export interface UploadedFile {
  name: string;
  date: string; // ISO Date YYYY-MM-DD
  size: string;
  status: 'loading' | 'success' | 'error';
  rawContent?: any[]; // Store parsed Excel data temporarily
}

export interface User {
  id: string; // UUID de Supabase auth.users (antes era number autoincremental)
  email: string;
  // password eliminado: la autenticación la gestiona Supabase Auth, nunca pasa por el cliente
  name: string;
  surname: string;
  rol: 'Master' | 'Gestor' | 'Compliance' | 'Backoffice';
  position?: string;
  walletAddress?: string;
}

export interface Fund {
  id: string;
  name: string;
  ticker: string;
  aum: number;
  currency: string;
  equityAllocation: number;
  derivativeCommitment?: number; // Added for derivative commitment tracking
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
  multiplier?: number; // Added for derivative multiplier tracking from portfolio
  rating?: string; // Added for Fixed Income rating tracking
  nominal?: number; // Added for Fixed Income nominal tracking
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
  operationType?: OperationType;
  derivativeCategory?: DerivativeCategory;
  derivativeAction?: DerivativeAction;
  commitmentConsumption?: DerivativeCommitmentConsumption;
  noConsumptionReason?: DerivativeNoConsumptionReason;
  derivativeInstrumentType?: DerivativeInstrumentType;
  underlying?: string;
  underlyingPrice?: number;
  maturity?: string;
  delta?: number;
  commitment?: number;
  multiplier?: number;
  valueDate?: string;
  validityDate?: string;
  notes?: string;
  fxTargetCurrency?: string;
  fxBaseCurrency?: string;
  rating?: string;
  nominal?: number;
  stats?: {
    liquidityAvailablePct: number;
    liquidityOperationPct: number;
    complies51040: boolean;
    concentrationPct: number;
    compliesEquity: boolean;
    equityPct: number;
    maxEquity: number | null;
    minEquity: number | null;
    commitmentBeforePct: number;
    compliesCommitment: boolean;
    commitmentPct: number;
    compliesIIC: boolean;
    iicWeightPct: number;
    holdings: number;
    compliesRating: boolean;
    isShortSell: boolean;
  };
}

export interface Boleta {
  id: string;
  fundId: string;
  fundName: string;
  timestamp: string;
  orders: PreTradeOrder[];
  generatedBy: string;
}

export type AppPhase = 'login' | 'upload' | 'workspace';
export type WorkspaceTab = 'dashboard' | 'operations' | 'pre-trade' | 'post-trade' | 'back-office' | 'compliance' | 'control-dashboard';
export type OrderSide = 'buy' | 'sell';
export type OperationType = 'Renta Variable' | 'Derivados' | 'Renta Fija' | 'Divisa';
export type DerivativeCategory = 'Índice' | 'Acciones' | 'Divisa';
export type DerivativeAction = 'Abrir' | 'Cerrar';
export type DerivativeCommitmentConsumption = 'SÍ' | 'NO';
export type DerivativeNoConsumptionReason = 'COBERTURA PERFECTA' | 'DESHACER POSICIÓN';
export type DerivativeInstrumentType = 'Futuros' | 'Opciones';

export type PostTradeOrderStatus = 'SIN_DATOS' | 'EJECUTADA' | 'VIVA';

export interface PostTradeExecutionData {
  orderType: 'A mercado' | 'Limitada' | 'Al Average';
  broker?: 'GVC Gaesco' | 'Renta 4' | 'Nomura' | 'Bestinver' | 'Bankinter';
  depositary?: 'CACEIS' | 'BNP' | 'Bankinter';
  callTime: string;
  executionPrice?: number;
  validityDate?: string;
  valueDate?: string;
  notes?: string;
}

export interface PostTradeOrder extends PreTradeOrder {
  status: PostTradeOrderStatus;
  processedBy?: string; // Name of the user who processed it
  processedAt?: string; // Date and time of processing
  executionData?: PostTradeExecutionData;
}

export interface LiquidityAdjustment {
  id: string;
  fundId: string;
  amount: number;
  reason: 'Suscripción' | 'Reembolso' | 'OTROS';
  valueDate?: string;
  comment: string;
  timestamp: string;
  user: string;
}
