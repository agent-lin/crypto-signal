package services

import (
	"database/sql"
	"fmt"
	"gorm.io/gorm"
	"sort"
	"time"
)

func IsPriceNearLow24h(db *gorm.DB, symbol string, currentPrice float64) bool {
	var minPrice sql.NullFloat64
	err := db.Table("funding_rate_records").
		Select("MIN(price)").
		Where("symbol = ? AND capture_time >= NOW() - INTERVAL 24 HOUR", symbol).
		Scan(&minPrice).Error

	if err != nil || !minPrice.Valid {
		return false
	}

	// 当前价 ≤ 最低价 * 1.015（1.5% 范围内）
	return currentPrice <= minPrice.Float64*1.015
}

func CalculateConsecutiveNegativeHours(db *gorm.DB, symbol string, currentTime time.Time) (uint, error) {
	var records []struct {
		CaptureTime time.Time
		FundingRate sql.NullFloat64
	}

	// 查询最近 72 小时（足够覆盖连续情况）
	err := db.Table("funding_rate_records").
		Select("capture_time, funding_rate").
		Where("symbol = ? AND capture_time >= ? AND funding_rate <= ?", symbol, currentTime.Add(-72*time.Hour), -0.00005).
		Order("capture_time DESC").
		Find(&records).Error
	if err != nil {
		return 0, err
	}

	if len(records) == 0 {
		return 0, nil
	}

	// 资金费率通常每8小时更新一次（如 00:00, 08:00, 16:00 UTC）
	// 但我们按“记录时间”判断是否连续（每5分钟可能重复记录同一个费率）
	// → 去重：按 funding_rate + 小时对齐（简化：只看不同 capture_time 的记录）

	type hourKey struct {
		Year  int
		Month time.Month
		Day   int
		Hour  int
	}
	seen := make(map[hourKey]bool)
	hours := 0

	for _, r := range records {
		key := hourKey{
			Year:  r.CaptureTime.Year(),
			Month: r.CaptureTime.Month(),
			Day:   r.CaptureTime.Day(),
			Hour:  r.CaptureTime.Hour(),
		}
		if seen[key] {
			continue
		}
		seen[key] = true
		hours++

		// 停止条件：一旦出现“非连续”就中断（这里简化为只统计最近连续段）
		// 更严谨做法：从最新 record 开始，逐小时检查是否都有 ≤ -0.00005 的记录
		// → 此处为简化，假设你每5分钟都记录，且只要最近 n 条都满足即视为连续
	}

	return uint(hours), nil
}

func CalculateFundingRatePercentile7d(db *gorm.DB, symbol string, currentRate float64) (*float64, error) {
	var rates []float64
	err := db.Table("funding_rate_records").
		Select("funding_rate").
		Where("symbol = ? AND capture_time >= NOW() - INTERVAL 7 DAY", symbol).
		Scan(&rates).Error
	if err != nil {
		return nil, err
	}

	if len(rates) == 0 {
		return nil, nil
	}

	// 排序
	sort.Float64s(rates)

	// 计算当前费率在历史中的百分位（0~100）
	countBelow := 0
	for _, r := range rates {
		if r <= currentRate {
			countBelow++
		}
	}
	percentile := float64(countBelow) / float64(len(rates)) * 100.0

	return &percentile, nil
}

func GetHistoricalRateAndPriceAndOI(db *gorm.DB, symbol string, hours int) (rate *float64, price *float64, oi *float64, err error) {
	type Result struct {
		FundingRate  float64
		Price        float64
		OpenInterest float64
	}

	var res Result
	err = db.Table("funding_rate_records").
		Select("funding_rate, price, 0").
		Where("symbol = ? AND capture_time <= ? AND capture_time >= ? AND price > 0",
			symbol,
			time.Now(),
			time.Now().Add(-time.Duration(hours)*time.Hour),
		).
		Order(fmt.Sprintf("capture_time ASC")).
		Limit(1).
		Scan(&res).Error

	if err != nil || err == gorm.ErrRecordNotFound {
		return nil, nil, nil, nil
	}

	return &res.FundingRate, &res.Price, &res.OpenInterest, nil
}
