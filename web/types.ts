
export interface SignalRecord {
  id: number;
  symbol: string;
  fundingRate: number;
  price: number;
  volumeSurgeRatio: number;
  currentRSI: number;
  stopLoss: number;
  takeProfit: number;
  rrr: number; // Risk Reward Ratio
  consecutiveNegativeFundingHours: number;
  ema7CrossAboveEma2115m: boolean;
  score: number;
  priceChange24hPercent: number;
  captureTime: string;
  // New fields
  markPrice: number;
  lastFundingRate: number;
  priceChangeAfterSignal: number;
  fundingRateChangeAfterSignal: number;
  // Newer fields
  side: 'LONG' | 'SHORT';
  oiChange: number;
  signalTag: string;
  is24HrHigh: boolean;
  marketCap: number;
  oiToMcRatio: number;
}

export interface SignalResponse {
  count: number;
  records: SignalRecord[];
}

export interface BacktestRecord {
  id: number;
  signalId: number;
  symbol: string;
  side: 'LONG' | 'SHORT';
  signalPrice: number;
  stopLoss: number;
  takeProfit: number;
  rrr: number;
  price4h: number | null;
  price12h: number | null;
  price24h: number | null;
  pnl4h: number | null;
  pnl12h: number | null;
  pnl24h: number | null;
  hitStopLoss: boolean;
  hitTakeProfit: boolean;
  captureTime: string;
  completedAt: string | null;
  // New metrics
  fundingRate: number;
  volumeSurgeRatio: number;
  marketCap: number;
  oiToMcRatio: number;
}

export interface BacktestResponse {
  code: number;
  data: BacktestRecord[];
  hasMore: boolean;
  message: string;
  page: number;
  pageSize: number;
  total: number;
}

export interface TickerData {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  lastPrice: string;
  lastQty: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  firstId: number;
  lastId: number;
  count: number;
}

export interface TickerResponse {
  ticker: TickerData;
}

export interface UserConfig {
  binanceApiUrl: string;
  binanceApiKey: string;
  binanceApiSecret: string;
}

export interface BinanceOrder {
  avgPrice: string;
  clientOrderId: string;
  cumQuote: string;
  executedQty: string;
  orderId: number;
  origQty: string;
  origType: string;
  price: string;
  reduceOnly: boolean;
  side: 'BUY' | 'SELL';
  positionSide: 'LONG' | 'SHORT' | 'BOTH';
  status: 'NEW' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELED' | 'REJECTED' | 'EXPIRED';
  stopPrice: string;
  closePosition: boolean;
  symbol: string;
  time: number;
  timeInForce: string;
  type: string;
  activatePrice?: string;
  priceRate?: string;
  updateTime: number;
  workingType: string;
  priceProtect: boolean;
}

export interface BinancePosition {
  symbol: string;
  positionSide: string;
  positionAmt: string;
  unrealizedProfit: string;
  isolatedMargin: string;
  notional: string;
  isolatedWallet: string;
  initialMargin: string;
  maintMargin: string;
  updateTime: number;
  leverage: string;
  entryPrice: string;
  maxNotionalValue?: string;
  liquidationPrice?: string;
  marginType?: string;
}

export interface BinanceAsset {
  asset: string;
  walletBalance: string;
  unrealizedProfit: string;
  marginBalance: string;
  maintMargin: string;
  initialMargin: string;
  positionInitialMargin: string;
  openOrderInitialMargin: string;
  crossWalletBalance: string;
  crossUnPnl: string;
  availableBalance: string;
  maxWithdrawAmount: string;
  updateTime: number;
}

export interface BinanceAccountInfo {
  totalInitialMargin: string;
  totalMaintMargin: string;
  totalWalletBalance: string;
  totalUnrealizedProfit: string;
  totalMarginBalance: string;
  totalPositionInitialMargin: string;
  totalOpenOrderInitialMargin: string;
  totalCrossWalletBalance: string;
  totalCrossUnPnl: string;
  availableBalance: string;
  maxWithdrawAmount: string;
  assets: BinanceAsset[];
  positions: BinancePosition[];
}

export enum SortOption {
  SCORE = 'SCORE',
  VOLUME = 'VOLUME',
  RSI = 'RSI',
  TIME = 'TIME',
  OI_MC = 'OI_MC'
}

export type Language = 'zh' | 'en';
export type ViewMode = 'signals' | 'account' | 'backtest';

export interface Translations {
  trade: string;
  vault: string;
  compete: string;
  activity: string;
  account: string;
  referrals: string;
  scanMarket: string;
  scanning: string;
  signals: string;
  active: string;
  avgScore: string;
  highVol: string;
  surge: string;
  negFunding: string;
  squeeze: string;
  perpetual: string;
  score: string;
  goldenCross: string;
  volSurge: string;
  funding: string;
  stopLoss: string;
  takeProfit: string;
  placeBuy: string;
  placeOrder: string;
  marketInsight: string;
  sortBy: string;
  highestScore: string;
  volumeSurge: string;
  rsiVolatility: string;
  latest: string;
  highOiMc: string;
  noSignals: string;
  marketQuiet: string;
  apiError: string;
  aiUnavailable: string;
  riskReward: string;
  markPrice: string;
  pnl: string;
  last: string;
  entry: string;
  long: string;
  short: string;
  oiChange: string;
  tag: string;
  newHigh: string;
  marketCap: string;
  oiToMc: string;
  // Settings
  settings: string;
  configuration: string;
  apiUrl: string;
  apiKey: string;
  apiSecret: string;
  save: string;
  cancel: string;
  // Account / Orders
  orderHistory: string;
  searchSymbol: string;
  fetchOrders: string;
  side: string;
  type: string;
  priceText: string;
  qty: string;
  filled: string;
  status: string;
  time: string;
  noOrders: string;
  loginRequired: string;
  // Account View
  walletBalance: string;
  unrealizedPnl: string;
  availableBalance: string;
  marginBalance: string;
  positions: string;
  asset: string;
  size: string;
  margin: string;
  noPositions: string;
  // Trade Modal
  confirmTrade: string;
  selectAmount: string;
  estQty: string;
  execute: string;
  executing: string;
  tradeSuccess: string;
  tradeFailed: string;
  logEntry: string;
  logSL: string;
  logTP: string;
  balanceWarning: string;
  custom: string;
  // Ticker
  marketSentiment: string;
  vol: string;
  // Backtest
  backtest: string;
  pnl4h: string;
  pnl12h: string;
  pnl24h: string;
  result: string;
  hitTP: string;
  hitSL: string;
  running: string;
  next: string;
  prev: string;
  page: string;
}
