
import React, { useState, useEffect } from 'react';
import { BinanceOrder, Translations, UserConfig } from '../types';
import { fetchBinanceOrders } from '../services/binanceService';
import { Search, Loader2, AlertCircle, Calendar, DollarSign, ListFilter } from 'lucide-react';

interface OrdersViewProps {
  config: UserConfig;
  t: Translations;
  onOpenSettings: () => void;
}

const OrdersView: React.FC<OrdersViewProps> = ({ config, t, onOpenSettings }) => {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [orders, setOrders] = useState<BinanceOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFetch = async () => {
    if (!config.binanceApiKey) {
      setError(t.loginRequired);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await fetchBinanceOrders(config, symbol);
      setOrders(data);
    } catch (err: any) {
      setError(err.message || t.apiError);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch if credentials exist
  useEffect(() => {
    if (config.binanceApiKey) {
      handleFetch();
    }
  }, [config]);

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (!config.binanceApiKey) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-card-dark rounded-3xl shadow-card dark:shadow-card-dark border border-gray-100 dark:border-gray-800">
        <div className="p-4 bg-orange-100 dark:bg-orange-900/20 rounded-full text-primary mb-4">
           <AlertCircle size={48} />
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t.configuration}</h3>
        <p className="text-gray-500 dark:text-gray-400 mb-6 text-center max-w-md">
          {t.loginRequired || "Please configure your Binance API Key and Secret in settings to view orders."}
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

  return (
    <div className="bg-white dark:bg-card-dark rounded-3xl shadow-card dark:shadow-card-dark border border-gray-100 dark:border-gray-800 overflow-hidden min-h-[600px]">
      
      {/* Header / Filter */}
      <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <ListFilter size={24} className="text-primary" />
          {t.orderHistory}
        </h2>

        <div className="flex w-full md:w-auto gap-2">
          <div className="relative flex-1 md:w-64">
            <input 
              type="text" 
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder={t.searchSymbol}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none text-gray-900 dark:text-white font-bold"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          </div>
          <button 
            onClick={handleFetch}
            disabled={loading}
            className="px-6 py-2.5 bg-gray-900 dark:bg-primary text-white rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : t.fetchOrders}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="m-6 p-4 bg-red-50 dark:bg-red-900/20 text-danger rounded-xl flex items-center gap-2 text-sm font-bold">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs uppercase font-bold tracking-wider">
            <tr>
              <th className="px-6 py-4">{t.time}</th>
              <th className="px-6 py-4">Symbol</th>
              <th className="px-6 py-4">{t.side}</th>
              <th className="px-6 py-4">{t.type}</th>
              <th className="px-6 py-4 text-right">{t.priceText}</th>
              <th className="px-6 py-4 text-right">{t.qty} / {t.filled}</th>
              <th className="px-6 py-4 text-center">{t.status}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
               <tr>
                 <td colSpan={7} className="px-6 py-20 text-center text-gray-400">
                   <div className="flex flex-col items-center gap-2">
                     <Loader2 size={32} className="animate-spin text-primary" />
                     <span>Loading...</span>
                   </div>
                 </td>
               </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-20 text-center text-gray-400 font-medium">
                  {t.noOrders}
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const isBuy = order.side === 'BUY';
                return (
                  <tr key={order.orderId} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap font-mono">
                      {formatDate(order.time)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-gray-900 dark:text-white">{order.symbol}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold ${isBuy ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                        {order.side} {order.positionSide !== 'BOTH' && `(${order.positionSide})`}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                      {order.type.replace(/_/g, ' ')}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-sm font-bold text-gray-900 dark:text-white">
                      {parseFloat(order.price) === 0 ? 'Market' : parseFloat(order.price).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right text-sm">
                      <div className="font-bold text-gray-900 dark:text-white">{parseFloat(order.origQty)}</div>
                      <div className="text-xs text-gray-400">{parseFloat(order.executedQty)} Filled</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full border ${
                        order.status === 'FILLED' ? 'border-success text-success' :
                        order.status === 'NEW' ? 'border-blue-500 text-blue-500' :
                        order.status === 'CANCELED' ? 'border-gray-400 text-gray-400' :
                        'border-orange-500 text-orange-500'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OrdersView;
