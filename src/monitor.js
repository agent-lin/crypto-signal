#!/usr/bin/env node
/**
 * 🦞 Crypto Signal - 加密货币永续合约信号检测系统
 * 监控 Binance/Bybit 永续合约，发现高价值交易机会
 */

const axios = require('axios');
const WebSocket = require('ws');

// 配置
const CONFIG = {
    // 交易所 API
    binanceFutures: 'https://fapi.binance.com',
    bybitFutures: 'https://api.bybit.com',
    
    // 信号检测阈值
    fundingRateThreshold: 0.01,      // 资金费率 > 1%
    priceChangeThreshold: 0.05,      // 价格波动 > 5%
    volumeSpikeThreshold: 3,         // 成交量放大 3 倍
    openInterestThreshold: 0.1,      // 持仓量变化 > 10%
    
    // 扫描设置
    scanInterval: 60000,             // 60 秒扫描一次
    topCoins: 20,                    // 监控前 20 个币种
    
    // 通知设置
    telegramBot: process.env.TELEGRAM_BOT_TOKEN || '',
    telegramChat: process.env.TELEGRAM_CHAT_ID || ''
};

class CryptoSignalMonitor {
    constructor() {
        this.lastData = new Map();
        this.signals = [];
        this.startTime = Date.now();
    }

    // 获取 Binance 永续合约数据
    async fetchBinanceData() {
        try {
            const [tickerResponse, fundingResponse] = await Promise.all([
                axios.get(`${CONFIG.binanceFutures}/fapi/v1/ticker/24hr`, { timeout: 10000 }),
                axios.get(`${CONFIG.binanceFutures}/fapi/v1/premiumIndex`, { timeout: 10000 })
            ]);
            
            const data = {};
            
            // 处理 24 小时行情
            tickerResponse.data.forEach(t => {
                if (t.symbol.endsWith('USDT') && !t.symbol.includes('BEAR') && !t.symbol.includes('BULL')) {
                    data[t.symbol] = {
                        symbol: t.symbol,
                        price: parseFloat(t.lastPrice),
                        priceChange24h: parseFloat(t.priceChangePercent),
                        volume24h: parseFloat(t.volume),
                        high24h: parseFloat(t.highPrice),
                        low24h: parseFloat(t.lowPrice)
                    };
                }
            });
            
            // 添加资金费率
            fundingResponse.data.forEach(f => {
                if (data[f.symbol]) {
                    data[f.symbol].fundingRate = parseFloat(f.lastFundingRate);
                    data[f.symbol].nextFundingTime = f.nextFundingTime;
                }
            });
            
            return data;
        } catch (err) {
            console.error('❌ Binance 数据获取失败:', err.message);
            return {};
        }
    }

    // 检测交易信号
    detectSignals(data) {
        const signals = [];
        
        for (const [symbol, info] of Object.entries(data)) {
            const coinSignals = [];
            
            // 信号 1: 高资金费率（正向套利机会）
            if (info.fundingRate > CONFIG.fundingRateThreshold) {
                coinSignals.push({
                    type: '🔥 高资金费率',
                    side: 'SHORT',
                    confidence: info.fundingRate > 0.02 ? '高' : '中',
                    reason: `资金费率 ${(info.fundingRate * 100).toFixed(3)}%`,
                    score: info.fundingRate * 1000
                });
            }
            
            // 信号 2: 价格大幅波动
            if (Math.abs(info.priceChange24h) > CONFIG.priceChangeThreshold * 100) {
                const direction = info.priceChange24h > 0 ? '上涨' : '下跌';
                coinSignals.push({
                    type: '📊 大幅波动',
                    side: info.priceChange24h > 0 ? 'SHORT' : 'LONG',
                    confidence: Math.abs(info.priceChange24h) > 10 ? '高' : '中',
                    reason: `24h ${direction} ${info.priceChange24h.toFixed(2)}%`,
                    score: Math.abs(info.priceChange24h) * 10
                });
            }
            
            // 信号 3: 接近 24h 高低点
            const priceRange = info.high24h - info.low24h;
            const pricePosition = (info.price - info.low24h) / priceRange;
            
            if (pricePosition < 0.1) {
                coinSignals.push({
                    type: '📍 接近 24h 低点',
                    side: 'LONG',
                    confidence: '中',
                    reason: `价格在 24h 区间底部 ${(pricePosition * 100).toFixed(1)}%`,
                    score: (1 - pricePosition) * 50
                });
            } else if (pricePosition > 0.9) {
                coinSignals.push({
                    type: '📍 接近 24h 高点',
                    side: 'SHORT',
                    confidence: '中',
                    reason: `价格在 24h 区间顶部 ${((1 - pricePosition) * 100).toFixed(1)}%`,
                    score: pricePosition * 50
                });
            }
            
            // 只保留得分最高的信号
            if (coinSignals.length > 0) {
                coinSignals.sort((a, b) => b.score - a.score);
                const topSignal = coinSignals[0];
                
                signals.push({
                    symbol: symbol.replace('USDT', ''),
                    price: info.price,
                    ...topSignal,
                    timestamp: Date.now()
                });
            }
        }
        
        // 按得分排序，返回前 10 个
        return signals.sort((a, b) => b.score - a.score).slice(0, 10);
    }

    // 格式化通知消息
    formatSignalMessage(signal) {
        const confidenceEmoji = signal.confidence === '高' ? '🔥' : '⚡';
        
        let msg = `${confidenceEmoji} *${signal.symbol}/USDT* 交易信号\n\n`;
        msg += `📊 信号类型：${signal.type}\n`;
        msg += `🎯 建议方向：**${signal.side}**\n`;
        msg += `💰 当前价格：$${signal.price.toFixed(4)}\n`;
        msg += `📈 置信度：${signal.confidence}\n\n`;
        msg += `📝 分析：${signal.reason}\n\n`;
        msg += `⏰ 时间：${new Date(signal.timestamp).toLocaleString('zh-CN')}`;
        
        return msg;
    }

    // 发送 Telegram 通知
    async sendNotification(message) {
        if (!CONFIG.telegramBot || !CONFIG.telegramChat) {
            console.log('📢', message.replace(/\*/g, ''));
            return;
        }
        
        try {
            await axios.post(
                `https://api.telegram.org/bot${CONFIG.telegramBot}/sendMessage`,
                {
                    chat_id: CONFIG.telegramChat,
                    text: message,
                    parse_mode: 'Markdown'
                }
            );
            console.log('✅ 通知已发送');
        } catch (err) {
            console.error('❌ 通知发送失败:', err.message);
        }
    }

    // 主扫描循环
    async scan() {
        console.log(`\n🔍 [${new Date().toLocaleString()}] 开始扫描市场...`);
        
        const data = await this.fetchBinanceData();
        const coinCount = Object.keys(data).length;
        console.log(`📈 获取到 ${coinCount} 个永续合约数据`);
        
        const signals = this.detectSignals(data);
        console.log(`🎯 发现 ${signals.length} 个交易信号`);
        
        // 发送前 3 个最强信号
        for (let i = 0; i < Math.min(3, signals.length); i++) {
            const signal = signals[i];
            const message = this.formatSignalMessage(signal);
            await this.sendNotification(message);
            
            // 避免频率限制
            await new Promise(r => setTimeout(r, 1000));
        }
        
        if (signals.length === 0) {
            console.log('ℹ️ 本次扫描未发现明显机会');
        }
        
        this.lastData = data;
    }

    // 启动监控
    start() {
        console.log('🦞 ' + '='.repeat(50));
        console.log('🦞 Crypto Signal 监控系统启动');
        console.log('🦞 ' + '='.repeat(50));
        console.log(`\n📊 监控设置:`);
        console.log(`   扫描间隔：${CONFIG.scanInterval / 1000}秒`);
        console.log(`   监控币种：Top ${CONFIG.topCoins}`);
        console.log(`   资金费率阈值：${(CONFIG.fundingRateThreshold * 100).toFixed(2)}%`);
        console.log(`   价格波动阈值：${(CONFIG.priceChangeThreshold * 100).toFixed(2)}%`);
        console.log(`\n⏰ 启动时间：${new Date().toLocaleString('zh-CN')}`);
        console.log(`\n🚀 开始监控...\n`);
        
        // 立即执行一次
        this.scan();
        
        // 定时扫描
        setInterval(() => this.scan(), CONFIG.scanInterval);
    }
}

// 启动监控
const monitor = new CryptoSignalMonitor();
monitor.start();
