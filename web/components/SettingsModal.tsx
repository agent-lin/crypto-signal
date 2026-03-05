import React, { useState, useEffect } from 'react';
import { UserConfig, Translations } from '../types';
import { X, Save, Lock, Globe, Key } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: UserConfig;
  onSave: (config: UserConfig) => void;
  t: Translations;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, config, onSave, t }) => {
  const [formData, setFormData] = useState<UserConfig>(config);

  useEffect(() => {
    if (isOpen) {
      setFormData(config);
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity">
      <div className="bg-white dark:bg-card-dark rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800 transform transition-all scale-100">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            {t.settings}
          </h2>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
              {t.configuration}
            </h3>

            {/* API URL */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Globe size={14} />
                {t.apiUrl}
              </label>
              <input
                type="text"
                name="binanceApiUrl"
                value={formData.binanceApiUrl}
                onChange={handleChange}
                placeholder="https://api.binance.com"
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none text-gray-900 dark:text-white transition-all placeholder-gray-400"
              />
            </div>

            {/* API Key */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Key size={14} />
                {t.apiKey}
              </label>
              <input
                type="text"
                name="binanceApiKey"
                value={formData.binanceApiKey}
                onChange={handleChange}
                placeholder="Enter your API Key"
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none text-gray-900 dark:text-white transition-all placeholder-gray-400"
              />
            </div>

            {/* API Secret */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Lock size={14} />
                {t.apiSecret}
              </label>
              <input
                type="password"
                name="binanceApiSecret"
                value={formData.binanceApiSecret}
                onChange={handleChange}
                placeholder="••••••••••••••••••••••••"
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none text-gray-900 dark:text-white transition-all placeholder-gray-400 font-mono"
              />
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-primary hover:bg-primary-600 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Save size={18} />
              {t.save}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default SettingsModal;