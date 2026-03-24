export interface UploadedFile {
  name: string;
  date: string; // ISO Date YYYY-MM-DD
  size: string;
  status: 'loading' | 'success' | 'error';
  rawContent?: any[]; // Store parsed Excel data temporarily
}

export interface User {
  id: number;
  email: string;
  password?: string; // Optional in UI context, required in auth check
  name: string;
  surname: string;
  rol: 'Gestor' | 'Control';
}

export interface Fund {
  id: string;
  name: string;
  ticker: string;
  aum: number;
  currency: string;
  equityAllocation: number;
  liquidity: number; // Percentage
  cash: number; // Absolute value
  valuationDate?: string; // Extracted date from the file
  positions: Asset[]; // The actual positions from the file
}

export interface Asset {
  ticker: string;
  name: string;
  isin: string;
  lastPrice: number;
  currency: string;
  quantity: number; // Mandatory for position holding checks
  marketValue: number;
  weight?: number; // Portfolio weight
  issuerTicker?: string; // Added for UCITS 5/10/40 grouping
  typology?: string; // Added for Asset Allocation (Renta Variable, Renta Fija, etc)
  derivativeType?: string; // Added for specific derivative classification (e.g. DIV, IRV)
  exchangeRate?: number; // Added for FX calculations (e.g. 1.08 for USD/EUR)
}

export interface PreTradeOrder {
  id: string;
  asset: Asset;
  side: OrderSide;
  quantity: number;
  price: number;
  currency: string;
  amountEur: number;
  preTradeStatus?: 'pending' | 'sent';
  addedAt: string; // Timestamp when added to Pre-Trade
  fundId?: string;
  fundName?: string;
  fundTicker?: string;
}

export type AppPhase = 'login' | 'upload' | 'workspace';
export type WorkspaceTab = 'dashboard' | 'operations' | 'pre-trade' | 'post-trade';
export type OrderSide = 'buy' | 'sell';

export type PostTradeOrderStatus = 'SIN_DATOS' | 'EJECUTADA' | 'VIVA';

export interface PostTradeExecutionData {
  orderType: 'A mercado' | 'Limitada' | 'Al Average';
  broker: 'GVC Gaesco' | 'Renta 4' | 'Nomura' | 'Bestinver' | 'Bankinter';
  callTime: string;
  executionPrice?: number;
  validityDate?: string;
  notes?: string;
}

export interface PostTradeOrder extends PreTradeOrder {
  status: PostTradeOrderStatus;
  processedBy?: string; // Name of the user who processed it
  processedAt?: string; // Date and time of processing
  executionData?: PostTradeExecutionData;
}