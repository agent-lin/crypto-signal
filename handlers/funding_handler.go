// handlers/funding_handler.go
package handlers

import (
	"errors"
	"fmt"
	"crypto-signal/binance"
	"crypto-signal/services"
	"crypto-signal/types"
	"log"
	"net/http"
	"strconv"
	"sync"
	"time"

	"crypto-signal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type FundingHandler struct {
	DB          *gorm.DB
	Ex          *binance.Exchange
	lastMsgID   int
	tickerCache sync.Map // key: symbol, value: *CacheEntry
}

// GetLatestRecords 获取每个交易对的最新记录（用于看盘）
func (h *FundingHandler) GetLatestRecords(c *gin.Context) {
	var records []models.FundingRateRecord
	sort := c.Query("sort")
	sortField := c.Query("sortField")

	if sort == "" {
		sort = "ASC"
	}

	if sortField == "" {
		sortField = "funding_rate"
	} else {
		sortField = types.CamelToSnake(sortField)
	}

	err := h.DB.Raw(fmt.Sprintf(`
SELECT *
FROM funding_rate_records frr1
INNER JOIN (
    SELECT symbol, MAX(capture_time) as max_time
    FROM funding_rate_records
    GROUP BY symbol
) frr2 ON frr1.symbol = frr2.symbol AND frr1.capture_time = frr2.max_time
ORDER BY frr1.%s %s 
LIMIT 50;
	`, sortField, sort)).Scan(&records).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}

	c.JSON(http.StatusOK, records)
}

func (h *FundingHandler) UpdateSignalPriceChange(db *gorm.DB) {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	update := func() error {
		signals, err := services.GetTopSignalsLastHours(h.DB, 4)
		if err != nil {
			return err
		}

		for _, s := range signals {
			premiumIndex, err := h.Ex.FetchPremiumIndex(s.Symbol)
			if err != nil {
				log.Printf("query premdium index: %v", err)
				continue
			}

			s.MarkPrice, _ = strconv.ParseFloat(premiumIndex[0].MarkPrice, 64)
			s.LastFundingRate, _ = strconv.ParseFloat(premiumIndex[0].LastFundingRate, 64)
			s.PriceChangeAfterSignal = (s.MarkPrice - s.Price) * 100 / s.Price
			s.FundingRateChangeAfterSignal = (s.LastFundingRate - s.FundingRate) * 100 / s.FundingRate

			lines, err := h.Ex.FetchKLines(s.Symbol, "1h", 24)
			if err != nil {
				log.Printf("query kline 1h: %v\n", err)
				//continue
			}

			if len(lines) > 0 {
				s.Is24HrHigh = binance.IsLatestHighTheHighest(lines)
			}

			if err = h.DB.Model(&models.FundingRateRecord{}).
				Where("id = ?", s.ID).
				Update("markPrice", s.MarkPrice).
				Update("lastFundingRate", s.LastFundingRate).
				Update("priceChangeAfterSignal", s.PriceChangeAfterSignal).
				Update("fundingRateChangeAfterSignal", s.FundingRateChangeAfterSignal).
				Update("is24HrHigh", s.Is24HrHigh).Error; err != nil {
				log.Printf("update signal err: %v\n", err)
				continue
			}

			sinceSignal := time.Now().Sub(s.CaptureTime)
			markPrice := s.MarkPrice
			if sinceSignal <= 4*time.Hour { //(bt.Price4h == nil && sinceSignal >= 4*time.Hour) {
				pnl := calculatePnL(s.Side, s.Price, s.MarkPrice)
				hitTakeProfit := false
				hitStopLoss := false

				// 检查是否触发止盈/止损（这里简化：只要价格越过就标记）
				if (s.Side == "LONG" && markPrice >= s.TakeProfit) ||
					(s.Side == "SHORT" && markPrice <= s.TakeProfit) {
					hitTakeProfit = true
				} else if (s.Side == "LONG" && markPrice <= s.StopLoss) ||
					(s.Side == "SHORT" && markPrice >= s.StopLoss) {
					hitStopLoss = true
				}

				if err := h.DB.Model(&models.BackTestResult{}).
					Where("signal_id = ?", s.ID).
					Update("pnl4h", pnl).
					Update("hit_take_profit", hitTakeProfit).
					Update("hit_stop_loss", hitStopLoss).
					Update("price4h", s.MarkPrice).Error; err != nil {
					log.Printf("update back test err: %v\n", err)
				}
			}

		}

		return nil
	}

	for {
		select {
		case <-ticker.C:
			log.Printf("start to update signal")
			if err := update(); err != nil {
				log.Printf("query faild: %v", err)
			}
		}
	}
}

// GetLatestWithVolumeSurge 返回所有交易对中“最新记录”且“成交量放大”的数据
func (h *FundingHandler) GetLatestWithVolumeSurge(c *gin.Context) {
	signals, err := services.GetTopSignalsLastHours(h.DB, 4)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"count":   len(signals),
		"records": signals,
	})
}

// CacheEntry 通用缓存条目
type CacheEntry struct {
	Data      interface{}
	ExpiresAt time.Time
}

func (h *FundingHandler) GetTicker24Hr(c *gin.Context) {
	symbol := c.Query("symbol")
	if symbol == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "symbol is required"})
		return
	}

	now := time.Now()
	cacheKey := symbol

	// 1. 尝试从缓存读取
	if cached, ok := h.tickerCache.Load(cacheKey); ok {
		entry := cached.(*CacheEntry)
		if now.Before(entry.ExpiresAt) {
			// 缓存命中
			c.JSON(http.StatusOK, gin.H{"ticker": entry.Data})
			return
		}
	}

	// 2. 缓存未命中或已过期 → 调用交易所 API
	ticker, err := h.Ex.FetchTicker24H(symbol)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}

	// 3. 写入缓存（有效期1分钟）
	entry := &CacheEntry{
		Data:      ticker,
		ExpiresAt: now.Add(1 * time.Minute),
	}
	h.tickerCache.Store(cacheKey, entry)

	// 4. 返回结果
	c.JSON(http.StatusOK, gin.H{"ticker": ticker})
}

// RunBacktestUpdate 每30分钟运行一次，更新回测结果
func (h *FundingHandler) RunBacktestUpdate() error {
	now := time.Now()

	// 1. 查询最近24小时内产生的信号
	signals, err := services.GetTopSignalsLastHours(h.DB, 26)
	if err != nil {
		return err
	}

	for _, signal := range signals {
		// 2. 查找或创建对应的回测记录
		var bt models.BackTestResult
		err := h.DB.Where("signal_id = ?", signal.ID).First(&bt).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// 创建新回测记录
			bt = models.BackTestResult{
				SignalID:         signal.ID,
				Symbol:           signal.Symbol,
				Side:             signal.Side,
				SignalPrice:      signal.Price, // 注意：你结构体中是 Price
				FundingRate:      signal.FundingRate,
				VolumeSurgeRatio: signal.VolumeSurgeRatio,
				MarketCap:        signal.MarketCap,
				OiToMcRatio:      signal.OiToMcRatio,
				StopLoss:         signal.StopLoss,
				TakeProfit:       signal.TakeProfit,
				Rrr:              signal.Rrr,
				CaptureTime:      signal.CaptureTime,
			}
			if err := h.DB.Create(&bt).Error; err != nil {
				log.Printf("create backtest record failed: %v", err)
				continue
			}
		} else if err != nil {
			log.Printf("query backtest record failed: %v", err)
			continue
		}

		// 3. 跳过已完成的（24h 已处理）
		if bt.Price24h != nil {
			continue
		}

		// 4. 计算时间差
		sinceSignal := now.Sub(signal.CaptureTime)

		// 5. 获取当前 MarkPrice
		premiumIndex, err := h.Ex.FetchPremiumIndex(signal.Symbol)
		if err != nil {
			log.Printf("query premium index for %s: %v", signal.Symbol, err)
			continue
		}
		if len(premiumIndex) == 0 {
			log.Printf("empty premium index for %s", signal.Symbol)
			continue
		}
		markPrice, err := strconv.ParseFloat(premiumIndex[0].MarkPrice, 64)
		if err != nil {
			log.Printf("parse mark price failed for %s: %v", signal.Symbol, err)
			continue
		}

		// 6. 检查 4h
		if sinceSignal <= 4*time.Hour { //(bt.Price4h == nil && sinceSignal >= 4*time.Hour) {
			pnl := calculatePnL(signal.Side, signal.Price, markPrice)
			bt.Price4h = &markPrice
			bt.Pnl4h = &pnl
			// 检查是否触发止盈/止损（这里简化：只要价格越过就标记）
			if !bt.HitTakeProfit && !bt.HitStopLoss {
				if (signal.Side == "LONG" && markPrice >= signal.TakeProfit) ||
					(signal.Side == "SHORT" && markPrice <= signal.TakeProfit) {
					bt.HitTakeProfit = true
				} else if (signal.Side == "LONG" && markPrice <= signal.StopLoss) ||
					(signal.Side == "SHORT" && markPrice >= signal.StopLoss) {
					bt.HitStopLoss = true
				}
			}
		}

		// 7. 检查 12h
		if bt.Price12h == nil && sinceSignal >= 12*time.Hour {
			pnl := calculatePnL(signal.Side, signal.Price, markPrice)
			bt.Price12h = &markPrice
			bt.Pnl12h = &pnl
			// 注意：止盈止损状态一旦触发不再改变（上面已处理）
		}

		// 8. 检查 24h
		if bt.Price24h == nil && sinceSignal >= 24*time.Hour {
			pnl := calculatePnL(signal.Side, signal.Price, markPrice)
			bt.Price24h = &markPrice
			bt.Pnl24h = &pnl
			completedAt := now
			bt.CompletedAt = &completedAt
		}

		// 9. 保存更新
		if err := h.DB.Save(&bt).Error; err != nil {
			log.Printf("update backtest record failed: %v", err)
		}
	}

	return nil
}

// calculatePnL 计算收益率（小数形式）
func calculatePnL(side string, entryPrice, currentPrice float64) float64 {
	if entryPrice == 0 {
		return 0
	}
	if side == "LONG" {
		return (currentPrice - entryPrice) / entryPrice
	} else {
		return (entryPrice - currentPrice) / entryPrice
	}
}

// handlers/funding_handler.go

func (h *FundingHandler) GetFundingHistory(c *gin.Context) {
	// 1. 解析分页参数
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))

	// 限制 pageSize 范围（防滥用）
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	if page <= 0 {
		page = 1
	}

	offset := (page - 1) * pageSize

	// 2. 查询总数
	var total int64
	h.DB.Model(&models.BackTestResult{}).Count(&total)

	// 3. 查询分页数据（按 capture_time 倒序）
	var records []models.BackTestResult
	err := h.DB.
		Order("capture_time DESC").
		Offset(offset).
		Limit(pageSize).
		Find(&records).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}

	// 4. 返回结果
	c.JSON(http.StatusOK, gin.H{
		"code":     0,
		"message":  "success",
		"data":     records,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
		"hasMore":  int64(offset+pageSize) < total,
	})
}
func (h *FundingHandler) GetStats(c *gin.Context) {
	stats, err := h.GetBacktestStats()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch stats"})
		return
	}
	c.JSON(http.StatusOK, stats)
}

func (r *FundingHandler) GetBacktestStats() ([]models.BacktestStat, error) {
	var results []models.BacktestStat

	sql := `
SELECT
    side,
    COUNT(*) AS total_signals,
    AVG(CASE WHEN hit_take_profit THEN 1 ELSE 0 END) AS win_rate,
    AVG(CASE WHEN hit_stop_loss THEN 1 ELSE 0 END) AS stop_loss_rate,
    AVG(pnl24h) AS avg_pnl_24h,
    AVG(CASE
        WHEN hit_take_profit THEN (take_profit - signal_price) / signal_price * 100
        WHEN hit_stop_loss THEN (stop_loss - signal_price) / signal_price * 100
        ELSE pnl24h
    END) AS avg_realized_pnl_pct,
    AVG(rrr) AS avg_rrr,
    AVG(funding_rate) AS avg_funding_rate,
    AVG(oi_to_mc_ratio) AS avg_oi_to_mc_ratio,
    AVG(market_cap) AS avg_market_cap,
    AVG(volume_surge_ratio) AS avg_volume_surge_ratio,
    AVG(CASE WHEN pnl24h > 0 THEN 1 ELSE 0 END) AS positive_pnl_24h_rate,
    AVG(pnl4h) AS avg_pnl_4h,
    AVG(pnl12h) AS avg_pnl_12h,
    MAX(pnl24h) AS max_pnl_24h,
    MIN(pnl24h) AS min_pnl_24h,
    SUM(CASE WHEN completed_at IS NULL THEN 1 ELSE 0 END) AS pending_signals
FROM back_test_results
WHERE pnl24h IS NOT NULL
GROUP BY side
WITH ROLLUP
`

	rows, err := r.DB.Raw(sql).Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var stat models.BacktestStat
		var side *string
		var avgPnL24h, avgRealizedPnLPct, avgPnL4h, avgPnL12h, maxPnL24h, minPnL24h *float64

		err := rows.Scan(
			&side,
			&stat.TotalSignals,
			&stat.WinRate,
			&stat.StopLossRate,
			&avgPnL24h,
			&avgRealizedPnLPct,
			&stat.AvgRRR,
			&stat.AvgFundingRate,
			&stat.AvgOiToMcRatio,
			&stat.AvgMarketCap,
			&stat.AvgVolumeSurgeRatio,
			&stat.PositivePnL24hRate,
			&avgPnL4h,
			&avgPnL12h,
			&maxPnL24h,
			&minPnL24h,
			&stat.PendingSignals,
		)
		if err != nil {
			return nil, err
		}

		stat.Side = side
		stat.AvgPnL24h = avgPnL24h
		stat.AvgRealizedPnLPct = avgRealizedPnLPct
		stat.AvgPnL4h = avgPnL4h
		stat.AvgPnL12h = avgPnL12h
		stat.MaxPnL24h = maxPnL24h
		stat.MinPnL24h = minPnL24h

		results = append(results, stat)
	}

	return results, nil
}
