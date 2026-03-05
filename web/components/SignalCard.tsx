
import React from 'react';
import { SignalRecord, Translations } from '../types';
import { ArrowUpRight, TrendingUp, ShieldAlert, Target, Activity, Scale, MoveUpRight, MoveDownRight, ArrowDownRight, Tag, BarChart, Coins, Divide, Clock } from 'lucide-react';

interface SignalCardProps {
  data: SignalRecord;
  t: Translations;
  onTrade: (signal: SignalRecord) => void;
}

const SignalCard: React.FC<SignalCardProps> = ({ data, t, onTrade }) => {
  const isBullishFunding = data.fundingRate < 0;
  const isOverbought = data.currentRSI > 70;
  const isOversold = data.currentRSI < 30;
  const isLong = data.side === 'LONG';

  // Format currency
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: price < 1 ? 4 : 2,
      maximumFractionDigits: price < 1 ? 6 : 2,
    }).format(price);
  };

  // Values are already percentages, so we don't multiply by 100
  const formatPercent = (val: number) => `${val.toFixed(3)}%`;

  // Format Market Cap
  const formatMarketCap = (mc: number) => {
    if (!mc) return '---';
    if (mc >= 1e9) return `$${(mc / 1e9).toFixed(2)}B`;
    if (mc >= 1e6) return `$${(mc / 1e6).toFixed(2)}M`;
    return `$${mc.toLocaleString()}`;
  };

  // Format capture time
  const formatTime = (timeStr: string) => {
    try {
      const date = new Date(timeStr);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return timeStr;
    }
  };

  return (
    <div className="bg-white dark:bg-card-dark rounded-3xl p-6 shadow-card dark:shadow-card-dark hover:shadow-card-hover transition-all duration-300 border border-transparent hover:border-primary/20 group relative overflow-hidden flex flex-col justify-between h-full">
      
      {/* Header Section */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center font-bold text-gray-700 dark:text-gray-300 text-sm">
            {data.symbol.substring(0, 1)}
          </div>
          <div>
            <a 
              href={`https://www.marketwebb.me/zh-CN/futures/${data.symbol}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="font-bold text-gray-900 dark:text-white text-lg leading-tight hover:text-primary dark:hover:text-primary transition-colors flex items-center gap-1"
            >
              {data.symbol}
              <ArrowUpRight size={14} className="opacity-50" />
            </a>
            <div className="flex flex-wrap items-center gap-2 mt-1">
               <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{t.perpetual}</span>
               <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                  <Clock size={10} /> {formatTime(data.captureTime)}
               </span>
               {data.signalTag && (
                  <span className="text-[10px] bg-orange-100 dark:bg-orange-900/30 text-primary px-1.5 py-0.5 rounded flex items-center gap-1 font-bold">
                    <Tag size={10} /> {data.signalTag}
                  </span>
               )}
               {data.is24HrHigh && (
                  <span className="text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded flex items-center gap-1 font-bold">
                    <TrendingUp size={10} /> {t.newHigh}
                  </span>
               )}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className={`px-3 py-1 rounded-full text-xs font-bold border ${data.score >= 80 ? 'bg-primary/10 text-primary border-primary/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'}`}>
            {t.score} {data.score}
          </div>
          <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${isLong ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
             {isLong ? t.long : t.short}
          </div>
        </div>
      </div>

      {/* Price Section */}
      <div className="mb-6">
        <div className="flex items-baseline gap-2">
          <div className={`text-4xl font-bold tracking-tight ${isLong ? 'text-success' : 'text-danger'}`}>
            {formatPrice(data.markPrice)}
          </div>
          {data.priceChangeAfterSignal !== 0 && (
            <span className={`text-sm font-bold px-1.5 py-0.5 rounded ${data.priceChangeAfterSignal >= 0 ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'} flex items-center`}>
              {data.priceChangeAfterSignal > 0 ? <MoveUpRight size={12} /> : <MoveDownRight size={12} />}
              {Math.abs(data.priceChangeAfterSignal).toFixed(2)}%
            </span>
          )}
        </div>
        
        {/* Signal Entry Price & Timestamps */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
          <span className="text-xs text-gray-400 font-medium">
             {t.entry}: <span className="text-gray-600 dark:text-gray-300 font-bold">{formatPrice(data.price)}</span>
          </span>
          
          <div className="flex gap-2">
             {data.ema7CrossAboveEma2115m && (
                <span className="flex items-center gap-1 text-xs font-medium text-success bg-success/10 px-2 py-0.5 rounded-md">
                  <TrendingUp size={12} /> {t.goldenCross}
                </span>
             )}
             <span className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-md" title={t.riskReward}>
                <Scale size={12} /> 1:{data.rrr}
             </span>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-3 border border-gray-100 dark:border-gray-700">
          <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">{t.volSurge}</span>
          <div className="flex items-center gap-1">
             <Activity size={14} className="text-primary" />
             <span className="text-base font-bold text-gray-900 dark:text-white">{data.volumeSurgeRatio.toFixed(2)}x</span>
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-3 border border-gray-100 dark:border-gray-700">
          <div className="flex justify-between items-center mb-1">
             <span className="text-xs text-gray-500 dark:text-gray-400">{t.oiChange}</span>
             <BarChart size={12} className="text-gray-400" />
          </div>
          <span className="text-base font-bold text-gray-900 dark:text-white">
            {data.oiChange > 0 ? '+' : ''}{data.oiChange.toFixed(2)}%
          </span>
        </div>
        
        {/* Market Cap */}
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-3 border border-gray-100 dark:border-gray-700">
          <div className="flex justify-between items-center mb-1">
             <span className="text-xs text-gray-500 dark:text-gray-400">{t.marketCap}</span>
             <Coins size={12} className="text-gray-400" />
          </div>
          <span className="text-base font-bold text-gray-900 dark:text-white">{formatMarketCap(data.marketCap)}</span>
        </div>

        {/* OI / MC Ratio */}
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-3 border border-gray-100 dark:border-gray-700">
          <div className="flex justify-between items-center mb-1">
             <span className="text-xs text-gray-500 dark:text-gray-400">{t.oiToMc}</span>
             <Divide size={12} className="text-gray-400" />
          </div>
          <span className="text-base font-bold text-gray-900 dark:text-white">
            {data.oiToMcRatio ? `${(data.oiToMcRatio * 100).toFixed(2)}%` : '---'}
          </span>
        </div>
      </div>

      {/* Funding & RSI Compact Row */}
      <div className="flex gap-4 mb-6">
          <div className="flex-1">
             <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 mb-1">
                <span>{t.funding}</span>
                {data.lastFundingRate !== data.fundingRate && (
                   <span className="text-[10px] text-gray-400">{t.last}: {formatPercent(data.lastFundingRate)}</span>
                )}
             </div>
             <div className={`text-base font-bold ${isBullishFunding ? 'text-success' : 'text-danger'}`}>
                {formatPercent(data.fundingRate)}
             </div>
          </div>
          <div className="flex-1">
              <div className="flex justify-between text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                <span>RSI (14)</span>
                <span className={isOverbought ? 'text-danger' : isOversold ? 'text-success' : 'text-gray-900 dark:text-white'}>
                  {data.currentRSI.toFixed(1)}
                </span>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden w-full relative mt-1">
                 <div className="absolute top-0 bottom-0 left-[30%] w-[40%] bg-gray-200/50 dark:bg-gray-700/50"></div>
                 <div 
                   className={`h-full absolute rounded-full transition-all duration-500 ${isOverbought ? 'bg-danger' : isOversold ? 'bg-success' : 'bg-primary'}`}
                   style={{ width: `${Math.min(data.currentRSI, 100)}%` }}
                 />
              </div>
          </div>
      </div>

      {/* Strategy / Action Section */}
      <div className="space-y-3">
        {/* Stop Loss Input Style */}
        <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
               <ShieldAlert size={12} /> {t.stopLoss}
            </span>
            <span className="font-mono text-sm font-bold text-gray-900 dark:text-white">
                {formatPrice(data.stopLoss)}
            </span>
        </div>

        {/* Take Profit Input Style */}
        <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
               <Target size={12} /> {t.takeProfit}
            </span>
            <span className="font-mono text-sm font-bold text-gray-900 dark:text-white">
                {formatPrice(data.takeProfit)}
            </span>
        </div>

        <button 
          onClick={() => onTrade(data)}
          className={`w-full text-white font-bold py-3.5 rounded-2xl shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 mt-4 cursor-pointer ${isLong ? 'bg-success hover:bg-success/90' : 'bg-danger hover:bg-danger/90'}`}
        >
          {t.placeOrder} ({isLong ? t.long : t.short})
          {isLong ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
        </button>
      </div>

    </div>
  );
};

export default SignalCard;
