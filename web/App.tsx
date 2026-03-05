
import React, { useState, useEffect, useCallback } from 'react';
import { fetchSignals, fetchTicker } from './services/api';
import { SignalRecord, SortOption, Language, Translations, UserConfig, ViewMode, TickerData } from './types';
import SignalCard from './components/SignalCard';
import DashboardHeader from './components/DashboardHeader';
import AIInsight from './components/AIInsight';
import SettingsModal from './components/SettingsModal';
import AccountView from './components/AccountView';
import BacktestView from './components/BacktestView';
import TradeModal from './components/TradeModal';
import TradeView from './components/TradeView';
import { AlertCircle, Filter, BarChart3 } from 'lucide-react';

// Translation Dictionary
const translations: Record<Language, Translations> = {
  en: {
    trade: "Trade",
    vault: "Vault",
    compete: "Compete",
    activity: "Activity",
    account: "Account",
    referrals: "Referrals",
    scanMarket: "Scan Market",
    scanning: "Scanning...",
    signals: "Signals",
    active: "+Active",
    avgScore: "Avg Score",
    highVol: "High Vol",
    surge: "Surge",
    negFunding: "Neg Funding",
    squeeze: "Squeeze",
    perpetual: "Perpetual",
    score: "Score",
    goldenCross: "Golden Cross",
    volSurge: "Vol Surge",
    funding: "Funding",
    stopLoss: "Stop Loss",
    takeProfit: "Take Profit",
    placeBuy: "Place Buy",
    placeOrder: "Place Order",
    marketInsight: "Gemini Market Insight",
    sortBy: "Sort By",
    highestScore: "Highest Score",
    volumeSurge: "Volume Surge",
    rsiVolatility: "RSI Volatility",
    latest: "Latest",
    highOiMc: "Highest OI/MC",
    noSignals: "No active signals",
    marketQuiet: "The market is currently quiet. Check back soon.",
    apiError: "Failed to connect to signal server. Please check your network or try again later.",
    aiUnavailable: "AI Analysis temporarily unavailable.",
    riskReward: "Risk/Reward",
    markPrice: "Mark",
    pnl: "PnL",
    last: "Last",
    entry: "Signal Price",
    long: "Long",
    short: "Short",
    oiChange: "OI Change",
    tag: "Tag",
    newHigh: "24h High",
    marketCap: "Mkt Cap",
    oiToMc: "OI/MC",
    settings: "Settings",
    configuration: "Configuration",
    apiUrl: "Binance API URL",
    apiKey: "API Key",
    apiSecret: "API Secret",
    save: "Save",
    cancel: "Cancel",
    // Orders / Account
    orderHistory: "Order History",
    searchSymbol: "Search Symbol (e.g. BTCUSDT)",
    fetchOrders: "Fetch Orders",
    side: "Side",
    type: "Type",
    priceText: "Price",
    qty: "Qty",
    filled: "Filled",
    status: "Status",
    time: "Time",
    noOrders: "No orders found for this symbol.",
    loginRequired: "Please configure API keys to view account info.",
    // Account View
    walletBalance: "Wallet Balance",
    unrealizedPnl: "Unrealized PnL",
    availableBalance: "Available Balance",
    marginBalance: "Margin Balance",
    positions: "Positions",
    asset: "Asset",
    size: "Size",
    margin: "Margin",
    noPositions: "No active positions.",
    // Trade Modal
    confirmTrade: "Confirm Trade",
    selectAmount: "Select Amount",
    estQty: "Est. Quantity",
    execute: "Execute Order",
    executing: "Executing Strategy...",
    tradeSuccess: "Trade Executed Successfully",
    tradeFailed: "Trade Failed",
    logEntry: "Placing Market Entry...",
    logSL: "Setting Stop Loss...",
    logTP: "Setting Take Profit...",
    balanceWarning: "Ensure you have sufficient USDT in your Futures wallet.",
    custom: "Custom",
    // Ticker
    marketSentiment: "BTC Sentiment",
    vol: "Vol",
    // Backtest
    backtest: "Backtest",
    trades: "Trades",
    pnl4h: "4H PnL",
    pnl12h: "12H PnL",
    pnl24h: "24H PnL",
    result: "Result",
    hitTP: "Hit TP",
    hitSL: "Hit SL",
    running: "Running",
    next: "Next",
    prev: "Prev",
    page: "Page",
  },
  zh: {
    trade: "交易",
    vault: "金库",
    compete: "竞赛",
    activity: "活动/订单",
    account: "账户信息",
    referrals: "邀请",
    scanMarket: "扫描市场",
    scanning: "扫描中...",
    signals: "信号数量",
    active: "活跃中",
    avgScore: "平均得分",
    highVol: "巨量",
    surge: "激增",
    negFunding: "负费率",
    squeeze: "轧空",
    perpetual: "永续合约",
    score: "得分",
    goldenCross: "金叉",
    volSurge: "成交放量",
    funding: "费率",
    stopLoss: "止损",
    takeProfit: "止盈",
    placeBuy: "买入",
    placeOrder: "下单",
    marketInsight: "Gemini 市场洞察",
    sortBy: "排序",
    highestScore: "最高得分",
    volumeSurge: "成交量激增",
    rsiVolatility: "RSI 波动",
    latest: "最新信号",
    highOiMc: "最高 OI/市值",
    noSignals: "暂无活跃信号",
    marketQuiet: "市场当前较为平静，请稍后再试。",
    apiError: "连接信号服务器失败，请检查网络。",
    aiUnavailable: "AI 分析暂时不可用。",
    riskReward: "盈亏比",
    markPrice: "标记",
    pnl: "盈亏",
    last: "前值",
    entry: "信号价格",
    long: "做多",
    short: "做空",
    oiChange: "持仓变化",
    tag: "标签",
    newHigh: "24小时新高",
    marketCap: "市值",
    oiToMc: "OI/市值",
    settings: "设置",
    configuration: "配置",
    apiUrl: "Binance API 地址",
    apiKey: "API Key (密钥)",
    apiSecret: "API Secret (私钥)",
    save: "保存",
    cancel: "取消",
    // Orders
    orderHistory: "订单历史",
    searchSymbol: "搜索币对 (如 BTCUSDT)",
    fetchOrders: "查询订单",
    side: "方向",
    type: "类型",
    priceText: "价格",
    qty: "数量",
    filled: "已成交",
    status: "状态",
    time: "时间",
    noOrders: "该币对下暂无订单。",
    loginRequired: "请先在设置中配置 API Key。",
    // Account View
    walletBalance: "钱包余额",
    unrealizedPnl: "未实现盈亏",
    availableBalance: "可用余额",
    marginBalance: "保证金余额",
    positions: "持仓",
    asset: "资产",
    size: "仓位大小",
    margin: "保证金",
    noPositions: "当前无持仓。",
    // Trade Modal
    confirmTrade: "确认交易",
    selectAmount: "选择金额",
    estQty: "预估数量",
    execute: "确认下单",
    executing: "策略执行中...",
    tradeSuccess: "交易执行成功",
    tradeFailed: "交易失败",
    logEntry: "正在执行市价下单...",
    logSL: "正在设置止损...",
    logTP: "正在设置止盈...",
    balanceWarning: "请确保合约账户有足够的 USDT 余额。",
    custom: "自定义",
    // Ticker
    marketSentiment: "BTC 市场风向",
    vol: "量",
    // Backtest
    backtest: "回测数据",
    trades: "交易记录",
    pnl4h: "4H 盈亏",
    pnl12h: "12H 盈亏",
    pnl24h: "24H 盈亏",
    result: "结果",
    hitTP: "止盈",
    hitSL: "止损",
    running: "运行中",
    next: "下一页",
    prev: "上一页",
    page: "页码",
  }
};

const DEFAULT_CONFIG: UserConfig = {
  binanceApiUrl: 'https://fapi.binance.com',
  binanceApiKey: '',
  binanceApiSecret: ''
};

const App: React.FC = () => {
  const [signals, setSignals] = useState<SignalRecord[]>([]);
  const [btcTicker, setBtcTicker] = useState<TickerData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>(SortOption.TIME);
  const [currentView, setCurrentView] = useState<ViewMode>('signals');
  
  // Settings State
  const [lang, setLang] = useState<Language>('zh');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [userConfig, setUserConfig] = useState<UserConfig>(DEFAULT_CONFIG);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Trade Modal State
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [selectedSignal, setSelectedSignal] = useState<SignalRecord | null>(null);

  const t = translations[lang];

  // Initialize from LocalStorage
  useEffect(() => {
    const savedConfig = localStorage.getItem('titan_user_config');
    if (savedConfig) {
      try {
        setUserConfig(JSON.parse(savedConfig));
      } catch (e) {
        console.error("Failed to parse user config", e);
      }
    }
  }, []);

  // Apply theme to document
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const saveConfig = (newConfig: UserConfig) => {
    setUserConfig(newConfig);
    localStorage.setItem('titan_user_config', JSON.stringify(newConfig));
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [signalData, tickerRes] = await Promise.all([
        fetchSignals(),
        fetchTicker('btcusdt')
      ]);
      setSignals(signalData.records);
      setBtcTicker(tickerRes.ticker);
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
      setError(t.apiError);
    } finally {
      setLoading(false);
    }
  }, [t.apiError]);

  useEffect(() => {
    loadData();
    // Auto-refresh every 60 seconds
    const intervalId = setInterval(loadData, 60000);
    return () => clearInterval(intervalId);
  }, [loadData]);

  const openTradeModal = (signal: SignalRecord) => {
    setSelectedSignal(signal);
    setIsTradeModalOpen(true);
  };

  const sortedSignals = [...signals].sort((a, b) => {
    switch (sortBy) {
      case SortOption.SCORE:
        return b.score - a.score;
      case SortOption.VOLUME:
        return b.volumeSurgeRatio - a.volumeSurgeRatio;
      case SortOption.RSI:
        // Sort by how extreme the RSI is (distance from 50)
        return Math.abs(b.currentRSI - 50) - Math.abs(a.currentRSI - 50);
      case SortOption.TIME:
        return new Date(b.captureTime).getTime() - new Date(a.captureTime).getTime();
      case SortOption.OI_MC:
        return (b.oiToMcRatio || 0) - (a.oiToMcRatio || 0);
      default:
        return 0;
    }
  });

  return (
    <div className="min-h-screen bg-background dark:bg-background-dark text-gray-900 dark:text-white p-4 md:p-8 font-sans selection:bg-primary/20 transition-colors duration-300">
      <div className="max-w-[1400px] mx-auto">
        
        <DashboardHeader 
          signals={signals}
          btcTicker={btcTicker}
          onRefresh={loadData} 
          isLoading={loading}
          lastUpdated={lastUpdated}
          lang={lang}
          setLang={setLang}
          theme={theme}
          setTheme={setTheme}
          onOpenSettings={() => setIsSettingsOpen(true)}
          currentView={currentView}
          onNavigate={setCurrentView}
          t={t}
        />

        {currentView === 'trades' ? (
          <TradeView apiUrl="http://localhost:8666" />
        ) : currentView === 'signals' ? (
          <>
            <AIInsight signals={signals} lang={lang} t={t} />

            {/* Controls */}
            <div className="flex items-center justify-between mb-6 px-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="flex items-center gap-3">
                <div className="bg-white dark:bg-card-dark p-2 rounded-lg shadow-sm border border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400">
                   <Filter size={18} />
                </div>
                <span className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t.sortBy}</span>
                <div className="relative">
                  <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="appearance-none bg-white dark:bg-card-dark border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200 text-sm font-bold rounded-xl focus:ring-2 focus:ring-primary focus:border-primary block p-2.5 pr-8 outline-none shadow-sm cursor-pointer hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                  >
                    <option value={SortOption.TIME}>{t.latest}</option>
                    <option value={SortOption.SCORE}>{t.highestScore}</option>
                    <option value={SortOption.OI_MC}>{t.highOiMc}</option>
                    <option value={SortOption.VOLUME}>{t.volumeSurge}</option>
                    <option value={SortOption.RSI}>{t.rsiVolatility}</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500 dark:text-gray-400">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Content Area */}
            {error && (
              <div className="bg-white dark:bg-card-dark border border-red-100 dark:border-red-900/30 text-danger p-6 rounded-3xl shadow-card dark:shadow-card-dark flex items-center gap-4 mb-6">
                <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded-full">
                  <AlertCircle size={24} />
                </div>
                <p className="font-medium">{error}</p>
              </div>
            )}

            {sortedSignals.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-8 animate-in fade-in duration-700">
                {sortedSignals.map((signal) => (
                  <SignalCard 
                    key={signal.id} 
                    data={signal} 
                    t={t} 
                    onTrade={openTradeModal}
                  />
                ))}
              </div>
            ) : (
              !loading && !error && (
                <div className="text-center py-32">
                  <div className="inline-block p-6 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                     <Filter className="text-gray-400 dark:text-gray-500" size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t.noSignals}</h3>
                  <p className="text-gray-500 dark:text-gray-400 mt-2">{t.marketQuiet}</p>
                </div>
              )
            )}
            
            {loading && signals.length === 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                 {[1, 2, 3].map((i) => (
                   <div key={i} className="h-[450px] bg-white dark:bg-card-dark rounded-3xl animate-pulse shadow-card dark:shadow-card-dark p-6">
                      <div className="flex justify-between mb-8">
                        <div className="h-10 w-10 bg-gray-100 dark:bg-gray-800 rounded-full"></div>
                        <div className="h-6 w-20 bg-gray-100 dark:bg-gray-800 rounded-full"></div>
                      </div>
                      <div className="h-12 w-3/4 bg-gray-100 dark:bg-gray-800 rounded-xl mb-6"></div>
                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="h-20 bg-gray-50 dark:bg-gray-800 rounded-2xl"></div>
                        <div className="h-20 bg-gray-50 dark:bg-gray-800 rounded-2xl"></div>
                      </div>
                      <div className="h-20 bg-gray-50 dark:bg-gray-800 rounded-2xl mb-4"></div>
                      <div className="h-12 w-full bg-gray-200 dark:bg-gray-700 rounded-2xl mt-8"></div>
                   </div>
                 ))}
              </div>
            )}
          </>
        ) : currentView === 'backtest' ? (
          <BacktestView t={t} />
        ) : (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <AccountView config={userConfig} t={t} onOpenSettings={() => setIsSettingsOpen(true)} />
          </div>
        )}

        {/* Settings Modal */}
        <SettingsModal 
          isOpen={isSettingsOpen} 
          onClose={() => setIsSettingsOpen(false)}
          config={userConfig}
          onSave={saveConfig}
          t={t}
        />

        {/* Trade Modal */}
        <TradeModal 
          isOpen={isTradeModalOpen}
          onClose={() => setIsTradeModalOpen(false)}
          signal={selectedSignal}
          config={userConfig}
          t={t}
        />

      </div>
    </div>
  );
};

export default App;
