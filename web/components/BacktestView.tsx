
import React, { useState, useEffect } from 'react';
import { Translations, BacktestRecord, BacktestResponse } from '../types';
import { fetchBacktestHistory } from '../services/api';
import { History, Loader2, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Clock } from 'lucide-react';

interface BacktestViewProps {
  t: Translations;
}

const BacktestView: React.FC<BacktestViewProps> = ({ t }) => {
  const [data, setData] = useState<BacktestRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pageSize = 20;

  useEffect(() => {
    loadData(page);
  }, [page]);

  const loadData = async (currentPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchBacktestHistory(currentPage, pageSize);
      if (response.code === 0) {
        setData(response.data);
        setHasMore(response.hasMore);
      } else {
        setError(response.message || 'Failed to fetch data');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number | null) => {
    if (price === null) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: price < 1 ? 4 : 2,
      maximumFractionDigits: price < 1 ? 6 : 2,
    }).format(price);
  };

  const formatPnl = (val: number | null) => {
    if (val === null) return '-';
    // API returns raw multiplier e.g. -0.082448, convert to percent
    const percent = val * 100;
    return `${percent > 0 ? '+' : ''}${percent.toFixed(2)}%`;
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return dateStr;
    }
  };
  
  const formatMarketCap = (mc: number | undefined) => {
    if (!mc) return '-';
    if (mc >= 1e9) return `$${(mc / 1e9).toFixed(1)}B`;
    if (mc >= 1e6) return `$${(mc / 1e6).toFixed(1)}M`;
    return `$${(mc / 1000).toFixed(0)}K`;
  };

  const getResultBadge = (record: BacktestRecord) => {
    if (record.hitTakeProfit) {
      return <span className="flex items-center gap-1 text-success font-bold"><CheckCircle2 size={16} /> {t.hitTP}</span>;
    }
    if (record.hitStopLoss) {
      return <span className="flex items-center gap-1 text-danger font-bold"><XCircle size={16} /> {t.hitSL}</span>;
    }
    return <span className="flex items-center gap-1 text-blue-500 font-bold"><Clock size={16} /> {t.running}</span>;
  };

  const getPnlColor = (val: number | null) => {
    if (val === null) return 'text-gray-400';
    return val >= 0 ? 'text-success' : 'text-danger';
  };

  return (
    <div className="bg-white dark:bg-card-dark rounded-3xl shadow-card dark:shadow-card-dark border border-gray-100 dark:border-gray-800 overflow-hidden min-h-[600px] animate-in fade-in slide-in-from-right-4 duration-500">
      
      {/* Header */}
      <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <History size={24} className="text-primary" />
          {t.backtest}
        </h2>
      </div>

      {/* Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left whitespace-nowrap">
          <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-sm uppercase font-bold tracking-wider">
            <tr>
              <th className="px-4 py-4">{t.time}</th>
              <th className="px-4 py-4">Symbol</th>
              <th className="px-4 py-4">{t.side}</th>
              <th className="px-4 py-4">{t.vol}</th>
              <th className="px-4 py-4">{t.funding}</th>
              <th className="px-4 py-4">{t.marketCap}</th>
              <th className="px-4 py-4">{t.oiToMc}</th>
              <th className="px-4 py-4 text-right">{t.entry}</th>
              <th className="px-4 py-4 text-right">{t.pnl4h}</th>
              <th className="px-4 py-4 text-right">{t.pnl12h}</th>
              <th className="px-4 py-4 text-right">{t.pnl24h}</th>
              <th className="px-4 py-4 text-center">{t.result}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading && data.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-6 py-20 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 size={32} className="animate-spin text-primary" />
                    <span className="text-gray-400">Loading history...</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-6 py-20 text-center text-gray-400 font-medium">
                  No backtest data available.
                </td>
              </tr>
            ) : (
              data.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400 font-mono">
                    {formatDate(record.captureTime)}
                  </td>
                  <td className="px-4 py-4">
                    <span className="font-bold text-gray-900 dark:text-white text-base">{record.symbol}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold ${record.side === 'LONG' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                      {record.side === 'LONG' ? t.long : t.short}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300 font-medium">
                    {record.volumeSurgeRatio ? `${record.volumeSurgeRatio.toFixed(1)}x` : '-'}
                  </td>
                  <td className={`px-4 py-4 text-sm font-medium ${record.fundingRate < 0 ? 'text-success' : 'text-danger'}`}>
                    {record.fundingRate ? `${record.fundingRate.toFixed(3)}%` : '-'}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300 font-medium">
                    {formatMarketCap(record.marketCap)}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300 font-medium">
                    {record.oiToMcRatio ? `${(record.oiToMcRatio * 100).toFixed(1)}%` : '-'}
                  </td>
                  <td className="px-4 py-4 text-right font-mono text-sm text-gray-900 dark:text-white">
                    {formatPrice(record.signalPrice)}
                  </td>
                  <td className={`px-4 py-4 text-right font-mono text-sm font-bold ${getPnlColor(record.pnl4h)}`}>
                    {formatPnl(record.pnl4h)}
                  </td>
                  <td className={`px-4 py-4 text-right font-mono text-sm font-bold ${getPnlColor(record.pnl12h)}`}>
                    {formatPnl(record.pnl12h)}
                  </td>
                  <td className={`px-4 py-4 text-right font-mono text-sm font-bold ${getPnlColor(record.pnl24h)}`}>
                    {formatPnl(record.pnl24h)}
                  </td>
                  <td className="px-4 py-4 text-center text-sm">
                    {getResultBadge(record)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
         <span className="text-sm text-gray-500 dark:text-gray-400">
           {t.page} {page}
         </span>
         <div className="flex gap-2">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
               <ChevronLeft size={20} className="text-gray-600 dark:text-gray-300" />
            </button>
            <button 
              onClick={() => setPage(p => p + 1)}
              disabled={!hasMore || loading}
              className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
               <ChevronRight size={20} className="text-gray-600 dark:text-gray-300" />
            </button>
         </div>
      </div>

    </div>
  );
};

export default BacktestView;
