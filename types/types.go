package types

// FundingIntervalInfo 存储资金费率周期信息
type FundingIntervalInfo struct {
	Interval  float64 // 周期，单位小时
	Frequency string  // 频率描述，如 "高" (低于4小时) 或 "标准"
}

// RateInfo 存储单个交易对的资金费率
type RateInfo struct {
	Symbol    string
	Rate      float64 // 资金费率（百分比）
	MarkPrice string
}

// ExchangeResult 存储单个交易所的抓取结果
type ExchangeResult struct {
	Top10            []RateInfo
	HighRates        []RateInfo
	FundingIntervals map[string]FundingIntervalInfo
}
