import React, { useState, useEffect } from 'react';
import { Activity, TrendingUp, TrendingDown, DollarSign, Clock, Target, XCircle, ArrowUpRight, Tag } from 'lucide-react';

interface Trade {
  id: number;
  signalId: number;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  entryTime: string;
  exitPrice?: number;
  exitTime?: string;
  exitReason?: string;
  stopLossPrice: number;
  takeProfitPrice: number;
  pnlPercent: number;
  pnlUSDT: number;
  isActive: boolean;
  currentPrice?: number;
  unrealizedPnl?: number;
}

interface TradeStats {
  totalTrades: number;
  activeTrades: number;
  winingTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnlUSDT: number;
  totalPnlPercent: number;
  avgWinPercent: number;
  avgLossPercent: number;
  profitFactor: number;
}

interface TradeViewProps {
  apiUrl: string;
}

const TradeView: React.FC<TradeViewProps> = ({ apiUrl }) => {
  const [stats, setStats] = useState<TradeStats | null>(null);
  const [activeTrades, setActiveTrades] = useState<Trade[]>([]);
  const [history, setHistory] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTradeData();
    const interval = setInterval(fetchTradeData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchTradeData = async () => {
    try {
      setError(null);
      const [statsRes, activeRes, historyRes] = await Promise.all([
        fetch(`/api/trades/stats`),
        fetch(`/api/trades/active`),
        fetch(`/api/trades/history?limit=50`)
      ]);

      const statsData = await statsRes.json();
      const activeData = await activeRes.json();
      const historyData = await historyRes.json();

      setStats(statsData.stats);
      setActiveTrades(activeData.trades || []);
      setHistory(historyData.trades || []);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch trade data:', err);
      setError('Failed to connect to API server');
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: price < 1 ? 4 : 2,
      maximumFractionDigits: price < 1 ? 6 : 2,
    }).format(price);
  };

  const formatTime = (timeStr: string) => {
    try {
      const date = new Date(timeStr);
      return date.toLocaleString([], { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch (e) {
      return timeStr;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 dark:text-gray-500 animate-pulse">Loading trades...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-400 dark:text-red-500 text-lg font-medium mb-2">{error}</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm">Make sure the backend is running</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* 统计面板 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<Activity className="w-5 h-5 text-blue-500" />}
            label="Total Trades"
            value={stats.totalTrades.toString()}
          />
          <StatCard
            icon={<TrendingUp className="w-5 h-5 text-green-500" />}
            label="Win Rate"
            value={`${stats.winRate.toFixed(1)}%`}
          />
          <StatCard
            icon={<DollarSign className="w-5 h-5 text-purple-500" />}
            label="Total PnL"
            value={`${stats.totalPnlUSDT >= 0 ? '+' : ''}${stats.totalPnlUSDT.toFixed(2)} USDT`}
            positive={stats.totalPnlUSDT >= 0}
          />
          <StatCard
            icon={<Target className="w-5 h-5 text-orange-500" />}
            label="Profit Factor"
            value={stats.profitFactor.toFixed(2)}
          />
        </div>
      )}

      {/* 选项卡 */}
      <div className="flex items-center gap-3 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 font-medium transition-all rounded-t-lg ${
            activeTab === 'active'
              ? 'bg-white dark:bg-gray-800 text-primary border-b-2 border-primary'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Active Positions ({activeTrades.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 font-medium transition-all rounded-t-lg ${
            activeTab === 'history'
              ? 'bg-white dark:bg-gray-800 text-primary border-b-2 border-primary'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Trade History ({history.length})
        </button>
      </div>

      {/* 当前持仓 */}
      {activeTab === 'active' && (
        <div className="space-y-4">
          {activeTrades.length === 0 ? (
            <div className="bg-white dark:bg-card-dark rounded-3xl p-12 shadow-card dark:shadow-card-dark border border-gray-100 dark:border-gray-800 text-center">
              <Activity className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
              <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">No active positions</p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">Waiting for trading signals...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeTrades.map(trade => (
                <TradeCard 
                  key={trade.id} 
                  trade={trade} 
                  isHistory={false}
                  formatPrice={formatPrice}
                  formatTime={formatTime}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 交易历史 */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {history.length === 0 ? (
            <div className="bg-white dark:bg-card-dark rounded-3xl p-12 shadow-card dark:shadow-card-dark border border-gray-100 dark:border-gray-800 text-center">
              <Clock className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
              <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">No trade history yet</p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">Your trades will appear here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map(trade => (
                <TradeCard 
                  key={trade.id} 
                  trade={trade} 
                  isHistory={true}
                  formatPrice={formatPrice}
                  formatTime={formatTime}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// 统计卡片组件
const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  positive?: boolean;
}> = ({ icon, label, value, positive }) => (
  <div className="bg-white dark:bg-card-dark rounded-3xl p-5 shadow-card dark:shadow-card-dark border border-gray-100 dark:border-gray-800 hover:shadow-card-hover transition-all duration-300">
    <div className="flex items-center gap-2 mb-2">
      {icon}
      <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">{label}</span>
    </div>
    <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
  </div>
);

// 交易卡片组件
const TradeCard: React.FC<{ 
  trade: Trade; 
  isHistory: boolean;
  formatPrice: (price: number) => string;
  formatTime: (time: string) => string;
}> = ({ trade, isHistory, formatPrice, formatTime }) => {
  const isLong = trade.side === 'LONG';
  const isProfitable = trade.pnlPercent >= 0;

  return (
    <div className="bg-white dark:bg-card-dark rounded-3xl p-6 shadow-card dark:shadow-card-dark border border-gray-100 dark:border-gray-800 hover:shadow-card-hover transition-all duration-300 group relative overflow-hidden">
      
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center font-bold text-gray-700 dark:text-gray-300 text-sm">
            {trade.symbol.substring(0, 1)}
          </div>
          <div>
            <div className="font-bold text-gray-900 dark:text-white text-lg flex items-center gap-2">
              {trade.symbol}
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                isLong ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
              }`}>
                {trade.side}
              </span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {formatTime(trade.entryTime)}
            </div>
          </div>
        </div>
        <div className={`text-2xl font-bold ${isProfitable ? 'text-green-500' : 'text-red-500'}`}>
          {isProfitable ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
        </div>
      </div>

      {/* Price Info */}
      <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b border-gray-100 dark:border-gray-700">
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Entry</div>
          <div className="font-semibold text-gray-900 dark:text-white">{formatPrice(trade.entryPrice)}</div>
        </div>
        {!isHistory && trade.currentPrice ? (
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Current</div>
            <div className="font-semibold text-gray-900 dark:text-white">{formatPrice(trade.currentPrice)}</div>
          </div>
        ) : isHistory && trade.exitPrice ? (
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Exit</div>
            <div className="font-semibold text-gray-900 dark:text-white">{formatPrice(trade.exitPrice)}</div>
          </div>
        ) : (
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Current</div>
            <div className="font-semibold text-gray-900 dark:text-white">---</div>
          </div>
        )}
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">PnL</div>
          <div className={`font-semibold ${isProfitable ? 'text-green-500' : 'text-red-500'}`}>
            {isProfitable ? '+' : ''}{trade.pnlUSDT.toFixed(2)} USDT
          </div>
        </div>
      </div>

      {/* Stop Loss / Take Profit */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <XCircle size={14} className="text-red-500" />
            <span className="text-xs text-red-600 dark:text-red-400 font-medium">Stop Loss</span>
          </div>
          <div className="text-sm font-semibold text-red-700 dark:text-red-300">{formatPrice(trade.stopLossPrice)}</div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/10 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Target size={14} className="text-green-500" />
            <span className="text-xs text-green-600 dark:text-green-400 font-medium">Take Profit</span>
          </div>
          <div className="text-sm font-semibold text-green-700 dark:text-green-300">{formatPrice(trade.takeProfitPrice)}</div>
        </div>
      </div>

      {/* Exit Info (History) */}
      {isHistory && trade.exitReason && (
        <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Tag size={14} className="text-gray-400" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Exit:</span>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
              {trade.exitReason.replace(/_/g, ' ')}
            </span>
          </div>
          {trade.exitTime && (
            <div className="text-xs text-gray-400 dark:text-gray-500">
              {formatTime(trade.exitTime)}
            </div>
          )}
        </div>
      )}

      {/* Unrealized PnL (Active) */}
      {!isHistory && (
        <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Unrealized PnL
            </div>
            <div className={`text-sm font-bold ${
              (trade.unrealizedPnl || 0) >= 0 ? 'text-green-500' : 'text-red-500'
            }`}>
              {(trade.unrealizedPnl || 0) >= 0 ? '+' : ''}{trade.unrealizedPnl?.toFixed(2) || '0.00'}%
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradeView;
