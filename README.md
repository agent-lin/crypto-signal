# 🦞 Crypto Signal - 加密货币永续合约信号检测系统

自动监控 Binance/Bybit 永续合约市场，发现高价值交易机会。

## ✨ 功能特性

- 🔥 **资金费率套利** - 检测高资金费率机会
- 📊 **价格波动监控** - 捕捉大幅波动行情
- 📍 **高低点检测** - 识别区间顶部/底部
- 📈 **成交量异常** - 发现成交量 spikes
- 🔔 **实时通知** - Telegram 推送交易信号

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量（可选）

```bash
export TELEGRAM_BOT_TOKEN="your_bot_token"
export TELEGRAM_CHAT_ID="your_chat_id"
```

### 3. 运行监控

```bash
npm start
```

## 📊 信号类型

| 信号 | 说明 | 置信度 |
|-----|------|--------|
| 🔥 高资金费率 | 资金费率>1%，适合套利 | 高/中 |
| 📊 大幅波动 | 24h 价格波动>5% | 高/中 |
| 📍 接近高低点 | 价格在 24h 区间极端位置 | 中 |

## ⚙️ 配置选项

在 `src/monitor.js` 中修改 `CONFIG` 对象：

```javascript
const CONFIG = {
    fundingRateThreshold: 0.01,      // 资金费率阈值 1%
    priceChangeThreshold: 0.05,      // 价格波动阈值 5%
    scanInterval: 60000,             // 扫描间隔 60 秒
    topCoins: 20,                    // 监控币种数量
};
```

## 📝 示例输出

```
🔥 BTC/USDT 交易信号

📊 信号类型：高资金费率
🎯 建议方向：SHORT
💰 当前价格：$67234.50
📈 置信度：高

📝 分析：资金费率 1.234%

⏰ 时间：2026-03-04 18:55:00
```

## ⚠️ 风险提示

- 本系统仅提供信息参考，不构成投资建议
- 加密货币交易风险极高，请谨慎操作
- 建议配合自己的分析和风险管理策略

## 📄 License

MIT
