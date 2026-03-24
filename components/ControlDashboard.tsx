import React, { useMemo } from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2, FileText, Search, Filter, ArrowRight, Database, TrendingUp, Wallet } from 'lucide-react';
import { Fund } from '../types';
import { FundLimit } from '../data/fundLimits';

interface ControlDashboardProps {
  funds: Fund[];
  fundLimits: FundLimit[];
  adjustments?: any[];
}

export const ControlDashboard: React.FC<ControlDashboardProps> = ({ funds, fundLimits, adjustments = [] }) => {
  // Mock data for Control if no real funds are loaded
  const MOCK_FUNDS: Fund[] = [
    { id: '1', name: 'Gesiuris Euro Equities FI', ticker: 'GESEURO', aum: 124500000, currency: 'EUR', equityAllocation: 84.5, liquidity: 5.2, cash: 6474000, valuationDate: '2026-02-10', positions: [] },
    { id: '2', name: 'Gesiuris Fixed Income Global', ticker: 'GESFIX', aum: 85200000, currency: 'EUR', equityAllocation: 12.3, liquidity: 15.8, cash: 13461600, valuationDate: '2026-02-10', positions: [] },
    { id: '3', name: 'Gesiuris Mixed Asset Class', ticker: 'GESMIX', aum: 42100000, currency: 'EUR', equityAllocation: 45.0, liquidity: 8.4, cash: 3536400, valuationDate: '2026-02-10', positions: [] },
  ];

  const displayFunds = funds.length > 0 ? funds : MOCK_FUNDS;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val);
  };

  const getComplianceStatus = (fund: Fund) => {
    const limit = fundLimits.find(l => fund.name.toUpperCase().includes(l.nameKeywords) || fund.id === l.code);
    if (!limit) return { status: 'warning', message: 'Sin límites definidos' };

    const fundAdjustments = adjustments.filter(a => a.fundId === fund.id && (a.reason === 'Suscripción' || a.reason === 'Reembolso'));
    const aumAdjustment = fundAdjustments.reduce((acc, curr) => acc + curr.amount, 0);
    const adjustedAum = fund.aum + aumAdjustment;

    // Recalculate equity percentage based on adjusted AUM
    // We assume the current equity value is fund.aum * (fund.equityAllocation / 100)
    const currentEquityValue = fund.aum * (fund.equityAllocation / 100);
    const adjustedEquityPct = (currentEquityValue / adjustedAum) * 100;

    if (adjustedEquityPct > limit.maxEquity * 100 || adjustedEquityPct < limit.minEquity * 100) {
      return { status: 'error', message: 'Incumplimiento Folleto' };
    }

    return { status: 'success', message: 'Cumple Normativa' };
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* 1. Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Wallet size={20} />
            </div>
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Patrimonio Bajo Control</h3>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {formatCurrency(displayFunds.reduce((acc, f) => {
              const fundAdjustments = adjustments.filter(a => a.fundId === f.id && (a.reason === 'Suscripción' || a.reason === 'Reembolso'));
              const aumAdjustment = fundAdjustments.reduce((sum, curr) => sum + curr.amount, 0);
              return acc + f.aum + aumAdjustment;
            }, 0))}
          </p>
          <p className="text-xs text-slate-400 mt-2">Total de {displayFunds.length} fondos activos</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
              <ShieldCheck size={20} />
            </div>
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Fondos Validados</h3>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {displayFunds.filter(f => getComplianceStatus(f).status === 'success').length} / {displayFunds.length}
          </p>
          <div className="w-full h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
            <div 
              className="h-full bg-green-500" 
              style={{ width: `${(displayFunds.filter(f => getComplianceStatus(f).status === 'success').length / displayFunds.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <ShieldAlert size={20} />
            </div>
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Alertas Críticas</h3>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {displayFunds.filter(f => getComplianceStatus(f).status === 'error').length}
          </p>
          <p className="text-xs text-red-500 font-medium mt-2">Requiere atención inmediata</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
              <Database size={20} />
            </div>
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Maestro de Activos</h3>
          </div>
          <p className="text-2xl font-bold text-slate-900">14.281</p>
          <p className="text-xs text-slate-400 mt-2">Instrumentos monitorizados</p>
        </div>
      </div>

      {/* 2. Main Compliance Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Estado de Cumplimiento por Fondo</h3>
            <p className="text-sm text-slate-500">Monitorización en tiempo real de límites de folleto y UCITS</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
              <input 
                type="text" 
                placeholder="Buscar fondo..." 
                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <button className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50">
              <Filter size={18} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-widest">
              <tr>
                <th className="px-8 py-4">Fondo</th>
                <th className="px-8 py-4">Patrimonio</th>
                <th className="px-8 py-4">Exp. RV</th>
                <th className="px-8 py-4">Límites Folleto</th>
                <th className="px-8 py-4">Estado</th>
                <th className="px-8 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayFunds.map(fund => {
                const compliance = getComplianceStatus(fund);
                const limit = fundLimits.find(l => fund.name.toUpperCase().includes(l.nameKeywords) || fund.id === l.code);
                
                const fundAdjustments = adjustments.filter(a => a.fundId === fund.id && (a.reason === 'Suscripción' || a.reason === 'Reembolso'));
                const aumAdjustment = fundAdjustments.reduce((acc, curr) => acc + curr.amount, 0);
                const adjustedAum = fund.aum + aumAdjustment;
                const currentEquityValue = fund.aum * (fund.equityAllocation / 100);
                const adjustedEquityPct = (currentEquityValue / adjustedAum) * 100;
                
                return (
                  <tr key={fund.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 border border-slate-200">
                          {fund.ticker.substring(0, 3)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">{fund.name}</p>
                          <p className="text-xs text-slate-400 font-mono">{fund.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <p className="text-sm font-mono text-slate-600">{formatCurrency(adjustedAum)}</p>
                      {aumAdjustment !== 0 && (
                        <p className={`text-[10px] font-mono ${aumAdjustment > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {aumAdjustment > 0 ? '+' : ''}{formatCurrency(aumAdjustment)}
                        </p>
                      )}
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-bold text-slate-700">{adjustedEquityPct.toFixed(2)}%</span>
                        {limit && (
                          <span className="text-[10px] text-slate-400">
                            (Range: {limit.minEquity * 100}-{limit.maxEquity * 100}%)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${compliance.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                          <span className="text-xs text-slate-600">Límite RV</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          <span className="text-xs text-slate-600">UCITS 5/10/40</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        compliance.status === 'success' 
                          ? 'bg-green-50 text-green-700 border-green-100' 
                          : compliance.status === 'error'
                          ? 'bg-red-50 text-red-700 border-red-100'
                          : 'bg-orange-50 text-orange-700 border-orange-100'
                      }`}>
                        {compliance.status === 'success' ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                        {compliance.message}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <button className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all">
                        <FileText size={18} />
                      </button>
                      <button className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all">
                        <ArrowRight size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Recent Activity & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <TrendingUp size={20} className="text-brand-500" />
            Alertas de Mercado Recientes
          </h3>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-start gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Variación Significativa en Precio</p>
                  <p className="text-xs text-slate-500 mt-1">Instrumento: ASML NA | Variación: -4.2% | Impacto en GESEURO: -0.32%</p>
                  <p className="text-[10px] text-slate-400 mt-2 font-mono uppercase">Hace 12 minutos</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <CheckCircle2 size={20} className="text-green-500" />
            Últimas Validaciones
          </h3>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center justify-between p-4 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-4">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">Validación Diaria: GESFIX</p>
                    <p className="text-xs text-slate-400">Todo conforme a folleto</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-slate-400">09:15 AM</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
