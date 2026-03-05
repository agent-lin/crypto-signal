# 🦞 Crypto Signal - 加密货币永续合约信号检测系统

> 实时监测 Binance 永续合约市场，通过资金费率、成交量、持仓量等多维度数据分析，自动发现高价值交易机会。

![Go](https://img.shields.io/badge/Go-1.21+-00ADD8?style=for-the-badge&logo=go)
![License](https://img.shields.io/github/license/agent-lin/crypto-signal?style=for-the-badge)

---

## ✨ 功能特性

### 🔍 核心功能

- **资金费率监控** - 实时追踪全市场资金费率，发现套利机会
- **成交量激增检测** - 自动识别异常放量币种
- **持仓量分析** - 监控 OI 变化，判断庄家动向
- **多维度评分** - 综合费率、成交量、价格波动生成信号评分
- **Telegram 推送** - 实时推送高价值信号到群组

### 📊 信号类型

| 信号类型 | 说明 | 置信度 |
|---------|------|--------|
| 🔥 高资金费率 | 费率 > 1%，适合套利 | 高/中 |
| 📈 成交量激增 | 成交量放大 > 3 倍 | 高/中 |
| 🐳 庄家控盘 | OI/MC 比率 > 0.5 | 高 |
| 📍 价格极端 | 24h 涨跌幅 > 10% | 中 |

---

## 🚀 快速开始

### 前置要求

- Go 1.21+
- MySQL 8.0+
- Binance API Key

### 1. 克隆项目

```bash
git clone https://github.com/agent-lin/crypto-signal.git
cd crypto-signal
```

### 2. 配置数据库

```sql
CREATE DATABASE `future-monitor` CHARACTER SET utf8mb4;
CREATE USER 'monitor'@'localhost' IDENTIFIED BY 'monitor123';
GRANT ALL PRIVILEGES ON `future-monitor`.* TO 'monitor'@'localhost';
FLUSH PRIVILEGES;
```

### 3. 配置文件

```bash
cp config.yaml.example config.yaml
```

编辑 `config.yaml`：

```yaml
# 数据库连接
dsn: "monitor:monitor123@unix(/var/run/mysqld/mysqld.sock)/future-monitor?charset=utf8mb4&parseTime=True&loc=Local"

# Binance API 密钥
api_key: "YOUR_BINANCE_API_KEY"
secret_key: "YOUR_BINANCE_SECRET_KEY"

# Telegram 通知（可选）
telegram_bot_token: "YOUR_BOT_TOKEN"
telegram_group_id: "YOUR_GROUP_ID"
```

### 4. 编译运行

```bash
# 编译
go build -o crypto-signal .

# 运行
./crypto-signal
```

---

## 📡 API 接口

服务启动后访问 `http://localhost:8666`

### 获取最新资金费率

```bash
curl http://localhost:8666/api/funding/latest
```

### 获取成交量激增

```bash
curl http://localhost:8666/api/funding/volume-surge
```

### 获取 24h 行情

```bash
curl "http://localhost:8666/api/ticker/24h?symbol=BTCUSDT"
```

### 获取历史数据

```bash
curl "http://localhost:8666/api/funding/history?page=1&pageSize=20"
```

### 获取统计数据

```bash
curl http://localhost:8666/api/funding/stats
```

---

## 🌐 Web 界面

前端项目位于 `web/` 目录：

```bash
cd web
pnpm install
pnpm dev
```

访问 http://localhost:3000

---

## ⚙️ 配置说明

### config.yaml 完整配置

```yaml
# 是否随程序启动
start_with_run: false

# MySQL 数据库连接
dsn: "user:password@unix(/var/run/mysqld/mysqld.sock)/database?charset=utf8mb4&parseTime=True&loc=Local"

# Binance API 密钥
api_key: "YOUR_BINANCE_API_KEY"
secret_key: "YOUR_BINANCE_SECRET_KEY"

# Telegram 通知（可选）
telegram_bot_token: "YOUR_BOT_TOKEN"
telegram_group_id: "YOUR_GROUP_ID"
```

### 信号检测阈值

在 `binance/analysis_v2.go` 中可调整：

```go
const (
    fundingRateThreshold = 0.01      // 资金费率阈值 1%
    volumeSpikeThreshold = 3.0       // 成交量放大倍数
    priceChangeThreshold = 0.10      // 价格波动阈值 10%
)
```

---

## 📁 项目结构

```
crypto-signal/
├── binance/              # Binance API 封装
│   ├── binance.go        # 主 API 客户端
│   └── analysis_v2.go    # 信号分析逻辑
├── config/               # 配置管理
├── handlers/             # HTTP 处理器
│   └── funding_handler.go
├── models/               # 数据模型
├── services/             # 业务服务
├── telegram/             # Telegram Bot
├── types/                # 类型定义
├── web/                  # React 前端
├── main.go               # 程序入口
└── config.yaml.example   # 配置示例
```

---

## 🔒 安全提示

1. **API 密钥安全**
   - 不要将 `config.yaml` 提交到 Git
   - 使用只读 API Key（不需要交易权限）
   - 定期更换密钥

2. **数据库安全**
   - 使用强密码
   - 限制数据库访问权限

3. **生产环境**
   - 启用 GIN Release 模式
   - 配置 HTTPS
   - 设置 API 限流

---

## 📊 数据来源

- **行情数据**: [Binance Futures API](https://binance-docs.github.io/apidocs/futures/en/)
- **资金费率**: Binance 每 8 小时更新
- **持仓量**: Binance 公开数据

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 📄 License

MIT License - 详见 [LICENSE](LICENSE) 文件

---

## ⚠️ 免责声明

本项目仅供学习和研究使用：

- ❌ **不构成投资建议**
- ❌ **不保证数据准确性**
- ❌ **不承担交易损失责任**

加密货币交易风险极高，请谨慎操作。

---

## 📞 联系方式

- GitHub: [@agent-lin](https://github.com/agent-lin)
- Project: [crypto-signal](https://github.com/agent-lin/crypto-signal)

---

**Made with ❤️ by agent-lin**
