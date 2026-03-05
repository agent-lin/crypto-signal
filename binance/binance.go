package binance

import (
	"context"
	"fmt"
	"crypto-signal/models"
	"crypto-signal/services"
	"crypto-signal/telegram"
	"crypto-signal/types"
	"github.com/adshao/go-binance/v2"
	"github.com/adshao/go-binance/v2/futures"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
	"log"
	"math/big"
	"sort"
	"strconv"
	"time"
)

type Exchange struct {
	ID            string
	FuturesClient *futures.Client
	counter       int
}

func NewBinanceExchange(apiKey, secretKey string) *Exchange {
	return &Exchange{
		FuturesClient: binance.NewFuturesClient(apiKey, secretKey),
	}
}

func (m *Exchange) MonitorMarketFundingRate(db *gorm.DB) bool {
	log.Printf("🔍 开始扫描日内启动机会...\n")

	// 1. 获取所有市场数据
	rateInfos := m.LoadMarkets()
	log.Printf("成功获取 %d 个币对基础数据\n", len(rateInfos))

	// 2. 预筛选：过滤掉成交量太小或价格极低的币种（可选），这里按 24h 涨幅排序，优先看活跃的
	// 注意：这里需要你自己在 LoadMarkets 或其他地方获取 24h Change，如果没有，暂时不排序也可以
	// 这里演示按资金费率排序的逻辑保持不变，或者你可以改为随机乱序以防API限制

	m.counter++

	sort.Slice(rateInfos, func(i, j int) bool {
		//return rateInfos[i].Rate < rateInfos[j].Rate // 也可以改为绝对值排序
		if m.counter%2 == 0 {
			return rateInfos[i].Rate > rateInfos[j].Rate
		} else {
			return rateInfos[i].Rate < rateInfos[j].Rate
		}
	})

	fmt.Printf("📊 日内趋势策略监控 - %s\n", time.Now().Format("2006-01-02 15:04:05"))

	var signals []models.FundingRateRecord

	// 限制并发数量，避免 API 封禁，或者分批处理
	limit := 0
	for _, rateInfo := range rateInfos {
		fmt.Printf("%s 资金费率: %.2f 价格: %s\n", rateInfo.Symbol, rateInfo.Rate, rateInfo.MarkPrice)
		if limit > 50 { // 每次扫描前50个活跃的，避免请求过多
			break
		}

		//可以在这里加一个基础过滤，比如排除掉
		//if math.Abs(rateInfo.Rate) < 0.03 {
		//	continue
		//}

		currentPrice, _ := strconv.ParseFloat(rateInfo.MarkPrice, 64)
		signal, err := m.RunDayTradingAnalysisV2(db, rateInfo.Symbol, rateInfo.Rate, currentPrice)
		if err != nil {
			log.Printf("analysis error %s: %v\n", rateInfo.Symbol, err)
		}

		if signal != nil {
			signals = append(signals, *signal)
		}

		limit++
		// 稍微延时避免请求过快
		time.Sleep(50 * time.Millisecond)
	}

	if len(signals) == 0 {
		return false
	}

	telegram.SendSignalToTelegram("8112130036:AAFpPrHnkNhKlUs98__-LJaVX0xPS-rYjeM", "-5050174389", 0, signals)

	return true
}

func (m *Exchange) LoadMarkets() []types.RateInfo {
	res, err := m.FuturesClient.NewPremiumIndexService().Do(context.Background())
	if err != nil {
		return nil
	}

	var out []types.RateInfo
	for _, r := range res {
		rate, _ := strconv.ParseFloat(r.LastFundingRate, 64)
		out = append(out, types.RateInfo{
			Symbol:    r.Symbol,
			Rate:      rate * 100,
			MarkPrice: r.MarkPrice,
		})
	}

	return out
}

// RunDayTradingAnalysis 基于 [价格 + OI + 资金费率] 三要素的日内策略
func (m *Exchange) RunDayTradingAnalysis(db *gorm.DB, symbol string, currentFunding, currentPrice float64) (*models.FundingRateRecord, error) {
	// 0. 基础去重 (4小时内不重复报同一个币)
	if services.HasSignalInLastDuration(db, symbol, 4*time.Hour) {
		return nil, nil
	}

	// 1. 获取 K 线数据 (用于判断 价格方向)
	klines, err := m.FetchKLines(symbol, "15m", 100)
	if err != nil || len(klines) < 60 {
		return nil, nil
	}

	// 数据转换
	idx := len(klines) - 1
	prices := make([]decimal.Decimal, len(klines))
	volumes := make([]decimal.Decimal, len(klines))
	highs := make([]decimal.Decimal, len(klines))
	lows := make([]decimal.Decimal, len(klines))

	for i, k := range klines {
		prices[i], _ = decimal.NewFromString(k.Close)
		volumes[i], _ = decimal.NewFromString(k.QuoteAssetVolume)
		highs[i], _ = decimal.NewFromString(k.High)
		lows[i], _ = decimal.NewFromString(k.Low)
	}

	// ------------------------------------------------------
	// 第一步：判断【价格方向】(Price Direction)
	// ------------------------------------------------------
	ema7 := calculateEMA(prices, 7)
	ema21 := calculateEMA(prices, 21)
	ema55 := calculateEMA(prices, 55)
	volSma20 := calculateSMA(volumes, 20)
	rsi := calculateRSI(prices, 14)
	_, _, histogram := calculateMACD(prices)

	// 基础过滤：必须有成交量（爆量 > 2倍），否则视为无庄散户行情
	if volSma20[idx].IsZero() {
		return nil, nil
	}
	volumeSurgeRatio := volumes[idx].Div(volSma20[idx])
	if volumeSurgeRatio.LessThan(decimal.NewFromFloat(3.0)) {
		return nil, nil // 量能不够，直接跳过
	}

	if !IsVolumeSurgedInLast8(klines) {
		return nil, nil
	}

	var side string = "NONE"

	// A. 判断做多结构 (Price Up)
	// 均线多头 + 价格在均线上 + K线收盘在高位(实体饱满)
	isBullishTrend := ema21[idx].GreaterThan(ema55[idx]) && prices[idx].GreaterThan(ema21[idx]) && ema7[idx].GreaterThan(ema21[idx])
	highLowRange := highs[idx].Sub(lows[idx])
	closePos := prices[idx].Sub(lows[idx])
	isStrongBullClose := !highLowRange.IsZero() && closePos.Div(highLowRange).GreaterThan(decimal.NewFromFloat(0.65))
	currentRSI := rsi[idx]

	if isBullishTrend && isStrongBullClose {
		// EMA7 乖离率检查
		// 逻辑：(现价 - EMA7) / EMA7
		// 如果偏离超过 5% (0.05)，说明短线涨太猛了，有回调风险，放弃追高
		deviation := prices[idx].Sub(ema7[idx]).Div(ema7[idx])
		maxDeviation := decimal.NewFromFloat(0.05) // 阈值可调：5%

		if deviation.GreaterThan(maxDeviation) {
			// (可选) 打印日志方便调试
			// log.Printf("⚠️ 跳过 %s: 乖离率过高 (%.2f%% > 1.5%%)", symbol, deviation.Mul(decimal.NewFromInt(100)).InexactFloat64())
			return nil, nil
		}

		// 要求最近3根 histogram 递增
		isMACDExpanding := histogram[idx].GreaterThan(histogram[idx-1]) && histogram[idx-1].GreaterThan(histogram[idx-2])
		if !isMACDExpanding {
			return nil, nil
		}

		klines1H, err := m.FetchKLines(symbol, "1h", 100)
		if err != nil || len(klines) < 60 {
			return nil, nil
		}

		if !IsEMA7CrossAboveEMA21(klines1H) || !IsMACDHistogramExpandingInLast3(klines1H) {
			return nil, nil
		}

		side = "LONG"
	}

	// B. 判断做空结构 (Price Down)
	// 均线空头 + 价格在均线下 + K线收盘在低位(实体饱满)
	isBearishTrend := ema21[idx].LessThan(ema55[idx]) // && prices[idx].LessThan(ema21[idx])
	isStrongBearClose := !highLowRange.IsZero() && closePos.Div(highLowRange).LessThan(decimal.NewFromFloat(0.35))

	//📌 建议：只做两种空：
	//
	//资金费率 > 0.1% + OI ↑ + 价格破位（杀多）
	//强庄出货（OI/MC > 0.8 + 费率正 + 价格跌）

	if isStrongBearClose && isBearishTrend {
		// 做空乖离率检查 (现价低于 EMA7)
		// 逻辑：(EMA7 - 现价) / EMA7
		//deviation := ema7[idx].Sub(prices[idx]).Div(ema7[idx])
		//maxDeviation := decimal.NewFromFloat(0.5)
		//
		//if deviation.GreaterThan(maxDeviation) {
		//	return nil, nil
		//}

		side = "SHORT"
	}

	// 如果没有明确的方向，直接退出，不浪费 API 请求查 OI
	if side == "NONE" {
		return nil, nil
	}

	// ------------------------------------------------------
	// 第二步：判断【OI 变化】(Open Interest)
	// ------------------------------------------------------

	// 获取最近 1h 的 OI 数据
	oiHistory, err := m.FetchOpenInterestHistory(symbol, "1h", 8)
	if err != nil || len(oiHistory) < 8 {
		return nil, nil
	}

	oiIndex0, _ := decimal.NewFromString(oiHistory[0].SumOpenInterestValue)
	oiIndex5, _ := decimal.NewFromString(oiHistory[5].SumOpenInterestValue)
	oiIndex6, _ := decimal.NewFromString(oiHistory[6].SumOpenInterestValue)
	oiIndex7, _ := decimal.NewFromString(oiHistory[7].SumOpenInterestValue)

	oiCurrent, _ := decimal.NewFromString(oiHistory[len(oiHistory)-1].SumOpenInterestValue)
	//oiPrev, _ := decimal.NewFromString(oiHistory[len(oiHistory)-2].SumOpenInterest)

	// 计算 OI 变化百分比
	//oiChangePercent := decimal.Zero
	//if !oiPrev.IsZero() {
	//	oiChangePercent = oiCurrent.Sub(oiPrev).Div(oiPrev).Mul(decimal.NewFromInt(100))
	//}

	oiChangePercent := decimal.Zero
	if !oiIndex0.IsZero() {
		oiChangePercent = oiIndex7.Sub(oiIndex0).Div(oiIndex0).Mul(decimal.NewFromInt(100))
	}

	isOITrendUp := oiIndex5.LessThan(oiIndex6) && oiIndex6.LessThanOrEqual(oiIndex7)

	// 【核心过滤】：严格执行策略，只做 OI 增加的行情 (新资金进场)
	// 如果 OI 减少或增加不明显 (< 1.5%)，视为无效波动或止损盘，直接过滤
	if oiChangePercent.LessThan(decimal.NewFromFloat(3)) || !isOITrendUp {
		return nil, nil
	}

	// 计算 OI/MC 比率 (庄家控盘度)
	marketCap := decimal.Zero
	oiToMcRatio := decimal.Zero

	supply, _ := decimal.NewFromString(oiHistory[len(oiHistory)-1].CMCCirculatingSupply)
	if !supply.IsZero() {
		marketCap = prices[idx].Mul(supply) // 现价 * 流通量 = 市值
		oiToMcRatio = oiCurrent.Div(marketCap)
	}

	// ------------------------------------------------------
	// 第三步：结合【资金费率】定性 (Funding Rate)
	// ------------------------------------------------------

	isValidSignal := false
	signalTag := ""
	score := 0.0

	// 庄家控盘阈值
	isCornered := oiToMcRatio.GreaterThan(decimal.NewFromFloat(0.5))      // OI > 50% MC (强控盘)
	isSuperCornered := oiToMcRatio.GreaterThan(decimal.NewFromFloat(0.8)) // OI > 80% MC (极度妖币)

	//if !isCornered {
	//	return nil, nil
	//}

	if side == "LONG" {
		// 场景 1: 价格涨 + OI涨 + 费率正 = 顺势多
		if currentFunding > 0 {
			signalTag = "Trend Long (顺势)"
			isValidSignal = true
			score = 1.0
		} else {
			// 场景 2: 价格涨 + OI涨 + 费率负 = 逼空 (极佳)
			signalTag = "Short Squeeze (逼空)"
			isValidSignal = true
			score = 1.5 // 加分

			// 🔥 如果叠加了高控盘，这是送钱行情
			if isCornered {
				signalTag = "🔥 WHALE SQUEEZE (强庄逼空)"
				score = 3.0 // 满分信号
			}
		}
	} else if side == "SHORT" {
		// 场景 3: 价格跌 + OI涨 + 费率负 = 顺势空
		if currentFunding < 0 {
			signalTag = "Trend Short (顺势)"
			isValidSignal = true
			score = 1.0
		} else if currentFunding > 0.01 { // 费率显著为正
			// 场景 4: 价格跌 + OI涨 + 费率正 = 多头爆仓/杀多
			signalTag = "Long Liquidation (杀多)"
			isValidSignal = true
			score = 1.5 //

			// 🔥 高控盘下的杀多往往是崩盘的开始
			if isCornered {
				signalTag = "🩸 WHALE DUMP (强庄出货)"
				score = 3.0
			}
		}
	}

	if !isValidSignal {
		return nil, nil
	}

	// ------------------------------------------------------
	// 第四步：计算止损止盈 (RRR)
	// ------------------------------------------------------

	atr := calculateATR(klines, 14)
	currentATR := atr[idx]

	// 基础盈亏比
	targetRRR := decimal.NewFromFloat(2.5)

	if score > 1.2 {
		targetRRR = decimal.NewFromFloat(4.0)
	} // 逼空/杀多行情看更远

	// 如果是强庄控盘 (OI/MC > 0.5)，波动会极度剧烈
	// 1. 放大止盈：庄家不拉倍数不走
	// 2. 放大止损：防止被庄家洗盘插针扫出去
	if isCornered || isSuperCornered {
		targetRRR = decimal.NewFromFloat(5.0) // 搏 1:5
		// 稍微放宽止损 buffer (0.5 ATR)，因为妖币插针深
		currentATR = currentATR.Mul(decimal.NewFromFloat(1.5))
	}

	var finalStopLoss, takeProfit, risk decimal.Decimal
	atrBuffer := currentATR.Mul(decimal.NewFromFloat(0.2))

	if side == "LONG" {
		swingLow := getLowestLow(klines, idx-5, idx)
		finalStopLoss = swingLow.Sub(atrBuffer) // 止损放在前低之下
		risk = prices[idx].Sub(finalStopLoss)
		takeProfit = prices[idx].Add(risk.Mul(targetRRR))
	} else {
		swingHigh := getHighestHigh(klines, idx-5, idx) // 需确保有此辅助函数
		finalStopLoss = swingHigh.Add(atrBuffer)        // 止损放在前高之上
		risk = finalStopLoss.Sub(prices[idx])
		takeProfit = prices[idx].Sub(risk.Mul(targetRRR))
	}

	if isCornered {
		// 强庄币：止损设在 EMA60 下方 1%
		finalStopLoss = ema55[idx].Mul(decimal.NewFromFloat(0.99))
	} else {
		// 普通币：用前低 + ATR
		swingLow := getLowestLow(klines, idx-5, idx)
		finalStopLoss = swingLow.Sub(currentATR.Mul(decimal.NewFromFloat(0.5)))
	}

	// ------------------------------------------------------
	// 第五步：保存与输出
	// ------------------------------------------------------

	// 颜色标记
	icon := "🟢"
	if side == "SHORT" {
		icon = "🔴"
	}
	if isCornered {
		icon = "🐳"
	} // 强庄图标

	fmt.Printf("\n%s 信号触发: %s [%s] \n", icon, symbol, side)
	fmt.Printf("   📊 逻辑: %s | 费率 %.4f%%\n", signalTag, currentFunding)
	fmt.Printf("   💣 控盘度: OI/MC=%.2f\n", oiToMcRatio.InexactFloat64())
	fmt.Printf("   💰 现价: %s -> 目标: %s (RRR: %.1f)\n", prices[idx].StringFixed(4), takeProfit.StringFixed(4), targetRRR.InexactFloat64())
	fmt.Println("   -------------------------------------")

	input := models.FundingRateRecord{
		Symbol:             symbol,
		FundingRate:        currentFunding,
		LastFundingRate:    currentFunding,
		MarkPrice:          prices[idx].InexactFloat64(),
		Price:              prices[idx].InexactFloat64(),
		Side:               side,
		SignalTag:          signalTag,
		VolumeSurgeRatio:   volumeSurgeRatio.InexactFloat64(),
		OpenInterestChange: oiChangePercent.InexactFloat64(),
		StopLoss:           finalStopLoss.InexactFloat64(),
		TakeProfit:         takeProfit.InexactFloat64(),
		Rrr:                targetRRR.InexactFloat64(),
		Score:              100 + score*10,
		CurrentRSI:         currentRSI.InexactFloat64(),
		MarketCap:          marketCap.InexactFloat64(),
		OiToMcRatio:        oiToMcRatio.InexactFloat64(),
		CaptureTime:        time.Now(),
	}

	return &input, services.SaveFundingRecord(db, input)
}

// ----------------------------------------------------------------
// 辅助计算函数库
// ----------------------------------------------------------------

// convertKLines 将原始K线数据转换为 decimal.Decimal 切片，方便计算
// 返回：价格（Close）、成交额（QuoteAssetVolume）、最高价、最低价
func convertKLines(klines []*futures.Kline) (
	prices []decimal.Decimal,
	volumes []decimal.Decimal,
	highs []decimal.Decimal,
	lows []decimal.Decimal,
) {
	n := len(klines)
	prices = make([]decimal.Decimal, n)
	volumes = make([]decimal.Decimal, n)
	highs = make([]decimal.Decimal, n)
	lows = make([]decimal.Decimal, n)

	for i, k := range klines {
		// 安全转换：若解析失败，默认为0（后续逻辑会过滤）
		closePrice, err := decimal.NewFromString(k.Close)
		if err != nil {
			closePrice = decimal.Zero
		}
		quoteVol, err := decimal.NewFromString(k.QuoteAssetVolume)
		if err != nil {
			quoteVol = decimal.Zero
		}
		high, err := decimal.NewFromString(k.High)
		if err != nil {
			high = decimal.Zero
		}
		low, err := decimal.NewFromString(k.Low)
		if err != nil {
			low = decimal.Zero
		}

		prices[i] = closePrice
		volumes[i] = quoteVol
		highs[i] = high
		lows[i] = low
	}

	return prices, volumes, highs, lows
}

// 新增函数：检查最近3根K线是否构成“回踩EMA21不破 + 放量阳线”
func isPullbackAndSurge(klines []*futures.Kline, ema21, volumes, volSma20 []decimal.Decimal) bool {
	n := len(klines) - 1
	if n < 2 {
		return false
	}

	// 1. 最近一根是放量阳线
	close, _ := decimal.NewFromString(klines[n].Close)
	open, _ := decimal.NewFromString(klines[n].Open)
	if close.LessThanOrEqual(open) {
		return false
	}
	if volumes[n].Div(volSma20[n]).LessThan(decimal.NewFromFloat(2.0)) {
		return false
	}

	// 2. 前1-2根回踩但不破EMA21
	low1, _ := decimal.NewFromString(klines[n-1].Low)
	if low1.LessThan(ema21[n-1]) {
		return false
	}
	low2, _ := decimal.NewFromString(klines[n-2].Low)
	if low2.LessThan(ema21[n-2]) {
		return false
	}

	return true
}

func isStrongBearClose(high, low, close decimal.Decimal) bool {
	rangeHL := high.Sub(low)
	closePos := close.Sub(low)
	return !rangeHL.IsZero() && closePos.Div(rangeHL).LessThan(decimal.NewFromFloat(0.35))
}

// getHighestHigh 获取指定范围内 K 线的最高价 (用于做空止损 - Swing High)
func getHighestHigh(klines []*futures.Kline, startIdx, endIdx int) decimal.Decimal {
	if startIdx < 0 {
		startIdx = 0
	}
	if endIdx >= len(klines) {
		endIdx = len(klines) - 1
	}

	highest, _ := decimal.NewFromString(klines[endIdx].High)

	for i := endIdx; i >= startIdx; i-- {
		high, err := decimal.NewFromString(klines[i].High)
		if err != nil {
			continue
		}
		if high.GreaterThan(highest) {
			highest = high
		}
	}
	return highest
}

// calculateBollingerBands 计算布林带
func calculateBollingerBands(prices []decimal.Decimal, period int, k float64) ([]decimal.Decimal, []decimal.Decimal, []decimal.Decimal) {
	n := len(prices)
	upper := make([]decimal.Decimal, n)
	middle := make([]decimal.Decimal, n) // 其实就是 SMA
	lower := make([]decimal.Decimal, n)

	if n < period {
		return upper, middle, lower
	}

	sma := calculateSMA(prices, period)
	kDec := decimal.NewFromFloat(k)

	for i := period - 1; i < n; i++ {
		// 计算标准差
		sum := decimal.Zero
		for j := 0; j < period; j++ {
			diff := prices[i-j].Sub(sma[i])
			sum = sum.Add(diff.Mul(diff))
		}
		variance := sum.Div(decimal.NewFromInt(int64(period)))
		stdDev := variance.Pow(decimal.NewFromFloat(0.5))

		middle[i] = sma[i]
		upper[i] = middle[i].Add(stdDev.Mul(kDec))
		lower[i] = middle[i].Sub(stdDev.Mul(kDec))
	}
	return upper, middle, lower
}

// getLowestLow 获取指定范围内 K 线的最低价 (寻找 Swing Low)
func getLowestLow(klines []*futures.Kline, startIdx, endIdx int) decimal.Decimal {
	if startIdx < 0 {
		startIdx = 0
	}
	if endIdx >= len(klines) {
		endIdx = len(klines) - 1
	}

	lowest, _ := decimal.NewFromString(klines[endIdx].Low)

	for i := endIdx; i >= startIdx; i-- {
		low, err := decimal.NewFromString(klines[i].Low)
		if err != nil {
			continue
		}
		if low.LessThan(lowest) {
			lowest = low
		}
	}
	return lowest
}

// calculateSMA 计算简单移动平均
func calculateSMA(data []decimal.Decimal, period int) []decimal.Decimal {
	out := make([]decimal.Decimal, len(data))
	if len(data) < period {
		return out
	}
	for i := period - 1; i < len(data); i++ {
		sum := decimal.Zero
		for j := 0; j < period; j++ {
			sum = sum.Add(data[i-j])
		}
		out[i] = sum.Div(decimal.NewFromInt(int64(period)))
	}
	return out
}

// calculateRSI 计算相对强弱指标
func calculateRSI(prices []decimal.Decimal, period int) []decimal.Decimal {
	n := len(prices)
	rsi := make([]decimal.Decimal, n)
	if n < period+1 {
		return rsi
	}

	gains := decimal.Zero
	losses := decimal.Zero

	// 初始计算
	for i := 1; i <= period; i++ {
		change := prices[i].Sub(prices[i-1])
		if change.GreaterThan(decimal.Zero) {
			gains = gains.Add(change)
		} else {
			losses = losses.Add(change.Abs())
		}
	}

	avgGain := gains.Div(decimal.NewFromInt(int64(period)))
	avgLoss := losses.Div(decimal.NewFromInt(int64(period)))

	for i := period + 1; i < n; i++ {
		change := prices[i].Sub(prices[i-1])
		currentGain := decimal.Zero
		currentLoss := decimal.Zero
		if change.GreaterThan(decimal.Zero) {
			currentGain = change
		} else {
			currentLoss = change.Abs()
		}

		// Wilder's Smoothing
		avgGain = (avgGain.Mul(decimal.NewFromInt(int64(period - 1))).Add(currentGain)).Div(decimal.NewFromInt(int64(period)))
		avgLoss = (avgLoss.Mul(decimal.NewFromInt(int64(period - 1))).Add(currentLoss)).Div(decimal.NewFromInt(int64(period)))

		if avgLoss.IsZero() {
			rsi[i] = decimal.NewFromInt(100)
		} else {
			rs := avgGain.Div(avgLoss)
			// RSI = 100 - (100 / (1 + RS))
			rsi[i] = decimal.NewFromInt(100).Sub(decimal.NewFromInt(100).Div(decimal.NewFromInt(1).Add(rs)))
		}
	}
	return rsi
}

// calculateATR 计算平均真实波幅 (用于止损)
func calculateATR(klines []*futures.Kline, period int) []decimal.Decimal {
	n := len(klines)
	atr := make([]decimal.Decimal, n)
	tr := make([]decimal.Decimal, n)

	if n < period {
		return atr
	}

	// 1. 计算 TR (True Range)
	for i := 1; i < n; i++ {
		high, _ := decimal.NewFromString(klines[i].High)
		low, _ := decimal.NewFromString(klines[i].Low)
		prevClose, _ := decimal.NewFromString(klines[i-1].Close)

		// TR = Max(High-Low, Abs(High-PrevClose), Abs(Low-PrevClose))
		hl := high.Sub(low)
		hpc := high.Sub(prevClose).Abs()
		lpc := low.Sub(prevClose).Abs()

		trVal := hl
		if hpc.GreaterThan(trVal) {
			trVal = hpc
		}
		if lpc.GreaterThan(trVal) {
			trVal = lpc
		}
		tr[i] = trVal
	}

	// 2. 计算 ATR (简单使用 SMA 作为一个近似，或者使用 Wilder's RMA)
	// 这里使用简单的 SMA 平滑处理 TR
	trSma := calculateSMA(tr, period)
	return trSma
}

func (m *Exchange) FetchFundingRate(symbol string) (float64, error) {
	fundingRate, err := m.FuturesClient.NewFundingRateService().Symbol(symbol).Limit(1).Do(context.Background())
	if err != nil {
		return 0, err
	}

	if len(fundingRate) == 0 {
		return 0, nil
	}

	rate, _ := strconv.ParseFloat(fundingRate[0].FundingRate, 64)

	return rate, nil
}

func (m *Exchange) FetchFundingRateHistory(symbol string, limit int) ([]int64, error) {
	fundingRate, err := m.FuturesClient.NewFundingRateService().Symbol(symbol).Limit(limit).Do(context.Background())
	if err != nil {
		return nil, err
	}

	var out []int64
	for _, r := range fundingRate {
		out = append(out, r.FundingTime)
	}

	return out, nil
}

func (m *Exchange) FetchKLines(symbol string, interval string, limit int) ([]*futures.Kline, error) {
	result, err := m.FuturesClient.NewKlinesService().Symbol(symbol).Interval(interval).Limit(limit).Do(context.Background())
	if err != nil {
		return nil, err
	}

	return result, nil
}

func (m *Exchange) FetchContinuousKLines(symbol string, interval string, limit int) ([]*futures.ContinuousKline, error) {
	result, err := m.FuturesClient.NewContinuousKlinesService().Pair(symbol).ContractType(string(futures.ContractTypePerpetual)).Interval(interval).Limit(limit).Do(context.Background())
	if err != nil {
		return nil, err
	}

	return result, nil
}

func (m *Exchange) FetchPremiumIndex(symbol string) ([]*futures.PremiumIndex, error) {
	result, err := m.FuturesClient.NewPremiumIndexService().Symbol(symbol).Do(context.Background())
	if err != nil {
		return nil, err
	}

	return result, nil
}

func (m *Exchange) FetchTicker24H(symbol string) (*futures.PriceChangeStats, error) {
	result, err := m.FuturesClient.NewListPriceChangeStatsService().Symbol(symbol).Do(context.Background())
	if err != nil {
		return nil, err
	}

	if len(result) == 0 {
		return nil, fmt.Errorf("ticker not found")
	}

	return result[0], nil
}

func (m *Exchange) FetchOpenInterest(symbol string) (*futures.OpenInterest, error) {
	result, err := m.FuturesClient.NewGetOpenInterestService().Symbol(symbol).Do(context.Background())
	if err != nil {
		return nil, err
	}

	return result, nil
}

func (m *Exchange) FetchOpenInterestHistory(symbol, period string, limit int) ([]*futures.OpenInterestStatistic, error) {
	result, err := m.FuturesClient.NewOpenInterestStatisticsService().Symbol(symbol).Period(period).Limit(limit).Do(context.Background())
	if err != nil {
		return nil, err
	}

	return result, nil
}

// calculateEMA 计算指数移动平均线（EMA）
// prices: 按时间顺序排列（从旧到新）的收盘价
// period: 周期（如 7 或 21）
func calculateEMA(prices []decimal.Decimal, period int) []decimal.Decimal {
	n := len(prices)
	if n < period {
		return nil
	}

	// 1. 计算初始 SMA（简单移动平均）
	var sum decimal.Decimal
	for i := 0; i < period; i++ {
		sum = sum.Add(prices[i])
	}
	sma := sum.Div(decimal.NewFromInt(int64(period)))

	// 2. 计算平滑因子 α = 2 / (period + 1)
	alpha := decimal.NewFromInt(2).Div(decimal.NewFromInt(int64(period + 1)))

	// 3. 初始化 EMA 切片（前面 period-1 个位置无 EMA，我们只从 period-1 开始填）
	emas := make([]decimal.Decimal, n)
	emas[period-1] = sma

	// 4. 递推计算后续 EMA
	for i := period; i < n; i++ {
		// EMA[i] = α * price[i] + (1 - α) * EMA[i-1]
		ema := alpha.Mul(prices[i]).Add(decimal.NewFromInt(1).Sub(alpha).Mul(emas[i-1]))
		emas[i] = ema
	}

	return emas
}

// IsEMA7CrossAboveEMA21 判断最新一根 K 线是否发生 EMA7 上穿 EMA21
// 要求：klines 按时间升序排列（klines[0] 最旧，klines[len-1] 最新）
// 返回 true 当且仅当：
//   - 当前 EMA7 > EMA21
func IsEMA7CrossAboveEMA21(klines []*futures.Kline) bool {
	if len(klines) < 22 {
		return false // EMA21 至少需要 21 根，再加 1 根判断交叉
	}

	// 提取 Close 价格（转为 decimal）
	prices := make([]decimal.Decimal, len(klines))
	for i, k := range klines {
		d, err := decimal.NewFromString(k.Close)
		if err != nil {
			return false // 数据无效，安全返回 false
		}
		prices[i] = d
	}

	// 计算 EMA7 和 EMA21
	ema7 := calculateEMA(prices, 7)
	ema21 := calculateEMA(prices, 21)

	if ema7 == nil || ema21 == nil {
		return false
	}

	n := len(prices)
	ema7Now := ema7[n-1]
	ema21Now := ema21[n-1]

	// 上穿条件：
	// EMA7 > EMA21
	return ema7Now.GreaterThan(ema21Now)
}

// calculateMACD 计算 MACD (12,26,9)
// 返回：macdLine, signalLine, histogram （长度与输入 prices 一致，前面不足的部分为 zero）
func calculateMACD(prices []decimal.Decimal) ([]decimal.Decimal, []decimal.Decimal, []decimal.Decimal) {
	n := len(prices)
	if n < 26+9 { // MACD(12,26,9) 至少需要 26+9-1 = 34 根，取35更安全
		zero := make([]decimal.Decimal, n)
		return zero, zero, zero
	}

	ema12 := calculateEMA(prices, 12)
	ema26 := calculateEMA(prices, 26)

	if ema12 == nil || ema26 == nil {
		zero := make([]decimal.Decimal, n)
		return zero, zero, zero
	}

	// MACD Line = EMA12 - EMA26
	macdLine := make([]decimal.Decimal, n)
	for i := range macdLine {
		if i < 25 { // EMA26 从索引 25 开始有值
			macdLine[i] = decimal.NewFromInt(0)
		} else {
			macdLine[i] = ema12[i].Sub(ema26[i])
		}
	}

	// Signal Line = EMA9 of MACD Line
	signalLineRaw := calculateEMA(macdLine[25:], 9) // 从有值的部分开始
	signalLine := make([]decimal.Decimal, n)
	for i := 0; i < 25+9-1; i++ {
		signalLine[i] = decimal.NewFromInt(0) // 前 33 个为 0
	}
	for i, val := range signalLineRaw {
		signalLine[25+i] = val
	}

	// Histogram = MACD Line - Signal Line
	histogram := make([]decimal.Decimal, n)
	for i := range histogram {
		histogram[i] = macdLine[i].Sub(signalLine[i])
	}

	return macdLine, signalLine, histogram
}

// IsMACDHistogramExpandingInLast3 检查最近 3 根 K 线的 MACD Histogram 是否连续放大（递增）
// 并且最新一根 Histogram > 0（多头区域）
func IsMACDHistogramExpandingInLast3(klines []*futures.Kline) bool {
	n := len(klines)
	if n < 35 { // MACD(12,26,9) 至少需要 26+9-1 = 34 根，取35更安全
		return false
	}

	// 提取收盘价
	prices := make([]decimal.Decimal, n)
	for i, k := range klines {
		p, err := decimal.NewFromString(k.Close)
		if err != nil {
			return false
		}
		prices[i] = p
	}

	_, _, histogram := calculateMACD(prices)

	// 取最后 3 个 histogram 值（确保非零）
	h0 := histogram[n-3] // 倒数第3根
	h1 := histogram[n-2] // 倒数第2根
	h2 := histogram[n-1] // 最新一根

	// 要求：
	// 1. 最新 histogram > 0（在多头区域）
	// 2. h0 < h1 < h2（连续放大）
	if h2.LessThanOrEqual(decimal.NewFromInt(0)) {
		return false
	}

	if h0.LessThan(h1) && h1.LessThan(h2) {
		return true
	}

	return false
}

// IsVolumeSurged checks if the latest Kline's volume is at least 3 times the previous one.
// Returns false if there are fewer than 2 klines.
func IsVolumeSurged(klines []*futures.Kline) bool {
	if len(klines) < 3 {
		return false
	}

	latest := klines[len(klines)-1]
	prev := klines[len(klines)-2]
	third := klines[len(klines)-3]

	// Use big.Float for precise decimal comparison (since volume is string, possibly fractional)
	volLatest := new(big.Float)
	volPrev := new(big.Float)
	volThird := new(big.Float)

	volLatest.SetString(latest.Volume)
	volPrev.SetString(prev.Volume)
	volThird.SetString(third.Volume)

	// Avoid division by zero
	if volPrev.Sign() == 0 {
		return volLatest.Sign() > 0 // if previous is 0 and latest > 0, consider surged
	}

	count := new(big.Float).SetInt64(2)
	sum := new(big.Float).Add(volPrev, volThird)
	volAvg := new(big.Float).Quo(sum, count)

	ratio := new(big.Float).Quo(volLatest, volAvg)
	threshold := new(big.Float).SetFloat64(2.0)

	return ratio.Cmp(threshold) >= 0 && latest.Close > prev.Close
}

// IsVolumeSurgedInLast8 checks if, in the last 8 klines,
// there exists any kline (from index start+1 to end)
// such that:
//
//	volume[i] >= 3 * volume[i-1] AND Close[i] > Open[i]
//
// (i.e., a bullish surge with 3x+ volume vs previous)
func IsVolumeSurgedInLast8(klines []*futures.Kline) bool {
	n := len(klines)
	if n < 2 {
		return false
	}

	// 只看最近 8 根（但至少 2 根）
	start := n - 8
	if start < 0 {
		start = 0
	}

	// 从 start+1 开始遍历（因为要比较 i 和 i-1）
	for i := start + 1; i < n; i++ {
		prev := klines[i-1]
		curr := klines[i]

		// 解析成交量
		volCurr := new(big.Float)
		volPrev := new(big.Float)

		if _, ok := volCurr.SetString(curr.Volume); !ok {
			continue
		}
		if _, ok := volPrev.SetString(prev.Volume); !ok {
			continue
		}

		// 避免除零：如果前一根 volume 为 0，当前 > 0 视为 surge
		if volPrev.Sign() == 0 {
			if volCurr.Sign() <= 0 {
				continue
			}
		} else {
			// 计算 ratio = curr / prev
			ratio := new(big.Float).Quo(volCurr, volPrev)
			threshold := new(big.Float).SetFloat64(3.0)

			// 如果 ratio < 3，跳过
			if ratio.Cmp(threshold) < 0 {
				continue
			}
		}

		// 检查是否阳线：Close > Open
		closePrice := new(big.Float)
		openPrice := new(big.Float)

		if _, ok := closePrice.SetString(curr.Close); !ok {
			continue
		}
		if _, ok := openPrice.SetString(curr.Open); !ok {
			continue
		}

		if closePrice.Cmp(openPrice) > 0 {
			return true // 找到符合条件的放量阳线
		}
	}

	return false
}

// IsLatestHighTheHighest 检查最近一根K线的 High 是否是所有K线中的最高值
func IsLatestHighTheHighest(klines []*futures.Kline) bool {
	n := len(klines)
	if n == 0 {
		return false
	}

	// 解析所有 High 为 decimal
	highs := make([]decimal.Decimal, n)
	for i, k := range klines {
		h, err := decimal.NewFromString(k.High)
		if err != nil {
			// 如果某根 High 无效，保守返回 false
			return false
		}
		highs[i] = h
	}

	latestHigh := highs[n-1]

	// 遍历所有 High，检查是否有比 latestHigh 更高的
	for i := 0; i < n-1; i++ {
		if highs[i].GreaterThan(latestHigh) {
			return false // 发现更高的，不是最高
		}
	}

	return true // 最新 High 是最高（允许相等，即“不小于任何一根”）
}

// IsPriceAboveEMA60 判断最新K线的收盘价是否高于 EMA60
// 要求：klines 按时间升序排列（旧 → 新），至少 60 根
func IsPriceAboveEMA60(klines []*futures.Kline) bool {
	n := len(klines)
	if n < 60 {
		return false // 无法计算 EMA60
	}

	// 提取收盘价
	prices := make([]decimal.Decimal, n)
	for i, k := range klines {
		p, err := decimal.NewFromString(k.Close)
		if err != nil {
			return false // 数据无效
		}
		prices[i] = p
	}

	// 计算 EMA60
	ema60 := calculateEMA(prices, 60)
	if ema60 == nil {
		return false
	}

	// 获取最新价格和最新 EMA60 值
	currentPrice := prices[n-1]
	currentEMA60 := ema60[n-1]

	// 判断：价格 > EMA60
	return currentPrice.GreaterThan(currentEMA60)
}

func (m *Exchange) CreateOrder(apiKey, secretKey string, symbol, price, quantity string, side futures.SideType, stopLossPrice, takeProfitPrice string) (*futures.CreateOrderResponse, error) {
	client := futures.NewClient(apiKey, secretKey)

	result, err := client.NewCreateOrderService().
		Symbol(symbol).
		Side(side).
		Price(price).
		Quantity(quantity).
		Type(futures.OrderTypeMarket).
		Do(context.Background())
	if err != nil {
		return nil, err
	}

	_, err = client.NewCreateAlgoOrderService().
		Symbol(symbol).
		Side(side).
		Price(stopLossPrice).
		Quantity(quantity).
		Type(futures.AlgoOrderTypeStopMarket).
		Do(context.Background())
	if err != nil {
		return nil, err
	}

	_, err = client.NewCreateAlgoOrderService().
		Symbol(symbol).
		Side(side).
		Price(takeProfitPrice).
		Quantity(quantity).
		Type(futures.AlgoOrderTypeTakeProfitMarket).
		Do(context.Background())
	if err != nil {
		return nil, err
	}

	return result, nil
}
