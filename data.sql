

CREATE TABLE funding_rate_records (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
symbol VARCHAR(32) NOT NULL DEFAULT '' COMMENT '交易对，如 BTC-USDT',
funding_rate DECIMAL(12, 10) NOT NULL COMMENT '资金费率，例如 -0.00005 表示 -0.005%',
close_price DECIMAL(18,8)  NOT NULL DEFAULT 0 COMMENT '记录时的最新价格',
capture_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '数据抓取时间（每5分钟一次）',
is_volume_surge TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否成交量放大',
funding_rate_change_1h DECIMAL(12, 10) NOT NULL DEFAULT 0 COMMENT '最近1小时资金费率变化（当前值 - 1小时前值)',
funding_rate_change_8h DECIMAL(12, 10) NOT NULL DEFAULT 0 COMMENT '最近24小时资金费率变化（当前值 - 8小时前值)',
funding_rate_change_24h DECIMAL(12, 10) NOT NULL DEFAULT 0 COMMENT '最近12小时资金费率变化（当前值 - 24小时前值)',
price_near_low_24h TINYINT(1) NOT NULL DEFAULT 0 COMMENT '价格是否处于近期低位',
consecutive_negative_funding_hours INT NOT NULL DEFAULT  0 COMMENT '资金费率连续为负的小时数',
ema7_cross_above_ema21_15m  TINYINT(1) NOT NULL DEFAULT 0 COMMENT '15m EMA7 vs EMA21 是否即将金叉 / 已金叉',
ema7_cross_above_ema21_1h  TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1h EMA7 vs EMA21 是否即将金叉 / 已金叉',
macd_histogram_expanding_15m TINYINT(1) NOT NULL DEFAULT 0 COMMENT '15分钟 MACD 柱状图动能是否放大（如 |hist| 增大或负转正）',
macd_histogram_expanding_1h TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1小时 MACD 柱状图动能是否放大',
volume24h DECIMAL(18, 8) NOT NULL DEFAULT 0 COMMENT '最近12小时成交额',
open_interest DECIMAL(18, 8) NOT NULL DEFAULT 0 COMMENT '未平仓合约数量',
open_interest_change_1h DECIMAL(12, 10) NOT NULL DEFAULT 0 COMMENT '最近1小时未平仓合约数量变化（当前值 - 1小时前值)',
high24h TINYINT(1) NOT NULL DEFAULT 0 COMMENT '24 小时新高',
is_above_ema60_1h TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1小时收盘高于ema60',
score DECIMAL(3, 2) NOT NULL DEFAULT 0 COMMENT '评分，例如 0-100',
INDEX idx_symbol_capture_time (symbol, capture_time),
INDEX idx_capture_time (capture_time),
INDEX idx_funding_rate (funding_rate),
INDEX idx_is_volume_surge (is_volume_surge)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资金费率记录表';