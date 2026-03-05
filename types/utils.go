package types

import (
	"regexp"
	"strings"
)

var (
	// 匹配大写字母前的位置（用于插入下划线）
	camelToSnake1 = regexp.MustCompile(`(.)([A-Z][a-z]+)`)
	camelToSnake2 = regexp.MustCompile(`([a-z0-9])([A-Z])`)
)

// CamelToSnake 将驼峰命名转为蛇形命名（全部小写 + 下划线）
// 示例：
//
//	"FundingRate"           → "funding_rate"
//	"EMA7Cross"             → "ema7_cross"
//	"XMLHttpRequest"        → "xml_http_request"
//	"iPhone"                → "i_phone"
//	"Already_Snake"         → "already_snake"（保留原下划线）
func CamelToSnake(s string) string {
	if s == "" {
		return ""
	}

	// 处理连续大写字母（如 XMLHttp → XML_Http）
	s = camelToSnake1.ReplaceAllString(s, "${1}_${2}")
	// 处理小写/数字后跟大写（如 iPhone → i_Phone）
	s = camelToSnake2.ReplaceAllString(s, "${1}_${2}")

	// 转为小写
	return strings.ToLower(s)
}
