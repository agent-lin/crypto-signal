
import React, { useState } from 'react';
import { SignalRecord, UserConfig, Translations } from '../types';
import { executeTradeStrategy } from '../services/binanceService';
import { X, Wallet, ArrowRight, CheckCircle2, AlertTriangle, Loader2, Terminal, Edit3 } from 'lucide-react';

interface TradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  signal: SignalRecord | null;
  config: UserConfig;
  t: Translations;
}

const AMOUNTS = [5, 10, 30, 50];

const TradeModal: React.FC<TradeModalProps> = ({ isOpen, onClose, signal, config, t }) => {
  const [selectedAmount, setSelectedAmount] = useState<number>(10);
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [customValue, setCustomValue] = useState<string>('');
  
  const [status, setStatus] = useState<'idle' | 'executing' | 'success' | 'error'>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>('');

  if (!isOpen || !signal) return null;

  const isLong = signal.side === 'LONG';

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `> ${msg}`]);
  };

  const handleAmountSelect = (amount: number) => {
    setSelectedAmount(amount);
    setIsCustom(false);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomValue(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      setSelectedAmount(num);
    }
  };

  const handleExecute = async () => {
    if (!config.binanceApiKey) {
      setErrorMessage(t.loginRequired);
      setStatus('error');
      return;
    }

    if (selectedAmount <= 0) {
      setErrorMessage("Please enter a valid amount.");
      setStatus('error');
      return;
    }

    setStatus('executing');
    setLogs([]);
    setErrorMessage('');

    try {
      addLog(`Initializing ${signal.side} trade for ${signal.symbol}...`);
      await executeTradeStrategy(config, signal, selectedAmount, addLog);
      setStatus('success');
    } catch (e: any) {
      console.error(e);
      setErrorMessage(e.message || "Unknown error occurred");
      setStatus('error');
    }
  };

  const resetModal = () => {
    setStatus('idle');
    setLogs([]);
    setErrorMessage('');
    onClose();
  };

  const estQty = (selectedAmount / signal.markPrice).toFixed(4);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all">
      <div className="bg-white dark:bg-card-dark rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800 transform transition-all scale-100 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                {signal.symbol.substring(0, 1)}
             </div>
             <div>
               <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                 {t.confirmTrade}
                 <span className={`text-xs px-2 py-0.5 rounded-full ${isLong ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                   {isLong ? t.long : t.short}
                 </span>
               </h2>
               <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">{signal.symbol} Perpetual</span>
             </div>
          </div>
          <button 
            onClick={resetModal}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          {status === 'idle' || status === 'error' ? (
            <>
              {/* Amounts Grid */}
              <div className="mb-6">
                <label className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-3 block">{t.selectAmount} (USDT)</label>
                <div className="grid grid-cols-3 gap-3">
                  {AMOUNTS.map(amount => (
                    <button
                      key={amount}
                      onClick={() => handleAmountSelect(amount)}
                      className={`py-3 rounded-xl font-bold transition-all ${
                        selectedAmount === amount && !isCustom
                          ? 'bg-primary text-white shadow-lg shadow-primary/30 scale-105' 
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      ${amount}
                    </button>
                  ))}
                  <button
                      onClick={() => {
                        setIsCustom(true);
                        setCustomValue('');
                      }}
                      className={`py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-1 ${
                        isCustom
                          ? 'bg-primary text-white shadow-lg shadow-primary/30 scale-105' 
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {t.custom} <Edit3 size={12} />
                    </button>
                </div>
                
                {isCustom && (
                  <div className="mt-3 animate-in fade-in slide-in-from-top-1">
                     <div className="relative">
                       <input 
                         type="number"
                         value={customValue}
                         onChange={handleCustomChange}
                         placeholder="Enter amount..."
                         className="w-full pl-8 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none text-gray-900 dark:text-white font-bold"
                         autoFocus
                       />
                       <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                     </div>
                  </div>
                )}
              </div>

              {/* Summary */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 space-y-3 mb-6 border border-gray-100 dark:border-gray-700">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 dark:text-gray-400 text-sm font-medium">{t.entry}</span>
                  <span className="font-bold text-gray-900 dark:text-white">Market</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 dark:text-gray-400 text-sm font-medium">{t.estQty}</span>
                  <span className="font-bold text-gray-900 dark:text-white">{estQty} {signal.symbol.replace('USDT', '')}</span>
                </div>
                <div className="flex justify-between items-center text-success">
                  <span className="text-sm font-medium">{t.takeProfit}</span>
                  <span className="font-bold">{signal.takeProfit}</span>
                </div>
                <div className="flex justify-between items-center text-danger">
                  <span className="text-sm font-medium">{t.stopLoss}</span>
                  <span className="font-bold">{signal.stopLoss}</span>
                </div>
              </div>

              {/* Error Display */}
              {status === 'error' && (
                <div className="mb-6 bg-red-50 dark:bg-red-900/20 text-danger p-4 rounded-xl flex items-start gap-3 text-sm font-medium">
                  <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold mb-1">{t.tradeFailed}</p>
                    <p className="opacity-90">{errorMessage}</p>
                  </div>
                </div>
              )}

              <button
                onClick={handleExecute}
                className={`w-full text-white font-bold py-4 rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 ${isLong ? 'bg-success hover:bg-success/90' : 'bg-danger hover:bg-danger/90'}`}
              >
                {t.execute} ({isLong ? t.long : t.short})
                <ArrowRight size={18} />
              </button>
            </>
          ) : (
            <div className="py-4">
               {status === 'executing' ? (
                 <div className="flex flex-col items-center justify-center mb-8">
                   <div className="relative">
                     <div className="w-16 h-16 border-4 border-gray-200 dark:border-gray-700 rounded-full"></div>
                     <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                   </div>
                   <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-4">{t.executing}</h3>
                 </div>
               ) : (
                 <div className="flex flex-col items-center justify-center mb-8">
                   <div className="w-16 h-16 bg-success/10 text-success rounded-full flex items-center justify-center mb-4">
                     <CheckCircle2 size={32} />
                   </div>
                   <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t.tradeSuccess}</h3>
                 </div>
               )}

               {/* Logs Console */}
               <div className="bg-gray-900 rounded-xl p-4 font-mono text-xs text-green-400 h-48 overflow-y-auto space-y-1 shadow-inner border border-gray-700">
                  <div className="flex items-center gap-2 text-gray-500 mb-2 pb-2 border-b border-gray-800">
                    <Terminal size={14} />
                    <span>System Logs</span>
                  </div>
                  {logs.map((log, idx) => (
                    <div key={idx} className="break-all">{log}</div>
                  ))}
                  {status === 'executing' && (
                    <div className="animate-pulse">_</div>
                  )}
               </div>

               {status === 'success' && (
                 <button
                   onClick={resetModal}
                   className="w-full mt-6 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-bold py-3.5 rounded-2xl transition-all"
                 >
                   Close
                 </button>
               )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default TradeModal;
