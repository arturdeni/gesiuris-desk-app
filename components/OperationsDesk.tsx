// ... (imports remain the same)
import React, { useState, useEffect, useMemo } from 'react';

const getRatingValue = (r: string | undefined): number => {
  if (!r) return 0;
  const s = r.trim().toUpperCase();
  if (s.includes('AAA')) return 12;
  if (s.includes('AA+')) return 11;
  if (s.includes('AA-')) return 9;
  if (s.includes('AA')) return 10;
  if (s.includes('A+')) return 8;
  if (s.includes('A-')) return 6;
  if (s.includes('A')) return 7;
  if (s.includes('BBB+')) return 5;
  if (s.includes('BBB-')) return 3;
  if (s.includes('BBB')) return 4;
  if (s.includes('BB+')) return 2;
  if (s.includes('BB')) return 1;
  return 0;
};

import { Search, Plus, ArrowRight, AlertTriangle, ShieldCheck, Ban, Wallet, TrendingUp, DollarSign, X, Globe, PieChart, Database, ChevronRight, Briefcase, Activity, Percent, Trash2, ListPlus, Send, ArrowLeft, FileText, CheckCircle2, Info, Filter, Clock, ArrowRightCircle, Calendar, MessageSquare } from 'lucide-react';
import { Fund, Asset, OrderSide, PreTradeOrder, PostTradeOrder, User, OperationType, DerivativeCategory, DerivativeAction, DerivativeInstrumentType, DerivativeCommitmentConsumption, DerivativeNoConsumptionReason } from '../types';
import { FundLimit } from '../data/fundLimits';
import { MasterDataModal } from './MasterDataModal';
import { Instrument } from '../data/maestro';
import { FundSelector } from './FundSelector';
import { TradingAssistant } from './TradingAssistant';
import { Sparkles as SparklesIcon } from 'lucide-react';

const PREDEFINED_FUTURES = [
  { ticker: 'IB1 Index', name: 'Ibex 35', multiplier: 10, type: 'Índice', currency: 'EUR' },
  { ticker: 'DFW1', name: 'Mini Dax', multiplier: 5, type: 'Índice', currency: 'EUR' },
  { ticker: 'VG1 Index', name: 'Eurostoxx 50', multiplier: 10, type: 'Índice', currency: 'EUR' },
  { ticker: 'ES1', name: 'MINI S&P', multiplier: 50, type: 'Índice', currency: 'USD' },
  { ticker: 'NQ1', name: 'MINI NASDAQ', multiplier: 20, type: 'Índice', currency: 'USD' },
  { ticker: 'RTY1', name: 'MINI RUSSELL', multiplier: 50, type: 'Índice', currency: 'USD' },
  { ticker: 'LWE1', name: 'MINI S&P EQ. WEIGHT', multiplier: 20, type: 'Índice', currency: 'USD' },
  { ticker: 'MES1', name: 'MINI EMERGING (USD)', multiplier: 50, type: 'Índice', currency: 'USD' },
  { ticker: 'NX1', name: 'NIKKEI 225 (CME)', multiplier: 5, type: 'Índice', currency: 'USD' },
  { ticker: 'HU1', name: 'MINI HANG SENG HKD', multiplier: 10, type: 'Índice', currency: 'HKD' },
  { ticker: 'EC1', name: 'FUT. EUR/USD', multiplier: 125000, type: 'Divisa', currency: 'EUR' },
  { ticker: 'RY1', name: 'FUT. EUR/JPY (CME)', multiplier: 125000, type: 'Divisa', currency: 'EUR' }
];

interface OperationsDeskProps {
  fund: Fund;
  funds: Fund[];
  onFundChange: (id: string) => void;
  fundLimits: FundLimit[]; // Dynamic limits prop
  currentUser: User | null;
  onConfirmAndGenerate: (orders: PreTradeOrder[]) => void;
  onSendOrder?: (order: PreTradeOrder) => void;
  preTradeOrders: PreTradeOrder[];
  setPreTradeOrders: React.Dispatch<React.SetStateAction<PreTradeOrder[]>>;
  pendingOrders: PreTradeOrder[];
  setPendingOrders: React.Dispatch<React.SetStateAction<PreTradeOrder[]>>;
  postTradeOrders: PostTradeOrder[];
  onAddOrder: (order: PreTradeOrder) => void;
  onRemoveOrder: (id: string) => void;
  manualAdjustment: number;
  aumAdjustment: number;
}

type QuickAddStep = 'type-selection' | 'form';
type QuickAddType = 'Renta Variable' | 'Renta Fija' | 'Derivados';

export const OperationsDesk: React.FC<OperationsDeskProps> = ({
  fund,
  funds,
  onFundChange,
  fundLimits,
  currentUser,
  onConfirmAndGenerate,
  onSendOrder,
  preTradeOrders,
  setPreTradeOrders,
  pendingOrders,
  setPendingOrders,
  postTradeOrders,
  onAddOrder,
  onRemoveOrder,
  manualAdjustment,
  aumAdjustment
}) => {
  // Use positions from the real Excel file
  const assetsList = fund.positions || [];

  const adjustedAum = (fund.aum || 0) + aumAdjustment;

  // State: Context
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [operationType, setOperationType] = useState<OperationType | null>(null);
  
  // State: Order Pad
  const [side, setSide] = useState<OrderSide>('buy');
  const [quantity, setQuantity] = useState<string>('');
  const [price, setPrice] = useState<string>('');
  const [exchangeRate, setExchangeRate] = useState<string>('1.00');
  const [validityDate, setValidityDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState<string>('');
  const [showFxWarning, setShowFxWarning] = useState(false);
  
  // State: Specific Fields for RF, Derivados, Divisa
  const [commitment, setCommitment] = useState<string>('');
  const [underlyingPrice, setUnderlyingPrice] = useState<string>('');
  const [multiplier, setMultiplier] = useState<string>('1');
  const [commitmentConsumption, setCommitmentConsumption] = useState<DerivativeCommitmentConsumption>('SÍ');
  const [noConsumptionReason, setNoConsumptionReason] = useState<DerivativeNoConsumptionReason>('COBERTURA PERFECTA');
  const [derivativeInstrumentType, setDerivativeInstrumentType] = useState<DerivativeInstrumentType>('Futuros');
  const [delta, setDelta] = useState<string>('1.00');
  const [derivativeCategory, setDerivativeCategory] = useState<DerivativeCategory>('Acciones');
  const [valueDate, setValueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [fxTargetCurrency, setFxTargetCurrency] = useState<string>('USD');
  const [fxBaseCurrency, setFxBaseCurrency] = useState<string>('EUR');
  const [rating, setRating] = useState<string>('NR');
  
  // State: New Derivative Fields
  const [isNewDerivative, setIsNewDerivative] = useState<boolean>(false);
  const [newDerivName, setNewDerivName] = useState<string>('');
  const [newDerivUnderlying, setNewDerivUnderlying] = useState<string>('');
  const [newDerivMaturity, setNewDerivMaturity] = useState<string>('');
  const [newDerivType, setNewDerivType] = useState<'FUT' | 'CALL' | 'PUT'>('FUT');
  const [newDerivStrike, setNewDerivStrike] = useState<string>('');
  const [newDerivCurrency, setNewDerivCurrency] = useState<string>('EUR');
  const [showPredefinedFutures, setShowPredefinedFutures] = useState(false);
  
  // State: Search & Master Modal
  const [searchQuery, setSearchQuery] = useState('');
  const [showMasterSearch, setShowMasterSearch] = useState(false);

  // State: Quick Add Wizard
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddStep, setQuickAddStep] = useState<QuickAddStep>('type-selection');
  const [quickAddType, setQuickAddType] = useState<QuickAddType>('Renta Variable');
  const [activeLookThrough, setActiveLookThrough] = useState<'liquidity' | 'issuer' | 'concentration' | 'equity' | null>(null);
  
  // State: Quick Add Form Fields
  const [qaTickerBase, setQaTickerBase] = useState('');
  const [qaTickerMarket, setQaTickerMarket] = useState('');
  const [qaName, setQaName] = useState('');
  const [qaCurrency, setQaCurrency] = useState('USD');
  const [qaPrice, setQaPrice] = useState('');

  // State: Issuer Mapping (Loaded from Maestro as fallback)
  const [issuerMap, setIssuerMap] = useState<Map<string, number>>(new Map());
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  // Load Issuer Map on Mount
  useEffect(() => {
    const loadIssuerData = async () => {
      try {
        const response = await fetch('/maestro.json');
        if (response.ok) {
          const text = await response.text();
          // Sanitize NaN if present
          const sanitizedText = text.replace(/:\s*NaN\b/g, ': null');
          const data: Instrument[] = JSON.parse(sanitizedText);
          
          const newMap = new Map<string, number>();
          data.forEach(item => {
            if (item.codigoEmisora) {
              if (item.ticker) {
                const t = item.ticker.trim();
                newMap.set(t, item.codigoEmisora);
                
                // Smart Mapping: Map "Root" ticker to Issuer Code as well
                const parts = t.split(' ');
                if (parts.length > 0) {
                   const root = parts[0];
                   if (!newMap.has(root)) {
                      newMap.set(root, item.codigoEmisora);
                   }
                }
              }
              if (item.isin) newMap.set(item.isin.trim(), item.codigoEmisora);
            }
          });
          setIssuerMap(newMap);
        }
      } catch (err) {
        console.warn("Could not load issuer map for compliance grouping", err);
      }
    };
    loadIssuerData();
  }, []);

  // --- DERIVED CALCULATIONS ---
  
  // 1. Calculate Real Liquidity from Portfolio Positions (ONLY Liquidez, EXCLUDING Garantías)
  const realLiquidity = useMemo(() => {
    const baseLiquidity = assetsList.reduce((sum, asset) => {
      const type = (asset.typology || '').toLowerCase();
      // Sum Risk€ (marketValue) if typology is strictly Liquidez
      if (type.includes('liqui')) {
        return sum + (asset.marketValue || 0);
      }
      return sum;
    }, 0);
    return baseLiquidity + manualAdjustment;
  }, [assetsList, manualAdjustment]);

  // 2. Current Form Gross Amount
  const currentFormAmountEur = useMemo(() => {
    const q = parseFloat(quantity) || 0;
    const p = parseFloat(price) || 0;
    const fx = parseFloat(exchangeRate) || 1;
    const m = parseFloat(multiplier) || 1;
    const currencyToUse = isNewDerivative ? newDerivCurrency : selectedAsset?.currency;
    
    if (operationType === 'Derivados') {
      const d = derivativeInstrumentType === 'Opciones' ? (parseFloat(delta) || 0) : 1;
      const uP = derivativeInstrumentType === 'Futuros' ? p : (parseFloat(underlyingPrice) || 0);
      
      // For derivatives, Importe Estimado = Commitment/Exposure
      // Formula: contracts * price_to_use * multiplier * abs(delta) / fx
      let amount = (q * uP * m * Math.abs(d)) / fx; 
      if (currencyToUse === 'GBP') {
        amount = amount / 100;
      }
      return amount;
    }

    if (operationType === 'Renta Fija') {
      // RF: Nominal * (Price / 100) / FX
      let amount = (q * (p / 100)) / fx;
      if (currencyToUse === 'GBP') {
        amount = amount / 100;
      }
      return amount;
    }

    if (operationType === 'Divisa') {
      // Divisa: Quantity is the amount in the base currency (fxBaseCurrency)
      if (fxBaseCurrency === 'EUR') {
        return q;
      }
      return q / fx;
    }

    let amount = (q * p) / fx;
    if (currencyToUse === 'GBP') {
      amount = amount / 100;
    }
    return amount;
  }, [quantity, price, exchangeRate, multiplier, delta, derivativeInstrumentType, selectedAsset, operationType, isNewDerivative, newDerivCurrency, fxBaseCurrency]);

  // Auto-calculate commitment for Derivados
  useEffect(() => {
    if (operationType === 'Derivados') {
      const q = parseFloat(quantity) || 0;
      const uP = derivativeInstrumentType === 'Futuros' ? (parseFloat(price) || 0) : (parseFloat(underlyingPrice) || 0);
      const m = parseFloat(multiplier) || 1;
      const fx = parseFloat(exchangeRate) || 1;
      const d = derivativeInstrumentType === 'Opciones' ? (parseFloat(delta) || 0) : 1;
      
      // Commitment = abs(delta) * price_to_use * multiplier * quantity / fx
      let calculated = (Math.abs(d) * uP * m * q) / fx;
      const currencyToUse = isNewDerivative ? newDerivCurrency : selectedAsset?.currency;
      if (currencyToUse === 'GBP') {
        calculated = calculated / 100;
      }
      setCommitment(calculated.toFixed(2));
    }
  }, [quantity, underlyingPrice, multiplier, exchangeRate, operationType, derivativeInstrumentType, delta, isNewDerivative, newDerivCurrency, selectedAsset]);
  const queueNetImpact = useMemo(() => {
    return preTradeOrders.reduce((acc, order) => {
      if (order.operationType === 'Derivados') return acc;
      if (order.side === 'buy') return acc - order.amountEur;
      return acc + order.amountEur;
    }, 0);
  }, [preTradeOrders]);

  // 4. Projected Cash (Liquidity + Queue + Current Form)
  const projectedCash = useMemo(() => {
    let cash = realLiquidity + queueNetImpact;
    
    // Add current form impact only if it's being edited
    if (operationType !== 'Derivados' && currentFormAmountEur > 0) {
      if (side === 'buy') cash -= currentFormAmountEur;
      else cash += currentFormAmountEur;
    }
    
    return cash;
  }, [realLiquidity, queueNetImpact, currentFormAmountEur, side, operationType]);

  const projectedLiquidityPct = (projectedCash / adjustedAum) * 100;

  // --- COMPLIANCE ENGINE (Single Order Check) ---
  const currentFundLimits = useMemo(() => {
    const found = fundLimits.find(l => 
      fund.name.toUpperCase().includes(l.nameKeywords) || 
      fund.id === l.code
    );
    if (found) return found;
    // Default to PATRIMONIS (code 54)
    return fundLimits.find(l => l.code === '54');
  }, [fund, fundLimits]);

  // 5. Projected Equity Stats (Restored for Limits Check)
  const projectedEquityStats = useMemo(() => {
    // Use official equity allocation from Excel as the base value
    const currentEquityValue = (fund.aum || 0) * ((fund.equityAllocation || 0) / 100);
    
    const typologyUpper = String(selectedAsset?.typology || '').toUpperCase().trim();
    const isEquityAsset = typologyUpper === 'RENTA VARIABLE' || typologyUpper === 'ACCIONES' || typologyUpper === 'PARTICIPACIONES IIC';
    const category = String(derivativeCategory || '').toUpperCase().trim();
    const isDerivEquity = operationType === 'Derivados' && (category === 'ÍNDICE' || category === 'INDICE' || category === 'ACCIONES');
    const isEquityRelated = isEquityAsset || isDerivEquity;
    
    const currentAdjustedEquityPct = (currentEquityValue / adjustedAum) * 100;
    let newEquityValue = currentEquityValue;
    
    // Add Queue Impact to Equity
    preTradeOrders.forEach(order => {
        const orderTypologyUpper = String(order.asset.typology || '').toUpperCase().trim();
        const isOrderEquity = orderTypologyUpper === 'RENTA VARIABLE' || orderTypologyUpper === 'ACCIONES' || orderTypologyUpper === 'PARTICIPACIONES IIC';
        const orderCategory = String(order.derivativeCategory || '').toUpperCase().trim();
        const isOrderDerivEquity = order.operationType === 'Derivados' && (orderCategory === 'ÍNDICE' || orderCategory === 'INDICE' || orderCategory === 'ACCIONES');
        
        if (isOrderEquity) {
            if (order.side === 'buy') newEquityValue += order.amountEur;
            else newEquityValue -= order.amountEur;
        } else if (isOrderDerivEquity) {
            // Rule 2: Normal derivatives increase exposure (even if sell)
            // Exception: SELL + NO commitment + COBERTURA PERFECTA -> reduces exposure
            const orderCommitment = order.commitment || 0;
            const isHedgingSell = order.side === 'sell' && order.commitmentConsumption === 'NO' && order.noConsumptionReason === 'COBERTURA PERFECTA';
            
            if (isHedgingSell) {
                newEquityValue -= orderCommitment;
            } else {
                newEquityValue += orderCommitment;
            }
        }
    });

    // Add Current Form Impact
    if (isEquityAsset && currentFormAmountEur > 0) {
      if (side === 'buy') {
        newEquityValue += currentFormAmountEur;
      } else {
        newEquityValue -= currentFormAmountEur;
      }
    } else if (isDerivEquity) {
      const formCommitment = parseFloat(commitment) || 0;
      const isHedgingSell = side === 'sell' && commitmentConsumption === 'NO' && noConsumptionReason === 'COBERTURA PERFECTA';
      
      if (isHedgingSell) {
        newEquityValue -= formCommitment;
      } else {
        newEquityValue += formCommitment;
      }
    }

    const newEquityPct = (newEquityValue / adjustedAum) * 100;
    return { isEquityAsset: isEquityRelated, newEquityPct, currentAdjustedEquityPct };
  }, [assetsList, selectedAsset, currentFormAmountEur, side, preTradeOrders, adjustedAum, operationType, derivativeCategory, commitment, commitmentConsumption, noConsumptionReason]);

  // Helper to get Issuer ID (Priority: Loaded Asset IssuerCode > Map > Fallback)
  const getIssuerId = (asset: Asset | null) => {
    if (!asset) return 'UNKNOWN';
    
    // 1. Priority: Use the Issuer Code directly from the asset if available (loaded from Excel)
    if (asset.issuerTicker && !isNaN(Number(asset.issuerTicker))) {
       return asset.issuerTicker;
    }
    
    // 2. Fallback: Try Map by ISIN
    if (asset.isin && issuerMap.has(asset.isin)) return issuerMap.get(asset.isin);
    
    // 3. Fallback: Try Map by Full Ticker
    const cleanTicker = asset.ticker ? asset.ticker.trim() : '';
    if (cleanTicker) {
      if (issuerMap.has(cleanTicker)) return issuerMap.get(cleanTicker);
      const root = cleanTicker.split(' ')[0];
      if (root && issuerMap.has(root)) return issuerMap.get(root);
      return root; // Last resort grouping by root ticker
    }
    return 'UNKNOWN'; 
  };

  // 6. DETAILED COMPLIANCE METRICS (For UI Display & Validation)
  const complianceMetrics = useMemo(() => {
    const targetAsset = isNewDerivative ? {
      ticker: newDerivName.toUpperCase() || 'NUEVO DERIVADO',
      name: newDerivName || 'Nuevo Derivado',
      typology: 'Derivados',
      currency: newDerivCurrency,
      lastPrice: parseFloat(price) || 0,
      isin: 'NEW-DERIV'
    } as Asset : selectedAsset;

    if (!targetAsset && operationType !== 'Divisa') return null;

    const targetIssuerId = getIssuerId(targetAsset);
    const totalAum = adjustedAum || 1;

    // A. Projected Titles (Simple Ticker Match for same instrument)
    const currentHolding = operationType === 'Renta Fija' ? (targetAsset?.nominal || 0) : (targetAsset?.quantity || 0);
    const queueOrdersForThisAsset = preTradeOrders.filter(o => o.asset.ticker === targetAsset?.ticker);
    const queueQty = queueOrdersForThisAsset.reduce((sum, o) => sum + (o.side === 'buy' ? (o.nominal || o.quantity) : -(o.nominal || o.quantity)), 0);
    
    const formQty = parseFloat(quantity) || 0;
    const projectedQty = currentHolding + queueQty + (side === 'buy' ? formQty : -formQty);

    // B. Issuer Weight & Concentration (GROUPED BY ISSUER ID)
    const issuerExposureMap = new Map<string | number, number>();
    const issuerAssetsMap = new Map<string | number, { name: string, ticker: string, value: number, isQueue?: boolean }[]>();
    const issuerNamesMap = new Map<string | number, string>();

    // 1. Map existing portfolio
    assetsList.forEach(a => {
      if (a.typology === 'Liquidez' || a.typology === 'Garantías' || a.typology === 'Participaciones IIC') return;
      if (String(a.issuerTicker).trim() === '1002') return; // Exclude Spanish State (1002)
      
      const derType = String(a.derivativeType || '').toUpperCase().trim();
      const isIndexOrFx = derType.includes('DIV') || derType.includes('IRV') || derType.includes('IND') || derType.includes('IDX');
      
      // Fallback: Check name for common index keywords if it's a derivative
      const isDerivative = a.typology === 'Derivados' || (a.derivativeType && a.derivativeType.trim() !== '');
      const nameUpper = (a.name || '').toUpperCase();
      const isIndexByName = isDerivative && (
        nameUpper.includes('S&P') || 
        nameUpper.includes('MSCI') || 
        nameUpper.includes('IBEX') || 
        nameUpper.includes('EUROSTOXX') || 
        nameUpper.includes('DAX') || 
        nameUpper.includes('NASDAQ') || 
        nameUpper.includes('MINI') ||
        nameUpper.includes('FUT.')
      );

      if (isIndexOrFx || isIndexByName) return;

      const issuerId = getIssuerId(a);
      const currentVal = issuerExposureMap.get(issuerId) || 0;
      issuerExposureMap.set(issuerId, currentVal + (a.marketValue || 0));

      const assets = issuerAssetsMap.get(issuerId) || [];
      assets.push({ name: a.name || a.ticker, ticker: a.ticker, value: a.marketValue || 0 });
      issuerAssetsMap.set(issuerId, assets);
      
      if (!issuerNamesMap.has(issuerId)) {
        issuerNamesMap.set(issuerId, a.name || a.ticker);
      }
    });

    // 2. Apply Queue
    preTradeOrders.forEach(o => {
      if (o.asset.typology === 'Liquidez' || o.asset.typology === 'Garantías' || o.asset.typology === 'Participaciones IIC') return;
      if (String(o.asset.issuerTicker).trim() === '1002') return; // Exclude Spanish State (1002)
      
      const derType = String(o.asset.derivativeType || '').toUpperCase().trim();
      const isIndexOrFx = derType.includes('DIV') || derType.includes('IRV') || derType.includes('IND') || derType.includes('IDX');
      
      const nameUpper = (o.asset.name || '').toUpperCase();
      const isIndexByName = o.operationType === 'Derivados' && (
        nameUpper.includes('S&P') || 
        nameUpper.includes('MSCI') || 
        nameUpper.includes('IBEX') || 
        nameUpper.includes('EUROSTOXX') || 
        nameUpper.includes('DAX') || 
        nameUpper.includes('NASDAQ') || 
        nameUpper.includes('MINI') ||
        nameUpper.includes('FUT.')
      );

      if (isIndexOrFx || isIndexByName) return;

      // Exclude Indices and FX derivatives from Issuer Limit
      if (o.operationType === 'Derivados') {
        if (o.derivativeCategory === 'Índice' || o.derivativeCategory === 'Divisa') return;
      }

      const issuerId = getIssuerId(o.asset);
      const currentVal = issuerExposureMap.get(issuerId) || 0;
      const impact = o.side === 'buy' ? o.amountEur : -o.amountEur;
      issuerExposureMap.set(issuerId, Math.max(0, currentVal + impact));

      const assets = issuerAssetsMap.get(issuerId) || [];
      assets.push({ name: o.asset.name || o.asset.ticker, ticker: o.asset.ticker, value: impact, isQueue: true });
      issuerAssetsMap.set(issuerId, assets);

      if (!issuerNamesMap.has(issuerId)) {
        issuerNamesMap.set(issuerId, o.asset.name || o.asset.ticker);
      }
    });

    // 3. Apply Current Form
    const formExposure = operationType === 'Derivados' ? (parseFloat(commitment) || 0) : currentFormAmountEur;
    if (formExposure > 0) {
       if (targetAsset) {
         const derType = String(targetAsset.derivativeType || '').toUpperCase().trim();
         const isIndexOrFx = derType.includes('DIV') || derType.includes('IRV') || derType.includes('IND') || derType.includes('IDX');
         
         const nameUpper = (targetAsset.name || '').toUpperCase();
         const isIndexByName = operationType === 'Derivados' && (
           nameUpper.includes('S&P') || 
           nameUpper.includes('MSCI') || 
           nameUpper.includes('IBEX') || 
           nameUpper.includes('EUROSTOXX') || 
           nameUpper.includes('DAX') || 
           nameUpper.includes('NASDAQ') || 
           nameUpper.includes('MINI') ||
           nameUpper.includes('FUT.')
         );

         let isExcluded = 
           targetAsset.typology === 'Liquidez' ||
           targetAsset.typology === 'Garantías' ||
           targetAsset.typology === 'Participaciones IIC' ||
           String(targetAsset.issuerTicker).trim() === '1002' || // Exclude Spanish State (1002)
           isIndexOrFx || isIndexByName;
         
         // New Derivative Category Rules for Issuer Limit
         if (operationType === 'Derivados') {
           if (derivativeCategory === 'Índice' || derivativeCategory === 'Divisa') {
             isExcluded = true;
           }
         }

         if (!isExcluded) {
            const impact = side === 'buy' ? formExposure : -formExposure;
            const currentVal = issuerExposureMap.get(targetIssuerId) || 0;
            issuerExposureMap.set(targetIssuerId, Math.max(0, currentVal + impact));

            const assets = issuerAssetsMap.get(targetIssuerId) || [];
            assets.push({ name: targetAsset.name || targetAsset.ticker, ticker: targetAsset.ticker, value: impact, isQueue: true });
            issuerAssetsMap.set(targetIssuerId, assets);
            
            if (!issuerNamesMap.has(targetIssuerId)) {
              issuerNamesMap.set(targetIssuerId, targetAsset.name || targetAsset.ticker);
            }
         }
       }
    }

    const projectedIssuerValue = issuerExposureMap.get(targetIssuerId) || 0;
    const issuerWeightPct = (projectedIssuerValue / totalAum) * 100;
    const issuerBreakdown = (issuerAssetsMap.get(targetIssuerId) || [])
      .filter(item => Math.abs(item.value) > 0.01)
      .sort((a, b) => b.value - a.value);

    // C. 5/10/40 Concentration Sum
    let concentrationSum = 0;
    const concentrationBreakdown: { issuerName: string; weight: number; value: number }[] = [];
    
    issuerExposureMap.forEach((val, id) => {
      const weight = val / totalAum;
      if (weight > 0.05) { 
        concentrationSum += weight;
        concentrationBreakdown.push({
          issuerName: issuerNamesMap.get(id) || String(id),
          weight: weight * 100,
          value: val
        });
      }
    });
    
    const concentrationPct = concentrationSum * 100;
    concentrationBreakdown.sort((a, b) => b.weight - a.weight);

    // D. Equity Breakdown
    const equityBreakdown: { name: string, ticker: string, value: number, isQueue?: boolean }[] = [];
    assetsList.forEach(a => {
      if (a.typology === 'Renta Variable' || a.typology === 'Participaciones IIC') {
        equityBreakdown.push({ name: a.name || a.ticker, ticker: a.ticker, value: a.marketValue || 0 });
      }
    });
    preTradeOrders.forEach(o => {
      const isRV = o.asset.typology === 'Renta Variable' || o.asset.typology === 'Participaciones IIC';
      const isDerRV = o.operationType === 'Derivados' && (o.derivativeCategory === 'Índice' || o.derivativeCategory === 'Acciones');
      
      if (isRV || isDerRV) {
        equityBreakdown.push({ name: o.asset.name || o.asset.ticker, ticker: o.asset.ticker, value: o.side === 'buy' ? o.amountEur : -o.amountEur, isQueue: true });
      }
    });

    const isCurrentFormRV = targetAsset?.typology === 'Renta Variable' || targetAsset?.typology === 'Participaciones IIC';
    const isCurrentFormDerRV = operationType === 'Derivados' && (derivativeCategory === 'Índice' || derivativeCategory === 'Acciones');

    if ((isCurrentFormRV || isCurrentFormDerRV) && currentFormAmountEur > 0 && targetAsset) {
      equityBreakdown.push({ name: targetAsset.name || targetAsset.ticker, ticker: targetAsset.ticker, value: side === 'buy' ? currentFormAmountEur : -currentFormAmountEur, isQueue: true });
    }
    equityBreakdown.sort((a, b) => b.value - a.value);

    // E. IIC Individual Limit (20%)
    let iicWeightPct = 0;
    if (targetAsset?.typology === 'Participaciones IIC') {
      const currentIICValue = assetsList
        .filter(a => a.ticker === targetAsset.ticker)
        .reduce((sum, a) => sum + (a.marketValue || 0), 0);
      const queueIICValue = preTradeOrders
        .filter(o => o.asset.ticker === targetAsset.ticker)
        .reduce((sum, o) => sum + (o.side === 'buy' ? o.amountEur : -o.amountEur), 0);
      const impact = side === 'buy' ? currentFormAmountEur : -currentFormAmountEur;
      iicWeightPct = ((currentIICValue + queueIICValue + impact) / totalAum) * 100;
    }

    return {
      projectedQty,
      issuerWeightPct,
      concentrationPct,
      iicWeightPct,
      projectedEquityPct: projectedEquityStats.newEquityPct,
      targetIssuerId,
      issuerBreakdown,
      concentrationBreakdown,
      equityBreakdown,
      liquidityBreakdown: [
        { name: 'Posición Actual', value: currentHolding },
        { name: 'En Cesta (Pre-Trade)', value: queueQty },
        { name: 'Orden Actual', value: side === 'buy' ? formQty : -formQty }
      ],
      derivativeCommitment: (() => {
        // Calculate total commitment in derivatives
        // 1. Initial Commitment from Official Data (Excel)
        const initialCommitmentValue = (fund.aum || 0) * ((fund.derivativeCommitment || 0) / 100);
        let totalCommitment = initialCommitmentValue;
        
        // 2. Queue Derivatives (Impact of orders in the basket)
        preTradeOrders.forEach(o => {
          if (o.operationType === 'Derivados') {
            if (o.commitmentConsumption === 'SÍ') {
              totalCommitment += (o.commitment || 0);
            } else if (o.commitmentConsumption === 'NO' && o.noConsumptionReason === 'DESHACER POSICIÓN') {
              totalCommitment = Math.max(0, totalCommitment - (o.commitment || 0));
            }
          }
        });

        // 3. Current Form (Impact of the order being filled)
        if (operationType === 'Derivados') {
          if (commitmentConsumption === 'SÍ') {
            totalCommitment += parseFloat(commitment) || 0;
          } else if (commitmentConsumption === 'NO' && noConsumptionReason === 'DESHACER POSICIÓN') {
            totalCommitment = Math.max(0, totalCommitment - (parseFloat(commitment) || 0));
          }
        }

        return {
          value: totalCommitment,
          pct: (totalCommitment / totalAum) * 100
        };
      })()
    };
  }, [selectedAsset, isNewDerivative, newDerivName, newDerivCurrency, quantity, side, preTradeOrders, assetsList, currentFormAmountEur, adjustedAum, projectedEquityStats, issuerMap, operationType, commitment, multiplier, derivativeCategory, commitmentConsumption, price, fund.currency, rating]);


  const complianceStatus = useMemo(() => {
    const isAssetSelected = !!selectedAsset || (operationType === 'Derivados' && isNewDerivative) || operationType === 'Divisa';
    if (!isAssetSelected || (currentFormAmountEur === 0 && operationType !== 'Derivados') || !complianceMetrics) return 'idle';

    // Rule 0: Short Selling Validation (Exclude Derivatives and Divisa — RV and RF are blocked)
    if (side === 'sell' && operationType !== 'Derivados' && operationType !== 'Divisa') {
      if (complianceMetrics.projectedQty < 0) {
        return 'insufficient_holdings';
      }
    }

    // Rule 7: Rating Limit (Fund 5 = Occident Renta fija)
    if ((fund.id === '5' || fund.name.toUpperCase().includes('OCCIDENT')) && operationType === 'Renta Fija') {
      const ratingVal = getRatingValue(rating);
      if (ratingVal < 3) { // 3 is BBB-
        return 'rating_violation';
      }
    }

    // Rule 1: Cash Check (Only for Buys)
    if (side === 'buy' && operationType !== 'Derivados') {
       const availableCashAfterQueue = realLiquidity + queueNetImpact; 
       if (currentFormAmountEur > availableCashAfterQueue) {
         return 'insufficient_funds';
       }
    }

    // Rule 2: Equity Limits (Folleto)
    if (currentFundLimits) {
      const minLimitPct = currentFundLimits.minEquity * 100;
      const maxLimitPct = currentFundLimits.maxEquity * 100;

      if (side === 'buy' && complianceMetrics.projectedEquityPct > maxLimitPct) {
        return 'equity_max_violation';
      }
      if (side === 'sell' && complianceMetrics.projectedEquityPct < minLimitPct) {
        return 'equity_min_violation';
      }
    }

    // Rule 3: UCITS Concentration (10%) - Grouped by Issuer
    const isExcludedDeriv = (operationType === 'Derivados' && (derivativeCategory === 'Índice' || derivativeCategory === 'Divisa')) || operationType === 'Divisa';
    if (side === 'buy' && !isExcludedDeriv && complianceMetrics.issuerWeightPct > 10) {
      return 'ucits_10_violation';
    }

    // Rule 4: UCITS 5/40 Rule - Grouped by Issuer
    if (side === 'buy' && !isExcludedDeriv && complianceMetrics.concentrationPct > 40 && complianceMetrics.issuerWeightPct > 5) {
        return 'ucits_40_violation';
    }

    // Rule 5: IIC Individual Limit (20%)
    if (side === 'buy' && selectedAsset?.typology === 'Participaciones IIC' && complianceMetrics.iicWeightPct > 20) {
        return 'iic_limit_violation';
    }

    // Rule 6: Derivative Commitment Limit (90% or 200% for Regata)
    const maxCommitment = (fund.id === '701' || fund.name.toUpperCase().includes('REGATA')) ? 200 : 90;
    if (operationType === 'Derivados' && complianceMetrics.derivativeCommitment.pct > maxCommitment) {
        return 'derivative_commitment_violation';
    }

    return 'valid';
  }, [selectedAsset, currentFormAmountEur, complianceMetrics, realLiquidity, queueNetImpact, side, currentFundLimits, rating, operationType, fund.id, fund.name, isNewDerivative, derivativeCategory]);



  // --- HANDLERS ---
  const handleAssetSelect = (asset: Asset) => {
    setSelectedAsset(asset);
    setIsNewDerivative(false);
    setPrice(asset.lastPrice ? asset.lastPrice.toString() : '');
    setQuantity('');
    setRating(asset.rating || 'NR');
    setCommitmentConsumption('SÍ');
    setNoConsumptionReason('COBERTURA PERFECTA');
    setShowFxWarning(false);
    
    if (asset.multiplier) {
      setMultiplier(asset.multiplier.toString());
    } else if (asset.typology !== 'Derivados') {
      setMultiplier('1');
    }

    // Auto-set derivative category based on derivativeType from Excel
    if (asset.typology === 'Derivados' && asset.derivativeType) {
      const type = asset.derivativeType.toUpperCase();
      if (type === 'IRV') setDerivativeCategory('Índice');
      else if (type === 'VRV') setDerivativeCategory('Acciones');
      else if (type === 'DIV') setDerivativeCategory('Divisa');
    }

    if (asset.currency !== 'EUR' && asset.exchangeRate) {
      setExchangeRate(asset.exchangeRate.toString());
    } else {
      setExchangeRate('1.00');
    }
    setSearchQuery('');
  };

  const handleMasterSelect = (instrument: Instrument) => {
    const newAsset: Asset = {
      ticker: instrument.ticker,
      name: instrument.nombreActivo,
      isin: instrument.isin || '',
      currency: instrument.moneda,
      typology: instrument.tipologia,
      // Fix: Ensure we use the Issuer Code from the Master if available
      issuerTicker: instrument.codigoEmisora ? String(instrument.codigoEmisora) : instrument.ticker,
      lastPrice: 0,
      marketValue: 0,
      quantity: 0,
      exchangeRate: 1.00
    };
    handleAssetSelect(newAsset);
  };

  const resetQuickAddForm = () => {
    setQuickAddStep('type-selection');
    setQaTickerBase('');
    setQaTickerMarket('');
    setQaName('');
    setQaCurrency('USD');
    setQaPrice('');
    setUnderlyingPrice('');
    setShowPredefinedFutures(false);
    // We don't clear newDerivName/Underlying/Maturity here 
    // because they are used in the main form after "creation"
    setShowQuickAdd(false);
  };

  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (quickAddType === 'Derivados') {
      setIsNewDerivative(true);
      setSelectedAsset(null);
      setPrice('');
      setQuantity('');
      setCommitmentConsumption('SÍ');
      setNoConsumptionReason('COBERTURA PERFECTA');
      setSearchQuery('');
      
      // Construct Name: TYPE UNDERLYING STRIKE(opt) MATURITY
      // Format Maturity from YYYY-MM-DD to DD/MM/YYYY
      let formattedMaturity = newDerivMaturity;
      if (newDerivMaturity) {
        const [year, month, day] = newDerivMaturity.split('-');
        formattedMaturity = `${day}/${month}/${year}`;
      }

      let constructedName = `${newDerivType} ${newDerivUnderlying}`;
      if (newDerivType === 'CALL' || newDerivType === 'PUT') {
        constructedName += ` ${newDerivStrike}`;
      }
      constructedName += ` ${formattedMaturity}`;
      
      setNewDerivName(constructedName);
      
      // Set Instrument Type
      if (newDerivType === 'FUT') {
        setDerivativeInstrumentType('Futuros');
      } else {
        setDerivativeInstrumentType('Opciones');
      }

      // Handle exchange rate for derivative currency
      if (newDerivCurrency !== 'EUR') {
        const referenceAsset = assetsList.find(a => a.currency === newDerivCurrency && a.exchangeRate && a.exchangeRate > 0);
        if (referenceAsset) {
          setExchangeRate(referenceAsset.exchangeRate!.toString());
        } else {
          setShowFxWarning(true);
        }
      } else {
        setExchangeRate('1.00');
      }

      resetQuickAddForm();
      return;
    }

    const fullTicker = `${qaTickerBase.toUpperCase()} ${qaTickerMarket.toUpperCase()}`;
    const parsedPrice = parseFloat(qaPrice) || 0;

    let detectedExchangeRate = 1.00;
    let fxFound = false;

    if (qaCurrency !== 'EUR') {
      const referenceAsset = assetsList.find(a => a.currency === qaCurrency && a.exchangeRate && a.exchangeRate > 0);
      if (referenceAsset) {
        detectedExchangeRate = referenceAsset.exchangeRate!;
        fxFound = true;
      } else {
        fxFound = false;
      }
    } else {
      fxFound = true;
    }

    const newAsset: Asset = {
      ticker: fullTicker,
      name: qaName || fullTicker,
      isin: `XMANUAL${Date.now()}`,
      lastPrice: parsedPrice,
      currency: qaCurrency, 
      marketValue: 0,
      quantity: 0,
      issuerTicker: fullTicker,
      exchangeRate: detectedExchangeRate, 
      typology: quickAddType
    };

    setIsNewDerivative(false);
    setSelectedAsset(newAsset);
    setPrice(parsedPrice.toString());
    setQuantity('');
    setExchangeRate(detectedExchangeRate.toString());
    
    if (qaCurrency !== 'EUR' && !fxFound) {
      setShowFxWarning(true);
    } else {
      setShowFxWarning(false);
    }
    
    setSearchQuery('');
    resetQuickAddForm();
  };

  const isFormValid = useMemo(() => {
    if (!operationType) return false;
    if (complianceStatus !== 'valid') return false;

    if (operationType === 'Divisa') {
      return !!fxBaseCurrency && !!fxTargetCurrency && !!quantity && !!exchangeRate && !!valueDate;
    }

    const hasAsset = !!selectedAsset || (operationType === 'Derivados' && isNewDerivative);
    if (!hasAsset) return false;

    const hasQuantity = !!quantity && parseFloat(quantity) > 0;
    const hasPrice = !!price && parseFloat(price) >= 0;

    if (operationType === 'Renta Variable') {
      return hasQuantity && hasPrice;
    }

    if (operationType === 'Renta Fija') {
      return hasQuantity && hasPrice && !!rating;
    }

    if (operationType === 'Derivados') {
      const needsUnderlying = derivativeInstrumentType === 'Opciones';
      const hasUnderlyingPrice = !needsUnderlying || (!!underlyingPrice && parseFloat(underlyingPrice) >= 0);
      const hasMultiplier = !!multiplier && parseFloat(multiplier) > 0;
      return hasQuantity && hasPrice && hasUnderlyingPrice && hasMultiplier;
    }

    return false;
  }, [operationType, complianceStatus, selectedAsset, isNewDerivative, quantity, price, fxBaseCurrency, fxTargetCurrency, exchangeRate, valueDate, rating, underlyingPrice, multiplier, derivativeInstrumentType]);

  const handleAddToPreTrade = () => {
    if (!isFormValid) return;

    let assetToUse: Asset;
    
    if (operationType === 'Divisa') {
      assetToUse = {
        ticker: `${fxBaseCurrency}/${fxTargetCurrency}`,
        name: `FX ${fxBaseCurrency}/${fxTargetCurrency}`,
        isin: `FX-${Date.now()}`,
        lastPrice: parseFloat(exchangeRate) || 0,
        currency: fxBaseCurrency,
        marketValue: 0,
        quantity: 0,
        typology: 'Liquidez'
      };
    } else if (isNewDerivative) {
      assetToUse = {
        ticker: newDerivName.toUpperCase() || 'NUEVO DERIVADO',
        name: newDerivName || 'Nuevo Derivado',
        isin: `NEW-DERIV-${Date.now()}`,
        lastPrice: parseFloat(price) || 0,
        currency: newDerivCurrency,
        marketValue: 0,
        quantity: 0,
        typology: 'Derivados'
      };
    } else {
      assetToUse = selectedAsset!;
    }

    const newOrder: PreTradeOrder = {
      id: Date.now().toString(),
      asset: assetToUse,
      side: side,
      quantity: parseFloat(quantity),
      price: operationType === 'Divisa' ? parseFloat(exchangeRate) : parseFloat(price),
      currency: assetToUse.currency || fund.currency,
      amountEur: currentFormAmountEur,
      addedAt: new Date().toISOString(),
      fundId: fund.id,
      fundName: fund.name,
      fundTicker: fund.ticker,
      operationType: operationType || 'Renta Variable',
      derivativeCategory: operationType === 'Derivados' ? derivativeCategory : undefined,
      derivativeAction: operationType === 'Derivados' ? (commitmentConsumption === 'SÍ' ? 'Abrir' : 'Cerrar') : undefined,
      commitmentConsumption: operationType === 'Derivados' ? commitmentConsumption : undefined,
      noConsumptionReason: operationType === 'Derivados' && commitmentConsumption === 'NO' ? noConsumptionReason : undefined,
      derivativeInstrumentType: operationType === 'Derivados' ? derivativeInstrumentType : undefined,
      underlying: operationType === 'Derivados' && isNewDerivative ? newDerivUnderlying : undefined,
      underlyingPrice: operationType === 'Derivados' ? parseFloat(underlyingPrice) : undefined,
      maturity: operationType === 'Derivados' && isNewDerivative ? newDerivMaturity : undefined,
      delta: operationType === 'Derivados' && derivativeInstrumentType === 'Opciones' ? parseFloat(delta) : undefined,
      commitment: operationType === 'Derivados' ? parseFloat(commitment) : undefined,
      multiplier: operationType === 'Derivados' ? parseFloat(multiplier) : undefined,
      rating: operationType === 'Renta Fija' ? rating : undefined,
      nominal: operationType === 'Renta Fija' ? parseFloat(quantity) : undefined,
      valueDate: operationType === 'Divisa' ? valueDate : undefined,
      fxTargetCurrency: operationType === 'Divisa' ? fxTargetCurrency : undefined,
      fxBaseCurrency: operationType === 'Divisa' ? fxBaseCurrency : undefined,
      validityDate: (operationType === 'Renta Variable' || operationType === 'Derivados') ? validityDate : undefined,
      notes: (operationType === 'Renta Variable' || operationType === 'Derivados') ? notes : undefined
    };

    if (operationType === 'Divisa' && onSendOrder) {
      onSendOrder(newOrder);
      setQuantity('');
      setPrice('');
      setExchangeRate('');
      setSelectedAsset(null);
      setSearchQuery('');
      setFxBaseCurrency('EUR');
      setFxTargetCurrency('USD');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const isFutureOrder = validityDate && validityDate > todayStr;

    if (isFutureOrder && (operationType === 'Renta Variable' || operationType === 'Derivados')) {
      setPendingOrders(prev => [...prev, newOrder]);
    } else {
      setPreTradeOrders(prev => [...prev, newOrder]);
      onAddOrder(newOrder);
    }

    setQuantity('');
    setPrice('');
    setUnderlyingPrice('');
    setCommitment('');
    setValidityDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    if (isNewDerivative) {
      setNewDerivName('');
      setNewDerivUnderlying('');
      setNewDerivMaturity('');
      setIsNewDerivative(false);
    }
  };

  const displayPendingOrders = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const filteredPending = pendingOrders.filter(o => o.validityDate && o.validityDate > todayStr);
    const vivaOrders = postTradeOrders.filter(o => o.status === 'VIVA');
    return [...filteredPending, ...vivaOrders];
  }, [pendingOrders, postTradeOrders]);

  const handleRemoveFromQueue = (id: string) => {
    setPreTradeOrders(prev => prev.filter(o => o.id !== id));
    onRemoveOrder(id);
  };

  const handleTypeSelection = (type: QuickAddType) => {
    setQuickAddType(type);
    setQuickAddStep('form');
  };



  const filteredAssets = useMemo(() => {
    return assetsList.filter(a => {
      // Filter by operation type
      if (operationType === 'Renta Variable') {
        if (a.typology !== 'Renta Variable') return false;
      } else if (operationType === 'Renta Fija') {
        if (a.typology !== 'Renta Fija') return false;
      } else if (operationType === 'Derivados') {
        if (a.typology !== 'Derivados') return false;
      } else if (operationType === 'Divisa') {
        if (a.typology !== 'Liquidez') return false;
      }

      const query = searchQuery.toLowerCase();
      return (
        (a.ticker && a.ticker.toLowerCase().includes(query)) || 
        (a.name && a.name.toLowerCase().includes(query)) ||
        (a.isin && a.isin.toLowerCase().includes(query))
      );
    });
  }, [assetsList, searchQuery, operationType]);

  const formatCurrency = (val: number, currency: string = fund.currency) => {
    // Force 'de-DE' locale to ensure dots are used for thousands separator as requested
    // (es-ES sometimes defaults to spaces in modern browsers/OS settings)
    // German (de-DE) standard is strictly 1.234,56
    return new Intl.NumberFormat('de-DE', { 
      style: 'currency', 
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val);
  };

  const themeColor = side === 'buy' ? 'emerald' : 'rose';

  // --- RENDER VIEW: DESK ---
  if (!operationType) {
    return (
      <div className="h-[calc(100vh-140px)] flex flex-col items-center justify-center p-8 bg-slate-50 animate-in fade-in duration-500">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-4 tracking-tight">Nueva Operación</h2>
            <p className="text-slate-500">Seleccione el tipo de activo para comenzar a introducir la orden.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { id: 'Renta Variable', icon: <TrendingUp size={32} />, label: 'Renta Variable', desc: 'Acciones y ETFs' },
              { id: 'Derivados', icon: <Activity size={32} />, label: 'Derivados', desc: 'Futuros y Opciones' },
              { id: 'Renta Fija', icon: <Database size={32} />, label: 'Renta Fija', desc: 'Bonos y Obligaciones' },
              { id: 'Divisa', icon: <Globe size={32} />, label: 'Divisa', desc: 'Operaciones FX' },
            ].map((type) => (
              <button
                key={type.id}
                onClick={() => setOperationType(type.id as OperationType)}
                className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:border-brand-500 hover:shadow-md transition-all group text-center flex flex-col items-center gap-4"
              >
                <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center text-brand-600 group-hover:bg-brand-600 group-hover:text-white transition-colors">
                  {type.icon}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">{type.label}</h3>
                  <p className="text-xs text-slate-500">{type.desc}</p>
                </div>
              </button>
            ))}
          </div>

          {/* PENDING ORDERS REPOSITORY */}
          <div className="mt-12 pt-12 border-t border-slate-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Clock className="text-brand-600" size={24} />
                Órdenes pendientes
              </h3>
              <span className="px-3 py-1 bg-brand-100 text-brand-700 rounded-full text-xs font-bold">
                {displayPendingOrders.length} Órdenes en repositorio
              </span>
            </div>

            {displayPendingOrders.length === 0 ? (
              <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                  <ListPlus size={32} />
                </div>
                <h4 className="text-slate-800 font-bold mb-1">No hay órdenes pendientes</h4>
                <p className="text-slate-500 text-sm">Las órdenes con fecha de validez futura aparecerán aquí para su seguimiento.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {displayPendingOrders.map((order) => (
                  <div key={order.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:border-brand-300 transition-all group">
                    <div className="flex items-center">
                      <div className={`w-2 self-stretch ${order.side === 'buy' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      <div className="flex-grow p-4 grid grid-cols-12 gap-4 items-center">
                        <div className="col-span-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${order.side === 'buy' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                              {order.side === 'buy' ? 'COMPRA' : 'VENTA'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">Generada: {new Date(order.addedAt).toLocaleDateString()}</span>
                          </div>
                          <h4 className="font-bold text-slate-800 truncate" title={order.asset.name}>{order.asset.name}</h4>
                          <p className="text-xs text-slate-500 font-mono">{order.asset.ticker}</p>
                        </div>

                        <div className="col-span-2">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">IIC / Fondo</p>
                          <p className="text-xs font-bold text-slate-700 truncate">{order.fundName}</p>
                          <p className="text-[10px] text-slate-500 font-mono">{order.fundId}</p>
                        </div>

                        <div className="col-span-2">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Características</p>
                          <p className="text-xs text-slate-700">{order.quantity.toLocaleString()} x {order.price.toFixed(2)} {order.currency}</p>
                          <p className="text-[10px] text-slate-500 font-bold">{formatCurrency(order.amountEur, 'EUR')}</p>
                        </div>

                        <div className="col-span-2">
                          <p className="text-[10px] font-bold text-brand-600 uppercase tracking-wider mb-1">Validez hasta</p>
                          <div className="flex items-center gap-1 text-brand-700 font-bold">
                            <Calendar size={12} />
                            <span className="text-sm">{order.validityDate ? new Date(order.validityDate).toLocaleDateString() : '---'}</span>
                          </div>
                        </div>

                        <div className="col-span-2">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Observaciones</p>
                          <p className="text-xs text-slate-600 italic line-clamp-2" title={order.notes}>{order.notes || 'Sin observaciones'}</p>
                        </div>

                        <div className="col-span-1 flex justify-end gap-2">
                          {('status' in order && (order as any).status === 'VIVA') ? (
                             <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-[10px] font-bold self-center">VIVA (Post-Trade)</span>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  const orderForPreTrade = { ...order, validityDate: undefined };
                                  setPreTradeOrders(prev => [...prev, orderForPreTrade]);
                                  onAddOrder(orderForPreTrade);
                                  setPendingOrders(prev => prev.filter(o => o.id !== order.id));
                                }}
                                className="p-2 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                                title="Mover a Cesta (Pre-Trade)"
                              >
                                <ArrowRightCircle size={20} />
                              </button>
                              <button
                                onClick={() => setPendingOrders(prev => prev.filter(o => o.id !== order.id))}
                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Eliminar"
                              >
                                <Trash2 size={20} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
      <div className="h-[calc(100vh-140px)] flex flex-col animate-in fade-in duration-500">
        
        {/* 1. STICKY CONTEXT BAR */}
        <div className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm px-6 py-3 flex justify-between items-center rounded-t-xl mx-0">
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-brand-100 rounded-lg flex items-center justify-center text-brand-700 font-bold border border-brand-200">
                {fund.ticker ? fund.ticker.substring(0, 3) : '---'}
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">{fund.name}</h2>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-mono">{fund.id}</span>
                  <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                  <span>{fund.currency}</span>
                </div>
              </div>
            </div>

            <div className="h-8 w-px bg-slate-200"></div>

            <button 
              onClick={() => setIsAssistantOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 group"
            >
              <SparklesIcon size={16} className="text-brand-400 group-hover:rotate-12 transition-transform" />
              AI ASSISTANT
            </button>

            <div className="h-8 w-px bg-slate-200"></div>

            <button 
              onClick={() => {
                setOperationType(null);
                setSelectedAsset(null);
                setIsNewDerivative(false);
                setCommitmentConsumption('SÍ');
                setNoConsumptionReason('COBERTURA PERFECTA');
              }}
              className="flex items-center gap-2 text-slate-400 hover:text-brand-600 transition-colors group"
            >
              <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
              <span className="text-xs font-bold uppercase tracking-wider">Cambiar Tipo</span>
            </button>

            <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100">
              <div className="text-slate-500">
                {operationType === 'Renta Variable' && <TrendingUp size={16} />}
                {operationType === 'Derivados' && <Activity size={16} />}
                {operationType === 'Renta Fija' && <Database size={16} />}
                {operationType === 'Divisa' && <Globe size={16} />}
              </div>
              <span className="text-xs font-bold text-slate-600 uppercase tracking-tight">{operationType}</span>
            </div>
          </div>

          <div className="flex items-center gap-8">
            <FundSelector 
              selectedFundId={fund.id} 
              funds={funds} 
              onFundChange={onFundChange} 
            />
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Patrimonio Total</p>
              <p className="text-sm font-mono font-medium text-slate-700">{formatCurrency(adjustedAum)}</p>
            </div>
            <div className="text-right group">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Liquidez (T-Real)</p>
              <div className="flex items-center justify-end gap-2">
                 <p className={`text-lg font-mono font-bold transition-colors duration-300 ${projectedLiquidityPct < 1 ? 'text-red-600' : 'text-slate-800'}`}>
                  {formatCurrency(projectedCash)}
                </p>
                {(currentFormAmountEur > 0 || queueNetImpact !== 0) && (
                  <span className={`text-xs font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600`}>
                    {(projectedCash - realLiquidity) > 0 ? '+' : ''}{formatCurrency(projectedCash - realLiquidity).replace('€', '')} var
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">% Renta Variable</p>
              <div className="flex justify-end items-baseline gap-1">
                 <p className="text-sm font-mono font-medium text-slate-700">{projectedEquityStats.currentAdjustedEquityPct.toFixed(2)}%</p>
                 {(currentFormAmountEur > 0 || preTradeOrders.length > 0) && (
                   <span className="text-[10px] text-slate-400">
                     → {projectedEquityStats.newEquityPct.toFixed(2)}%
                   </span>
                 )}
              </div>
            </div>
          </div>
        </div>

        <TradingAssistant 
          fund={fund}
          adjustedAum={adjustedAum}
          availableLiquidity={realLiquidity + queueNetImpact}
          fundLimits={fundLimits}
          isOpen={isAssistantOpen}
          onClose={() => setIsAssistantOpen(false)}
          onProposeOrders={(orders) => {
            setPreTradeOrders(prev => [...prev, ...orders]);
          }}
        />

        {/* MAIN WORKSPACE GRID */}
        <div className="flex-grow grid grid-cols-12 gap-0 bg-white min-h-0">
          
          {/* 2. LEFT PANEL: SEARCH & MASTER */}
          <div className="col-span-3 border-r border-slate-200 bg-slate-50 flex flex-col min-h-0">
            {/* ... existing left panel ... */}
            <div className="p-4 border-b border-slate-200 bg-white space-y-3">
              {operationType === 'Divisa' ? (
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg text-center">
                  <Globe className="mx-auto text-blue-500 mb-2" size={24} />
                  <p className="text-sm font-bold text-blue-800">Modo Divisa</p>
                  <p className="text-xs text-blue-600 mt-1">Configure la operación en el panel central.</p>
                </div>
              ) : (
                <>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Buscador en Cartera</label>
                  <div className="relative group">
                    <Search className="absolute left-3 top-2.5 text-slate-400 group-focus-within:text-brand-500 transition-colors" size={16} />
                    <input 
                      type="text"
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all"
                      placeholder="Ticker, ISIN o Nombre..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  
                  <button 
                    onClick={() => setShowMasterSearch(true)}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-brand-50 border border-brand-200 rounded-lg text-brand-700 text-sm font-bold hover:bg-brand-100 hover:border-brand-300 transition-all shadow-sm"
                  >
                    <Database size={16} />
                    BUSCADOR MAESTRO
                  </button>
                </>
              )}
            </div>
            
            <div className="flex-grow overflow-y-auto p-2 space-y-1">
              {operationType === 'Divisa' ? null : (
                <>
                  {searchQuery && filteredAssets.length === 0 ? (
                     <div className="text-center py-8 px-4">
                       <p className="text-sm text-slate-500 mb-3">No encontrado en la cartera actual.</p>
                       <button 
                        onClick={() => setShowMasterSearch(true)}
                        className="w-full py-2 px-3 bg-brand-600 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-brand-700 transition-all flex items-center justify-center gap-2"
                       >
                         <Search size={14} /> Buscar en Maestro
                       </button>
                     </div>
                  ) : (
                    filteredAssets.map((asset, idx) => (
                      <button
                        key={asset.isin || idx}
                        onClick={() => handleAssetSelect(asset)}
                        className={`w-full text-left p-3 rounded-lg border transition-all group ${
                          selectedAsset?.ticker === asset.ticker 
                            ? 'bg-white border-brand-500 shadow-sm ring-1 ring-brand-100' 
                            : 'bg-white border-transparent hover:border-slate-300 hover:bg-white/50'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-slate-800 truncate pr-2 text-xs">{operationType === 'Divisa' ? asset.currency : asset.name}</span>
                          <span className="font-mono text-[10px] text-slate-500 whitespace-nowrap">{asset.lastPrice.toFixed(2)} {asset.currency}</span>
                        </div>
                        {asset.ticker && !asset.ticker.startsWith('POS-') && (
                          <div className="text-[10px] font-bold text-brand-600 uppercase tracking-wider">{asset.ticker}</div>
                        )}
                        <div className="text-[10px] text-slate-400 font-mono mt-1 flex justify-between">
                          <span>{operationType === 'Renta Fija' ? (asset.nominal || 0).toLocaleString() : (asset.quantity || 0).toLocaleString()} {operationType === 'Renta Fija' ? 'nom.' : 'tit.'}</span>
                          {asset.marketValue && <span className="font-semibold text-slate-600">{formatCurrency(asset.marketValue)}</span>}
                        </div>
                      </button>
                    ))
                  )}
                </>
              )}
              {!searchQuery && (
                <div className="p-4 text-center">
                  <p className="text-xs text-slate-400 italic">Mostrando {filteredAssets.length} activos de Renta Variable.</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-white">
              {operationType !== 'Renta Fija' && (
                <button
                  onClick={() => {
                    setNewDerivName('');
                    setNewDerivUnderlying('');
                    setNewDerivMaturity('');
                    
                    if (operationType === 'Renta Variable') {
                      setQuickAddType('Renta Variable');
                      setQuickAddStep('form');
                    } else if (operationType === 'Derivados') {
                      setQuickAddType('Derivados');
                      setQuickAddStep('form');
                    } else {
                      setQuickAddStep('type-selection');
                    }
                    
                    setShowQuickAdd(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-white border-2 border-slate-200 rounded-xl text-slate-700 text-sm font-bold hover:border-brand-500 hover:text-brand-700 hover:bg-brand-50 transition-all shadow-sm group"
                >
                  <Plus size={18} className="text-slate-400 group-hover:text-brand-500 transition-colors" />
                  ALTA RÁPIDA INSTRUMENTO
                </button>
              )}
            </div>
          </div>

          {/* 3. CENTER PANEL: ORDER PAD */}
          <div className="col-span-5 border-r border-slate-200 bg-white p-8 flex flex-col overflow-y-auto">
            {/* ... existing order pad code ... */}
            <div className="mb-6">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <div className="w-2 h-6 bg-slate-800 rounded-full"></div>
                Boleta de Órdenes
              </h3>
            </div>

            <div className={`mb-4 p-3 rounded-xl border ${selectedAsset || isNewDerivative ? `border-${themeColor}-100 bg-${themeColor}-50/30` : 'border-slate-100 bg-slate-50'} transition-all`}>
              {!selectedAsset && !isNewDerivative ? (
                <div className="text-center text-slate-400 text-xs py-2">Selecciona un activo del panel izquierdo o usa Alta Rápida</div>
              ) : (
                <div className="flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                        {isNewDerivative ? 'Nuevo Derivado (Alta Rápida)' : 'Activo en Cartera'}
                      </span>
                      <CheckCircle2 size={10} className="text-brand-500" />
                    </div>
                    <h4 className="font-bold text-slate-800 text-base leading-tight">
                      {isNewDerivative ? newDerivName : selectedAsset?.name}
                    </h4>
                    {selectedAsset?.ticker && !selectedAsset.ticker.startsWith('POS-') && (
                      <p className="text-xs font-bold text-brand-600 uppercase tracking-wider">
                        {selectedAsset.ticker}
                      </p>
                    )}
                    {isNewDerivative && (
                      <p className="text-xs text-slate-500">
                        {newDerivUnderlying} - {newDerivMaturity}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-slate-400 uppercase">Divisa Activo</p>
                    <p className="font-mono font-bold text-base text-slate-700">
                      {isNewDerivative ? newDerivCurrency : (selectedAsset?.currency === 'GBP' ? 'GBP (Peniques)' : selectedAsset?.currency)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-6 flex-grow">
              {/* Sentido de la Operación (Compra/Venta) - Always visible and part of the flow */}
              {operationType !== 'Divisa' && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sentido de la Operación</label>
                <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl">
                  <button
                    onClick={() => setSide('buy')}
                    className={`py-2.5 text-sm font-bold rounded-lg transition-all duration-300 flex items-center justify-center gap-2 ${side === 'buy' ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-100' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <div className={`w-2 h-2 rounded-full ${side === 'buy' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></div>
                    COMPRA
                  </button>
                  <button
                    onClick={() => setSide('sell')}
                    className={`py-2.5 text-sm font-bold rounded-lg transition-all duration-300 flex items-center justify-center gap-2 ${side === 'sell' ? 'bg-white text-rose-700 shadow-sm ring-1 ring-rose-100' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <div className={`w-2 h-2 rounded-full ${side === 'sell' ? 'bg-rose-500 animate-pulse' : 'bg-slate-300'}`}></div>
                    VENTA
                  </button>
                </div>
              </div>
              )}

              {operationType === 'Divisa' && (
                <div className="space-y-6 animate-in slide-in-from-top-2">
                  {/* Row 1: Primary Action */}
                  <div className="grid grid-cols-12 gap-4 items-end">
                    <div className="col-span-4 space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Operación</label>
                      <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl">
                         <button onClick={() => setSide('buy')} className={`py-2 text-xs font-bold rounded-lg transition-all ${side === 'buy' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}>COMPRA</button>
                         <button onClick={() => setSide('sell')} className={`py-2 text-xs font-bold rounded-lg transition-all ${side === 'sell' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-500'}`}>VENTA</button>
                      </div>
                    </div>
                    <div className="col-span-3 space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Divisa</label>
                      <select 
                        value={fxBaseCurrency} 
                        onChange={(e) => setFxBaseCurrency(e.target.value)} 
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-mono text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                         {['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD'].map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="col-span-5 space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Importe</label>
                      <input 
                        type="number"
                        value={quantity} 
                        onChange={(e) => setQuantity(e.target.value)} 
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-mono text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Row 2: Secondary Action (Inverse) */}
                  <div className="grid grid-cols-12 gap-4 items-end bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="col-span-4 flex items-center h-full pb-2">
                      <span className={`text-sm font-bold uppercase flex items-center gap-2 ${side === 'buy' ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {side === 'buy' ? <div className="w-2 h-2 rounded-full bg-rose-500"></div> : <div className="w-2 h-2 rounded-full bg-emerald-500"></div>}
                        {side === 'buy' ? 'VENTA' : 'COMPRA'}
                      </span>
                    </div>
                    <div className="col-span-3 space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Contrapartida</label>
                      <select 
                        value={fxTargetCurrency} 
                        onChange={(e) => setFxTargetCurrency(e.target.value)} 
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-mono text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                         {['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD'].map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="col-span-5 space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Importe Estimado</label>
                      <input 
                        value={quantity && exchangeRate ? (parseFloat(quantity) * parseFloat(exchangeRate)).toFixed(2) : ''} 
                        readOnly 
                        className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-lg font-mono text-sm text-slate-500"
                      />
                    </div>
                  </div>

                  {/* Row 3: Rate & Date */}
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                       <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tipo de Cambio ({fxTargetCurrency}/{fxBaseCurrency})</label>
                       <input 
                         type="number"
                         step="0.0001"
                         value={exchangeRate} 
                         onChange={(e) => setExchangeRate(e.target.value)} 
                         className="w-full p-3 bg-white border border-slate-300 rounded-lg font-mono text-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                         placeholder="1.0000"
                       />
                     </div>
                     <div className="space-y-2">
                       <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha Valor</label>
                       <input 
                         type="date"
                         value={valueDate} 
                         onChange={(e) => setValueDate(e.target.value)} 
                         className="w-full p-3 bg-white border border-slate-300 rounded-lg font-mono text-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                       />
                     </div>
                  </div>
                </div>
              )}

              {operationType === 'Derivados' && (
                <div className="space-y-4 animate-in slide-in-from-top-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">¿CONSUME COMPROMISO EN DERIVADOS?</label>
                      <select
                        value={commitmentConsumption}
                        onChange={(e) => setCommitmentConsumption(e.target.value as DerivativeCommitmentConsumption)}
                        className="w-full p-3 bg-white border border-slate-300 rounded-lg font-mono text-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="SÍ">SÍ</option>
                        <option value="NO">NO</option>
                      </select>
                    </div>
                    
                    {commitmentConsumption === 'NO' && (
                      <div className="space-y-2 animate-in slide-in-from-left-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Motivo de no consumo</label>
                        <select
                          value={noConsumptionReason}
                          onChange={(e) => setNoConsumptionReason(e.target.value as DerivativeNoConsumptionReason)}
                          className="w-full p-3 bg-white border border-slate-300 rounded-lg font-mono text-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                        >
                          <option value="COBERTURA PERFECTA">COBERTURA PERFECTA</option>
                          <option value="DESHACER POSICIÓN">DESHACER POSICIÓN</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tipo Derivado</label>
                      <select
                        value={derivativeCategory}
                        onChange={(e) => setDerivativeCategory(e.target.value as DerivativeCategory)}
                        className="w-full p-3 bg-white border border-slate-300 rounded-lg font-mono text-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="Acciones">Acciones</option>
                        <option value="Índice">Índice</option>
                        <option value="Divisa">Divisa</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Instrumento</label>
                      <select
                        value={derivativeInstrumentType}
                        onChange={(e) => setDerivativeInstrumentType(e.target.value as DerivativeInstrumentType)}
                        className="w-full p-3 bg-white border border-slate-300 rounded-lg font-mono text-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="Futuros">Futuros</option>
                        <option value="Opciones">Opciones</option>
                      </select>
                    </div>
                  </div>

                  {derivativeInstrumentType === 'Opciones' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2 animate-in zoom-in-95 duration-200">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Delta (0 a 1)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="1"
                          value={delta}
                          onChange={(e) => setDelta(e.target.value)}
                          className="w-full p-3 bg-white border border-slate-300 rounded-lg font-mono text-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                          placeholder="0.50"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {operationType !== 'Divisa' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {operationType === 'Renta Fija' ? 'Nominal' : 
                     operationType === 'Renta Variable' ? 'Cantidad (Títulos)' : 
                     operationType === 'Derivados' ? 'Contratos' : 'Importe'}
                  </label>
                  <input
                    type="number"
                    disabled={!selectedAsset && !isNewDerivative && operationType !== 'Divisa'}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className={`w-full p-3 bg-white border border-slate-300 rounded-lg font-mono text-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent tabular-nums transition-shadow disabled:bg-slate-50 disabled:text-slate-300`}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {operationType === 'Renta Fija' ? 'Precio (%)' : 
                     operationType === 'Divisa' ? 'Tipo de Cambio' :
                     operationType === 'Derivados' ? `Prima / Precio Futuro (${(isNewDerivative ? newDerivCurrency : selectedAsset?.currency) === 'GBP' ? 'GBp' : (isNewDerivative ? newDerivCurrency : selectedAsset?.currency) || '---'})` :
                     `Precio (${(isNewDerivative ? newDerivCurrency : selectedAsset?.currency) === 'GBP' ? 'GBp - Peniques' : (isNewDerivative ? newDerivCurrency : selectedAsset?.currency) || '---'})`}
                  </label>
                  <input
                    type="number"
                    disabled={!selectedAsset && !isNewDerivative && operationType !== 'Divisa'}
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className={`w-full p-3 bg-white border border-slate-300 rounded-lg font-mono text-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent tabular-nums transition-shadow disabled:bg-slate-50 disabled:text-slate-300`}
                    placeholder="0.00"
                  />
                </div>
              </div>
              )}

              {operationType === 'Derivados' && derivativeInstrumentType === 'Opciones' && (
                <div className="space-y-2 animate-in slide-in-from-top-2 mb-4">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Precio Subyacente (VITAL para Compromiso/Exposición)
                  </label>
                  <input
                    type="number"
                    value={underlyingPrice}
                    onChange={(e) => setUnderlyingPrice(e.target.value)}
                    className={`w-full p-3 bg-white border border-slate-300 rounded-lg font-mono text-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent tabular-nums transition-shadow`}
                    placeholder="0.00"
                  />
                </div>
              )}

              {operationType === 'Renta Fija' && (
                <div className="space-y-2 animate-in slide-in-from-top-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Rating</label>
                  <input
                    type="text"
                    value={rating}
                    onChange={(e) => setRating(e.target.value.toUpperCase())}
                    className="w-full p-3 bg-white border border-slate-300 rounded-lg font-mono text-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="AAA, BBB+, NR..."
                  />
                  <p className="text-[10px] text-slate-400 italic">Calidad crediticia del emisor/activo. NR = Sin Calificar (Peor calidad).</p>
                </div>
              )}

              {operationType === 'Derivados' && (
                <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Multiplicador</label>
                    <input
                      type="number"
                      value={multiplier}
                      onChange={(e) => setMultiplier(e.target.value)}
                      className={`w-full p-3 bg-white border border-slate-300 rounded-lg font-mono text-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent tabular-nums transition-shadow`}
                      placeholder="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Compromiso (EUR)</label>
                    <input
                      type="number"
                      readOnly
                      value={commitment}
                      className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-lg font-mono text-lg text-slate-500 tabular-nums cursor-not-allowed`}
                    />
                  </div>
                </div>
              )}



              {((selectedAsset && selectedAsset.currency !== 'EUR') || (isNewDerivative && newDerivCurrency !== 'EUR')) && operationType !== 'Divisa' && (
                <div className="space-y-2 animate-in slide-in-from-top-2">
                  <div className="flex justify-between items-center">
                     <label className="text-xs font-bold text-brand-700 uppercase tracking-wider flex items-center gap-1">
                       <Globe size={12} /> Tipo de Cambio ({isNewDerivative ? newDerivCurrency : selectedAsset?.currency}/EUR)
                     </label>
                     {selectedAsset?.exchangeRate && !showFxWarning && !isNewDerivative && (
                       <button 
                         onClick={() => setExchangeRate(selectedAsset.exchangeRate!.toString())}
                         className="text-[10px] text-slate-400 hover:text-brand-500 underline decoration-dotted"
                       >
                         Restaurar valor cartera: {selectedAsset.exchangeRate}
                       </button>
                     )}
                  </div>
                  <input
                    type="number"
                    step="0.0001"
                    value={exchangeRate}
                    onChange={(e) => {
                      setExchangeRate(e.target.value);
                      if (showFxWarning) setShowFxWarning(false); 
                    }}
                    className={`w-full p-3 bg-brand-50 border ${showFxWarning ? 'border-orange-300 ring-2 ring-orange-200' : 'border-brand-200'} rounded-lg font-mono text-lg text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent tabular-nums transition-shadow`}
                    placeholder="1.0000"
                  />
                  
                  {showFxWarning ? (
                    <div className="p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-800 flex items-start gap-2 animate-in slide-in-from-top-2">
                      <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                      <p><strong>Atención:</strong> Insertar tipo de cambio. Actualmente no disponible en cartera para {isNewDerivative ? newDerivCurrency : selectedAsset?.currency}.</p>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 italic">Dividimos el importe bruto ({isNewDerivative ? newDerivCurrency : selectedAsset?.currency}) por este valor para obtener el riesgo en EUR.</p>
                  )}
                </div>
              )}

              {(operationType === 'Renta Variable' || operationType === 'Derivados') && (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <Calendar size={12} /> Validez de la orden
                    </label>
                    <input
                      type="date"
                      value={validityDate}
                      onChange={(e) => setValidityDate(e.target.value)}
                      className={`w-full p-3 bg-white border border-slate-300 rounded-lg font-mono text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent transition-shadow`}
                    />
                    <p className="text-[10px] text-slate-400 italic">Si la fecha es futura, la orden se guardará en el repositorio de órdenes pendientes.</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <MessageSquare size={12} /> Observaciones
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      className={`w-full p-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent transition-shadow resize-none`}
                      placeholder="Indica detalles adicionales de la orden..."
                    />
                  </div>
                </div>
              )}

              <div className={`p-4 rounded-xl border border-slate-200 bg-slate-50 flex justify-between items-center`}>
                <div>
                  <span className="text-sm font-bold text-slate-500 uppercase">Importe Estimado</span>
                  {((selectedAsset && selectedAsset.currency !== 'EUR') || (isNewDerivative && newDerivCurrency !== 'EUR')) && (
                     <p className="text-[10px] text-slate-400 font-medium">
                       Local ({isNewDerivative ? newDerivCurrency : selectedAsset?.currency}): {formatCurrency(
                         (parseFloat(quantity) || 0) * 
                         (operationType === 'Derivados' 
                           ? (derivativeInstrumentType === 'Futuros' ? (parseFloat(price) || 0) : (parseFloat(underlyingPrice) || 0)) * (parseFloat(multiplier) || 1) * (derivativeInstrumentType === 'Opciones' ? Math.abs(parseFloat(delta) || 0) : 1)
                           : (parseFloat(price) || 0)), 
                         (isNewDerivative ? newDerivCurrency : selectedAsset?.currency) === 'GBP' ? 'GBp' : (isNewDerivative ? newDerivCurrency : selectedAsset?.currency)
                       )}
                     </p>
                  )}
                </div>
                <div className="text-right">
                  <span className={`text-xl font-mono font-bold tracking-tight ${currentFormAmountEur > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
                    {formatCurrency(currentFormAmountEur, 'EUR')}
                  </span>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-widest mt-1">Estimación en EUR</span>
                  {/* LIQUIDITY PERCENTAGE DISPLAY */}
                  {side === 'buy' && currentFormAmountEur > 0 && (
                    <span className="text-[10px] text-blue-600 block font-medium mt-0.5">
                      {adjustedAum > 0 ? ((currentFormAmountEur / adjustedAum) * 100).toFixed(2) : '0.00'}% s/ Patrimonio
                    </span>
                  )}
                </div>
              </div>
              
              <button
                onClick={handleAddToPreTrade}
                className={`w-full py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                  isFormValid
                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
                disabled={!isFormValid}
              >
                {operationType === 'Divisa' ? <Send size={18} /> : <ListPlus size={18} />}
                {operationType === 'Divisa' ? 'ENVIAR A POST-TRADE' : 'AÑADIR A PRE-TRADE'}
              </button>
              
              {((selectedAsset?.currency === 'GBP') || (isNewDerivative && newDerivCurrency === 'GBP')) && (
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-[11px] text-amber-800 flex items-start gap-2">
                  <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                  <p><strong>Aviso GBP:</strong> Los títulos en GBP cotizan en <strong>peniques (GBp)</strong>. El sistema divide automáticamente por 100 para calcular el importe en Libras antes de aplicar el tipo de cambio.</p>
                </div>
              )}
            </div>
          </div>

          {/* 4. RIGHT PANEL: COMPLIANCE BRAIN & PRE-TRADE TABLE */}
          <div className="col-span-4 bg-slate-50 p-6 flex flex-col overflow-y-auto">
            {/* ... rest of the file stays exactly the same ... */}
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-6 flex items-center gap-2">
               <ShieldCheck size={16} /> Compliance Check
            </h3>

            <div className="space-y-4 mb-8">
              
              {/* Status Card */}
              <div className={`p-5 rounded-xl border transition-all duration-300 ${
                complianceStatus === 'idle' ? 'bg-white border-slate-200' :
                complianceStatus === 'valid' ? 'bg-green-50 border-green-200 shadow-sm' :
                (complianceStatus.includes('violation') || complianceStatus.includes('insufficient')) ? 'bg-red-50 border-red-200 shadow-sm' :
                'bg-yellow-50 border-yellow-200 shadow-sm'
              }`}>
                {complianceStatus === 'idle' && (
                  <div className="flex flex-col items-center text-center py-4">
                    <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                      <TrendingUp size={24} />
                    </div>
                    <p className="text-sm text-slate-500">Introduce datos de la orden para validar reglas UCITS.</p>
                  </div>
                )}
                
                {complianceStatus === 'valid' && (
                   <div className="flex items-start gap-4">
                     <div className="p-2 bg-green-100 text-green-600 rounded-full mt-1">
                       <ShieldCheck size={20} />
                     </div>
                     <div>
                       <h4 className="text-sm font-bold text-green-800">Orden Validada</h4>
                       <p className="text-xs text-green-700 mt-1">Cumple normativa UCITS, Folleto y Límites.</p>
                     </div>
                   </div>
                )}

                {/* --- RESTORED ERROR MESSAGES --- */}
                
                {complianceStatus === 'equity_max_violation' && (
                  <div className="flex items-start gap-4">
                     <div className="p-2 bg-red-100 text-red-600 rounded-full mt-1">
                       <PieChart size={20} />
                     </div>
                     <div>
                       <h4 className="text-sm font-bold text-red-800">Límite Máximo RV Excedido</h4>
                       <p className="text-xs text-red-700 mt-1">Esta compra superaría el {(currentFundLimits!.maxEquity * 100).toFixed(0)}% de Renta Variable permitido en folleto.</p>
                       <div className="mt-2 text-xs font-mono font-bold text-red-800">
                          Proyectado: {projectedEquityStats.newEquityPct.toFixed(2)}%
                       </div>
                     </div>
                   </div>
                )}

                {complianceStatus === 'equity_min_violation' && (
                  <div className="flex items-start gap-4">
                     <div className="p-2 bg-red-100 text-red-600 rounded-full mt-1">
                       <PieChart size={20} />
                     </div>
                     <div>
                       <h4 className="text-sm font-bold text-red-800">Límite Mínimo RV Violado</h4>
                       <p className="text-xs text-red-700 mt-1">Esta venta reduciría la RV por debajo del mínimo de {(currentFundLimits!.minEquity * 100).toFixed(0)}%.</p>
                       <div className="mt-2 text-xs font-mono font-bold text-red-800">
                          Proyectado: {projectedEquityStats.newEquityPct.toFixed(2)}%
                       </div>
                     </div>
                   </div>
                )}

                {complianceStatus === 'insufficient_holdings' && (
                  <div className="flex items-start gap-4">
                     <div className="p-2 bg-red-100 text-red-600 rounded-full mt-1">
                       <Ban size={20} />
                     </div>
                     <div>
                       <h4 className="text-sm font-bold text-red-800">Venta no permitida</h4>
                       <p className="text-xs text-red-700 mt-1">La cantidad excede {operationType === 'Renta Fija' ? 'el nominal' : 'los títulos'} en cartera.</p>
                       <div className="mt-3 flex justify-between text-xs bg-white border border-red-100 p-2 rounded">
                         <span className="text-slate-500">Disponible:</span>
                         <span className="font-mono font-bold text-red-700">
                           {operationType === 'Renta Fija' ? (selectedAsset?.nominal || 0).toLocaleString() : (selectedAsset?.quantity || 0).toLocaleString()}
                         </span>
                       </div>
                     </div>
                   </div>
                )}

                {complianceStatus === 'rating_violation' && (
                  <div className="flex items-start gap-4">
                     <div className="p-2 bg-red-100 text-red-600 rounded-full mt-1">
                       <ShieldCheck size={20} />
                     </div>
                     <div>
                       <h4 className="text-sm font-bold text-red-800">Rating no permitido</h4>
                       <p className="text-xs text-red-700 mt-1">Occident Renta fija no puede invertir en activos con rating inferior a BBB-.</p>
                       <div className="mt-2 text-xs font-mono font-bold text-red-800">
                          Rating actual: {rating || 'NR'}
                       </div>
                     </div>
                   </div>
                )}

                {complianceStatus === 'insufficient_funds' && (
                  <div className="flex items-start gap-4">
                     <div className="p-2 bg-red-100 text-red-600 rounded-full mt-1">
                       <Ban size={20} />
                     </div>
                     <div>
                       <h4 className="text-sm font-bold text-red-800">Fondos Insuficientes</h4>
                       <p className="text-xs text-red-700 mt-1">El importe supera la liquidez disponible.</p>
                     </div>
                   </div>
                )}

                 {complianceStatus === 'ucits_10_violation' && (
                  <div className="flex items-start gap-4">
                     <div className="p-2 bg-red-100 text-red-600 rounded-full mt-1">
                       <AlertTriangle size={20} />
                     </div>
                     <div>
                       <h4 className="text-sm font-bold text-red-800">Violación Regla 10%</h4>
                       <p className="text-xs text-red-700 mt-1">Este emisor superaría el 10% del patrimonio.</p>
                     </div>
                   </div>
                )}

                {complianceStatus === 'ucits_40_violation' && (
                  <div className="flex items-start gap-4">
                     <div className="p-2 bg-red-100 text-red-600 rounded-full mt-1">
                       <AlertTriangle size={20} />
                     </div>
                     <div>
                       <h4 className="text-sm font-bold text-red-800">Violación Regla 5/40</h4>
                       <p className="text-xs text-red-700 mt-1">La suma de emisores &gt;5% supera el 40% del total.</p>
                     </div>
                   </div>
                )}

                {complianceStatus === 'iic_limit_violation' && (
                  <div className="flex items-start gap-4">
                     <div className="p-2 bg-red-100 text-red-600 rounded-full mt-1">
                       <AlertTriangle size={20} />
                     </div>
                     <div>
                       <h4 className="text-sm font-bold text-red-800">Límite IIC Excedido (20%)</h4>
                       <p className="text-xs text-red-700 mt-1">Ninguna participación en IIC puede superar el 20% del patrimonio.</p>
                       <div className="mt-2 text-xs font-mono font-bold text-red-800">
                          Proyectado: {complianceMetrics?.iicWeightPct.toFixed(2)}%
                       </div>
                     </div>
                   </div>
                )}

                {complianceStatus === 'derivative_commitment_violation' && (
                  <div className="flex items-start gap-4">
                     <div className="p-2 bg-red-100 text-red-600 rounded-full mt-1">
                       <Activity size={20} />
                     </div>
                     <div>
                       <h4 className="text-sm font-bold text-red-800">Límite Compromiso Excedido</h4>
                       <p className="text-xs text-red-700 mt-1">El compromiso total en derivados no puede superar el {(fund.id === '701' || fund.name.toUpperCase().includes('REGATA')) ? '200%' : '90%'} del patrimonio.</p>
                       <div className="mt-2 text-xs font-mono font-bold text-red-800">
                          Proyectado: {complianceMetrics?.derivativeCommitment.pct.toFixed(2)}% ({complianceMetrics?.derivativeCommitment.value.toLocaleString('es-ES')} €)
                       </div>
                     </div>
                   </div>
                )}
              </div>

              {/* Rules Checklist */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Checklist Regulatorio</h4>
                
                  {operationType !== 'Derivados' && (
                    <button 
                      onClick={() => setActiveLookThrough('liquidity')}
                      className="w-full flex items-center justify-between text-sm hover:bg-slate-50 p-1 -m-1 rounded transition-colors group"
                    >
                      <span className="text-slate-600 flex items-center gap-1">
                        Liquidez / Títulos
                        {complianceMetrics && (
                          <span className="text-xs text-slate-400 font-mono ml-1">
                            ({complianceMetrics.projectedQty.toLocaleString()} tít.)
                          </span>
                        )}
                        <ChevronRight size={12} className="text-slate-300 group-hover:text-brand-500 transition-colors" />
                      </span>
                      {(complianceStatus === 'insufficient_funds' || complianceStatus === 'insufficient_holdings')
                        ? <X size={14} className="text-red-500" />
                        : <div className={`w-2 h-2 rounded-full ${complianceStatus === 'idle' ? 'bg-slate-300' : 'bg-green-500'}`} />
                      }
                    </button>
                  )}

                  {!(operationType === 'Derivados' && derivativeCategory === 'Índice') && (
                    <button 
                      onClick={() => setActiveLookThrough('issuer')}
                      className="w-full flex items-center justify-between text-sm hover:bg-slate-50 p-1 -m-1 rounded transition-colors group"
                    >
                      <span className="text-slate-600 flex items-center gap-1">
                        Límite Emisor (10%)
                        {complianceMetrics && (
                          <span className="text-xs text-slate-400 font-mono ml-1">
                            ({complianceMetrics.issuerWeightPct.toFixed(2)}%)
                          </span>
                        )}
                        <ChevronRight size={12} className="text-slate-300 group-hover:text-brand-500 transition-colors" />
                      </span>
                      {complianceStatus === 'ucits_10_violation' 
                        ? <X size={14} className="text-red-500" />
                        : <div className={`w-2 h-2 rounded-full ${complianceStatus === 'idle' ? 'bg-slate-300' : 'bg-green-500'}`} />
                      }
                    </button>
                  )}

                  {!(operationType === 'Derivados' && derivativeCategory === 'Índice') && (
                    <button 
                      onClick={() => setActiveLookThrough('concentration')}
                      className="w-full flex items-center justify-between text-sm hover:bg-slate-50 p-1 -m-1 rounded transition-colors group"
                    >
                      <span className="text-slate-600 flex items-center gap-1">
                        Concentración (40%)
                        {complianceMetrics && (
                          <span className="text-xs text-slate-400 font-mono ml-1">
                            ({complianceMetrics.concentrationPct.toFixed(2)}%)
                          </span>
                        )}
                        <ChevronRight size={12} className="text-slate-300 group-hover:text-brand-500 transition-colors" />
                      </span>
                      {complianceStatus === 'ucits_40_violation'
                        ? <X size={14} className="text-red-500" /> 
                        : <div className={`w-2 h-2 rounded-full ${complianceStatus === 'idle' ? 'bg-slate-300' : 'bg-green-500'}`} />
                      }
                    </button>
                  )}

                <div className="w-full flex items-center justify-between text-sm p-1 -m-1 rounded transition-colors">
                  <span className="text-slate-600 flex items-center gap-1">
                    Límite IIC (20%)
                    {complianceMetrics && selectedAsset?.typology === 'Participaciones IIC' && (
                      <span className="text-xs text-slate-400 font-mono ml-1">
                        ({complianceMetrics.iicWeightPct.toFixed(2)}%)
                      </span>
                    )}
                  </span>
                  {complianceStatus === 'iic_limit_violation'
                    ? <X size={14} className="text-red-500" /> 
                    : <div className={`w-2 h-2 rounded-full ${complianceStatus === 'idle' ? 'bg-slate-300' : (selectedAsset?.typology === 'Participaciones IIC' ? 'bg-green-500' : 'bg-slate-200')}`} />
                  }
                </div>

                <div className="w-full flex items-center justify-between text-sm p-1 -m-1 rounded transition-colors">
                  <span className="text-slate-600 flex items-center gap-1">
                    Compromiso Deriv. (90%)
                    {complianceMetrics && operationType === 'Derivados' && (
                      <span className="text-xs text-slate-400 font-mono ml-1">
                        ({complianceMetrics.derivativeCommitment.pct.toFixed(2)}%)
                      </span>
                    )}
                  </span>
                  {complianceStatus === 'derivative_commitment_violation'
                    ? <X size={14} className="text-red-500" /> 
                    : <div className={`w-2 h-2 rounded-full ${complianceStatus === 'idle' ? 'bg-slate-300' : (operationType === 'Derivados' ? 'bg-green-500' : 'bg-slate-200')}`} />
                  }
                </div>

                <button 
                  onClick={() => setActiveLookThrough('equity')}
                  className="w-full flex items-center justify-between text-sm hover:bg-slate-50 p-1 -m-1 rounded transition-colors group"
                >
                  <span className="text-slate-600 flex items-center gap-1">
                    {currentFundLimits ? `Límites Folleto RV (${currentFundLimits.minEquity * 100}% - ${currentFundLimits.maxEquity * 100}%)` : 'Exposición Renta Variable'}
                    {complianceMetrics && (
                      <span className="text-xs text-slate-400 font-mono ml-1">
                        ({complianceMetrics.projectedEquityPct.toFixed(2)}%)
                      </span>
                    )}
                    <ChevronRight size={12} className="text-slate-300 group-hover:text-brand-500 transition-colors" />
                  </span>
                  {(complianceStatus === 'equity_max_violation' || complianceStatus === 'equity_min_violation')
                    ? <X size={14} className="text-red-500" /> 
                    : <div className={`w-2 h-2 rounded-full ${complianceStatus === 'idle' ? 'bg-slate-300' : 'bg-green-500'}`} />
                  }
                </button>
              </div>
            </div>

            {/* PRE-TRADE TABLE */}
            <div className="flex-grow border-t border-slate-200 pt-6">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center justify-between">
                 <span>Pre-Trades ({preTradeOrders.length})</span>
                 {queueNetImpact !== 0 && (
                   <span className={`text-xs ${queueNetImpact > 0 ? 'text-red-600' : 'text-green-600'}`}>
                     Neto: {formatCurrency(Math.abs(queueNetImpact))}
                   </span>
                 )}
              </h3>
              
              {preTradeOrders.length === 0 ? (
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
                  <p className="text-xs text-slate-400">No hay órdenes en la cesta.</p>
                  <p className="text-[10px] text-slate-300 mt-1">Añade operaciones validadas aquí.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {preTradeOrders.map((order) => (
                    <div key={order.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className={`w-1.5 h-8 rounded-full ${order.side === 'buy' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        <div>
                          <div className="flex items-baseline gap-2">
                            <span className="font-bold text-sm text-slate-800 truncate max-w-[120px]" title={order.asset.name}>
                              {order.asset.ticker.startsWith('POS-') ? order.asset.name : order.asset.ticker}
                            </span>
                            <span className={`text-[10px] font-bold uppercase ${order.side === 'buy' ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {order.side === 'buy' ? 'COMPRA' : 'VENTA'}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 font-mono">
                            {order.quantity} x {order.price} {order.currency}
                          </div>
                          {order.commitment !== undefined && (
                            <div className="text-[10px] text-blue-600 font-bold mt-0.5">
                              Compromiso: {order.commitment.toLocaleString('es-ES')} €
                            </div>
                          )}
                        </div>
                      </div>
                      <button 
                        onClick={() => handleRemoveFromQueue(order.id)}
                        className="text-slate-300 hover:text-red-500 p-1.5 rounded-full hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-slate-200 text-center">
               <p className="text-sm text-slate-500">
                 {preTradeOrders.length > 0 
                   ? `Tienes ${preTradeOrders.length} órdenes en Pre-Trade. Ve a la pestaña "Pre-Trade" para confirmar.` 
                   : 'Añade órdenes para continuar.'}
               </p>
            </div>

          </div>
        </div>

        {/* ... MODALS ... */}
        {showQuickAdd && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Alta Rápida de Instrumento</h3>
                  <p className="text-xs text-slate-500">
                    {quickAddStep === 'type-selection' ? 'Selecciona la tipología del activo' : `Configurando: ${quickAddType}`}
                  </p>
                </div>
                <button onClick={resetQuickAddForm} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={20} />
                </button>
              </div>

              {/* Content Area */}
              <div className="p-6">
                
                {/* STEP 1: Type Selection */}
                {quickAddStep === 'type-selection' && (
                  <div className="grid grid-cols-1 gap-4">
                    <button 
                      onClick={() => handleTypeSelection('Renta Variable')}
                      className="flex items-center justify-between p-4 rounded-xl border-2 border-slate-200 hover:border-brand-500 hover:bg-brand-50 transition-all group text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-brand-100 text-brand-600 rounded-lg group-hover:bg-brand-600 group-hover:text-white transition-colors">
                          <Briefcase size={24} />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 group-hover:text-brand-800">Renta Variable</h4>
                          <p className="text-xs text-slate-500">Acciones, ETFs, Participaciones</p>
                        </div>
                      </div>
                      <ChevronRight className="text-slate-300 group-hover:text-brand-500" />
                    </button>

                    <button 
                      onClick={() => handleTypeSelection('Derivados')}
                      className="flex items-center justify-between p-4 rounded-xl border-2 border-slate-200 hover:border-brand-500 hover:bg-brand-50 transition-all group text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-brand-100 text-brand-600 rounded-lg group-hover:bg-brand-600 group-hover:text-white transition-colors">
                          <Activity size={24} />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 group-hover:text-brand-800">Derivados</h4>
                          <p className="text-xs text-slate-500">Futuros, Opciones</p>
                        </div>
                      </div>
                      <ChevronRight className="text-slate-300 group-hover:text-brand-500" />
                    </button>

                    <button 
                      disabled
                      className="flex items-center justify-between p-4 rounded-xl border-2 border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-slate-200 text-slate-400 rounded-lg">
                          <Percent size={24} />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-400">Renta Fija</h4>
                          <p className="text-xs text-slate-400">Bonos, Letras (Próximamente)</p>
                        </div>
                      </div>
                    </button>
                  </div>
                )}

                {/* STEP 2: Form */}
                {quickAddStep === 'form' && (
                  <form onSubmit={handleQuickAddSubmit} className="space-y-5">
                    <div className="p-3 bg-blue-50 text-blue-800 rounded-lg text-xs flex gap-2 border border-blue-100">
                       <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                       <p>Este activo se añadirá a la sesión temporal para operar. Asegúrate de que los datos de mercado son correctos para la validación de riesgos.</p>
                    </div>

                    {quickAddType === 'Renta Variable' ? (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ticker Compañía</label>
                            <input 
                              required
                              autoFocus
                              value={qaTickerBase}
                              onChange={(e) => setQaTickerBase(e.target.value.toUpperCase())}
                              className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none font-mono"
                              placeholder="Ej. AAPL"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ticker Mercado</label>
                            <input 
                              required
                              value={qaTickerMarket}
                              onChange={(e) => setQaTickerMarket(e.target.value.toUpperCase())}
                              className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none font-mono"
                              placeholder="Ej. US"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre Compañía</label>
                          <input 
                            required
                            value={qaName}
                            onChange={(e) => setQaName(e.target.value)}
                            className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                            placeholder="Ej. Apple Inc."
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Divisa Cotización</label>
                            <select 
                              required
                              value={qaCurrency}
                              onChange={(e) => setQaCurrency(e.target.value)}
                              className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white"
                            >
                              <option value="EUR">EUR - Euro</option>
                              <option value="USD">USD - Dólar USA</option>
                              <option value="GBP">GBp - Pence</option>
                              <option value="CHF">CHF - Franco Suizo</option>
                              <option value="JPY">JPY - Yen Japonés</option>
                              <option value="CAD">CAD - Dólar Canadiense</option>
                              <option value="DKK">DKK - Corona Danesa</option>
                              <option value="SEK">SEK - Corona Sueca</option>
                              <option value="NOK">NOK - Corona Noruega</option>
                              <option value="HKD">HKD - Dólar HK</option>
                              <option value="AUD">AUD - Dólar Australiano</option>
                              <option value="PLN">PLN - Esloti Polaco</option>
                              <option value="NZD">NZD - Dólar Neozelandés</option>
                              <option value="SGD">SGD - Dólar Singapurense</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Último Precio</label>
                            <div className="relative">
                              <input 
                                required
                                type="number"
                                step="0.01"
                                value={qaPrice}
                                onChange={(e) => setQaPrice(e.target.value)}
                                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none tabular-nums"
                                placeholder="0.00"
                              />
                              <span className="absolute right-3 top-2.5 text-slate-400 text-sm font-medium">{qaCurrency}</span>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="text-sm font-bold text-slate-700">Configuración Manual</h4>
                          {newDerivType === 'FUT' && (
                            <button
                              type="button"
                              onClick={() => setShowPredefinedFutures(!showPredefinedFutures)}
                              className="text-xs font-bold text-brand-600 hover:text-brand-700 underline decoration-dotted"
                            >
                              {showPredefinedFutures ? 'Ocultar Futuros Tipo' : 'Utilizar FUTURO Tipo'}
                            </button>
                          )}
                        </div>

                        {showPredefinedFutures && newDerivType === 'FUT' && (
                          <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Seleccionar Futuro Tipo</label>
                            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                              {PREDEFINED_FUTURES.map(fut => (
                                <button
                                  key={fut.ticker}
                                  type="button"
                                  onClick={() => {
                                    setNewDerivType('FUT');
                                    setNewDerivUnderlying(fut.name);
                                    setMultiplier(fut.multiplier.toString());
                                    setDerivativeCategory(fut.type as DerivativeCategory);
                                    setNewDerivCurrency(fut.currency);
                                    setShowPredefinedFutures(false);
                                  }}
                                  className="text-left p-2 text-sm bg-white border border-slate-200 rounded hover:border-brand-500 hover:bg-brand-50 transition-colors flex justify-between items-center"
                                >
                                  <span className="font-bold text-slate-700">{fut.name}</span>
                                  <span className="text-xs text-slate-500 font-mono">{fut.ticker} | Mult: {fut.multiplier} | {fut.currency}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo</label>
                            <select 
                              required
                              value={newDerivType}
                              onChange={(e) => setNewDerivType(e.target.value as 'FUT' | 'CALL' | 'PUT')}
                              className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white"
                            >
                              <option value="FUT">Futuro (FUT)</option>
                              <option value="CALL">Call</option>
                              <option value="PUT">Put</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Subyacente</label>
                            <input 
                              required
                              value={newDerivUnderlying}
                              onChange={(e) => setNewDerivUnderlying(e.target.value.toUpperCase())}
                              className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none uppercase"
                              placeholder="Ej. EUROSTOXX"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Divisa</label>
                            <select 
                              required
                              value={newDerivCurrency}
                              onChange={(e) => setNewDerivCurrency(e.target.value)}
                              className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white"
                            >
                              <option value="EUR">EUR - Euro</option>
                              <option value="USD">USD - Dólar USA</option>
                              <option value="GBP">GBp - Pence</option>
                              <option value="CHF">CHF - Franco Suizo</option>
                              <option value="JPY">JPY - Yen Japonés</option>
                              <option value="HKD">HKD - Dólar HK</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Vencimiento</label>
                            <input 
                              required
                              type="date"
                              value={newDerivMaturity}
                              onChange={(e) => setNewDerivMaturity(e.target.value)}
                              className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                            />
                          </div>
                        </div>

                        {(newDerivType === 'CALL' || newDerivType === 'PUT') && (
                          <div className="mt-4">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Strike</label>
                            <input 
                              required
                              type="number"
                              value={newDerivStrike}
                              onChange={(e) => setNewDerivStrike(e.target.value)}
                              className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                              placeholder="Ej. 3850"
                            />
                          </div>
                        )}
                      </>
                    )}

                    <div className="flex gap-3 pt-4 border-t border-slate-100">
                      <button type="button" onClick={() => setQuickAddStep('type-selection')} className="px-4 py-2.5 border border-slate-300 rounded-lg text-slate-600 font-medium hover:bg-slate-50">
                        Atrás
                      </button>
                      <button type="submit" className="flex-1 py-2.5 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700 shadow-sm flex justify-center items-center gap-2">
                        <Plus size={18} /> Crear y Operar
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- LOOK-THROUGH MODAL --- */}
        {activeLookThrough && complianceMetrics && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 border border-slate-200">
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center text-brand-600">
                    <Activity size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">
                      {activeLookThrough === 'liquidity' && 'Desglose: Liquidez / Títulos'}
                      {activeLookThrough === 'issuer' && 'Desglose: Límite Emisor'}
                      {activeLookThrough === 'concentration' && 'Desglose: Concentración (40%)'}
                      {activeLookThrough === 'equity' && 'Desglose: Límites Folleto (RV)'}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                      {activeLookThrough === 'issuer' && `Emisora: ${selectedAsset?.name || '---'}`}
                      {activeLookThrough === 'concentration' && 'Emisores con peso superior al 5%'}
                      {activeLookThrough === 'equity' && 'Activos de Renta Variable y Participaciones IIC'}
                      {activeLookThrough === 'liquidity' && `Activo: ${selectedAsset?.ticker || '---'}`}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setActiveLookThrough(null)}
                  className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-grow overflow-auto p-8 bg-slate-50/50">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Concepto / Activo</th>
                        <th className="px-4 py-3 text-right">Valor / Cantidad</th>
                        <th className="px-4 py-3 text-right">Peso %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeLookThrough === 'liquidity' && complianceMetrics.liquidityBreakdown.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-slate-700">{item.name}</td>
                          <td className="px-4 py-3 text-right font-mono text-slate-600">{item.value.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-mono text-slate-400">---</td>
                        </tr>
                      ))}

                      {activeLookThrough === 'issuer' && complianceMetrics.issuerBreakdown.map((item, idx) => (
                        <tr key={idx} className={`hover:bg-slate-50 transition-colors ${item.isQueue ? 'bg-blue-50/30' : ''}`}>
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-700">{item.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{item.ticker} {item.isQueue && '(EN CESTA)'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-600">{formatCurrency(item.value)}</td>
                          <td className="px-4 py-3 text-right font-mono text-brand-600 font-bold">
                            {((item.value / adjustedAum) * 100).toFixed(2)}%
                          </td>
                        </tr>
                      ))}

                      {activeLookThrough === 'concentration' && complianceMetrics.concentrationBreakdown.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-slate-700">{item.issuerName}</td>
                          <td className="px-4 py-3 text-right font-mono text-slate-600">{formatCurrency(item.value)}</td>
                          <td className="px-4 py-3 text-right font-mono text-brand-600 font-bold">{item.weight.toFixed(2)}%</td>
                        </tr>
                      ))}

                      {activeLookThrough === 'equity' && complianceMetrics.equityBreakdown.map((item, idx) => (
                        <tr key={idx} className={`hover:bg-slate-50 transition-colors ${item.isQueue ? 'bg-blue-50/30' : ''}`}>
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-700">{item.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{item.ticker} {item.isQueue && '(EN CESTA)'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-600">{formatCurrency(item.value)}</td>
                          <td className="px-4 py-3 text-right font-mono text-brand-600 font-bold">
                            {((item.value / adjustedAum) * 100).toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-200 font-bold">
                      <tr>
                        <td className="px-4 py-3 text-slate-700">TOTAL PROYECTADO</td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {activeLookThrough === 'liquidity' 
                            ? complianceMetrics.projectedQty.toLocaleString() 
                            : formatCurrency(
                                activeLookThrough === 'issuer' ? complianceMetrics.issuerBreakdown.reduce((s, i) => s + i.value, 0) :
                                activeLookThrough === 'concentration' ? complianceMetrics.concentrationBreakdown.reduce((s, i) => s + i.value, 0) :
                                complianceMetrics.equityBreakdown.reduce((s, i) => s + i.value, 0)
                              )
                          }
                        </td>
                        <td className="px-4 py-3 text-right text-brand-600">
                          {activeLookThrough === 'liquidity' ? '---' : 
                           activeLookThrough === 'issuer' ? complianceMetrics.issuerWeightPct.toFixed(2) + '%' :
                           activeLookThrough === 'concentration' ? complianceMetrics.concentrationPct.toFixed(2) + '%' :
                           complianceMetrics.projectedEquityPct.toFixed(2) + '%'
                          }
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                
                <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
                  <Info size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="space-y-2">
                    <p className="text-xs text-blue-700 leading-relaxed">
                      Este desglose incluye tanto la posición actual en cartera como el impacto de las órdenes en la cesta (Pre-Trade) y la orden que se está validando actualmente.
                    </p>
                    <p className="text-[10px] text-blue-600 italic leading-relaxed border-t border-blue-200 pt-2">
                      Nota: Si el límite del 40% está excedido, solo se prohíbe la compra de emisores que superen el 5% (o que pasarían a superarlo), ya que son los únicos que agravan el incumplimiento.
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-8 py-4 bg-white border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setActiveLookThrough(null)}
                  className="py-2 px-6 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-all"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MASTER DATA SEARCH MODAL */}
        {showMasterSearch && (
          <MasterDataModal 
            onClose={() => setShowMasterSearch(false)}
            onSelect={handleMasterSelect}
          />
        )}
      </div>
    );

  /*
  // --- RENDER VIEW 2: REVIEW ---
  if (viewMode === 'review') {
    return (
      <div className="h-[calc(100vh-140px)] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 bg-slate-50 p-8">
        <div className="max-w-5xl mx-auto w-full flex flex-col h-full">
          
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                <FileText className="text-brand-600" />
                Revisión de Órdenes
              </h2>
              <p className="text-slate-500 mt-1">Verifica el impacto secuencial en la liquidez y cumplimiento normativo antes de ejecutar.</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setViewMode('desk')}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-600 font-bold hover:bg-slate-50 transition-colors"
              >
                Volver a Mesa
              </button>
              <button 
                onClick={generatePDF}
                className="px-6 py-2 rounded-lg bg-brand-600 text-white font-bold hover:bg-brand-700 shadow-lg shadow-brand-200 flex items-center gap-2 transition-transform active:scale-95"
              >
                <CheckCircle2 size={20} />
                CONFIRMAR Y GENERAR PDF
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-grow flex flex-col">
            <div className="overflow-auto flex-grow">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-100 text-slate-500 font-bold uppercase text-xs sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4">Orden</th>
                    <th className="px-6 py-4">Activo</th>
                    <th className="px-6 py-4 text-right">Cantidad</th>
                    <th className="px-6 py-4 text-right">Precio</th>
                    <th className="px-6 py-4 text-right">Importe EUR</th>
                    <th className="px-6 py-4 text-center bg-slate-50 border-l border-slate-200">Liq. Disp.</th>
                    <th className="px-6 py-4 text-center bg-slate-50">Impacto</th>
                    <th className="px-6 py-4 text-center bg-slate-50 border-r border-slate-200">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sequentialReviewData.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold uppercase ${
                          row.side === 'buy' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {row.side === 'buy' ? 'COMPRA' : 'VENTA'}
                        </span>
                        <div className="text-[10px] text-slate-400 font-mono mt-1">#{idx + 1}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{row.asset.ticker}</div>
                        <div className="text-xs text-slate-500 truncate max-w-[150px]">{row.asset.name}</div>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-slate-600">
                        {row.quantity.toLocaleString('es-ES')}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-slate-600">
                        {row.price.toFixed(2)} {row.currency}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-slate-800">
                        {formatCurrency(row.amountEur, 'EUR')}
                      </td>
                      
                      SIMULATED METRICS COLUMNS
                      <td className="px-6 py-4 text-center font-mono text-slate-600 border-l border-slate-100 bg-slate-50/50">
                        {row.stats.liquidityAvailablePct.toFixed(2)}%
                      </td>
                      <td className="px-6 py-4 text-center font-mono text-slate-600 bg-slate-50/50">
                        {row.side === 'buy' ? '-' : '+'}{row.stats.liquidityOperationPct.toFixed(2)}%
                      </td>
                      <td className="px-6 py-4 text-center border-r border-slate-100 bg-slate-50/50">
                        <div className="flex flex-col gap-1 items-center">
                           5/10/40 Check
                           <div className={`text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                             row.stats.complies51040 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
                           }`}>
                             <span>UCITS</span>
                             {row.stats.complies51040 ? <CheckCircle2 size={10} /> : <X size={10} />}
                           </div>
                           
                           Equity Limit Check
                           {currentFundLimits && (
                             <div className={`text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                               row.stats.compliesEquity ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
                             }`}>
                               <span>FOLLETO</span>
                               {row.stats.compliesEquity ? <CheckCircle2 size={10} /> : <X size={10} />}
                             </div>
                           )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
              <p>
                * La simulación asume ejecución secuencial. La liquidez disponible se actualiza tras cada operación.
              </p>
              <p>
                Total Operaciones: <span className="font-bold">{sequentialReviewData.length}</span>
              </p>
            </div>
          </div>

        </div>
      </div>
    );
  }

  */
  return null; // Should not happen
};