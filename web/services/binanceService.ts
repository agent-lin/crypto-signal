
import { UserConfig, BinanceOrder, SignalRecord, BinanceAccountInfo, BinancePosition, BinanceAsset } from '../types';
import CryptoJS from 'crypto-js';

// Helper to generate HMAC SHA256 Signature using crypto-js
const hmacSha256 = async (key: string, message: string): Promise<string> => {
  try {
    // Use crypto-js for HMAC-SHA256 (works in all browsers)
    const signature = CryptoJS.HmacSHA256(message, key);
    return CryptoJS.enc.Hex.stringify(signature);
  } catch (error) {
    console.error('HMAC signature failed:', error);
    throw new Error('Failed to generate signature');
  }
};

interface SymbolFilter {
  filterType: string;
  stepSize?: string;
  tickSize?: string;
}

interface SymbolInfo {
  symbol: string;
  filters: SymbolFilter[];
}

// Cache for exchange info to avoid repeated heavy calls
let exchangeInfoCache: Record<string, SymbolInfo> | null = null;

const getExchangeInfo = async (config: UserConfig): Promise<Record<string, SymbolInfo>> => {
  if (exchangeInfoCache) return exchangeInfoCache;

  const baseUrl = config.binanceApiUrl.replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/fapi/v1/exchangeInfo`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch exchange info');
  }

  const data = await response.json();
  const map: Record<string, SymbolInfo> = {};
  
  data.symbols.forEach((s: any) => {
    map[s.symbol] = {
      symbol: s.symbol,
      filters: s.filters
    };
  });

  exchangeInfoCache = map;
  return map;
};

// Fetch Symbol Config (Leverage)
const getSymbolConfig = async (config: UserConfig, symbol: string) => {
  if (!config.binanceApiKey || !config.binanceApiSecret) {
    throw new Error("Missing API Credentials");
  }

  const timestamp = Date.now();
  const baseUrl = config.binanceApiUrl.replace(/\/$/, '');
  const endpoint = '/fapi/v1/symbolConfig';
  
  const queryString = `symbol=${symbol}&timestamp=${timestamp}`;
  const signature = await hmacSha256(config.binanceApiSecret, queryString);
  const url = `${baseUrl}${endpoint}?${queryString}&signature=${signature}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-MBX-APIKEY': config.binanceApiKey,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();

  if (!response.ok) {
     throw new Error(data.msg || `Failed to fetch symbol config: ${response.status}`);
  }
  
  return data;
};

// Calculate number of decimals from step size (e.g. "0.001" -> 3)
const getPrecision = (stepSize: string): number => {
  if (parseFloat(stepSize) >= 1) return 0;
  return stepSize.indexOf('1') - 1;
};

const adjustPrecision = (value: number, precision: number): string => {
  const factor = Math.pow(10, precision);
  return (Math.floor(value * factor) / factor).toFixed(precision);
};

export const fetchBinanceAccount = async (config: UserConfig): Promise<BinanceAccountInfo> => {
  if (!config.binanceApiKey || !config.binanceApiSecret) {
    throw new Error("Missing API Credentials");
  }

  const timestamp = Date.now();
  const baseUrl = config.binanceApiUrl.replace(/\/$/, '');
  const endpoint = '/fapi/v3/account';

  const queryString = `timestamp=${timestamp}`;
  const signature = await hmacSha256(config.binanceApiSecret, queryString);
  const url = `${baseUrl}${endpoint}?${queryString}&signature=${signature}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-MBX-APIKEY': config.binanceApiKey,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.msg || `Failed to fetch account info: ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error("Binance Account Fetch Error:", error);
    throw error;
  }
};

export const fetchBinanceOrders = async (
  config: UserConfig, 
  symbol: string
): Promise<BinanceOrder[]> => {
  if (!config.binanceApiKey || !config.binanceApiSecret) {
    throw new Error("Missing API Credentials");
  }

  const timestamp = Date.now();
  const baseUrl = config.binanceApiUrl.replace(/\/$/, '');
  const endpoint = '/fapi/v1/allOrders';
  
  const queryString = `symbol=${symbol.toUpperCase()}&timestamp=${timestamp}&limit=50`;
  const signature = await hmacSha256(config.binanceApiSecret, queryString);
  const url = `${baseUrl}${endpoint}?${queryString}&signature=${signature}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-MBX-APIKEY': config.binanceApiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.msg || `Binance API Error: ${response.status}`);
    }

    const data: BinanceOrder[] = await response.json();
    return data.sort((a, b) => b.time - a.time);
  } catch (error) {
    console.error("Binance Fetch Error:", error);
    throw error;
  }
};

export const fetchOpenOrders = async (
  config: UserConfig,
  symbol: string
): Promise<any[]> => {
  if (!config.binanceApiKey || !config.binanceApiSecret) {
    throw new Error("Missing API Credentials");
  }

  const timestamp = Date.now();
  const baseUrl = config.binanceApiUrl.replace(/\/$/, '');
  const endpoint = '/fapi/v1/openOrders';

  const queryString = `symbol=${symbol}&timestamp=${timestamp}`;
  const signature = await hmacSha256(config.binanceApiSecret, queryString);
  const url = `${baseUrl}${endpoint}?${queryString}&signature=${signature}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-MBX-APIKEY': config.binanceApiKey,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.msg || `Failed to fetch open orders: ${response.status}`);
  }

  return data;
};

export const placeBinanceOrder = async (
  config: UserConfig,
  params: Record<string, string | number | boolean>
) => {
  if (!config.binanceApiKey || !config.binanceApiSecret) {
    throw new Error("Missing API Credentials");
  }

  const timestamp = Date.now();
  const baseUrl = config.binanceApiUrl.replace(/\/$/, '');
  const endpoint = '/fapi/v1/order';

  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    queryParams.append(key, String(value));
  });
  queryParams.append('timestamp', String(timestamp));

  const queryString = queryParams.toString();
  const signature = await hmacSha256(config.binanceApiSecret, queryString);
  const body = `${queryString}&signature=${signature}`;

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'X-MBX-APIKEY': config.binanceApiKey,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.msg || `Order Failed: ${response.status}`);
  }

  return data;
};

export const placeBinanceAlgoOrder = async (
  config: UserConfig,
  params: Record<string, string | number | boolean>
) => {
  if (!config.binanceApiKey || !config.binanceApiSecret) {
    throw new Error("Missing API Credentials");
  }

  const timestamp = Date.now();
  const baseUrl = config.binanceApiUrl.replace(/\/$/, '');
  const endpoint = '/fapi/v1/algoOrder';

  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    queryParams.append(key, String(value));
  });
  queryParams.append('timestamp', String(timestamp));

  const queryString = queryParams.toString();
  const signature = await hmacSha256(config.binanceApiSecret, queryString);
  const body = `${queryString}&signature=${signature}`;

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'X-MBX-APIKEY': config.binanceApiKey,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.msg || `Algo Order Failed: ${response.status}`);
  }

  return data;
};

export const executeTradeStrategy = async (
  config: UserConfig,
  signal: SignalRecord,
  usdtAmount: number,
  log: (msg: string) => void
) => {
  const symbol = signal.symbol;
  const isLong = signal.side === 'LONG';
  const entrySide = isLong ? 'BUY' : 'SELL';
  const closeSide = isLong ? 'SELL' : 'BUY';

  log(`Initializing ${signal.side} Strategy for ${symbol}...`);

  // 0. Fetch Exchange Info (Precision) and Account Config (Leverage)
  log('Fetching market data & leverage...');
  
  // Precision
  let symbolInfo;
  try {
    const exchangeInfo = await getExchangeInfo(config);
    symbolInfo = exchangeInfo[symbol];
    if (!symbolInfo) throw new Error(`Symbol ${symbol} not found in exchange info`);
  } catch (e) {
    log('Failed to fetch exchange info (precision). Using defaults.');
    symbolInfo = {
       symbol,
       filters: [
         { filterType: 'LOT_SIZE', stepSize: '0.1' }, 
         { filterType: 'PRICE_FILTER', tickSize: '0.01' } 
       ]
    };
  }

  // Leverage
  let leverage = 1;
  try {
    const configs = await getSymbolConfig(config, symbol);
    if (Array.isArray(configs) && configs.length > 0) {
      leverage = configs[0].leverage;
      log(`Fetched Leverage: ${leverage}x`);
    } else {
      log('Leverage config not found, defaulting to 1x.');
    }
  } catch (e: any) {
    log(`Failed to fetch leverage: ${e.message}. Defaulting to 1x.`);
  }

  const lotSizeFilter = symbolInfo.filters.find(f => f.filterType === 'LOT_SIZE');
  const priceFilter = symbolInfo.filters.find(f => f.filterType === 'PRICE_FILTER');

  const quantityPrecision = getPrecision(lotSizeFilter?.stepSize || '0.1');
  const pricePrecision = getPrecision(priceFilter?.tickSize || '0.01');

  // 1. Calculate Quantity
  // Quantity = (Margin Amount * Leverage) / Price
  const rawQty = (usdtAmount * leverage) / signal.markPrice;
  const quantity = adjustPrecision(rawQty, quantityPrecision);
  
  if (parseFloat(quantity) * signal.markPrice < 5) {
     log(`Warning: Order Notional Value (~${(parseFloat(quantity) * signal.markPrice).toFixed(2)}) might be too low.`);
  }

  log(`Calculated Qty: ${quantity} (Margin: ${usdtAmount}, Lev: ${leverage}x)`);

  // 2. Place Market Entry Order (Standard Order Endpoint)
  log(`1/3 Placing MARKET ${entrySide} order...`);
  const entryOrder = await placeBinanceOrder(config, {
    symbol,
    side: entrySide,
    type: 'MARKET',
    quantity
  });
  log(`Entry Success! Order ID: ${entryOrder.orderId}`);

  // 3. Check for existing SL/TP
  log('Checking for existing open orders...');
  let hasSL = false;
  let hasTP = false;

  try {
    const openOrders = await fetchOpenOrders(config, symbol);
    
    // Check if there are any STOP_MARKET orders for the closing side
    hasSL = openOrders.some((o: any) => 
      o.type === 'STOP_MARKET' && 
      o.side === closeSide && 
      o.closePosition === true
    );

    // Check if there are any TAKE_PROFIT_MARKET orders for the closing side
    hasTP = openOrders.some((o: any) => 
      o.type === 'TAKE_PROFIT_MARKET' && 
      o.side === closeSide && 
      o.closePosition === true
    );

  } catch (e: any) {
    log(`Failed to fetch open orders: ${e.message}. Will proceed with placement attempt.`);
  }

  // 4. Place Stop Loss (Algo Order Endpoint)
  if (hasSL) {
    log('Existing Stop Loss order detected. Skipping new SL placement.');
  } else {
    const stopPrice = adjustPrecision(signal.stopLoss, pricePrecision);
    log(`2/3 Setting STOP_LOSS (Algo) at ${stopPrice}...`);
    try {
      await placeBinanceAlgoOrder(config, {
        symbol,
        side: closeSide, // Reverse of entry
        algoType: 'CONDITIONAL',
        type: 'STOP_MARKET',
        triggerPrice: stopPrice, 
        closePosition: 'true',
        workingType: 'MARK_PRICE'
      });
      log('Stop Loss set successfully.');
    } catch (e: any) {
      log(`Failed to set Stop Loss: ${e.message}`);
      // Don't throw here, allow TP to try
    }
  }

  // 5. Place Take Profit (Algo Order Endpoint)
  if (hasTP) {
    log('Existing Take Profit order detected. Skipping new TP placement.');
  } else {
    const tpPrice = adjustPrecision(signal.takeProfit, pricePrecision);
    log(`3/3 Setting TAKE_PROFIT (Algo) at ${tpPrice}...`);
    try {
      await placeBinanceAlgoOrder(config, {
        symbol,
        side: closeSide, // Reverse of entry
        algoType: 'CONDITIONAL',
        type: 'TAKE_PROFIT_MARKET',
        triggerPrice: tpPrice,
        closePosition: 'true',
        workingType: 'MARK_PRICE'
      });
      log('Take Profit set successfully.');
    } catch (e: any) {
      log(`Failed to set Take Profit: ${e.message}`);
    }
  }

  log('Strategy execution completed.');
  return entryOrder;
};
