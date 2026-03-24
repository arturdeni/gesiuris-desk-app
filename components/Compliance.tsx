import React, { useState, useMemo, useEffect } from 'react';
import { Scale, Search, FileText, CheckCircle2, ShieldCheck, Clock, ExternalLink, Sparkles, Calendar, Filter, ListFilter, X, AlertTriangle, Check, Send, Trash2, Hourglass } from 'lucide-react';
import { Fund, PreTradeOrder, User, Boleta, Asset } from '../types';
import { FundSelector } from './FundSelector';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ComplianceProps {
  selectedFundId: string | null;
  funds: Fund[];
  onFundChange: (id: string) => void;
  orders: PreTradeOrder[];
  boletas: Boleta[];
  currentUser: User | null;
}

export const Compliance: React.FC<ComplianceProps> = ({ 
  selectedFundId, 
  funds, 
  onFundChange, 
  orders, 
  boletas,
  currentUser 
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllFunds, setShowAllFunds] = useState(false);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [selectedBoleta, setSelectedBoleta] = useState<Boleta | null>(null);

  // Filter boletas by date and fund
  const filteredBoletas = useMemo(() => {
    return boletas.filter(boleta => {
      // 1. Filter by Fund
      if (!showAllFunds && selectedFundId && boleta.fundId !== selectedFundId && boleta.fundId !== 'GLOBAL') {
        return false;
      }

      // 2. Filter by Date
      if (dateFilter) {
        const boletaDate = new Date(boleta.timestamp).toISOString().split('T')[0];
        if (boletaDate !== dateFilter) return false;
      }

      // 3. Filter by Search Query (Fund name or ID)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          boleta.fundName.toLowerCase().includes(query) ||
          boleta.fundId.toLowerCase().includes(query) ||
          boleta.id.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [boletas, selectedFundId, dateFilter, showAllFunds, searchQuery]);

  // If a boleta is selected, use its orders. Otherwise, maybe default to the first one or show empty.
  const displayOrders = useMemo(() => {
    if (selectedBoleta) return selectedBoleta.orders;
    return [];
  }, [selectedBoleta]);

  // Set initial selected boleta
  useEffect(() => {
    if (filteredBoletas.length > 0 && !selectedBoleta) {
      setSelectedBoleta(filteredBoletas[0]);
    } else if (filteredBoletas.length === 0) {
      setSelectedBoleta(null);
    }
  }, [filteredBoletas]);

  const formatCurrency = (val: number, currency: string = 'EUR') => {
    return new Intl.NumberFormat('de-DE', { 
      style: 'currency', 
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val);
  };

  const generatePDF = (ordersToPrint: PreTradeOrder[], boletaId: string, fundName: string) => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    doc.text(`Comprobaciones PRE-Trade - ${fundName}`, 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, 30);
    doc.text(`ID Boleta: #${boletaId}`, 14, 35);

    const tableBody = [
      [{ content: `IIC: ${fundName}`, colSpan: 14, styles: { fontStyle: 'bold', fillColor: [240, 240, 240], halign: 'left' } as any }],
      ...ordersToPrint.map(row => {
        let tickerDisplay = row.asset.ticker && row.asset.ticker.startsWith('POS-') ? row.asset.name : row.asset.ticker;
        if (row.operationType === 'Derivados') {
          const consumption = row.commitmentConsumption === 'NO' ? ` (NO CONSUME: ${row.noConsumptionReason})` : ' (CONSUME COMPROMISO)';
          tickerDisplay += `\n${row.derivativeCategory} - ${row.derivativeInstrumentType}${consumption}`;
        }
        if (row.operationType === 'Renta Fija' && row.rating) {
          tickerDisplay += `\nRating: ${row.rating}`;
        }
        
        return [
          new Date(row.addedAt).toLocaleString('es-ES'),
          row.side === 'buy' ? 'COMPRA' : 'VENTA',
          tickerDisplay,
          row.quantity.toLocaleString('es-ES'),
          `${row.price.toFixed(2)} ${row.currency}`,
          `${row.stats?.commitmentBeforePct?.toFixed(2) || '0,00'}%`,
          `${row.stats?.commitmentPct?.toFixed(2) || '0,00'}%`,
          row.side === 'buy' ? `${row.stats?.liquidityAvailablePct?.toFixed(2) || '-'}%` : '-',
          row.side === 'buy' ? `${row.stats?.liquidityOperationPct?.toFixed(2) || '-'}%` : '-',
          row.side === 'buy' ? (row.stats?.complies51040 ? `SI (${row.stats?.concentrationPct?.toFixed(2) || '-'}%)` : `NO (${row.stats?.concentrationPct?.toFixed(2) || '-'}%)`) : '-',
          row.stats?.compliesEquity ? `SI (${row.stats?.equityPct?.toFixed(2) || '-'}% / ${row.stats?.maxEquity?.toFixed(0) || '-'}%)` : `NO (${row.stats?.equityPct?.toFixed(2) || '-'}% / ${row.stats?.maxEquity?.toFixed(0) || '-'}%)`,
          row.asset.typology === 'Participaciones IIC' ? (row.stats?.compliesIIC ? `SI (${row.stats?.iicWeightPct?.toFixed(2) || '-'}% / 20%)` : `NO (${row.stats?.iicWeightPct?.toFixed(2) || '-'}% / 20%)`) : '-',
          row.operationType === 'Renta Fija' ? (row.stats?.compliesRating ? 'SI' : 'NO') : '-',
          row.side === 'sell' ? row.stats?.holdings?.toLocaleString('es-ES') || '-' : '-'
        ];
      })
    ];

    autoTable(doc, {
      startY: 45,
      head: [['Fecha', 'C/V', 'Ticker', 'Títulos', 'Precio', 'Comp. Pre', 'Comp. Post', '% Liq Disp', '% Liq Op', '5/10/40', 'Lim RV Folleto', 'Lim IIC (20%)', 'Rating', 'Títulos en Cartera']],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [63, 63, 65], textColor: [255, 255, 255], fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: [50, 50, 50] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: {
        1: { fontStyle: 'bold' },
        7: { halign: 'center' },
        8: { halign: 'center' }
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(8);

    const now = new Date();
    const formattedDate = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const signerName = currentUser ? `${currentUser.name} ${currentUser.surname}`.toUpperCase() : 'GESIURIS ASSET MANAGEMENT';
    
    doc.text(`Firmado Digitalmente: ${signerName} ${formattedDate}`, 14, finalY);

    const disclaimerText = "DISCLAIMER: Esta aplicación, así como los datos, cálculos y funcionalidades, han sido desarrolladas por GESIURIS ASSET MANAGEMENT S.G.I.I.C. S.A. (en adelante, GESIURIS) con la finalidad única de facilitar el proceso de comprobaciones previas y el envío de operaciones a mercado de las IICs. La responsabilidad última de los datos, cálculos y funcionalidades de esta aplicación corresponde al gestor firmante, que comprueba todas las informaciones generadas por la aplicación. En consecuencia, GESIURIS no se responsabiliza de los errores contenidos.";
    
    const splitDisclaimer = doc.splitTextToSize(disclaimerText, 180);
    doc.text(splitDisclaimer, 14, finalY + 10);
    
    doc.save(`Boleta_Compliance_${boletaId}.pdf`);
  };

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 bg-slate-50 p-8">
      <div className="w-full flex flex-col h-full">
        
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
              <Scale className="text-brand-600" />
              Compliance: Control Normativo
            </h2>
            <p className="text-slate-500 mt-1">Registro histórico de validaciones Pre-Trade y cumplimiento normativo.</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
              <button
                onClick={() => setShowAllFunds(!showAllFunds)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-colors ${
                  showAllFunds 
                    ? 'bg-brand-600 text-white shadow-sm' 
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <ListFilter size={14} />
                {showAllFunds ? 'Todos los Fondos' : 'Por Fondo'}
              </button>
              
              {!showAllFunds && (
                <div className="w-64">
                  <FundSelector 
                    selectedFundId={selectedFundId || ''} 
                    funds={funds} 
                    onFundChange={onFundChange} 
                  />
                </div>
              )}
            </div>

            <div className="relative">
              <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input 
                type="date" 
                className="pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm font-bold focus:ring-brand-500 focus:border-brand-500 bg-white shadow-sm"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />
            </div>
            {selectedBoleta && (
              <button 
                onClick={() => generatePDF(selectedBoleta.orders, selectedBoleta.id, selectedBoleta.fundName)}
                className="px-6 py-2.5 bg-brand-700 text-white rounded-xl font-bold hover:bg-brand-800 transition-all shadow-lg shadow-brand-200 flex items-center gap-2"
              >
                <FileText size={18} />
                DESCARGAR PDF
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-grow flex flex-col">
          <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
            {/* Main Table Area */}
            <div className="flex-grow overflow-auto border-r border-slate-100">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-100 text-slate-500 font-bold uppercase text-xs sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4">Fecha</th>
                    <th className="px-6 py-4">Orden</th>
                    <th className="px-6 py-4">Activo</th>
                    <th className="px-6 py-4 text-right">Cantidad</th>
                    <th className="px-6 py-4 text-right">Precio</th>
                    <th className="px-6 py-4 text-right">Importe EUR</th>
                    <th className="px-6 py-4 text-center bg-blue-50/20">Comp. Pre</th>
                    <th className="px-6 py-4 text-center bg-blue-50/40 border-r border-blue-100">Comp. Post</th>
                    <th className="px-6 py-4 text-center bg-slate-50 border-l border-slate-200">Liq. Disp.</th>
                    <th className="px-6 py-4 text-center bg-slate-50">Impacto</th>
                    <th className="px-6 py-4 text-center bg-slate-50 border-r border-slate-200">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedBoleta && (
                    <tr className="bg-slate-50/80">
                      <td colSpan={11} className="px-6 py-2 font-bold text-slate-600 text-[10px] uppercase tracking-wider border-b border-slate-200 flex justify-between items-center">
                        <span>IIC: {selectedBoleta.fundName} (#{selectedBoleta.id})</span>
                        <span className="text-brand-600">Generado por: {selectedBoleta.generatedBy}</span>
                      </td>
                    </tr>
                  )}
                  {displayOrders.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-6 py-20 text-center">
                        <div className="max-w-xs mx-auto">
                          <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                            <ShieldCheck size={24} />
                          </div>
                          <h3 className="text-slate-900 font-bold mb-1">Sin boletas seleccionadas</h3>
                          <p className="text-slate-500 text-xs">
                            Selecciona una boleta del historial para revisar los controles normativos realizados.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    displayOrders.map((row, idx) => (
                      <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-xs text-slate-500 font-mono">
                            {new Date(row.addedAt).toLocaleDateString()}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {new Date(row.addedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold uppercase ${
                            row.side === 'buy' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {row.side === 'buy' ? 'COMPRA' : 'VENTA'}
                          </span>
                          <div className="text-[10px] text-slate-400 font-mono mt-1">#{idx + 1}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                            {row.fundName || row.fundId}
                          </div>
                          <div className="font-bold text-slate-800" title={row.asset.name}>
                            {row.asset.ticker && row.asset.ticker.startsWith('POS-') ? row.asset.name : row.asset.name || row.asset.ticker}
                          </div>
                          {row.asset.ticker && !row.asset.ticker.startsWith('POS-') && (
                            <div className="text-[10px] font-bold text-brand-600 uppercase tracking-wider">{row.asset.ticker}</div>
                          )}
                          {row.rating && (
                            <div className="text-[10px] font-bold text-slate-500 mt-1 flex items-center gap-1">
                              <ShieldCheck size={10} /> Rating: {row.rating}
                            </div>
                          )}
                          {row.operationType && row.operationType !== 'Renta Variable' && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              <span className="text-[9px] px-1 bg-slate-100 text-slate-500 rounded font-bold uppercase">{row.operationType}</span>
                              {row.commitmentConsumption && (
                                <span className={`text-[9px] px-1 rounded font-bold uppercase ${
                                  row.commitmentConsumption === 'SÍ' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                                }`}>
                                  Consume: {row.commitmentConsumption}
                                </span>
                              )}
                              {row.noConsumptionReason && (
                                <span className="text-[9px] px-1 bg-amber-100 text-amber-700 rounded font-bold uppercase">
                                  {row.noConsumptionReason}
                                </span>
                              )}
                              {row.derivativeInstrumentType && (
                                <span className="text-[9px] px-1 bg-indigo-100 text-indigo-700 rounded font-bold uppercase">
                                  {row.derivativeInstrumentType}
                                </span>
                              )}
                              {row.derivativeCategory && (
                                <span className="text-[9px] px-1 bg-purple-100 text-purple-700 rounded font-bold uppercase">
                                  {row.derivativeCategory}
                                </span>
                              )}
                              {row.delta !== undefined && (
                                <span className="text-[9px] px-1 bg-teal-100 text-teal-700 rounded font-bold uppercase">
                                  Delta: {row.delta.toFixed(2)}
                                </span>
                              )}
                              {row.underlying && (
                                <span className="text-[9px] px-1 bg-stone-100 text-stone-700 rounded font-bold uppercase">
                                  Sub: {row.underlying}
                                </span>
                              )}
                              {row.maturity && (
                                <span className="text-[9px] px-1 bg-stone-100 text-stone-700 rounded font-bold uppercase">
                                  Venc: {row.maturity}
                                </span>
                              )}
                              {row.derivativeCategory && <span className="text-[9px] px-1 bg-slate-200 text-slate-600 rounded font-bold">{row.derivativeCategory}</span>}
                              {row.commitment !== undefined && <span className="text-[9px] px-1 bg-blue-50 text-blue-600 rounded font-bold">Compromiso: {row.commitment.toLocaleString('es-ES')}€</span>}
                              {row.multiplier !== undefined && <span className="text-[9px] px-1 bg-indigo-50 text-indigo-600 rounded font-bold">Mult: {row.multiplier}</span>}
                              {row.valueDate && <span className="text-[9px] px-1 bg-amber-50 text-amber-600 rounded font-bold">V.Date: {row.valueDate}</span>}
                              {row.fxTargetCurrency && <span className="text-[9px] px-1 bg-purple-50 text-purple-600 rounded font-bold">→ {row.fxTargetCurrency}</span>}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-slate-600">
                          {row.quantity.toLocaleString('es-ES')} {row.operationType === 'Renta Fija' ? 'nom.' : ''}
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-slate-600">
                          {row.price.toFixed(2)} {row.currency}
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-slate-800">
                          {formatCurrency(row.amountEur, 'EUR')}
                        </td>
                        <td className="px-6 py-4 text-center font-mono text-slate-500 bg-blue-50/10">
                          {row.stats ? `${row.stats.commitmentBeforePct.toFixed(2)}%` : '-'}
                        </td>
                        <td className="px-6 py-4 text-center font-mono font-bold text-blue-700 bg-blue-50/30 border-r border-blue-100">
                          {row.stats ? `${row.stats.commitmentPct.toFixed(2)}%` : '-'}
                        </td>
                        
                        <td className="px-6 py-4 text-center font-mono text-slate-600 border-l border-slate-100 bg-slate-50/50">
                          {row.stats ? `${row.stats.liquidityAvailablePct.toFixed(2)}%` : '-'}
                        </td>
                        <td className="px-6 py-4 text-center font-mono text-slate-600 bg-slate-50/50">
                          {row.stats ? (row.side === 'buy' ? '-' : '+') + row.stats.liquidityOperationPct.toFixed(2) + '%' : '-'}
                        </td>
                        <td className="px-6 py-4 text-center border-r border-slate-100 bg-slate-50/50">
                          {row.stats ? (
                          <div className="flex flex-col gap-1 items-center">
                             <div className={`text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                               row.stats.complies51040 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
                             }`}>
                               <span>UCITS</span>
                               {row.stats.complies51040 ? <CheckCircle2 size={10} /> : <X size={10} />}
                             </div>
                             
                             {row.stats.maxEquity !== null && (
                               <div className={`text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                                 row.stats.compliesEquity ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
                               }`}>
                                 <span>FOLLETO ({row.stats.maxEquity}%)</span>
                                 {row.stats.compliesEquity ? <CheckCircle2 size={10} /> : <X size={10} />}
                               </div>
                             )}

                             <div className={`text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                               row.stats.compliesCommitment ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
                             }`}>
                               <span>COMPROMISO</span>
                               {row.stats.compliesCommitment ? <CheckCircle2 size={10} /> : <X size={10} />}
                             </div>

                             <div className={`text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                               row.stats.compliesLiquidity ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
                             }`}>
                               <span>LIQUIDEZ</span>
                               {row.stats.compliesLiquidity ? <CheckCircle2 size={10} /> : <X size={10} />}
                             </div>

                             {row.asset.typology === 'Participaciones IIC' && (
                               <div className={`text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                                 row.stats.compliesIIC ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
                               }`}>
                                 <span>IIC (20%)</span>
                                 {row.stats.compliesIIC ? <CheckCircle2 size={10} /> : <X size={10} />}
                               </div>
                             )}

                             {row.operationType === 'Renta Fija' && (
                               <div className={`text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                                 row.stats.compliesRating ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
                               }`}>
                                 <span>RATING</span>
                                 {row.stats.compliesRating ? <CheckCircle2 size={10} /> : <X size={10} />}
                               </div>
                             )}

                             {row.stats.isShortSell && (
                               <div className="text-[10px] px-2 py-0.5 rounded-full border bg-red-50 border-red-200 text-red-700 flex items-center gap-1">
                                 <span>DESCUBIERTO</span>
                                 <AlertTriangle size={10} />
                               </div>
                             )}
                          </div>
                          ) : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Boletas Sidebar */}
            <div className="w-full md:w-72 bg-slate-50 flex flex-col border-l border-slate-200">
              <div className="p-4 border-bottom border-slate-200 bg-white">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <FileText size={14} />
                  Historial de Boletas
                </h3>
              </div>
              <div className="flex-grow overflow-auto p-2 space-y-2">
                {filteredBoletas.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-xs text-slate-400">No hay boletas para los filtros seleccionados.</p>
                  </div>
                ) : (
                  filteredBoletas.map(boleta => (
                    <button
                      key={boleta.id}
                      onClick={() => setSelectedBoleta(boleta)}
                      className={`w-full text-left p-3 rounded-lg border transition-all group ${
                        selectedBoleta?.id === boleta.id 
                          ? 'bg-brand-50 border-brand-300 shadow-sm' 
                          : 'bg-white border-slate-200 hover:border-brand-300 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[10px] font-mono font-bold text-brand-600">#{boleta.id}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(boleta.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-800 truncate">{boleta.fundName}</div>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-[10px] text-slate-500">{boleta.orders.length} órdenes</span>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            generatePDF(boleta.orders, boleta.id, boleta.fundName);
                          }}
                          className="text-[10px] text-brand-600 font-bold flex items-center gap-1 hover:text-brand-700 hover:underline"
                        >
                          PDF <Sparkles size={10} />
                        </button>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
            <p>
              * Los datos mostrados corresponden a la validación Pre-Trade realizada en el momento de la generación de la boleta.
            </p>
            {selectedBoleta && (
              <p>
                Total Operaciones en Boleta: <span className="font-bold">{selectedBoleta.orders.length}</span>
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

