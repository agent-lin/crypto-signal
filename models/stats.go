package models

type BacktestStat struct {
	Side                *string  `json:"side"` // NULL 表示汇总行
	TotalSignals        int64    `json:"totalSignals"`
	WinRate             float64  `json:"winRate"`
	StopLossRate        float64  `json:"stopLossRate"`
	AvgPnL24h           *float64 `json:"avgPnl24h"`
	AvgRealizedPnLPct   *float64 `json:"avgRealizedPnLPct"`
	AvgRRR              float64  `json:"avgRrr"`
	AvgFundingRate      float64  `json:"avgFundingRate"`
	AvgOiToMcRatio      float64  `json:"avgOiToMcRatio"`
	AvgMarketCap        float64  `json:"avgMarketCap"`
	AvgVolumeSurgeRatio float64  `json:"avgVolumeSurgeRatio"`
	PositivePnL24hRate  float64  `json:"positivePnl24hRate"`
	AvgPnL4h            *float64 `json:"avgPnl4h"`
	AvgPnL12h           *float64 `json:"avgPnl12h"`
	MaxPnL24h           *float64 `json:"maxPnl24h"`
	MinPnL24h           *float64 `json:"minPnl24h"`
	PendingSignals      int64    `json:"pendingSignals"`
}
