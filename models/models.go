// models/funding_rate_record.go
package models

import (
	"time"
)

type FundingRateRecord struct {
	ID                 uint    `gorm:"primaryKey" json:"id"`
	Symbol             string  `gorm:"index:idx_symbol_time;not null" json:"symbol"`
	FundingRate        float64 `gorm:"type:decimal(12,10);not null" json:"fundingRate"` // 小数形式
	Price              float64 `gorm:"type:decimal(12,8)" json:"price"`
	Side               string  `gorm:"type:varchar(10);not null;default:'LONG'" json:"side"` // "LONG" 或 "SHORT"
	OpenInterestChange float64 `gorm:"type:decimal(12,8)" json:"oiChange"`                   // 记录当时的 OI 变化率
	SignalTag          string  `gorm:"type:varchar(50)" json:"signalTag"`                    // 例如 "Squeeze", "Trend", "Trap"

	VolumeSurgeRatio float64 `gorm:"type:decimal(12,8)" json:"volumeSurgeRatio"`
	CurrentRSI       float64 `gorm:"type:decimal(12,8)" json:"currentRSI"`
	StopLoss         float64 `gorm:"type:decimal(12,8)" json:"stopLoss"`
	TakeProfit       float64 `gorm:"type:decimal(12,8)" json:"takeProfit"`
	Rrr              float64 `gorm:"type:decimal(6,4)" json:"rrr"`

	ConsecutiveNegativeFundingHours uint `gorm:"not null;default:0" json:"consecutiveNegativeFundingHours"`
	EMA7CrossAboveEMA2115m          bool `gorm:"not null;default:false" json:"ema7CrossAboveEma2115m"`
	Is24HrHigh                      bool `gorm:"not null;default:false" json:"is24HrHigh"`

	Score                 float64   `gorm:"not null;default:0" json:"score"`
	PriceChange24hPercent float64   `gorm:"type:decimal(10,6)" json:"priceChange24hPercent"`
	CaptureTime           time.Time `gorm:"index;not null;default:CURRENT_TIMESTAMP(3)" json:"captureTime"`

	MarkPrice                    float64 `gorm:"type:decimal(12,8)" json:"markPrice"`
	LastFundingRate              float64 `gorm:"type:decimal(12,10);not null" json:"lastFundingRate"` // 小数形式
	PriceChangeAfterSignal       float64 `gorm:"type:decimal(10,6)" json:"priceChangeAfterSignal"`
	FundingRateChangeAfterSignal float64 `gorm:"type:decimal(10,6)" json:"fundingRateChangeAfterSignal"`

	MarketCap   float64 `gorm:"type:decimal(20,2)" json:"marketCap"`   // 流通市值
	OiToMcRatio float64 `gorm:"type:decimal(10,4)" json:"oiToMcRatio"` // OI/MC 比率 (核心指标)

	// New fields for optimization
	//PositionSizePct    float64
	//TrailingStopActive bool
}

// TableName 自定义表名
func (FundingRateRecord) TableName() string {
	return "funding_rate_records"
}

type BackTestResult struct {
	ID       uint `gorm:"primaryKey" json:"id"`
	SignalID uint `gorm:"not null" json:"signalId"` // 关联 FundingRateRecord.ID

	Symbol           string  `gorm:"not null" json:"symbol"`
	Side             string  `gorm:"type:enum('LONG','SHORT');not null" json:"side"`
	SignalPrice      float64 `gorm:"type:decimal(12,8);not null" json:"signalPrice"`
	FundingRate      float64 `gorm:"type:decimal(12,8);not null" json:"fundingRate"`
	VolumeSurgeRatio float64 `gorm:"type:decimal(12,8)" json:"volumeSurgeRatio"`
	MarketCap        float64 `gorm:"type:decimal(20,2)" json:"marketCap"`   // 流通市值
	OiToMcRatio      float64 `gorm:"type:decimal(10,4)" json:"oiToMcRatio"` // OI/MC 比率 (核心指标)
	StopLoss         float64 `gorm:"type:decimal(12,8);not null" json:"stopLoss"`
	TakeProfit       float64 `gorm:"type:decimal(12,8);not null" json:"takeProfit"`
	Rrr              float64 `gorm:"type:decimal(6,4);not null" json:"rrr"`

	Price4h  *float64 `gorm:"type:decimal(12,8)" json:"price4h"`
	Price12h *float64 `gorm:"type:decimal(12,8)" json:"price12h"`
	Price24h *float64 `gorm:"type:decimal(12,8)" json:"price24h"`

	Pnl4h  *float64 `gorm:"type:decimal(10,6)" json:"pnl4h"`
	Pnl12h *float64 `gorm:"type:decimal(10,6)" json:"pnl12h"`
	Pnl24h *float64 `gorm:"type:decimal(10,6)" json:"pnl24h"`

	HitStopLoss   bool `gorm:"not null;default:false" json:"hitStopLoss"`
	HitTakeProfit bool `gorm:"not null;default:false" json:"hitTakeProfit"`

	CaptureTime time.Time  `gorm:"not null;default:CURRENT_TIMESTAMP(3)" json:"captureTime"`
	CompletedAt *time.Time `json:"completedAt"`
}

// TableName 自定义表名
func (BackTestResult) TableName() string {
	return "backtest_results"
}

// SimulatedTrade - 模拟交易记录
type SimulatedTrade struct {
	ID        uint   `gorm:"primaryKey" json:"id"`
	SignalID  uint   `gorm:"index;not null" json:"signalId"` // 关联信号 ID
	Symbol    string `gorm:"index;not null" json:"symbol"`
	Side      string `gorm:"type:varchar(10);not null" json:"side"` // LONG/SHORT

	// 入场信息
	EntryPrice      float64   `gorm:"type:decimal(12,8);not null" json:"entryPrice"`
	EntryTime       time.Time `gorm:"not null" json:"entryTime"`
	PositionSize    float64   `gorm:"type:decimal(10,2);default:100" json:"positionSize"` // 仓位大小 (USDT)
	Leverage        int       `gorm:"default:1" json:"leverage"`                          // 杠杆倍数

	// 出场信息
	ExitPrice       *float64   `gorm:"type:decimal(12,8)" json:"exitPrice"`
	ExitTime        *time.Time `gorm:"index" json:"exitTime"`
	ExitReason      string     `gorm:"type:varchar(50)" json:"exitReason"` // TAKE_PROFIT/STOP_LOSS/TIME_EXIT/MANUAL

	// 止损止盈
	StopLossPrice   float64 `gorm:"type:decimal(12,8)" json:"stopLossPrice"`
	TakeProfitPrice float64 `gorm:"type:decimal(12,8)" json:"takeProfitPrice"`

	// 盈亏计算
	PnlPercent  float64  `gorm:"type:decimal(10,6)" json:"pnlPercent"`  // 盈亏百分比
	PnlUSDT     float64  `gorm:"type:decimal(12,2)" json:"pnlUSDT"`     // 盈亏金额
	MaxDrawdown float64  `gorm:"type:decimal(10,6)" json:"maxDrawdown"` // 最大回撤
	MaxProfit   float64  `gorm:"type:decimal(10,6)" json:"maxProfit"`   // 最大浮盈

	// 当前状态
	IsActive      bool `gorm:"default:true;index" json:"isActive"` // 是否持仓中
	CurrentPrice  float64 `gorm:"-" json:"currentPrice"`            // 当前价格 (虚拟字段)
	UnrealizedPnl float64 `gorm:"-" json:"unrealizedPnl"`           // 未实现盈亏

	CaptureTime time.Time `gorm:"autoCreateTime" json:"captureTime"`
	UpdateTime  time.Time `gorm:"autoUpdateTime" json:"updateTime"`
}

func (SimulatedTrade) TableName() string {
	return "simulated_trades"
}

// TradeStats - 交易统计
type TradeStats struct {
	TotalTrades       int     `json:"totalTrades"`        // 总交易次数
	ActiveTrades      int     `json:"activeTrades"`       // 当前持仓
	WiningTrades      int     `json:"winingTrades"`       // 盈利次数
	LosingTrades      int     `json:"losingTrades"`       // 亏损次数
	WinRate           float64 `json:"winRate"`            // 胜率
	TotalPnlUSDT      float64 `json:"totalPnlUSDT"`       // 总盈亏
	TotalPnlPercent   float64 `json:"totalPnlPercent"`    // 总盈亏百分比
	AvgWinPercent     float64 `json:"avgWinPercent"`      // 平均盈利
	AvgLossPercent    float64 `json:"avgLossPercent"`     // 平均亏损
	ProfitFactor      float64 `json:"profitFactor"`       // 盈利因子
	MaxConsecutiveWin int     `json:"maxConsecutiveWin"`  // 最大连胜
	MaxConsecutiveLose int    `json:"maxConsecutiveLose"` // 最大连亏
	BestTrade         float64 `json:"bestTrade"`          // 最佳交易
	WorstTrade        float64 `json:"worstTrade"`         // 最差交易
}
