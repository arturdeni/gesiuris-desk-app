import React, { useMemo, useState } from 'react';
import { Wallet, Droplet, TrendingUp, Calendar, Filter, Clock, X, Info, PlaneTakeoff, Plus, Minus, MessageSquare, RefreshCw, BrainCircuit } from 'lucide-react';
import { KPICard } from './KPICard';
import { FundSelector } from './FundSelector';
import { Fund, Asset, LiquidityAdjustment, User, PreTradeOrder } from '../types';

interface DashboardProps {
  reconciliationDate: string;
  funds: Fund[]; // List of REAL detected funds
  selectedFundId: string | null;
  onFundChange: (id: string) => void;
  adjustments: LiquidityAdjustment[];
  onAddAdjustment: (adj: LiquidityAdjustment) => void;
  currentUser: User | null;
  onUpdateData?: () => void;
  preTradeOrders?: PreTradeOrder[]; // Added to calculate projected commitment
}

const MOCK_FUNDS: Fund[] = [
  { id: '1', name: 'Gesiuris Euro Equities FI', ticker: 'GESEURO', aum: 124500000, currency: 'EUR', equityAllocation: 84.5, liquidity: 5.2, cash: 6474000, valuationDate: '2026-02-10', positions: [] },
  { id: '2', name: 'Gesiuris Fixed Income Global', ticker: 'GESFIX', aum: 85200000, currency: 'EUR', equityAllocation: 12.3, liquidity: 15.8, cash: 13461600, valuationDate: '2026-02-10', positions: [] },
  { id: '3', name: 'Gesiuris Mixed Asset Class', ticker: 'GESMIX', aum: 42100000, currency: 'EUR', equityAllocation: 45.0, liquidity: 8.4, cash: 3536400, valuationDate: '2026-02-10', positions: [] },
];

const ASSET_CATEGORIES = [
  { id: 'Renta Variable', label: 'Renta Variable', color: 'bg-brand-500' },
  { id: 'Renta Fija', label: 'Renta Fija', color: 'bg-slate-500' },
  { id: 'Participaciones IIC', label: 'Participaciones IIC', color: 'bg-brand-300' },
  { id: 'Derivados', label: 'Derivados', color: 'bg-slate-700' },
  { id: 'Liquidez', label: 'Liquidez', color: 'bg-slate-300' },
  { id: 'Garantías', label: 'Garantías', color: 'bg-brand-200' },
];

export const Dashboard: React.FC<DashboardProps> = ({ 
  reconciliationDate, 
  funds, 
  selectedFundId, 
  onFundChange,
  adjustments,
  onAddAdjustment,
  currentUser,
  onUpdateData,
  preTradeOrders = []
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'reduce'>('add');
  const [adjustmentReason, setAdjustmentReason] = useState<'Suscripción' | 'Reembolso' | 'OTROS'>('Suscripción');
  const [valueDate, setValueDate] = useState(new Date().toISOString().split('T')[0]);
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentComment, setAdjustmentComment] = useState('');
  
  // Use real funds if available, otherwise fallback to mocks for demo purposes (only if no files uploaded)
  const displayFunds = funds.length > 0 ? funds : MOCK_FUNDS;
  
  // Find the currently selected fund object
  const selectedFund = displayFunds.find(f => f.id === selectedFundId) || displayFunds[0];

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: selectedFund.currency }).format(val);
  };

  const formatNumber = (val: number) => {
    return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
  };

  // Helper to handle Date Formatting (Handles Excel Serial Numbers like 46063 and ISO Strings)
  const formatExtendedDate = (input: string | number | undefined): string => {
    if (!input) return '---';
    
    let dateObj: Date;
    const numericVal = Number(input);
    
    // Check if input looks like an Excel serial number (approx > 20000 to be safe for modern dates)
    // Excel base date is ~1900. JS is 1970.
    if (!isNaN(numericVal) && numericVal > 20000) {
       // Excel Date to JS Date conversion: (Excel - 25569) * 86400 * 1000
       dateObj = new Date((numericVal - 25569) * 86400 * 1000);
    } else {
       // Try parsing as standard string
       dateObj = new Date(input);
    }

    if (isNaN(dateObj.getTime())) return String(input);

    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    
    const formatted = dateObj.toLocaleDateString('es-ES', options);
    // Capitalize first letter
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

  // --- ASSET ALLOCATION CALCULATION (Moved up for KPI usage) ---
  const fundAdjustments = useMemo(() => adjustments.filter(a => a.fundId === selectedFund.id), [adjustments, selectedFund.id]);
  const currentManualAdjustment = useMemo(() => fundAdjustments.reduce((acc, curr) => acc + curr.amount, 0), [fundAdjustments]);
  const aumAdjustment = useMemo(() => fundAdjustments
    .filter(a => a.reason === 'Suscripción' || a.reason === 'Reembolso')
    .reduce((acc, curr) => acc + curr.amount, 0), [fundAdjustments]);

  const adjustedAum = (selectedFund.aum || 0) + aumAdjustment;

  const assetAllocationData = useMemo(() => {
    const allocation: Record<string, number> = {
      'Renta Variable': 0,
      'Renta Fija': 0,
      'Participaciones IIC': 0,
      'Derivados': 0,
      'Garantías': 0,
      'Liquidez': 0 // Initialize to 0, will be filled by positions.typology === 'Liquidez'
    };

    selectedFund.positions.forEach(pos => {
      // Normalize to check if it matches keys
      const rawType = pos.typology || 'Otros';
      // Simple mapping or direct usage if normalization in App.tsx aligns with keys
      // App.tsx uses: 'Renta Variable', 'Renta Fija', 'Participaciones IIC', 'Derivados', 'Garantías', 'Liquidez', 'Otros'
      // keys here match App.tsx output.
      
      if (allocation[rawType] !== undefined) {
        allocation[rawType] += (pos.marketValue || 0);
      } else {
        // Fallback for types not strictly matching keys (though App.tsx normalizes them)
         if (rawType.includes('Liquidez')) allocation['Liquidez'] += (pos.marketValue || 0);
         else if (rawType.includes('Garantías')) allocation['Garantías'] += (pos.marketValue || 0);
      }
    });

    const totalAum = adjustedAum || 1;
    
    return ASSET_CATEGORIES.map(cat => {
      let value = allocation[cat.id] || 0;
      
      // If category is Renta Variable, we might want to use the official value as base
      // but only if it's the initial calculation. 
      // Actually, let's keep the chart as "Positions based" but the KPI as "Official based"
      // to avoid breaking the chart's drill-down logic.
      
      const pct = (value / totalAum) * 100;
      return {
        ...cat,
        value,
        pct: pct // Pass raw percentage (can be > 100 or < 0)
      };
    });
  }, [selectedFund, adjustedAum]);

  // Derive KPI values: Liquidez Disponible = ONLY Liquidez (exclude Garantías)
  const liquidityKPI = assetAllocationData.find(d => d.id === 'Liquidez');
  
  const totalLiquidityValue = (liquidityKPI?.value || 0) + currentManualAdjustment;
  const totalLiquidityPct = (totalLiquidityValue / (adjustedAum || 1)) * 100;

  // EXPOSICIÓN RENTA VARIABLE: Use official value from Excel (fund.equityAllocation) as base
  // and adjust it by the new AUM.
  const initialEquityValue = (selectedFund.aum || 0) * ((selectedFund.equityAllocation || 0) / 100);
  const displayEquityPct = (initialEquityValue / (adjustedAum || 1)) * 100;

  // COMPROMISO EN DERIVADOS: Use official value from Excel (fund.derivativeCommitment) as base
  // and add pre-trade orders impact.
  const initialCommitmentValue = (selectedFund.aum || 0) * ((selectedFund.derivativeCommitment || 0) / 100);
  const queueCommitmentImpact = preTradeOrders
    .filter(o => o.fundId === selectedFund.id && o.operationType === 'Derivados' && o.derivativeAction !== 'Cerrar')
    .reduce((sum, o) => sum + (o.commitment || 0), 0);
  
  const totalCommitmentValue = initialCommitmentValue + queueCommitmentImpact;
  const displayCommitmentPct = (totalCommitmentValue / (adjustedAum || 1)) * 100;

  // Modal data filtering
  const categoryPositions = useMemo(() => {
    if (!selectedCategory) return [];
    
    // Filter strictly by typology
    return selectedFund.positions
      .filter(p => p.typology === selectedCategory)
      .map(p => ({
        ...p,
        weight: (p.marketValue / (adjustedAum || 1)) * 100
      }));
  }, [selectedCategory, selectedFund, adjustedAum]);

  const todayFormatted = new Date().toLocaleDateString('es-ES', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  const todayCapitalized = todayFormatted.charAt(0).toUpperCase() + todayFormatted.slice(1);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Dashboard Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center gap-4 pb-4 border-b border-slate-200">
        <div className="flex-grow flex flex-col sm:flex-row sm:items-center gap-6">
           <div>
              <h2 className="text-2xl font-bold text-slate-900">Resumen de Situación</h2>
              <div className="mt-2 flex flex-col gap-1">
                 <p className="text-slate-500 text-sm flex items-center gap-2">
                    <Clock size={14} /> Fecha actual: <span className="font-semibold text-slate-700">{todayCapitalized}</span>
                 </p>
                 <p className="text-slate-500 text-sm flex items-center gap-2">
                    <Calendar size={14} /> Datos reconciliados al: <span className="font-semibold text-slate-700">{formatExtendedDate(selectedFund.valuationDate || reconciliationDate)}</span>
                 </p>
              </div>
           </div>

           {onUpdateData && (
             <button
               onClick={onUpdateData}
               className="flex items-center gap-2 px-4 py-2.5 bg-white border border-brand-200 text-brand-700 rounded-xl text-sm font-bold shadow-sm hover:bg-brand-50 hover:border-brand-300 transition-all group"
             >
               <div className="w-8 h-8 bg-brand-50 rounded-lg flex items-center justify-center text-brand-600 group-hover:bg-brand-100 transition-colors">
                 <RefreshCw size={16} />
               </div>
               Actualizar Datos IIC
             </button>
           )}
        </div>
        
        <div className="flex items-center gap-3">
          <FundSelector 
            selectedFundId={selectedFund.id} 
            funds={displayFunds} 
            onFundChange={onFundChange} 
          />
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <KPICard 
          title="Patrimonio Total (AUM)"
          value={formatCurrency(adjustedAum)}
          icon={<Wallet size={24} />}
          highlight
        >
          {aumAdjustment !== 0 && (
            <div className={`text-[10px] font-medium px-2 py-1 rounded flex items-center justify-between ${aumAdjustment > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              <span>Var. suscrip/reemb:</span>
              <span className="font-bold">{aumAdjustment > 0 ? '+' : ''}{formatCurrency(aumAdjustment)}</span>
            </div>
          )}
        </KPICard>
        <KPICard 
          title="Exposición Renta Variable"
          value={`${displayEquityPct.toFixed(2)}%`}
          icon={<TrendingUp size={24} />}
        />
        <KPICard 
          title="Compromiso en Derivados"
          value={`${displayCommitmentPct.toFixed(2)}%`}
          icon={<BrainCircuit size={24} />}
        />
        <KPICard 
          title="Liquidez Disponible (T-Real)"
          value={`${totalLiquidityPct.toFixed(2)}%`}
          subValue={formatCurrency(totalLiquidityValue)}
          icon={<Droplet size={24} />}
        >
          <div className="flex flex-col gap-2">
            <button 
              onClick={() => setShowAdjustmentModal(true)}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-brand-50 border border-brand-200 rounded-lg text-brand-700 text-xs font-bold hover:bg-brand-100 transition-all"
            >
              <PlaneTakeoff size={14} />
              Operaciones en vuelo
            </button>
            {currentManualAdjustment !== 0 && (
              <button 
                onClick={() => setShowHistoryModal(true)}
                className={`w-full text-[10px] font-medium px-2 py-1 rounded flex flex-col gap-1 text-left transition-all hover:ring-1 hover:ring-current ${currentManualAdjustment > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}
              >
                <div className="flex items-center justify-between w-full">
                  <span>Ajuste manual:</span>
                  <span className="font-bold">{currentManualAdjustment > 0 ? '+' : ''}{formatCurrency(currentManualAdjustment)}</span>
                </div>
                {fundAdjustments.length > 0 && (
                  <div className="text-[8px] opacity-70 italic border-t border-current pt-1 flex justify-between w-full">
                    <span>Ver historial ({fundAdjustments.length})</span>
                    <span>Último: {new Date(fundAdjustments[fundAdjustments.length - 1].timestamp).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                )}
              </button>
            )}
          </div>
        </KPICard>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6 min-h-[400px]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-800">Asset Allocation</h3>
            <div className="flex items-center gap-2 text-slate-400">
              <Info size={14} />
              <span className="text-[10px] uppercase font-bold tracking-wider">Haz click para ver detalle</span>
            </div>
          </div>
          
          {/* Asset Allocation Horizontal Bar Chart */}
          <div className="space-y-6">
            {assetAllocationData.map((category) => (
              <div 
                key={category.id} 
                className="group cursor-pointer"
                onClick={() => setSelectedCategory(category.id)}
              >
                <div className="flex justify-between items-end mb-1">
                  <span className="text-sm font-semibold text-slate-700 group-hover:text-brand-700 transition-colors flex items-center gap-2">
                    {category.label}
                    <div className={`w-1.5 h-1.5 rounded-full ${category.color}`}></div>
                  </span>
                  <div className="text-right">
                     <span className={`text-sm font-bold ${category.pct < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                       {category.pct.toFixed(2)}%
                     </span>
                     <span className="text-xs text-slate-400 block font-mono">{formatCurrency(category.value)}</span>
                  </div>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ease-out group-hover:opacity-80 ${category.color}`}
                    style={{ width: `${Math.max(0, Math.min(100, category.pct))}%` }} // Visual clamp: 0% to 100%
                  />
                </div>
              </div>
            ))}
            
            <div className="pt-4 mt-4 border-t border-slate-50 text-xs text-slate-400 text-center">
               * Distribución calculada sobre Patrimonio Ajustado de {formatCurrency(adjustedAum)}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Incumplimiento de Límites y Coeficientes</h3>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100 hover:bg-white hover:shadow-sm transition-all cursor-pointer">
                 <div className="w-2 h-2 rounded-full bg-orange-400 mt-2 flex-shrink-0" />
                 <div>
                   <p className="text-sm font-medium text-slate-700">Discrepancia en valoración</p>
                   <p className="text-xs text-slate-500 mt-1">Ticker: INDITEX | Dif: 0.04%</p>
                 </div>
              </div>
            ))}
             <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-100">
                 <div className="w-2 h-2 rounded-full bg-green-500 mt-2 flex-shrink-0" />
                 <div>
                   <p className="text-sm font-medium text-slate-700">Conciliación Completada</p>
                   <p className="text-xs text-slate-500 mt-1">09:45 AM - Automático</p>
                 </div>
              </div>
          </div>
        </div>
      </div>

      {/* --- LIQUIDITY ADJUSTMENT MODAL --- */}
      {showAdjustmentModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-brand-100 rounded-lg flex items-center justify-center text-brand-700">
                  <PlaneTakeoff size={18} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Operaciones en vuelo</h3>
              </div>
              <button 
                onClick={() => setShowAdjustmentModal(false)}
                className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-3 p-1 bg-slate-100 rounded-xl">
                <button
                  onClick={() => {
                    setAdjustmentType('add');
                    setAdjustmentReason('Suscripción');
                  }}
                  className={`flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-lg transition-all ${adjustmentType === 'add' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Plus size={16} />
                  Añadir
                </button>
                <button
                  onClick={() => {
                    setAdjustmentType('reduce');
                    setAdjustmentReason('Reembolso');
                  }}
                  className={`flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-lg transition-all ${adjustmentType === 'reduce' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Minus size={16} />
                  Reducir
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Motivo del Ajuste</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setAdjustmentReason(adjustmentType === 'add' ? 'Suscripción' : 'Reembolso')}
                    className={`py-2 px-4 rounded-xl border text-sm font-bold transition-all ${
                      adjustmentReason !== 'OTROS' 
                        ? 'bg-brand-50 border-brand-200 text-brand-700' 
                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    {adjustmentType === 'add' ? 'Suscripción' : 'Reembolso'}
                  </button>
                  <button
                    onClick={() => setAdjustmentReason('OTROS')}
                    className={`py-2 px-4 rounded-xl border text-sm font-bold transition-all ${
                      adjustmentReason === 'OTROS' 
                        ? 'bg-brand-50 border-brand-200 text-brand-700' 
                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    OTROS
                  </button>
                </div>
              </div>

              {adjustmentReason !== 'OTROS' && (
                <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {adjustmentReason === 'Suscripción' ? 'Fecha de Entrada' : 'Fecha de Salida'} (Fecha Valor)
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="date"
                      value={valueDate}
                      onChange={(e) => setValueDate(e.target.value)}
                      className="w-full p-4 pl-12 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Importe de Liquidez (EUR)</label>
                <div className="relative">
                  <input
                    type="number"
                    autoFocus
                    value={adjustmentAmount}
                    onChange={(e) => setAdjustmentAmount(e.target.value)}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all"
                    placeholder="0.00"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">€</div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Comentario del Gestor {adjustmentReason === 'OTROS' ? '(Obligatorio)' : '(Opcional)'}
                </label>
                <div className="relative">
                  <MessageSquare className="absolute left-4 top-4 text-slate-400" size={18} />
                  <textarea
                    value={adjustmentComment}
                    onChange={(e) => setAdjustmentComment(e.target.value)}
                    className="w-full p-4 pl-12 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all min-h-[80px]"
                    placeholder={adjustmentReason === 'OTROS' ? "Indique el motivo del ajuste..." : "Añada una nota si lo desea..."}
                  />
                </div>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
                <Info size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-700 leading-relaxed">
                  Este ajuste manual afectará a la liquidez disponible en la mesa de operaciones y a los controles de cumplimiento pre-trade para el fondo <strong>{selectedFund.name}</strong>.
                </p>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => {
                  setAdjustmentAmount('');
                  setShowAdjustmentModal(false);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-600 font-bold hover:bg-slate-100 transition-all"
              >
                Cancelar
              </button>
              <button
                disabled={
                  !adjustmentAmount || 
                  parseFloat(adjustmentAmount) <= 0 || 
                  (adjustmentReason === 'OTROS' && !adjustmentComment.trim())
                }
                onClick={() => {
                  const amount = parseFloat(adjustmentAmount) || 0;
                  const finalAmount = adjustmentType === 'add' ? amount : -amount;
                  
                  const newAdjustment: LiquidityAdjustment = {
                    id: crypto.randomUUID(),
                    fundId: selectedFund.id,
                    amount: finalAmount,
                    reason: adjustmentReason,
                    valueDate: adjustmentReason !== 'OTROS' ? valueDate : undefined,
                    comment: adjustmentComment,
                    timestamp: new Date().toISOString(),
                    user: currentUser ? `${currentUser.name} ${currentUser.surname}` : 'Gestor'
                  };

                  onAddAdjustment(newAdjustment);
                  setAdjustmentAmount('');
                  setAdjustmentComment('');
                  setAdjustmentReason('Suscripción');
                  setShowAdjustmentModal(false);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-brand-600 text-white font-bold hover:bg-brand-700 shadow-lg shadow-brand-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirmar Ajuste
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- LIQUIDITY HISTORY MODAL --- */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 border border-slate-200">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-700">
                  <Clock size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Historial de Ajustes</h3>
                  <p className="text-sm text-slate-500 mt-1">{selectedFund.name} • {fundAdjustments.length} registros</p>
                </div>
              </div>
              <button 
                onClick={() => setShowHistoryModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-grow overflow-auto p-8 space-y-6 bg-slate-50/50">
              {fundAdjustments.length === 0 ? (
                <div className="py-20 text-center">
                  <p className="text-slate-400 italic">No hay ajustes registrados para este fondo.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {[...fundAdjustments].reverse().map((adj) => (
                    <div key={adj.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${adj.amount > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {adj.reason}
                            </span>
                            <span className="text-xs font-mono text-slate-400">
                              {new Date(adj.timestamp).toLocaleString('es-ES')}
                            </span>
                          </div>
                          {adj.valueDate && (
                            <p className="text-[10px] text-slate-500 font-medium">
                              Fecha Valor: <span className="font-mono">{new Date(adj.valueDate).toLocaleDateString('es-ES')}</span>
                            </p>
                          )}
                        </div>
                        <span className={`text-lg font-mono font-bold ${adj.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {adj.amount > 0 ? '+' : ''}{formatCurrency(adj.amount)}
                        </span>
                      </div>
                      
                      {adj.comment && (
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1 flex items-center gap-1">
                            <MessageSquare size={10} /> Comentario
                          </p>
                          <p className="text-sm text-slate-700 italic leading-relaxed">"{adj.comment}"</p>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span className="font-bold uppercase">Autor:</span>
                        <span>{adj.user}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-8 py-4 bg-white border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="py-2 px-6 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-all"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- DETAILED ASSET MODAL --- */}
      {selectedCategory && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            {/* Modal Header */}
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <div>
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${ASSET_CATEGORIES.find(c => c.id === selectedCategory)?.color || 'bg-brand-500'}`}></div>
                  <h3 className="text-xl font-bold text-slate-900">Desglose: {selectedCategory}</h3>
                </div>
                <p className="text-sm text-slate-500 mt-1">{selectedFund.name} • {categoryPositions.length} instrumentos</p>
              </div>
              <button 
                onClick={() => setSelectedCategory(null)}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Body: The Table */}
            <div className="flex-grow overflow-auto p-8 pt-2">
              <table className="w-full text-left border-separate border-spacing-y-2">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                    <th className="pb-4 pl-4">Nombre Activo</th>
                    <th className="pb-4">Ticker</th>
                    <th className="pb-4">Moneda</th>
                    <th className="pb-4 text-right">{selectedCategory === 'Renta Fija' ? 'Nominal' : 'Títulos'}</th>
                    <th className="pb-4 text-right">Precio</th>
                    <th className="pb-4 text-right">Riesgo €</th>
                    <th className="pb-4 text-right pr-4">Peso %</th>
                  </tr>
                </thead>
                <tbody className="space-y-2">
                  {categoryPositions.map((asset, idx) => (
                    <tr 
                      key={asset.isin + idx} 
                      className="bg-white hover:bg-slate-50 border border-slate-100 rounded-lg group transition-all"
                    >
                      <td className="py-4 pl-4 rounded-l-xl border-y border-l border-slate-100">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-800 truncate max-w-[240px]">{asset.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{asset.isin}</span>
                        </div>
                      </td>
                      <td className="py-4 border-y border-slate-100">
                        <span className="font-bold text-slate-600 font-mono text-sm">{asset.ticker}</span>
                      </td>
                      <td className="py-4 border-y border-slate-100">
                        <span className="text-xs font-semibold px-2 py-1 bg-slate-100 rounded text-slate-600">{asset.currency}</span>
                      </td>
                      <td className="py-4 border-y border-slate-100 text-right">
                        <span className="font-mono text-sm text-slate-600">{formatNumber(selectedCategory === 'Renta Fija' ? (asset.nominal || 0) : asset.quantity)}</span>
                      </td>
                      <td className="py-4 border-y border-slate-100 text-right">
                        <span className="font-mono text-sm text-slate-600">{formatNumber(asset.lastPrice)}</span>
                      </td>
                      <td className="py-4 border-y border-slate-100 text-right">
                        <span className="font-bold text-slate-900">{formatCurrency(asset.marketValue)}</span>
                      </td>
                      <td className="py-4 pr-4 rounded-r-xl border-y border-r border-slate-100 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                            <div 
                              className={`h-full ${asset.weight && asset.weight < 0 ? 'bg-red-500' : 'bg-brand-500'}`}
                              style={{ width: `${Math.min(100, Math.abs(asset.weight || 0) * 10)}%` }} // Scaled bar for visibility
                            />
                          </div>
                          <span className={`text-sm font-bold min-w-[50px] ${asset.weight && asset.weight < 0 ? 'text-red-600' : 'text-brand-700'}`}>
                            {(asset.weight || 0).toFixed(2)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {categoryPositions.length === 0 && (
                <div className="py-20 text-center">
                  <p className="text-slate-400 italic">No se encontraron posiciones en esta categoría.</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-xs text-slate-400 font-medium">
               <span>Visualizando {categoryPositions.length} activos</span>
               <span>Total Riesgo en {selectedCategory}: {formatCurrency(categoryPositions.reduce((acc, p) => acc + (p.marketValue || 0), 0))}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};