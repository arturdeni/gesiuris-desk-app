// ... (imports remain the same)
import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, ArrowRight, AlertTriangle, ShieldCheck, Ban, Wallet, TrendingUp, DollarSign, X, Globe, PieChart, Database, ChevronRight, Briefcase, Activity, Percent, Trash2, ListPlus, Send, ArrowLeft, FileText, CheckCircle2 } from 'lucide-react';
import { Fund, Asset, OrderSide, PreTradeOrder, User } from '../types';
import { FundLimit } from '../data/fundLimits';
import { MasterDataModal } from './MasterDataModal';
import { Instrument } from '../data/maestro';

interface OperationsDeskProps {
  fund: Fund;
  fundLimits: FundLimit[]; // Dynamic limits prop
  currentUser: User | null;
  onConfirmAndGenerate: (orders: PreTradeOrder[]) => void;
  preTradeOrders: PreTradeOrder[];
  setPreTradeOrders: React.Dispatch<React.SetStateAction<PreTradeOrder[]>>;
}

type QuickAddStep = 'type-selection' | 'form';
type QuickAddType = 'Renta Variable' | 'Renta Fija' | 'Derivados';

export const OperationsDesk: React.FC<OperationsDeskProps> = ({ 
  fund, 
  fundLimits, 
  currentUser, 
  onConfirmAndGenerate,
  preTradeOrders,
  setPreTradeOrders
}) => {
  // Use positions from the real Excel file
  const assetsList = fund.positions || [];

  // State: Context
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  
  // State: Order Pad
  const [side, setSide] = useState<OrderSide>('buy');
  const [quantity, setQuantity] = useState<string>('');
  const [price, setPrice] = useState<string>('');
  const [exchangeRate, setExchangeRate] = useState<string>('1.00');
  const [showFxWarning, setShowFxWarning] = useState(false);
  
  // State: Search & Master Modal
  const [searchQuery, setSearchQuery] = useState('');
  const [showMasterSearch, setShowMasterSearch] = useState(false);

  // State: Quick Add Wizard
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddStep, setQuickAddStep] = useState<QuickAddStep>('type-selection');
  const [quickAddType, setQuickAddType] = useState<QuickAddType>('Renta Variable');
  
  // State: Quick Add Form Fields
  const [qaTickerBase, setQaTickerBase] = useState('');
  const [qaTickerMarket, setQaTickerMarket] = useState('');
  const [qaName, setQaName] = useState('');
  const [qaCurrency, setQaCurrency] = useState('USD');
  const [qaPrice, setQaPrice] = useState('');

  // State: Issuer Mapping (Loaded from Maestro as fallback)
  const [issuerMap, setIssuerMap] = useState<Map<string, number>>(new Map());

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
    return assetsList.reduce((sum, asset) => {
      const type = (asset.typology || '').toLowerCase();
      // Sum Risk€ (marketValue) if typology is strictly Liquidez
      if (type.includes('liqui')) {
        return sum + (asset.marketValue || 0);
      }
      return sum;
    }, 0);
  }, [assetsList]);

  // 2. Current Form Gross Amount
  const currentFormAmountEur = useMemo(() => {
    const q = parseFloat(quantity) || 0;
    const p = parseFloat(price) || 0;
    const fx = parseFloat(exchangeRate) || 1;
    
    let amount = (q * p) / fx;
    if (selectedAsset?.currency === 'GBP') {
      amount = amount / 100;
    }
    return amount;
  }, [quantity, price, exchangeRate, selectedAsset]);

  // 3. Pre-Trade Queue Net Impact
  const queueNetImpact = useMemo(() => {
    return preTradeOrders.reduce((acc, order) => {
      if (order.side === 'buy') return acc - order.amountEur;
      return acc + order.amountEur;
    }, 0);
  }, [preTradeOrders]);

  // 4. Projected Cash (Liquidity + Queue + Current Form)
  const projectedCash = useMemo(() => {
    let cash = realLiquidity + queueNetImpact;
    
    // Add current form impact only if it's being edited
    if (currentFormAmountEur > 0) {
      if (side === 'buy') cash -= currentFormAmountEur;
      else cash += currentFormAmountEur;
    }
    
    return cash;
  }, [realLiquidity, queueNetImpact, currentFormAmountEur, side]);

  const projectedLiquidityPct = (projectedCash / fund.aum) * 100;

  // --- COMPLIANCE ENGINE (Single Order Check) ---
  const currentFundLimits = useMemo(() => {
    return fundLimits.find(l => 
      fund.name.toUpperCase().includes(l.nameKeywords) || 
      fund.id === l.code
    );
  }, [fund, fundLimits]);

  // 5. Projected Equity Stats (Restored for Limits Check)
  const projectedEquityStats = useMemo(() => {
    const currentEquityValue = fund.aum * ((fund.equityAllocation || 0) / 100);
    const isEquityAsset = selectedAsset?.typology === 'Renta Variable' || selectedAsset?.typology === 'Participaciones IIC';
    
    let newEquityValue = currentEquityValue;
    
    // Add Queue Impact to Equity
    preTradeOrders.forEach(order => {
        const isOrderEquity = order.asset.typology === 'Renta Variable' || order.asset.typology === 'Participaciones IIC';
        if(isOrderEquity) {
            if(order.side === 'buy') newEquityValue += order.amountEur;
            else newEquityValue -= order.amountEur;
        }
    });

    // Add Current Form Impact
    if (isEquityAsset && currentFormAmountEur > 0) {
      if (side === 'buy') {
        newEquityValue += currentFormAmountEur;
      } else {
        newEquityValue -= currentFormAmountEur;
      }
    }

    const newEquityPct = (newEquityValue / fund.aum) * 100;
    return { isEquityAsset, newEquityPct, currentEquityPct: fund.equityAllocation || 0 };
  }, [fund, selectedAsset, currentFormAmountEur, side, preTradeOrders]);

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
    if (!selectedAsset) return null;

    const targetIssuerId = getIssuerId(selectedAsset);

    // A. Projected Titles (Simple Ticker Match for same instrument)
    const currentHolding = selectedAsset.quantity || 0;
    const queueQty = preTradeOrders
      .filter(o => o.asset.ticker === selectedAsset.ticker)
      .reduce((sum, o) => sum + (o.side === 'buy' ? o.quantity : -o.quantity), 0);
    
    const formQty = parseFloat(quantity) || 0;
    const projectedQty = currentHolding + queueQty + (side === 'buy' ? formQty : -formQty);

    // B. Issuer Weight & Concentration (GROUPED BY ISSUER ID)
    const issuerExposureMap = new Map<string | number, number>();

    // 1. Map existing portfolio (Aggregating RV, RF, Derivatives, IICs by Issuer)
    assetsList.forEach(a => {
      // Exclude Liquidez/Cash from issuer concentration. 
      if (a.typology === 'Liquidez') return;
      if (a.typology === 'Garantías') return; // Exclude Garantías

      // Exclude State Bonds (Renta Fija + Issuer 1002)
      if (a.typology === 'Renta Fija' && a.issuerTicker === '1002') return;

      // EXCLUSION RULE: Exclude Derivatives if Type is DIV or IRV (Currency/Interest Rate Futures)
      if (a.typology === 'Derivados' && a.derivativeType && (a.derivativeType === 'DIV' || a.derivativeType === 'IRV')) {
         return;
      }

      const issuerId = getIssuerId(a);
      const currentVal = issuerExposureMap.get(issuerId) || 0;
      issuerExposureMap.set(issuerId, currentVal + (a.marketValue || 0));
    });

    // 2. Apply Queue
    preTradeOrders.forEach(o => {
      // Apply exclusions to queue as well
      if (o.asset.typology === 'Liquidez') return;
      if (o.asset.typology === 'Garantías') return;
      if (o.asset.typology === 'Renta Fija' && o.asset.issuerTicker === '1002') return;

      const issuerId = getIssuerId(o.asset);
      const currentVal = issuerExposureMap.get(issuerId) || 0;
      const impact = o.side === 'buy' ? o.amountEur : -o.amountEur;
      // Ensure we don't go below zero
      issuerExposureMap.set(issuerId, Math.max(0, currentVal + impact));
    });

    // 3. Apply Current Form
    if (currentFormAmountEur > 0) {
       // Check if current asset should be excluded
       const isExcluded = 
         selectedAsset.typology === 'Liquidez' ||
         selectedAsset.typology === 'Garantías' ||
         (selectedAsset.typology === 'Renta Fija' && selectedAsset.issuerTicker === '1002');
       
       if (!isExcluded) {
          const impact = side === 'buy' ? currentFormAmountEur : -currentFormAmountEur;
          const currentVal = issuerExposureMap.get(targetIssuerId) || 0;
          issuerExposureMap.set(targetIssuerId, Math.max(0, currentVal + impact));
       }
    }

    const totalAum = fund.aum || 1;
    const projectedIssuerValue = issuerExposureMap.get(targetIssuerId) || 0;
    const issuerWeightPct = (projectedIssuerValue / totalAum) * 100;

    // C. 5/10/40 Concentration Sum
    // Logic: Sum of all weights where individual weight > 5%
    let concentrationSum = 0;
    
    issuerExposureMap.forEach((val) => {
      const weight = val / totalAum;
      // STRICT RULE: If an issuer (sum of RV+RF+Deriv) > 5%, add to the 40% bucket
      if (weight > 0.05) { 
        concentrationSum += weight;
      }
    });
    
    const concentrationPct = concentrationSum * 100;

    return {
      projectedQty,
      issuerWeightPct,
      concentrationPct,
      projectedEquityPct: projectedEquityStats.newEquityPct,
      targetIssuerId // Debug info
    };
  }, [selectedAsset, quantity, side, preTradeOrders, assetsList, currentFormAmountEur, fund.aum, projectedEquityStats, issuerMap]);


  const complianceStatus = useMemo(() => {
    if (!selectedAsset || currentFormAmountEur === 0 || !complianceMetrics) return 'idle';

    // Rule 0: Short Selling Validation
    if (side === 'sell') {
      if (complianceMetrics.projectedQty < 0) {
        return 'insufficient_holdings';
      }
    }

    // Rule 1: Cash Check (Only for Buys)
    if (side === 'buy') {
       const availableCashAfterQueue = realLiquidity + queueNetImpact; 
       if (currentFormAmountEur > availableCashAfterQueue) {
         return 'insufficient_funds';
       }
    }

    // Rule 2: Equity Limits (Folleto)
    if (currentFundLimits) {
      const minLimitPct = currentFundLimits.minEquity * 100;
      const maxLimitPct = currentFundLimits.maxEquity * 100;

      if (complianceMetrics.projectedEquityPct > maxLimitPct) {
        return 'equity_max_violation';
      }
      if (complianceMetrics.projectedEquityPct < minLimitPct) {
        return 'equity_min_violation';
      }
    }

    // Rule 3: UCITS Concentration (10%) - Grouped by Issuer
    if (complianceMetrics.issuerWeightPct > 10) {
      return 'ucits_10_violation';
    }

    // Rule 4: UCITS 5/40 Rule - Grouped by Issuer
    if (complianceMetrics.concentrationPct > 40) {
        return 'ucits_40_violation';
    }

    return 'valid';
  }, [selectedAsset, currentFormAmountEur, complianceMetrics, realLiquidity, queueNetImpact, side, currentFundLimits]);



  // --- HANDLERS ---
  const handleAssetSelect = (asset: Asset) => {
    setSelectedAsset(asset);
    setPrice(asset.lastPrice ? asset.lastPrice.toString() : '');
    setQuantity('');
    setShowFxWarning(false);
    
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
    setShowQuickAdd(false);
  };

  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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

  const handleAddToPreTrade = () => {
    if (!selectedAsset || complianceStatus !== 'valid') return;

    const newOrder: PreTradeOrder = {
      id: Date.now().toString(),
      asset: selectedAsset,
      side: side,
      quantity: parseFloat(quantity),
      price: parseFloat(price),
      currency: selectedAsset.currency,
      amountEur: currentFormAmountEur,
      addedAt: new Date().toISOString(),
      fundId: fund.id,
      fundName: fund.name,
      fundTicker: fund.ticker
    };

    setPreTradeOrders([...preTradeOrders, newOrder]);
    setQuantity('');
  };

  const handleRemoveFromQueue = (id: string) => {
    setPreTradeOrders(prev => prev.filter(o => o.id !== id));
  };

  const handleTypeSelection = (type: QuickAddType) => {
    setQuickAddType(type);
    setQuickAddStep('form');
  };



  const filteredAssets = useMemo(() => {
    return assetsList.filter(a => {
      if (a.typology !== 'Renta Variable') return false;
      const query = searchQuery.toLowerCase();
      return (
        (a.ticker && a.ticker.toLowerCase().includes(query)) || 
        (a.name && a.name.toLowerCase().includes(query)) ||
        (a.isin && a.isin.toLowerCase().includes(query))
      );
    });
  }, [assetsList, searchQuery]);

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
  return (
      <div className="h-[calc(100vh-140px)] flex flex-col animate-in fade-in duration-500">
        
        {/* 1. STICKY CONTEXT BAR */}
        <div className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm px-6 py-3 flex justify-between items-center rounded-t-xl mx-0">
          {/* ... existing context bar code ... */}
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
                {currentFundLimits && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                    <span className="text-slate-400">Rango RV: {(currentFundLimits.minEquity * 100).toFixed(0)}% - {(currentFundLimits.maxEquity * 100).toFixed(0)}%</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-8">
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Patrimonio Total</p>
              <p className="text-sm font-mono font-medium text-slate-700">{formatCurrency(fund.aum)}</p>
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
                 <p className="text-sm font-mono font-medium text-slate-700">{fund.equityAllocation ? fund.equityAllocation.toFixed(2) : 0}%</p>
                 {projectedEquityStats.isEquityAsset && (currentFormAmountEur > 0 || preTradeOrders.length > 0) && (
                   <span className="text-[10px] text-slate-400">
                     → {projectedEquityStats.newEquityPct.toFixed(2)}%
                   </span>
                 )}
              </div>
            </div>
          </div>
        </div>

        {/* MAIN WORKSPACE GRID */}
        <div className="flex-grow grid grid-cols-12 gap-0 bg-white min-h-0">
          
          {/* 2. LEFT PANEL: SEARCH & MASTER */}
          <div className="col-span-3 border-r border-slate-200 bg-slate-50 flex flex-col min-h-0">
            {/* ... existing left panel ... */}
            <div className="p-4 border-b border-slate-200 bg-white space-y-3">
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
            </div>
            
            <div className="flex-grow overflow-y-auto p-2 space-y-1">
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
                      <span className="font-bold text-slate-800">{asset.ticker || 'N/A'}</span>
                      <span className="font-mono text-xs text-slate-500">{asset.lastPrice} {asset.currency}</span>
                    </div>
                    <div className="text-xs text-slate-500 truncate">{asset.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-1 flex justify-between">
                      <span>{asset.quantity || 0} tit.</span>
                      {asset.marketValue && <span className="font-semibold text-slate-600">{formatCurrency(asset.marketValue)}</span>}
                    </div>
                  </button>
                ))
              )}
              {!searchQuery && (
                <div className="p-4 text-center">
                  <p className="text-xs text-slate-400 italic">Mostrando {filteredAssets.length} activos de Renta Variable.</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-white">
              <button
                onClick={() => {
                  setQuickAddStep('type-selection');
                  setShowQuickAdd(true);
                }}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-white border-2 border-slate-200 rounded-xl text-slate-700 text-sm font-bold hover:border-brand-500 hover:text-brand-700 hover:bg-brand-50 transition-all shadow-sm group"
              >
                <Plus size={18} className="text-slate-400 group-hover:text-brand-500 transition-colors" />
                ALTA RÁPIDA INSTRUMENTO
              </button>
            </div>
          </div>

          {/* 3. CENTER PANEL: ORDER PAD */}
          <div className="col-span-5 border-r border-slate-200 bg-white p-8 flex flex-col overflow-y-auto">
            {/* ... existing order pad code ... */}
            <div className="mb-8">
              <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <div className="w-2 h-6 bg-slate-800 rounded-full"></div>
                Boleta de Órdenes
              </h3>
              
              <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl mb-6">
                <button
                  onClick={() => setSide('buy')}
                  className={`py-2 text-sm font-bold rounded-lg transition-all duration-300 ${side === 'buy' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  COMPRA
                </button>
                <button
                  onClick={() => setSide('sell')}
                  className={`py-2 text-sm font-bold rounded-lg transition-all duration-300 ${side === 'sell' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  VENTA
                </button>
              </div>
            </div>

            <div className={`mb-8 p-4 rounded-xl border ${selectedAsset ? `border-${themeColor}-100 bg-${themeColor}-50/30` : 'border-slate-100 bg-slate-50'} transition-all`}>
              {!selectedAsset ? (
                <div className="text-center text-slate-400 text-sm py-4">Selecciona un activo del panel izquierdo</div>
              ) : (
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-slate-800 text-lg">{selectedAsset.ticker}</h4>
                    <p className="text-sm text-slate-500">{selectedAsset.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400 uppercase">Divisa Activo</p>
                    <p className="font-mono font-bold text-lg text-slate-700">
                      {selectedAsset.currency === 'GBP' ? 'GBP (Peniques)' : selectedAsset.currency}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-6 flex-grow">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cantidad (Títulos)</label>
                  <input
                    type="number"
                    disabled={!selectedAsset}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className={`w-full p-3 bg-white border border-slate-300 rounded-lg font-mono text-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent tabular-nums transition-shadow disabled:bg-slate-50 disabled:text-slate-300`}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Precio Límite ({selectedAsset?.currency === 'GBP' ? 'GBp - Peniques' : selectedAsset?.currency || '---'})
                  </label>
                  <input
                    type="number"
                    disabled={!selectedAsset}
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className={`w-full p-3 bg-white border border-slate-300 rounded-lg font-mono text-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent tabular-nums transition-shadow disabled:bg-slate-50 disabled:text-slate-300`}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {selectedAsset && selectedAsset.currency !== 'EUR' && (
                <div className="space-y-2 animate-in slide-in-from-top-2">
                  <div className="flex justify-between items-center">
                     <label className="text-xs font-bold text-brand-700 uppercase tracking-wider flex items-center gap-1">
                       <Globe size={12} /> Tipo de Cambio ({selectedAsset.currency}/EUR)
                     </label>
                     {selectedAsset.exchangeRate && !showFxWarning && (
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
                      <p><strong>Atención:</strong> Insertar tipo de cambio. Actualmente no disponible en cartera para {selectedAsset.currency}.</p>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 italic">Dividimos el importe bruto ({selectedAsset.currency}) por este valor para obtener el riesgo en EUR.</p>
                  )}
                </div>
              )}

              <div className={`p-4 rounded-xl border border-slate-200 bg-slate-50 flex justify-between items-center`}>
                <div>
                  <span className="text-sm font-bold text-slate-500 uppercase">Importe Estimado</span>
                  {selectedAsset && selectedAsset.currency !== 'EUR' && (
                     <p className="text-[10px] text-slate-400 font-medium">
                       Local ({selectedAsset.currency}): {formatCurrency((parseFloat(quantity) || 0) * (parseFloat(price) || 0), selectedAsset.currency === 'GBP' ? 'GBp' : selectedAsset.currency)}
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
                      {fund.aum > 0 ? ((currentFormAmountEur / fund.aum) * 100).toFixed(2) : '0.00'}% s/ Patrimonio
                    </span>
                  )}
                </div>
              </div>
              
              <button
                onClick={handleAddToPreTrade}
                className={`w-full py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                  (complianceStatus === 'valid' && selectedAsset)
                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
                disabled={!(complianceStatus === 'valid' && selectedAsset)}
              >
                <ListPlus size={18} />
                AÑADIR A PRE-TRADE
              </button>
              
              {selectedAsset?.currency === 'GBP' && (
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
                       <p className="text-xs text-red-700 mt-1">La cantidad excede los títulos en cartera.</p>
                       <div className="mt-3 flex justify-between text-xs bg-white border border-red-100 p-2 rounded">
                         <span className="text-slate-500">Actual:</span>
                         <span className="font-mono font-bold text-red-700">{selectedAsset?.quantity || 0}</span>
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
              </div>

              {/* Rules Checklist */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Checklist Regulatorio</h4>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">
                    Liquidez / Títulos
                    {complianceMetrics && (
                      <span className="text-xs text-slate-400 font-mono ml-1">
                        ({complianceMetrics.projectedQty.toLocaleString()} tít.)
                      </span>
                    )}
                  </span>
                  {(complianceStatus === 'insufficient_funds' || complianceStatus === 'insufficient_holdings')
                    ? <X size={14} className="text-red-500" />
                    : <div className={`w-2 h-2 rounded-full ${complianceStatus === 'idle' ? 'bg-slate-300' : 'bg-green-500'}`} />
                  }
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">
                    Límite Emisor (10%)
                    {complianceMetrics && (
                      <span className="text-xs text-slate-400 font-mono ml-1">
                        ({complianceMetrics.issuerWeightPct.toFixed(2)}%)
                      </span>
                    )}
                  </span>
                  {complianceStatus === 'ucits_10_violation' 
                    ? <X size={14} className="text-red-500" />
                    : <div className={`w-2 h-2 rounded-full ${complianceStatus === 'idle' ? 'bg-slate-300' : 'bg-green-500'}`} />
                  }
                </div>
                 <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">
                    Concentración (40%)
                    {complianceMetrics && (
                      <span className="text-xs text-slate-400 font-mono ml-1">
                        ({complianceMetrics.concentrationPct.toFixed(2)}%)
                      </span>
                    )}
                  </span>
                  {complianceStatus === 'ucits_40_violation'
                    ? <X size={14} className="text-red-500" /> 
                    : <div className={`w-2 h-2 rounded-full ${complianceStatus === 'idle' ? 'bg-slate-300' : 'bg-green-500'}`} />
                }
                </div>
                {currentFundLimits && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">
                      Límites Folleto (RV)
                      {complianceMetrics && (
                        <span className="text-xs text-slate-400 font-mono ml-1">
                          ({complianceMetrics.projectedEquityPct.toFixed(2)}%)
                        </span>
                      )}
                    </span>
                    {(complianceStatus === 'equity_max_violation' || complianceStatus === 'equity_min_violation')
                      ? <X size={14} className="text-red-500" /> 
                      : <div className={`w-2 h-2 rounded-full ${complianceStatus === 'idle' ? 'bg-slate-300' : 'bg-green-500'}`} />
                  }
                  </div>
                )}
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
                            <span className="font-bold text-sm text-slate-800">{order.asset.ticker}</span>
                            <span className={`text-[10px] font-bold uppercase ${order.side === 'buy' ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {order.side === 'buy' ? 'COMPRA' : 'VENTA'}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 font-mono">
                            {order.quantity} x {order.price} {order.currency}
                          </div>
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
                      disabled
                      className="flex items-center justify-between p-4 rounded-xl border-2 border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-slate-200 text-slate-400 rounded-lg">
                          <Activity size={24} />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-400">Derivados</h4>
                          <p className="text-xs text-slate-400">Futuros, Opciones (Próximamente)</p>
                        </div>
                      </div>
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

                {/* STEP 2: Equity Form */}
                {quickAddStep === 'form' && (
                  <form onSubmit={handleQuickAddSubmit} className="space-y-5">
                    <div className="p-3 bg-blue-50 text-blue-800 rounded-lg text-xs flex gap-2 border border-blue-100">
                       <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                       <p>Este activo se añadirá a la sesión temporal para operar. Asegúrate de que los datos de mercado son correctos para la validación de riesgos.</p>
                    </div>

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