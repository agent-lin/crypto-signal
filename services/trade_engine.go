package services

import (
	"crypto-signal/models"
	"fmt"
	"log"
	"time"

	"gorm.io/gorm"
)

type TradeEngine struct {
	db *gorm.DB
}

func NewTradeEngine(db *gorm.DB) *TradeEngine {
	return &TradeEngine{db: db}
}

// ExecuteBuy - 执行买入（开仓）
func (t *TradeEngine) ExecuteBuy(signal *models.FundingRateRecord) error {
	if signal == nil || signal.Side == "NONE" {
		return nil
	}

	trade := &models.SimulatedTrade{
		SignalID:        signal.ID,
		Symbol:          signal.Symbol,
		Side:            signal.Side,
		EntryPrice:      signal.Price,
		EntryTime:       time.Now(),
		PositionSize:    100, // 默认 100 USDT
		Leverage:        1,
		StopLossPrice:   signal.StopLoss,
		TakeProfitPrice: signal.TakeProfit,
		IsActive:        true,
	}

	return t.db.Create(trade).Error
}

// CheckExitConditions - 检查出场条件
func (t *TradeEngine) CheckExitConditions(currentPrice float64) error {
	var activeTrades []models.SimulatedTrade
	if err := t.db.Where("is_active = ?", true).Find(&activeTrades).Error; err != nil {
		return err
	}

	for i := range activeTrades {
		trade := &activeTrades[i]
		shouldExit := false
		exitReason := ""

		// 检查止盈
		if trade.Side == "LONG" && currentPrice >= trade.TakeProfitPrice {
			shouldExit = true
			exitReason = "TAKE_PROFIT"
		} else if trade.Side == "SHORT" && currentPrice <= trade.TakeProfitPrice {
			shouldExit = true
			exitReason = "TAKE_PROFIT"
		}

		// 检查止损
		if trade.Side == "LONG" && currentPrice <= trade.StopLossPrice {
			shouldExit = true
			exitReason = "STOP_LOSS"
		} else if trade.Side == "SHORT" && currentPrice >= trade.StopLossPrice {
			shouldExit = true
			exitReason = "STOP_LOSS"
		}

		// 检查持仓时间超过 24 小时
		if time.Since(trade.EntryTime).Hours() > 24 && !shouldExit {
			shouldExit = true
			exitReason = "TIME_EXIT"
		}

		if shouldExit {
			if err := t.ExecuteSell(trade, currentPrice, exitReason); err != nil {
				log.Printf("执行卖出失败 %s: %v", trade.Symbol, err)
			}
		}
	}

	return nil
}

// ExecuteSell - 执行卖出（平仓）
func (t *TradeEngine) ExecuteSell(trade *models.SimulatedTrade, exitPrice float64, reason string) error {
	now := time.Now()
	trade.ExitPrice = &exitPrice
	trade.ExitTime = &now
	trade.ExitReason = reason
	trade.IsActive = false

	// 计算盈亏
	if trade.Side == "LONG" {
		trade.PnlPercent = (exitPrice - trade.EntryPrice) / trade.EntryPrice * 100
	} else {
		trade.PnlPercent = (trade.EntryPrice - exitPrice) / trade.EntryPrice * 100
	}

	// 计算盈亏金额 (考虑杠杆)
	trade.PnlUSDT = trade.PositionSize * trade.PnlPercent / 100 * float64(trade.Leverage)

	fmt.Printf("💰 [平仓] %s %s | 入场：%.4f | 出场：%.4f | 盈亏：%.2f%% (%.2f USDT) | 原因：%s\n",
		trade.Symbol, trade.Side, trade.EntryPrice, exitPrice, trade.PnlPercent, trade.PnlUSDT, reason)

	return t.db.Save(trade).Error
}

// UpdateUnrealizedPnl - 更新未实现盈亏
func (t *TradeEngine) UpdateUnrealizedPnl(symbol string, currentPrice float64) error {
	var trade models.SimulatedTrade
	if err := t.db.Where("symbol = ? AND is_active = ?", symbol, true).First(&trade).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil
		}
		return err
	}

	// 计算未实现盈亏
	var unrealizedPnl float64
	if trade.Side == "LONG" {
		unrealizedPnl = (currentPrice - trade.EntryPrice) / trade.EntryPrice * 100
	} else {
		unrealizedPnl = (trade.EntryPrice - currentPrice) / trade.EntryPrice * 100
	}

	// 更新最大浮盈和最大回撤
	if unrealizedPnl > trade.MaxProfit {
		trade.MaxProfit = unrealizedPnl
	}
	if unrealizedPnl < trade.MaxDrawdown {
		trade.MaxDrawdown = unrealizedPnl
	}

	return t.db.Save(&trade).Error
}

// GetTradeStats - 获取交易统计
func (t *TradeEngine) GetTradeStats() (*models.TradeStats, error) {
	stats := &models.TradeStats{}

	// 总交易数
	var totalTrades, activeTrades, winingTrades, losingTrades int64
	t.db.Model(&models.SimulatedTrade{}).Where("exit_reason != ''").Count(&totalTrades)
	t.db.Model(&models.SimulatedTrade{}).Where("is_active = ?", true).Count(&activeTrades)
	t.db.Model(&models.SimulatedTrade{}).Where("pnl_percent > 0").Count(&winingTrades)
	t.db.Model(&models.SimulatedTrade{}).Where("pnl_percent < 0").Count(&losingTrades)
	
	stats.TotalTrades = int(totalTrades)
	stats.ActiveTrades = int(activeTrades)
	stats.WiningTrades = int(winingTrades)
	stats.LosingTrades = int(losingTrades)

	// 胜率
	if stats.TotalTrades > 0 {
		stats.WinRate = float64(stats.WiningTrades) / float64(stats.TotalTrades) * 100
	}

	// 总盈亏
	var totalPnl float64
	t.db.Model(&models.SimulatedTrade{}).Where("exit_reason != ''").Select("COALESCE(SUM(pnl_usdt), 0)").Scan(&totalPnl)
	stats.TotalPnlUSDT = totalPnl

	// 平均盈利/亏损
	var avgWin, avgLoss float64
	t.db.Model(&models.SimulatedTrade{}).Where("pnl_percent > 0").Select("COALESCE(AVG(pnl_percent), 0)").Scan(&avgWin)
	t.db.Model(&models.SimulatedTrade{}).Where("pnl_percent < 0").Select("COALESCE(AVG(pnl_percent), 0)").Scan(&avgLoss)
	stats.AvgWinPercent = avgWin
	stats.AvgLossPercent = avgLoss

	// 盈利因子
	if avgLoss != 0 {
		stats.ProfitFactor = avgWin / -avgLoss
	}

	// 最佳/最差交易
	t.db.Model(&models.SimulatedTrade{}).Where("exit_reason != ''").Order("pnl_percent DESC").Limit(1).Pluck("pnl_percent", &stats.BestTrade)
	t.db.Model(&models.SimulatedTrade{}).Where("exit_reason != ''").Order("pnl_percent ASC").Limit(1).Pluck("pnl_percent", &stats.WorstTrade)

	return stats, nil
}

// GetActiveTrades - 获取当前持仓
func (t *TradeEngine) GetActiveTrades() ([]models.SimulatedTrade, error) {
	var trades []models.SimulatedTrade
	err := t.db.Where("is_active = ?", true).Order("entry_time DESC").Find(&trades).Error
	return trades, err
}

// GetTradeHistory - 获取交易历史
func (t *TradeEngine) GetTradeHistory(limit int) ([]models.SimulatedTrade, error) {
	var trades []models.SimulatedTrade
	err := t.db.Where("exit_reason != ''").Order("exit_time DESC").Limit(limit).Find(&trades).Error
	return trades, err
}
