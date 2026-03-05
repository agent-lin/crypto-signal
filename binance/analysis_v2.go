package binance

import (
	"fmt"
	"crypto-signal/models"
	"crypto-signal/services"
	"time"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// RunDayTradingAnalysisV2 from qwen (Refactored for Trend+Momentum)
func (m *Exchange) RunDayTradingAnalysisV2(db *gorm.DB, symbol string, currentFunding, currentPrice float64) (*models.FundingRateRecord, error) {
	// 0. 基础去重 (4小时内不重复报同一个币)
	if services.HasSignalInLastDuration(db, symbol, 4*time.Hour) {
		return nil, nil
	}

	// 1. 获取 K 线数据 (15m 和 1h)
	// 15m 用于具体入场信号
	klines15m, err := m.FetchKLines(symbol, "15m", 100)
	if err != nil || len(klines15m) < 60 {
		return nil, nil
	}
	// 1h 用于大趋势判断
	klines1h, err := m.FetchKLines(symbol, "1h", 100)
	if err != nil || len(klines1h) < 60 {
		return nil, nil
	}

	// 2. 数据转换
	prices15m, volumes15m, _, _ := convertKLines(klines15m)
	prices1h, _, _, _ := convertKLines(klines1h)

	idx15 := len(prices15m) - 1
	idx1h := len(prices1h) - 1

	// 3. 计算技术指标 (15m)
	ema21_15 := calculateEMA(prices15m, 21)
	ema50_15 := calculateEMA(prices15m, 50)
	rsi15 := calculateRSI(prices15m, 14)
	volSma20_15 := calculateSMA(volumes15m, 20)
	macdLine15, macdSignal15, macdHist15 := calculateMACD(prices15m)

	// 计算技术指标 (1h) - 仅需 EMA 判断趋势
	ema21_1h := calculateEMA(prices1h, 21)
	ema50_1h := calculateEMA(prices1h, 50)

	// 4. 核心策略逻辑
	var side string = "NONE"
	var signalLevel string = "B"
	var signalTag string
	var score float64 = 0

	// ------------------------------------------------------
	// 趋势判断 (Trend Filter)
	// ------------------------------------------------------
	// 1H 趋势必须配合
	is1hBullish := prices1h[idx1h].GreaterThan(ema50_1h[idx1h]) && ema21_1h[idx1h].GreaterThan(ema50_1h[idx1h])
	is1hBearish := prices1h[idx1h].LessThan(ema50_1h[idx1h]) && ema21_1h[idx1h].LessThan(ema50_1h[idx1h])

	// 15m 趋势结构
	is15mBullStruct := prices15m[idx15].GreaterThan(ema21_15[idx15]) && ema21_15[idx15].GreaterThan(ema50_15[idx15])
	is15mBearStruct := prices15m[idx15].LessThan(ema21_15[idx15]) && ema21_15[idx15].LessThan(ema50_15[idx15])

	// ------------------------------------------------------
	// 动能与过滤器 (Momentum & Filters)
	// ------------------------------------------------------
	currentRSI := rsi15[idx15]
	currentVol := volumes15m[idx15]
	avgVol := volSma20_15[idx15]

	// 确保有成交量支持 (当前成交量 > 0.8 * 均量，或者相对平稳)
	isVolHealthy := !avgVol.IsZero() && currentVol.Div(avgVol).GreaterThan(decimal.NewFromFloat(0.8))

	// MACD 确认
	isMacdBullish := macdHist15[idx15].GreaterThan(decimal.Zero) && macdHist15[idx15].GreaterThan(macdHist15[idx15-1])
	isMacdBearish := macdHist15[idx15].LessThan(decimal.Zero) && macdHist15[idx15].LessThan(macdHist15[idx15-1])

	// ------------------------------------------------------
	// 做多逻辑 (LONG)
	// ------------------------------------------------------
	if is1hBullish && is15mBullStruct && isVolHealthy {
		// RSI 过滤: 45 < RSI < 75 (避免超买，但要有动能)
		if currentRSI.GreaterThan(decimal.NewFromInt(45)) && currentRSI.LessThan(decimal.NewFromInt(75)) {
			// MACD 动能增强 或 金叉状态 (Line > Signal)
			if isMacdBullish || macdLine15[idx15].GreaterThan(macdSignal15[idx15]) {
				side = "LONG"
				signalTag = "Trend Long (顺势多)"
				score = 1.0
			}
		}
	}

	// ------------------------------------------------------
	// 做空逻辑 (SHORT)
	// ------------------------------------------------------
	if is1hBearish && is15mBearStruct && isVolHealthy {
		// RSI 过滤: 25 < RSI < 55
		if currentRSI.GreaterThan(decimal.NewFromInt(25)) && currentRSI.LessThan(decimal.NewFromInt(55)) {
			// MACD 动能增强 或 死叉状态 (Line < Signal)
			if isMacdBearish || macdLine15[idx15].LessThan(macdSignal15[idx15]) {
				side = "SHORT"
				signalTag = "Trend Short (顺势空)"
				score = 1.0
			}
		}
	}

	// 特殊过滤：资金费率反向交易 (Funding Rate Filter)
	if side == "LONG" && currentFunding > 0.05 {
		side = "NONE" // 费率过热
	}
	if side == "SHORT" && currentFunding < -0.05 {
		side = "NONE" // 费率过冷
	}

	if side == "NONE" {
		return nil, nil
	}

	// ------------------------------------------------------
	// 5. 强庄/逼空检查 (Whale Logic Booster)
	// ------------------------------------------------------
	isCornered := false
	oiToMcRatio := decimal.Zero
	marketCap := decimal.Zero

	// 获取 OI 数据
	oiHistory, err := m.FetchOpenInterestHistory(symbol, "1h", 8)
	if err == nil && len(oiHistory) >= 6 {
		oiLast := oiHistory[len(oiHistory)-1]
		oiCurrent, _ := decimal.NewFromString(oiLast.SumOpenInterestValue)
		// supply, _ := decimal.NewFromString(oiLast.CMCCirculatingSupply)

		// if !supply.IsZero() {
		// 	marketCap = prices15m[idx15].Mul(supply)
		// 	oiToMcRatio = oiCurrent.Div(marketCap)
		// }

		// 判断控盘度 > 0.5
		if oiToMcRatio.GreaterThan(decimal.NewFromFloat(0.5)) {
			isCornered = true
			signalLevel = "S"
			score += 2.0
			if side == "LONG" {
				signalTag = "🐳 WHALE PUMP (强庄拉升)"
			} else {
				signalTag = "🩸 WHALE DUMP (强庄出货)"
			}
		} else {
			// OI 异动加分
			oiPrev4, _ := decimal.NewFromString(oiHistory[len(oiHistory)-5].SumOpenInterestValue)
			if !oiPrev4.IsZero() {
				oiChange := oiCurrent.Sub(oiPrev4).Div(oiPrev4)
				if oiChange.GreaterThan(decimal.NewFromFloat(0.05)) { // 4小时增仓5%
					score += 0.5
					signalLevel = "A"
				}
			}
		}
	}

	// ------------------------------------------------------
	// 6. 止损止盈计算 (Risk Management)
	// ------------------------------------------------------
	atr15 := calculateATR(klines15m, 14)
	currentATR := atr15[idx15]
	var finalStopLoss, takeProfit decimal.Decimal
	var targetRRR float64 = 2.0

	if isCornered {
		targetRRR = 4.0
	} else if score >= 1.5 {
		targetRRR = 2.5
	}

	entryPrice := prices15m[idx15]

	if side == "LONG" {
		// 止损逻辑： EMA50下方0.5% 和 近期低点 取较小值(为了不被打损，取较大的StopLossPrice即较小的Risk是错的，应该取较远的StopLoss)
		// 实际上为了安全，StopLoss 应该是 min(SwingLow, EMA50) ? No, that's wider.
		// Let's use SwingLow - 0.5 ATR.
		lowMin := getLowestLow(klines15m, idx15-5, idx15)
		slByLow := lowMin.Sub(currentATR.Mul(decimal.NewFromFloat(0.5)))

		finalStopLoss = slByLow

		// 检查止损百分比，最小 0.6%
		stopLossPercent := entryPrice.Sub(finalStopLoss).Div(entryPrice)
		if stopLossPercent.LessThan(decimal.NewFromFloat(0.006)) {
			finalStopLoss = entryPrice.Mul(decimal.NewFromFloat(0.994))
		}

		risk := entryPrice.Sub(finalStopLoss)
		takeProfit = entryPrice.Add(risk.Mul(decimal.NewFromFloat(targetRRR)))

	} else { // SHORT
		// 止损逻辑： SwingHigh + 0.5 ATR
		highMax := getHighestHigh(klines15m, idx15-5, idx15)
		slByHigh := highMax.Add(currentATR.Mul(decimal.NewFromFloat(0.5)))

		finalStopLoss = slByHigh

		stopLossPercent := finalStopLoss.Sub(entryPrice).Div(entryPrice)
		if stopLossPercent.LessThan(decimal.NewFromFloat(0.006)) {
			finalStopLoss = entryPrice.Mul(decimal.NewFromFloat(1.006))
		}

		risk := finalStopLoss.Sub(entryPrice)
		takeProfit = entryPrice.Sub(risk.Mul(decimal.NewFromFloat(targetRRR)))
	}

	// ------------------------------------------------------
	// 7. 输出与记录
	// ------------------------------------------------------
	icon := "🟢"
	if side == "SHORT" {
		icon = "🔴"
	}
	if isCornered {
		icon = "🐳"
	}

	fmt.Printf("\n%s [%s] 信号: %s | %s \n", icon, signalLevel, symbol, side)
	fmt.Printf("   📊 策略: %s | 评分: %.1f\n", signalTag, score)
	fmt.Printf("   💰 现价: %s -> TP: %s | SL: %s (RRR: %.1f)\n",
		prices15m[idx15].StringFixed(4), takeProfit.StringFixed(4), finalStopLoss.StringFixed(4), targetRRR)

	record := models.FundingRateRecord{
		Symbol:           symbol,
		FundingRate:      currentFunding,
		LastFundingRate:  currentFunding,
		MarkPrice:        prices15m[idx15].InexactFloat64(),
		Price:            prices15m[idx15].InexactFloat64(),
		Side:             side,
		SignalTag:        signalTag,
		VolumeSurgeRatio: currentVol.Div(avgVol).InexactFloat64(),
		StopLoss:         finalStopLoss.InexactFloat64(),
		TakeProfit:       takeProfit.InexactFloat64(),
		Rrr:              targetRRR,
		Score:            100 + score*10,
		CurrentRSI:       currentRSI.InexactFloat64(),
		MarketCap:        marketCap.InexactFloat64(),
		OiToMcRatio:      oiToMcRatio.InexactFloat64(),
		CaptureTime:      time.Now(),
	}

	return &record, services.SaveFundingRecord(db, record)
}
