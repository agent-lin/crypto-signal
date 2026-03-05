import React, { useEffect, useState, useRef } from 'react';
import { SignalRecord, Language, Translations } from '../types';
import { analyzeSignals } from '../services/geminiService';
import { Bot, Sparkles } from 'lucide-react';

interface AIInsightProps {
  signals: SignalRecord[];
  lang: Language;
  t: Translations;
}

const AIInsight: React.FC<AIInsightProps> = ({ signals, lang, t }) => {
  const [insight, setInsight] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  
  // Cache key to prevent redundant API calls
  const lastAnalysisKey = useRef<string>('');

  useEffect(() => {
    if (signals.length === 0) return;

    // Create a unique key for the current data state + language
    // We use the top signal's capture time and the language as a composite key
    const topSignal = signals[0];
    const dataKey = `${topSignal.symbol}-${topSignal.captureTime}-${signals.length}-${lang}`;

    // If key matches last successful fetch, skip to save quota
    if (lastAnalysisKey.current === dataKey && insight) {
      return;
    }

    const fetchAnalysis = async () => {
      setLoading(true);
      
      // If we don't have any insight yet, we can show loading, otherwise keep showing old insight
      if (!insight) setInsight('');

      try {
        const result = await analyzeSignals(signals, lang);
        setInsight(result);
        lastAnalysisKey.current = dataKey;
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [signals, lang, insight]);

  if (signals.length === 0) return null;

  return (
    <div className="mb-10 bg-white dark:bg-card-dark border border-primary/10 dark:border-primary/5 rounded-3xl p-6 relative overflow-hidden shadow-card dark:shadow-card-dark transition-colors duration-300">
      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
        <Bot size={120} className="text-primary" />
      </div>
      
      <div className="flex items-center gap-3 mb-4 relative z-10">
        <div className="p-2.5 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl shadow-lg shadow-primary/30">
           <Sparkles className="text-white" size={20} />
        </div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t.marketInsight}</h2>
      </div>

      <div className="relative z-10 pl-1">
        {loading && !insight ? (
          <div className="flex flex-col gap-3 animate-pulse">
            <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-3/4"></div>
            <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-full"></div>
            <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-5/6"></div>
          </div>
        ) : (
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm md:text-base font-medium">
            {insight}
          </p>
        )}
      </div>
    </div>
  );
};

export default AIInsight;