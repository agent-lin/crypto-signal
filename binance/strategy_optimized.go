package binance

import (
	"context"
	"crypto-signal/models"
	"crypto-signal/services"
	"fmt"
	"strconv"
	"time"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// OptimizedStrategy - 优化后的策略
// 目标：提高胜率和盈亏比
func (m *Exchange) OptimizedStrategy(db *gorm.DB, symbol string, currentFunding, currentPrice float64) (*models.FundingRateRecord, error) {
	// ===== 优化点 1: 更严格的去重 =====
	// 8 小时内不重复报同一个币，避免过度交易
	if services.HasSignalInLastDuration(db, symbol, 8*time.Hour) {
		return nil, nil
	}

	// ===== 优化点 2: 多周期共振 =====
	// 15m - 入场时机
	// 1h - 中期趋势
	// 4h - 长期趋势
	klines15m, err := m.FetchKLines(symbol, "15m", 100)
	if err != nil || len(klines15m) < 60 {
		return nil, nil
	}
	klines1h, err := m.FetchKLines(symbol, "1h", 100)
	if err != nil || len(klines1h) < 60 {
		return nil, nil
	}
	klines4h, err := m.FetchKLines(symbol, "4h", 50)
	if err != nil || len(klines4h) < 30 {
		return nil, nil
	}

	prices15m, volumes15m, _, _ := convertKLines(klines15m)
	prices1h, _, ema21_1h, ema50_1h := convertKLines(klines1h)
	prices4h, _, ema21_4h, ema50_4h := convertKLines(klines4h)

	idx15 := len(prices15m) - 1
	idx1h := len(prices1h) - 1
	idx4h := len(prices4h) - 1

	// ===== 优化点 3: 严格趋势过滤 =====
	// 4H 定方向，1H 找时机，15m 入场
	is4hBullish := prices4h[idx4h].GreaterThan(ema21_4h[idx4h]) && ema21_4h[idx4h].GreaterThan(ema50_4h[idx4h])
	is4hBearish := prices4h[idx4h].LessThan(ema21_4h[idx4h]) && ema21_4h[idx4h].LessThan(ema50_4h[idx4h])

	is1hBullish := prices1h[idx1h].GreaterThan(ema21_1h[idx1h]) && ema21_1h[idx1h].GreaterThan(ema50_1h[idx1h])
	is1hBearish := prices1h[idx1h].LessThan(ema21_1h[idx1h]) && ema21_1h[idx1h].LessThan(ema50_1h[idx1h])

	// ===== 优化点 4: 技术指标优化 =====
	ema21_15 := calculateEMA(prices15m, 21)
	ema50_15 := calculateEMA(prices15m, 50)
	rsi15 := calculateRSI(prices15m, 14)
	volSma20_15 := calculateSMA(volumes15m, 20)
	_, _, macdHist15 := calculateMACD(prices15m)

	currentRSI := rsi15[idx15]
	currentVol := volumes15m[idx15]
	avgVol := volSma20_15[idx15]

	// 成交量必须放大（> 1.2 倍均量）
	isVolSurge := !avgVol.IsZero() && currentVol.Div(avgVol).GreaterThan(decimal.NewFromFloat(1.2))

	// MACD 确认
	isMacdBullish := macdHist15[idx15].GreaterThan(decimal.Zero) && macdHist15[idx15].GreaterThan(macdHist15[idx15-1])
	isMacdBearish := macdHist15[idx15].LessThan(decimal.Zero) && macdHist15[idx15].LessThan(macdHist15[idx15-1])

	// ===== 优化点 5: 高胜率做多条件 =====
	var side string = "NONE"
	var signalTag string
	var score float64 = 0

	// LONG: 4H 多 + 1H 多 + 15m 金叉 + 放量 + RSI 健康
	if is4hBullish && is1hBullish {
		if prices15m[idx15].GreaterThan(ema21_15[idx15]) && ema21_15[idx15].GreaterThan(ema50_15[idx15]) {
			if isVolSurge && isMacdBullish {
				// RSI 45-65 最佳（避免追高）
				if currentRSI.GreaterThan(decimal.NewFromInt(45)) && currentRSI.LessThan(decimal.NewFromInt(65)) {
					side = "LONG"
					signalTag = "🎯 High Win Rate Long (高胜率多)"
					score = 3.0 // 基础分 3 分
				}
			}
		}
	}

	// SHORT: 4H 空 + 1H 空 + 15m 死叉 + 放量 + RSI 健康
	if is4hBearish && is1hBearish {
		if prices15m[idx15].LessThan(ema21_15[idx15]) && ema21_15[idx15].LessThan(ema50_15[idx15]) {
			if isVolSurge && isMacdBearish {
				// RSI 35-55 最佳（避免杀跌）
				if currentRSI.GreaterThan(decimal.NewFromInt(35)) && currentRSI.LessThan(decimal.NewFromInt(55)) {
					side = "SHORT"
					signalTag = "🎯 High Win Rate Short (高胜率空)"
					score = 3.0
				}
			}
		}
	}

	// ===== 优化点 6: 资金费率过滤 =====
	if side == "LONG" && currentFunding > 0.03 {
		score -= 1.0
		signalTag += " (费率偏高)"
	}
	if side == "SHORT" && currentFunding < -0.03 {
		score -= 1.0
		signalTag += " (费率偏低)"
	}

	// ===== 优化点 7: 24h 涨跌幅过滤 =====
	price24hChange := m.FetchPriceChange24h(symbol)
	if price24hChange > 15.0 && side == "LONG" {
		side = "NONE"
	}
	if price24hChange < -15.0 && side == "SHORT" {
		side = "NONE"
	}

	if side == "NONE" || score < 2.0 {
		return nil, nil
	}

	// ===== 优化点 8: 动态止损止盈 =====
	priceDec := decimal.NewFromFloat(currentPrice)
	stopLossPct := decimal.NewFromFloat(0.02) // 2% 止损
	takeProfitPct := decimal.NewFromFloat(0.06) // 6% 止盈 (1:3 盈亏比)

	var stopLoss, takeProfit decimal.Decimal
	if side == "LONG" {
		stopLoss = priceDec.Mul(decimal.NewFromInt(1).Sub(stopLossPct))
		takeProfit = priceDec.Mul(decimal.NewFromInt(1).Add(takeProfitPct))
	} else {
		stopLoss = priceDec.Mul(decimal.NewFromInt(1).Add(stopLossPct))
		takeProfit = priceDec.Mul(decimal.NewFromInt(1).Sub(takeProfitPct))
	}

	// ===== 优化点 9: 评分系统 =====
	if currentVol.Div(avgVol).GreaterThan(decimal.NewFromFloat(2.0)) {
		score += 1.0
	}
	if (side == "LONG" && currentFunding < 0) || (side == "SHORT" && currentFunding > 0) {
		score += 0.5
	}

	// ===== 创建信号记录 =====
	currentRSIFloat, _ := currentRSI.Float64()
	stopLossFloat, _ := stopLoss.Float64()
	takeProfitFloat, _ := takeProfit.Float64()

	record := &models.FundingRateRecord{
		Symbol:          symbol,
		FundingRate:     currentFunding,
		Price:           currentPrice,
		Side:            side,
		SignalTag:       signalTag,
		Score:           score,
		CurrentRSI:      currentRSIFloat,
		StopLoss:        stopLossFloat,
		TakeProfit:      takeProfitFloat,
		Rrr:             3.0,
		CaptureTime:     time.Now(),
		MarkPrice:       currentPrice,
		LastFundingRate: currentFunding,
	}

	fmt.Printf("🎯 [OPTIMIZED] %s %s | Score: %.1f | RSI: %.2f | Funding: %.4f%%\n",
		symbol, signalTag, score, currentRSIFloat, currentFunding*100)

	return record, nil
}

// FetchPriceChange24h 获取 24h 涨跌幅
func (m *Exchange) FetchPriceChange24h(symbol string) float64 {
	tickers, err := m.FuturesClient.NewListPriceChangeStatsService().Symbol(symbol).Do(context.Background())
	if err != nil || len(tickers) == 0 {
		return 0
	}
	pct, _ := strconv.ParseFloat(tickers[0].PriceChangePercent, 64)
	return pct
}
