import React, { useState, useEffect, useMemo } from 'react';
import { FileText, CheckCircle2, X, Trash2, Send, Hourglass, Check } from 'lucide-react';
import { Fund, Asset, PreTradeOrder, User } from '../types';
import { FundLimit } from '../data/fundLimits';
import { Instrument } from '../data/maestro';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PreTradeProps {
  fund: Fund;
  fundLimits: FundLimit[];
  currentUser: User | null;
  orders: PreTradeOrder[];
  setOrders: React.Dispatch<React.SetStateAction<PreTradeOrder[]>>;
  onConfirmAndGenerate: (orders: PreTradeOrder[]) => void;
  onSendOrder: (order: PreTradeOrder) => void;
  onBack: () => void;
}

export const PreTrade: React.FC<PreTradeProps> = ({ 
  fund, 
  fundLimits, 
  currentUser, 
  orders, 
  setOrders, 
  onConfirmAndGenerate, 
  onSendOrder,
  onBack 
}) => {
  
  const assetsList = fund.positions || [];
  const [issuerMap, setIssuerMap] = useState<Map<string, number>>(new Map());

  // Load Issuer Map on Mount (Duplicated from OperationsDesk)
  useEffect(() => {
    const loadIssuerData = async () => {
      try {
        const response = await fetch('/maestro.json');
        if (response.ok) {
          const text = await response.text();
          const sanitizedText = text.replace(/:\s*NaN\b/g, ': null');
          const data: Instrument[] = JSON.parse(sanitizedText);
          
          const newMap = new Map<string, number>();
          data.forEach(item => {
            if (item.codigoEmisora) {
              if (item.ticker) {
                const t = item.ticker.trim();
                newMap.set(t, item.codigoEmisora);
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

  // Helper to get Issuer ID
  const getIssuerId = (asset: Asset | null) => {
    if (!asset) return 'UNKNOWN';
    if (asset.issuerTicker && !isNaN(Number(asset.issuerTicker))) {
       return asset.issuerTicker;
    }
    if (asset.isin && issuerMap.has(asset.isin)) return issuerMap.get(asset.isin);
    const cleanTicker = asset.ticker ? asset.ticker.trim() : '';
    if (cleanTicker) {
      if (issuerMap.has(cleanTicker)) return issuerMap.get(cleanTicker);
      const root = cleanTicker.split(' ')[0];
      if (root && issuerMap.has(root)) return issuerMap.get(root);
      return root;
    }
    return 'UNKNOWN'; 
  };

  // Calculate Real Liquidity
  const realLiquidity = useMemo(() => {
    return assetsList.reduce((sum, asset) => {
      const type = (asset.typology || '').toLowerCase();
      if (type.includes('liqui')) {
        return sum + (asset.marketValue || 0);
      }
      return sum;
    }, 0);
  }, [assetsList]);

  const currentFundLimits = useMemo(() => {
    return fundLimits.find(l => 
      fund.name.toUpperCase().includes(l.nameKeywords) || 
      fund.id === l.code
    );
  }, [fund, fundLimits]);

  // SEQUENTIAL CALCULATION LOGIC FOR REVIEW TABLE
  const sequentialReviewData = useMemo(() => {
    let runningLiquidity = realLiquidity;
    let runningEquityValue = fund.aum * ((fund.equityAllocation || 0) / 100);

    const runningIssuerMap = new Map<string | number, number>();
    assetsList.forEach(a => {
      if (a.typology === 'Liquidez') return;
      if (a.typology === 'Garantías') return;
      if (a.typology === 'Renta Fija' && a.issuerTicker === '1002') return;

      if (a.typology === 'Derivados' && a.derivativeType && (a.derivativeType === 'DIV' || a.derivativeType === 'IRV')) {
         return;
      }
      const issuerId = getIssuerId(a);
      const currentVal = runningIssuerMap.get(issuerId) || 0;
      runningIssuerMap.set(issuerId, currentVal + (a.marketValue || 0));
    });

    return orders.map(order => {
      const isBuy = order.side === 'buy';
      const orderAmount = order.amountEur;
      
      const liquidityOperationPct = (orderAmount / fund.aum) * 100;
      
      if (isBuy) {
        runningLiquidity -= orderAmount;
        runningEquityValue += orderAmount;
      } else {
        runningLiquidity += orderAmount;
        runningEquityValue -= orderAmount;
      }

      const issuerId = getIssuerId(order.asset);
      
      const isExcluded = 
         order.asset.typology === 'Liquidez' ||
         order.asset.typology === 'Garantías' ||
         (order.asset.typology === 'Renta Fija' && order.asset.issuerTicker === '1002');

      if (!isExcluded) {
        const currentIssuerVal = runningIssuerMap.get(issuerId) || 0;
        const impact = isBuy ? orderAmount : -orderAmount;
        runningIssuerMap.set(issuerId, Math.max(0, currentIssuerVal + impact));
      }

      let concentrationSum = 0;
      runningIssuerMap.forEach((val) => {
        const weight = val / fund.aum;
        if (weight > 0.05) { 
          concentrationSum += weight;
        }
      });
      const concentrationPct = concentrationSum * 100;
      const complies51040 = concentrationPct <= 40;
      
      const equityPct = (runningEquityValue / fund.aum) * 100;
      let compliesEquity = true;
      if (currentFundLimits) {
        const min = currentFundLimits.minEquity * 100;
        const max = currentFundLimits.maxEquity * 100;
        compliesEquity = equityPct >= min && equityPct <= max;
      }

      const portfolioAsset = assetsList.find(a => a.ticker === order.asset.ticker);
      const holdings = portfolioAsset ? portfolioAsset.quantity : 0;

      return {
        ...order,
        stats: {
          liquidityAvailablePct: (runningLiquidity / fund.aum) * 100,
          liquidityOperationPct,
          complies51040,
          concentrationPct,
          compliesEquity,
          equityPct,
          holdings
        }
      };
    });
  }, [orders, realLiquidity, fund.aum, assetsList, currentFundLimits, issuerMap]);

  const formatCurrency = (val: number, currency: string = 'EUR') => {
    return new Intl.NumberFormat('de-DE', { 
      style: 'currency', 
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val);
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    doc.text(`Boleta de Órdenes - ${fund.name}`, 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, 30);
    doc.text(`ID Boleta: #GES-${Date.now().toString().slice(-6)}`, 14, 35);

    const tableBody = sequentialReviewData.map(row => [
      new Date(row.addedAt).toLocaleString('es-ES'),
      row.side === 'buy' ? 'COMPRA' : 'VENTA',
      row.asset.ticker,
      row.quantity.toLocaleString('es-ES'),
      `${row.price.toFixed(2)} ${row.currency}`,
      row.side === 'buy' ? `${row.stats.liquidityAvailablePct.toFixed(2)}%` : '-',
      row.side === 'buy' ? `${row.stats.liquidityOperationPct.toFixed(2)}%` : '-',
      row.side === 'buy' ? (row.stats.complies51040 ? `SI (${row.stats.concentrationPct.toFixed(2)}%)` : `NO (${row.stats.concentrationPct.toFixed(2)}%)`) : '-',
      row.stats.compliesEquity ? `SI (${row.stats.equityPct.toFixed(2)}%)` : `NO (${row.stats.equityPct.toFixed(2)}%)`,
      row.side === 'sell' ? row.stats.holdings.toLocaleString('es-ES') : '-'
    ]);

    autoTable(doc, {
      startY: 45,
      head: [['Fecha', 'C/V', 'Ticker', 'Títulos', 'Precio', '% Liq Disp', '% Liq Op', '5/10/40', 'Lim RV', 'Cartera']],
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
    
    doc.save(`Boleta_${fund.ticker}_${Date.now()}.pdf`);
  };

  const handleConfirmAndGeneratePDF = () => {
    generatePDF();
    onConfirmAndGenerate(orders);
  };

  const handleSendAndGeneratePDF = (order: PreTradeOrder) => {
    generatePDF();
    onSendOrder(order);
  };

  const handleRemoveOrder = (id: string) => {
    setOrders(prev => prev.filter(o => o.id !== id));
  };

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 bg-slate-50 p-8">
      <div className="w-full flex flex-col h-full">
        
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
              <FileText className="text-brand-600" />
              Revisión de Órdenes (Pre-Trade)
            </h2>
            <p className="text-slate-500 mt-1">Verifica el impacto secuencial en la liquidez y cumplimiento normativo antes de ejecutar.</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={onBack}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-600 font-bold hover:bg-slate-50 transition-colors"
            >
              Volver a Mesa
            </button>
            <button 
              onClick={handleConfirmAndGeneratePDF}
              disabled={orders.length === 0}
              className={`px-6 py-2 rounded-lg font-bold text-white shadow-lg flex items-center gap-2 transition-transform active:scale-95 ${
                orders.length === 0 ? 'bg-slate-300 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-700 shadow-brand-200'
              }`}
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
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Orden</th>
                  <th className="px-6 py-4">Activo</th>
                  <th className="px-6 py-4 text-right">Cantidad</th>
                  <th className="px-6 py-4 text-right">Precio</th>
                  <th className="px-6 py-4 text-right">Importe EUR</th>
                  <th className="px-6 py-4 text-center bg-slate-50 border-l border-slate-200">Liq. Disp.</th>
                  <th className="px-6 py-4 text-center bg-slate-50">Impacto</th>
                  <th className="px-6 py-4 text-center bg-slate-50 border-r border-slate-200">Estado</th>
                  <th className="px-6 py-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sequentialReviewData.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-slate-400">
                      No hay órdenes en la cesta de Pre-Trade.
                    </td>
                  </tr>
                ) : (
                  sequentialReviewData.map((row, idx) => (
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
                        <div className="font-bold text-slate-800">{row.asset.ticker}</div>
                        <div className="text-xs text-slate-500 truncate max-w-[250px]">{row.asset.name}</div>
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
                      
                      <td className="px-6 py-4 text-center font-mono text-slate-600 border-l border-slate-100 bg-slate-50/50">
                        {row.stats.liquidityAvailablePct.toFixed(2)}%
                      </td>
                      <td className="px-6 py-4 text-center font-mono text-slate-600 bg-slate-50/50">
                        {row.side === 'buy' ? '-' : '+'}{row.stats.liquidityOperationPct.toFixed(2)}%
                      </td>
                      <td className="px-6 py-4 text-center border-r border-slate-100 bg-slate-50/50">
                        <div className="flex flex-col gap-1 items-center">
                           <div className={`text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                             row.stats.complies51040 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
                           }`}>
                             <span>UCITS</span>
                             {row.stats.complies51040 ? <CheckCircle2 size={10} /> : <X size={10} />}
                           </div>
                           
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
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="flex flex-col items-center text-slate-400" title={row.preTradeStatus === 'sent' ? "Enviada a Post-Trade" : "Pendiente de envío"}>
                             {row.preTradeStatus === 'sent' ? (
                               <>
                                 <Check size={16} className="text-green-500" />
                                 <span className="text-[10px] text-green-600">Enviada</span>
                               </>
                             ) : (
                               <>
                                 <Hourglass size={16} className="opacity-50" />
                                 <span className="text-[10px]">Pendiente</span>
                               </>
                             )}
                          </div>
                          <div className="h-6 w-px bg-slate-200 mx-1"></div>
                          <button 
                            onClick={() => handleSendAndGeneratePDF(row)}
                            disabled={row.preTradeStatus === 'sent'}
                            className={`p-2 rounded-full transition-colors ${
                              row.preTradeStatus === 'sent' 
                                ? 'text-slate-300 cursor-not-allowed' 
                                : 'text-brand-600 hover:text-brand-700 hover:bg-brand-50'
                            }`}
                            title={row.preTradeStatus === 'sent' ? "Ya enviada" : "Enviar a Post-Trade"}
                          >
                            <Send size={16} />
                          </button>
                          <button 
                            onClick={() => handleRemoveOrder(row.id)}
                            className="text-slate-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-colors"
                            title="Eliminar orden"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
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
};
