
export interface Instrument {
  tipologia: string;
  isin: string | null;
  ticker: string;
  codigoEmisora: number;
  nombreActivo: string;
  moneda: string;
  sector: string;
  subsector?: string | null;
  region: string;
  pais: string;
}

// NOTE: The actual data has been moved to 'public/maestro.json' for performance.
// This file is now used solely for Type Definitions.
