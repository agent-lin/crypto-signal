package telegram

import (
	"bytes"
	"encoding/json"
	"fmt"
	"crypto-signal/models"
	"net/http"
	"strings"
	"time"
)

type sendMessageResponse struct {
	Ok     bool `json:"ok"`
	Result struct {
		MessageID int `json:"message_id"`
	} `json:"result"`
}

// TelegramMessage 发送消息到 Telegram
func TelegramMessage(botToken, chatID string, messageID int, message string) (int, error) {
	url := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", botToken)

	payload := map[string]string{
		"chat_id":    chatID,
		"text":       message,
		"parse_mode": "HTML", // 可选：支持 HTML 格式（也可用 "MarkdownV2"）
	}

	if messageID != 0 {
		url = fmt.Sprintf("https://api.telegram.org/bot%s/editMessageText", botToken)
		payload["message_id"] = fmt.Sprintf("%d", messageID)
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return 0, fmt.Errorf(" marshal payload: %w", err)
	}

	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	resp, err := client.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return 0, fmt.Errorf(" send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf(" telegram API error: status=%d", resp.StatusCode)
	}

	var result sendMessageResponse

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0, fmt.Errorf(" json decoder: %v", err)
	}

	return result.Result.MessageID, nil
}

func SendSignalToTelegram(botToken, chatID string, messageID int, signals []models.FundingRateRecord) (int, error) {
	msg := BuildTelegramSignalMessage(signals)
	return TelegramMessage(botToken, chatID, messageID, msg)
}

// BuildTelegramSignalMessage 构建结构化信号消息（HTML 格式）
func BuildTelegramSignalMessage(signals []models.FundingRateRecord) string {
	if len(signals) == 0 {
		return "<b>无信号</b>"
	}

	var lines []string

	// 标题
	lines = append(lines, fmt.Sprintf("<b>🚨 买入信号（%d个）</b>", len(signals)))

	for _, s := range signals {
		// 交易对 & 时间
		captureAgo := time.Since(s.CaptureTime).Truncate(time.Minute)
		lines = append(lines, fmt.Sprintf("\n\n<b>%s</b>", s.Symbol))
		lines = append(lines, fmt.Sprintf("<i>%s前</i>", formatDuration(captureAgo)))

		// 信号类型
		signal := getSignalType(s)
		lines = append(lines, fmt.Sprintf("\n<b>信号：</b><code>%s</code> %s", signal, getSignalEmoji(signal)))

		// 资金费率
		fundingStr := fmt.Sprintf("%.4f%%", s.FundingRate)
		fundingColor := "🔴" // 默认红色
		if s.FundingRate >= 0 {
			fundingColor = "🟢"
		}
		lines = append(lines, fmt.Sprintf("<b>资金费率：</b>%s %s", fundingStr, fundingColor))

		// 24H涨跌幅
		changeStr := fmt.Sprintf("%.2f%%", s.PriceChange24hPercent)
		color := "🟢"
		if s.PriceChange24hPercent < 0 {
			color = "🔴"
		}
		lines = append(lines, fmt.Sprintf("<b>24H涨跌幅：</b>%s %s", changeStr, color))

		// 价格
		priceStr := fmt.Sprintf("$%.6f", s.MarkPrice)
		lines = append(lines, fmt.Sprintf("<b>价格：</b>%s", priceStr))

		// 指标列表
		volumeSurgeRatio := fmt.Sprintf("%.2f%%", s.VolumeSurgeRatio)
		lines = append(lines, fmt.Sprintf("<b>成交放量：</b>%s %s", volumeSurgeRatio, "📈"))
		lines = append(lines, fmt.Sprintf("<b>15m EMA突破：</b>%s %s", boolToText(s.EMA7CrossAboveEMA2115m), boolToEmoji(s.EMA7CrossAboveEMA2115m)))
		//lines = append(lines, fmt.Sprintf("<b>1h EMA突破：</b>%s %s", boolToText(s.EMA7CrossAboveEMA211h), boolToEmoji(s.EMA7CrossAboveEMA211h)))
		//lines = append(lines, fmt.Sprintf("<b>15m动能增强：</b>%s %s", boolToText(s.MACDHistogramExpanding15m), boolToEmoji(s.MACDHistogramExpanding15m)))
		//lines = append(lines, fmt.Sprintf("<b>1h动能增强：</b>%s %s", boolToText(s.MACDHistogramExpanding1h), boolToEmoji(s.MACDHistogramExpanding1h)))
		//lines = append(lines, fmt.Sprintf("<b>24h新高：</b>%s %s", boolToText(s.High24h), boolToEmoji(s.High24h)))
		takeProfitStr := fmt.Sprintf("$%.6f", s.TakeProfit)
		lines = append(lines, fmt.Sprintf("<b>止盈：</b>%s", takeProfitStr))
		stopLossStr := fmt.Sprintf("$%.6f", s.StopLoss)
		lines = append(lines, fmt.Sprintf("<b>止损：</b>%s", stopLossStr))

		// 连续负费率
		if s.ConsecutiveNegativeFundingHours > 0 {
			lines = append(lines, fmt.Sprintf("\n<b>连续负费率：</b>%dh", s.ConsecutiveNegativeFundingHours))
		}

		// 分隔线
		lines = append(lines, "\n────────────────")
	}

	return strings.Join(lines, "\n")
}

// 辅助函数
func formatDuration(d time.Duration) string {
	hours := int(d.Hours())
	minutes := int(d.Minutes()) % 60
	if hours > 0 {
		return fmt.Sprintf("%dh%dmin", hours, minutes)
	}
	return fmt.Sprintf("%dmin", minutes)
}

func getSignalType(f models.FundingRateRecord) string {
	if f.FundingRate < 0 && f.PriceChange24hPercent > 0 {
		return "空头挤压"
	}

	if f.FundingRate > 0 && f.PriceChange24hPercent > 0 {
		return "多头反转"
	}

	return "中性ℹ️"
}

func getSignalEmoji(signalType string) string {
	switch signalType {
	case "空头挤压":
		return "⚠️"
	case "多头反转":
		return "📈"
	default:
		return "ℹ️"
	}
}

func boolToText(b bool) string {
	if b {
		return "是"
	}
	return "否"
}

func boolToEmoji(b bool) string {
	if b {
		return "✅"
	}
	return "❌"
}
