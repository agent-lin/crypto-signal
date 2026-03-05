
import React, { useState, useEffect } from 'react';
import { SignalRecord, Language, Translations, ViewMode, TickerData } from '../types';
import { Zap, BarChart3, RefreshCw, Wallet, Bell, ChevronDown, Moon, Sun, Languages, Settings, LayoutGrid, User, TrendingUp, TrendingDown, Bitcoin, History } from 'lucide-react';

interface DashboardHeaderProps {
  signals: SignalRecord[];
  btcTicker: TickerData | null;
  onRefresh: () => void;
  isLoading: boolean;
  lastUpdated: Date | null;
  lang: Language;
  setLang: (lang: Language) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  onOpenSettings: () => void;
  currentView: ViewMode;
  onNavigate: (view: ViewMode) => void;
  t: Translations;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({ 
  signals, btcTicker, onRefresh, isLoading, lastUpdated, 
  lang, setLang, theme, setTheme, onOpenSettings, 
  currentView, onNavigate, t 
}) => {
  const [timeLeft, setTimeLeft] = useState<number>(60);

  // Reset timer when data is updated (successful fetch)
  useEffect(() => {
    setTimeLeft(60);
  }, [lastUpdated]);

  // Countdown logic
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const avgScore = signals.length > 0 
    ? (signals.reduce((acc, curr) => acc + curr.score, 0) / signals.length).toFixed(0) 
    : 0;

  const highVolCount = signals.filter(s => s.volumeSurgeRatio > 2).length;
  const negFundingCount = signals.filter(s => s.fundingRate < 0).length;

  const formatPrice = (price: string) => {
    const p = parseFloat(price);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(p);
  };
  
  const formatVol = (vol: string) => {
    const v = parseFloat(vol);
    if (v >= 1000000) return `${(v / 1000000).toFixed(2)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(2)}K`;
    return v.toFixed(0);
  };

  return (
    <div className="mb-10">
      {/* Navbar Style Top Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 bg-white/50 dark:bg-card-dark/50 backdrop-blur-sm p-4 rounded-3xl border border-white dark:border-gray-800 shadow-sm transition-colors duration-300">
        <div className="flex items-center gap-12">
          {/* Logo */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => onNavigate('signals')}>
            <div className="bg-primary text-white p-1.5 rounded-full">
              <Zap size={20} fill="currentColor" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
              Titan<span className="text-primary">Signal</span>
            </h1>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-2 text-sm font-medium">
            <button 
              onClick={() => onNavigate('signals')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${currentView === 'signals' ? 'bg-white dark:bg-gray-800 text-primary shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              <LayoutGrid size={16} />
              {t.trade}
            </button>
            <button 
              onClick={() => onNavigate('backtest')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${currentView === 'backtest' ? 'bg-white dark:bg-gray-800 text-primary shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              <History size={16} />
              {t.backtest}
            </button>
            <button 
              onClick={() => onNavigate('trades')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${currentView === 'trades' ? 'bg-white dark:bg-gray-800 text-primary shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              <BarChart3 size={16} />
              Trades
            </button>
            <button 
              onClick={() => onNavigate('account')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${currentView === 'account' ? 'bg-white dark:bg-gray-800 text-primary shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              <User size={16} />
              {t.account}
            </button>
            <button className="px-4 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">{t.vault}</button>
            <button className="px-4 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">{t.compete}</button>
          </nav>
        </div>
        
        {/* Right Actions */}
        <div className="flex items-center gap-3 mt-4 md:mt-0">
          
          {/* Language Toggle */}
          <button 
            onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
            className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors flex items-center gap-1"
            title="Switch Language"
          >
            <Languages size={20} />
            <span className="text-xs font-bold uppercase">{lang}</span>
          </button>

          {/* Theme Toggle */}
          <button 
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            title="Toggle Theme"
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>

          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-full text-xs font-medium text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
             <span>0xBwq...1248</span>
             <ChevronDown size={14} />
          </div>
          
          <button 
            onClick={onOpenSettings}
            className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            title="API Settings"
          >
            <Settings size={20} />
          </button>
          
          <button className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
            <Bell size={20} />
          </button>
          
          <button 
            onClick={onRefresh}
            disabled={isLoading}
            className={`flex items-center gap-2 px-5 py-2.5 bg-gray-900 dark:bg-primary hover:bg-black dark:hover:bg-primary-600 text-white rounded-xl font-medium text-sm transition-all shadow-lg hover:shadow-xl active:scale-95 ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            {isLoading ? t.scanning : (
              <span className="flex items-center gap-1">
                {t.scanMarket}
                <span className="font-mono text-xs opacity-70 bg-white/20 px-1.5 py-0.5 rounded ml-1 min-w-[30px] text-center">
                  {timeLeft}s
                </span>
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Summary Cards - Only show on Signals View */}
      {currentView === 'signals' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
          
          {/* BTC Market Indicator Card */}
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 dark:from-primary dark:to-orange-700 text-white p-5 rounded-3xl shadow-card dark:shadow-card-dark flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <Bitcoin size={64} />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold opacity-80">{t.marketSentiment}</span>
              </div>
              <div className="flex items-end gap-2 mb-2">
                 <span className="text-2xl font-bold tracking-tight">
                   {btcTicker ? parseFloat(btcTicker.lastPrice).toLocaleString() : '---'}
                 </span>
              </div>
              {btcTicker && (
                 <div className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded w-fit ${parseFloat(btcTicker.priceChangePercent) >= 0 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                    {parseFloat(btcTicker.priceChangePercent) >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {btcTicker.priceChangePercent}%
                 </div>
              )}
            </div>
            {btcTicker && (
              <div className="relative z-10 flex justify-between items-end mt-2 pt-2 border-t border-white/10">
                 <div className="text-[10px] opacity-70">
                   H: {parseFloat(btcTicker.highPrice).toLocaleString()}
                 </div>
                 <div className="text-[10px] opacity-70">
                   {t.vol}: {formatVol(btcTicker.quoteVolume)}
                 </div>
              </div>
            )}
          </div>

          {/* Active Signals Card */}
          <div className="bg-white dark:bg-card-dark p-5 rounded-3xl shadow-card dark:shadow-card-dark border border-white dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 transition-all">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-full text-blue-500 dark:text-blue-400">
                <BarChart3 size={18} />
              </div>
              <span className="text-sm font-bold text-gray-400 dark:text-gray-500">{t.signals}</span>
            </div>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-bold text-gray-900 dark:text-white">{signals.length}</span>
              <span className="text-xs font-medium text-green-500 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">{t.active}</span>
            </div>
          </div>

          {/* Score Card */}
          <div className="bg-white dark:bg-card-dark p-5 rounded-3xl shadow-card dark:shadow-card-dark border border-white dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 transition-all">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-orange-50 dark:bg-orange-900/30 rounded-full text-primary">
                <Zap size={18} fill="currentColor" />
              </div>
              <span className="text-sm font-bold text-gray-400 dark:text-gray-500">{t.avgScore}</span>
            </div>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-bold text-gray-900 dark:text-white">{avgScore}</span>
              <div className="h-6 w-16 bg-gradient-to-r from-orange-100 to-white dark:from-orange-900/40 dark:to-card-dark rounded-full relative overflow-hidden">
                  <div className="absolute top-0 bottom-0 left-0 bg-primary/20 w-[70%]"></div>
              </div>
            </div>
          </div>

          {/* Volume Surge Card */}
          <div className="bg-white dark:bg-card-dark p-5 rounded-3xl shadow-card dark:shadow-card-dark border border-white dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 transition-all">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-full text-purple-500 dark:text-purple-400">
                <BarChart3 size={18} />
              </div>
              <span className="text-sm font-bold text-gray-400 dark:text-gray-500">{t.highVol}</span>
            </div>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-bold text-gray-900 dark:text-white">{highVolCount}</span>
              <span className="text-xs text-gray-400">{t.surge} {'>'} 2x</span>
            </div>
          </div>

          {/* Funding Card */}
          <div className="bg-white dark:bg-card-dark p-5 rounded-3xl shadow-card dark:shadow-card-dark border border-white dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 transition-all">
            <div className="flex items-center gap-3 mb-2">
               <div className="p-2 bg-red-50 dark:bg-red-900/30 rounded-full text-danger">
                <Wallet size={18} />
              </div>
              <span className="text-sm font-bold text-gray-400 dark:text-gray-500">{t.negFunding}</span>
            </div>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-bold text-gray-900 dark:text-white">{negFundingCount}</span>
              <span className="text-xs font-medium text-danger bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-full">{t.squeeze}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardHeader;
