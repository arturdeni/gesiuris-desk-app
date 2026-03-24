
export interface FundLimit {
  code: string;
  nameKeywords: string; // Used for fuzzy matching fund names
  minEquity: number; // Percentage
  maxEquity: number; // Percentage
}

export const FUND_LIMITS: FundLimit[] = [
  {
    code: '54',
    nameKeywords: 'PATRIMONIS', // Matches 'GESIURIS CAT PATRIMONIS'
    minEquity: -1,
    maxEquity: 2
  },
  {
    code: '2',
    nameKeywords: 'IURISFOND', // Matches 'GESIURIS IURISFOND'
    minEquity: 0,
    maxEquity: 0.3
  },
  {
    code: '4',
    nameKeywords: 'EURO EQUITIES', // Matches 'GESIURIS EURO EQUITIES'
    minEquity: 0.75,
    maxEquity: 2
  }
];
