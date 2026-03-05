
import { GoogleGenAI } from "@google/genai";
import { SignalRecord, Language } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const analyzeSignals = async (signals: SignalRecord[], lang: Language): Promise<string> => {
  if (!apiKey) {
    return lang === 'zh' ? "未配置 API 密钥。" : "API Key not configured.";
  }

  try {
    const languageInstruction = lang === 'zh'
      ? "Please provide the market insight strictly in Simplified Chinese (简体中文)."
      : "Please provide the market insight in English.";

    // Simplify payload to save tokens and reduce latency
    const simplifiedSignals = signals.map(s => ({
      symbol: s.symbol,
      score: s.score,
      volSurge: s.volumeSurgeRatio,
      funding: s.fundingRate,
      rsi: s.currentRSI,
      pnl: s.priceChangeAfterSignal
    }));

    const prompt = `
      You are a professional crypto trading analyst.
      Analyze this crypto signal data: ${JSON.stringify(simplifiedSignals)}

      ${languageInstruction}

      Provide a concise market insight (max 100 words).
      Focus on:
      1. Best asset based on score/volume/funding.
      2. General trends (e.g. short squeeze potential).
      3. RSI cautions.

      Format: Clean paragraph, no headers.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || (lang === 'zh' ? "暂时无法生成分析。" : "Unable to generate analysis at this time.");
  } catch (error: any) {
    console.error("Gemini analysis failed:", error);
    
    // Handle Quota limits (429)
    if (error?.status === 429 || error?.code === 429 || error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
       return lang === 'zh' 
         ? "AI 分析请求过于频繁，请稍后刷新重试 (Rate Limit Exceeded)。" 
         : "High traffic. AI analysis temporarily paused (Rate Limit Exceeded).";
    }

    return lang === 'zh' ? "AI 分析暂时不可用。" : "AI Analysis temporarily unavailable.";
  }
};
