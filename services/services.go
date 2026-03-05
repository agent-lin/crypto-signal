// services/funding_service.go
package services

import (
	"future-signal/models"
	"gorm.io/gorm"
	"time"
)

// SaveFundingRecord 保存一条记录
func SaveFundingRecord(db *gorm.DB, record models.FundingRateRecord) error {
	return db.Create(&record).Error
}

// HasSignalInLastDuration 检查指定币种在过去 duration 时间内是否已经存在记录
// symbol: 币种名称
// duration: 时间范围，例如 2 * time.Hour
func HasSignalInLastDuration(db *gorm.DB, symbol string, duration time.Duration) bool {
	var count int64
	startTime := time.Now().Add(-duration)

	// 查询条件：Symbol 匹配 且 CaptureTime 在 startTime 之后
	err := db.Model(&models.FundingRateRecord{}).
		Where("symbol = ? AND capture_time > ?", symbol, startTime).
		Count(&count).Error

	if err != nil {
		// 如果查询出错，为了安全起见（防止漏报），可以返回 false，或者记录日志
		return false
	}

	return count > 0
}

// GetTopSignalsLastHours 获取过去24小时内 质量最高 的信号 (按 Score 或 RRR 排序)
func GetTopSignalsLastHours(db *gorm.DB, hours int) ([]*models.FundingRateRecord, error) {
	var signals []*models.FundingRateRecord
	startTime := time.Now().Add(-(time.Duration(hours)) * time.Hour)

	result := db.Model(&models.FundingRateRecord{}).
		Where("capture_time >= ?", startTime).
		Order("capture_time DESC"). // 分数高的排前面
		Limit(20).
		Find(&signals)

	return signals, result.Error
}
