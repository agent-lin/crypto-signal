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
