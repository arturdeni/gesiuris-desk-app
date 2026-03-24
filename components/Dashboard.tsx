import React, { useMemo, useState } from 'react';
import { Wallet, Droplet, TrendingUp, Calendar, Filter, Clock, X, Info } from 'lucide-react';
import { KPICard } from './KPICard';
import { Fund, Asset } from '../types';

interface DashboardProps {
  reconciliationDate: string;
  funds: Fund[]; // List of REAL detected funds
  selectedFundId: string | null;
  onFundChange: (id: string) => void;
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
  onFundChange 
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
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

    const totalAum = selectedFund.aum || 1;
    
    return ASSET_CATEGORIES.map(cat => {
      const value = allocation[cat.id] || 0;
      const pct = (value / totalAum) * 100;
      return {
        ...cat,
        value,
        pct: pct // Pass raw percentage (can be > 100 or < 0)
      };
    });
  }, [selectedFund]);

  // Derive KPI values: Liquidez Disponible = ONLY Liquidez (exclude Garantías)
  const liquidityKPI = assetAllocationData.find(d => d.id === 'Liquidez');
  
  // Adjusted to only use Liquidity KPI values, ignoring Guarantees for the summary card
  const totalLiquidityValue = (liquidityKPI?.value || 0);
  const totalLiquidityPct = (liquidityKPI?.pct || 0);

  let displayEquityPct = selectedFund.equityAllocation || 0;
  if (displayEquityPct > 0 && displayEquityPct <= 1) {
    displayEquityPct = displayEquityPct * 100;
  }

  // Modal data filtering
  const categoryPositions = useMemo(() => {
    if (!selectedCategory) return [];
    
    // Filter strictly by typology
    return selectedFund.positions
      .filter(p => p.typology === selectedCategory)
      .map(p => ({
        ...p,
        weight: (p.marketValue / (selectedFund.aum || 1)) * 100
      }));
  }, [selectedCategory, selectedFund]);

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
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <select 
              value={selectedFund.id}
              onChange={(e) => onFundChange(e.target.value)}
              className="appearance-none bg-white border border-slate-300 text-slate-700 py-2 pl-4 pr-10 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 font-medium min-w-[320px]"
            >
              {displayFunds.map(fund => (
                <option key={fund.id} value={fund.id}>{fund.id} - {fund.name}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
              <Filter size={14} />
            </div>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KPICard 
          title="Patrimonio Total (AUM)"
          value={formatCurrency(selectedFund.aum)}
          icon={<Wallet size={24} />}
          highlight
        />
        <KPICard 
          title="Exposición Renta Variable"
          value={`${displayEquityPct.toFixed(2)}%`}
          icon={<TrendingUp size={24} />}
        />
        <KPICard 
          title="Liquidez Disponible (T-Real)"
          value={`${totalLiquidityPct.toFixed(2)}%`}
          subValue={formatCurrency(totalLiquidityValue)}
          icon={<Droplet size={24} />}
        />
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
               * Distribución calculada sobre Patrimonio Total de {formatCurrency(selectedFund.aum)}
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
                    <th className="pb-4 pl-4">Ticker</th>
                    <th className="pb-4">Nombre Activo</th>
                    <th className="pb-4">Moneda</th>
                    <th className="pb-4 text-right">Títulos</th>
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
                        <span className="font-bold text-slate-900 font-mono text-sm">{asset.ticker}</span>
                      </td>
                      <td className="py-4 border-y border-slate-100">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-slate-700 truncate max-w-[240px]">{asset.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{asset.isin}</span>
                        </div>
                      </td>
                      <td className="py-4 border-y border-slate-100">
                        <span className="text-xs font-semibold px-2 py-1 bg-slate-100 rounded text-slate-600">{asset.currency}</span>
                      </td>
                      <td className="py-4 border-y border-slate-100 text-right">
                        <span className="font-mono text-sm text-slate-600">{formatNumber(asset.quantity)}</span>
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