
import { SignalResponse, TickerResponse, BacktestResponse } from '../types';

const API_BASE = 'http://localhost:8666/api';
const API_URL = `${API_BASE}/funding/volume-surge`;
const TICKER_URL = `${API_BASE}/ticker/24h`;
const BACKTEST_URL = `${API_BASE}/funding/history`;

export const fetchSignals = async (): Promise<SignalResponse> => {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Failed to fetch signals:", error);
    throw error;
  }
};

export const fetchTicker = async (symbol: string): Promise<TickerResponse> => {
  try {
    const response = await fetch(`${TICKER_URL}?symbol=${symbol}`);
    if (!response.ok) {
        throw new Error(`Ticker API Error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch ticker:", error);
    throw error;
  }
};

export const fetchBacktestHistory = async (page: number = 1, pageSize: number = 20): Promise<BacktestResponse> => {
  try {
    const response = await fetch(`${BACKTEST_URL}?page=${page}&pageSize=${pageSize}`);
    if (!response.ok) {
      throw new Error(`Backtest API Error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch backtest history:", error);
    throw error;
  }
};
