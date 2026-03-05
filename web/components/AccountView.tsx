
import React, { useState, useEffect } from 'react';
import { BinanceAccountInfo, Translations, UserConfig } from '../types';
import { fetchBinanceAccount } from '../services/binanceService';
import { Wallet, Loader2, AlertCircle, TrendingUp, RefreshCw, Briefcase, DollarSign } from 'lucide-react';

interface AccountViewProps {
  config: UserConfig;
  t: Translations;
  onOpenSettings: () => void;
}

const AccountView: React.FC<AccountViewProps> = ({ config, t, onOpenSettings }) => {
  const [accountInfo, setAccountInfo] = useState<BinanceAccountInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFetch = async () => {
    if (!config.binanceApiKey || !config.binanceApiSecret) {
      setError(t.loginRequired);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await fetchBinanceAccount(config);
      setAccountInfo(data);
    } catch (err: any) {
      console.error('Account fetch error:', err);
      setError(err.message || t.apiError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch if API keys are configured
    if (config.binanceApiKey && config.binanceApiSecret) {
      handleFetch();
    }
  }, [config.binanceApiKey, config.binanceApiSecret]);

  if (!config.binanceApiKey) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-card-dark rounded-3xl shadow-card dark:shadow-card-dark border border-gray-100 dark:border-gray-800">
        <div className="p-4 bg-orange-100 dark:bg-orange-900/20 rounded-full text-primary mb-4">
           <AlertCircle size={48} />
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t.configuration}</h3>
        <p className="text-gray-500 dark:text-gray-400 mb-6 text-center max-w-md">
          {t.loginRequired || "Please configure your Binance API Key and Secret in settings to view account info."}
        </p>
        <button 
          onClick={onOpenSettings}
          className="px-6 py-3 bg-primary hover:bg-primary-600 text-white rounded-xl font-bold shadow-lg transition-all"
        >
          {t.settings}
        </button>
      </div>
    );
  }

  // Format Helpers
  const formatUSD = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '$0.00';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(num);
  };

  const activePositions = accountInfo?.positions?.filter(p => parseFloat(p.positionAmt || '0') !== 0) || [];

  return (
    <div className="space-y-6">
      
      {/* Header & Refresh */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
           <Wallet className="text-primary" /> {t.account}
        </h2>
        <button 
            onClick={handleFetch}
            disabled={loading}
            className="p-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors disabled:opacity-50"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-danger rounded-xl flex items-center gap-2 text-sm font-bold">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {loading && !accountInfo ? (
        <div className="flex justify-center py-20">
           <Loader2 size={40} className="animate-spin text-primary" />
        </div>
      ) : accountInfo ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Wallet Balance */}
            <div className="bg-white dark:bg-card-dark p-6 rounded-3xl shadow-card dark:shadow-card-dark border border-gray-100 dark:border-gray-800">
               <div className="flex items-center gap-2 mb-2 text-gray-500 dark:text-gray-400 font-medium">
                  <Wallet size={18} />
                  <span>{t.walletBalance}</span>
               </div>
               <div className="text-3xl font-bold text-gray-900 dark:text-white">
                  {formatUSD(accountInfo?.totalWalletBalance)}
               </div>
               <div className="text-sm text-gray-400 mt-1">
                 {t.availableBalance}: <span className="text-gray-700 dark:text-gray-300 font-bold">{formatUSD(accountInfo?.availableBalance)}</span>
               </div>
            </div>

            {/* Unrealized PnL */}
            <div className="bg-white dark:bg-card-dark p-6 rounded-3xl shadow-card dark:shadow-card-dark border border-gray-100 dark:border-gray-800">
               <div className="flex items-center gap-2 mb-2 text-gray-500 dark:text-gray-400 font-medium">
                  <TrendingUp size={18} />
                  <span>{t.unrealizedPnl}</span>
               </div>
               <div className={`text-3xl font-bold ${parseFloat(accountInfo.totalUnrealizedProfit) >= 0 ? 'text-success' : 'text-danger'}`}>
                  {parseFloat(accountInfo.totalUnrealizedProfit) > 0 ? '+' : ''}{formatUSD(accountInfo.totalUnrealizedProfit)}
               </div>
               <div className="text-sm text-gray-400 mt-1">
                 Total Cross UnPnl
               </div>
            </div>

             {/* Margin Balance */}
             <div className="bg-white dark:bg-card-dark p-6 rounded-3xl shadow-card dark:shadow-card-dark border border-gray-100 dark:border-gray-800">
               <div className="flex items-center gap-2 mb-2 text-gray-500 dark:text-gray-400 font-medium">
                  <Briefcase size={18} />
                  <span>{t.marginBalance}</span>
               </div>
               <div className="text-3xl font-bold text-gray-900 dark:text-white">
                  {formatUSD(accountInfo.totalMarginBalance)}
               </div>
               <div className="text-sm text-gray-400 mt-1">
                 Maint. Margin: {formatUSD(accountInfo.totalMaintMargin)}
               </div>
            </div>
          </div>

          {/* Positions Table */}
          <div className="bg-white dark:bg-card-dark rounded-3xl shadow-card dark:shadow-card-dark border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800">
               <h3 className="font-bold text-lg text-gray-900 dark:text-white">{t.positions}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs uppercase font-bold tracking-wider">
                  <tr>
                    <th className="px-6 py-4">{t.asset}</th>
                    <th className="px-6 py-4">{t.size}</th>
                    <th className="px-6 py-4 text-right">{t.entry}</th>
                    <th className="px-6 py-4 text-right">{t.unrealizedPnl}</th>
                    <th className="px-6 py-4 text-right">{t.margin}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                   {activePositions.length === 0 ? (
                     <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                          {t.noPositions || "No open positions"}
                        </td>
                     </tr>
                   ) : (
                     activePositions.map((pos) => {
                       const size = parseFloat(pos.positionAmt);
                       const pnl = parseFloat(pos.unrealizedProfit);
                       const side = size > 0 ? 'LONG' : 'SHORT';
                       
                       return (
                         <tr key={pos.symbol} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-bold text-gray-900 dark:text-white">{pos.symbol}</div>
                              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${side === 'LONG' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                                {pos.leverage}x {side}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-mono text-sm text-gray-700 dark:text-gray-300">
                              {size}
                            </td>
                            <td className="px-6 py-4 text-right font-mono text-sm text-gray-700 dark:text-gray-300">
                               {parseFloat(pos.entryPrice).toFixed(4)}
                            </td>
                            <td className={`px-6 py-4 text-right font-bold font-mono ${pnl >= 0 ? 'text-success' : 'text-danger'}`}>
                               {pnl > 0 ? '+' : ''}{pnl.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 text-right font-mono text-sm text-gray-700 dark:text-gray-300">
                               {parseFloat(pos.initialMargin).toFixed(2)}
                            </td>
                         </tr>
                       );
                     })
                   )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

    </div>
  );
};

export default AccountView;
