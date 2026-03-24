import React, { useState, useEffect, useMemo } from 'react';
import { FileText, CheckCircle2, X, Trash2, Send, Hourglass, Check, Sparkles, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Fund, Asset, PreTradeOrder, User, Boleta, LiquidityAdjustment } from '../types';

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
import { FundLimit } from '../data/fundLimits';
import { Instrument } from '../data/maestro';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { FundSelector } from './FundSelector';

interface PreTradeProps {
  fund: Fund | null;
  funds: Fund[];
  onFundChange: (id: string) => void;
  fundLimits: FundLimit[];
  currentUser: User | null;
  orders: PreTradeOrder[];
  setOrders: React.Dispatch<React.SetStateAction<PreTradeOrder[]>>;
  onRemoveOrder: (id: string) => void;
  onConfirmAndGenerate: (orders: PreTradeOrder[]) => void;
  onSendOrder: (order: PreTradeOrder) => void;
  onBack: () => void;
  manualAdjustment: number;
  aumAdjustment: number;
  liquidityAdjustments: LiquidityAdjustment[];
  boletas: Boleta[];
  onSaveBoleta: (boleta: Boleta) => void;
}

export const PreTrade: React.FC<PreTradeProps> = ({
  fund,
  funds,
  onFundChange,
  fundLimits,
  currentUser,
  orders,
  setOrders,
  onRemoveOrder,
  onConfirmAndGenerate,
  onSendOrder,
  onBack,
  manualAdjustment,
  aumAdjustment,
  liquidityAdjustments,
  boletas,
  onSaveBoleta
}) => {
  const adjustedAum = fund ? (fund.aum || 0) + aumAdjustment : 0;
  
  const assetsList = fund ? fund.positions || [] : [];
  const [issuerMap, setIssuerMap] = useState<Map<string, number>>(new Map());
  const [selectedBoleta, setSelectedBoleta] = useState<Boleta | null>(null);

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
    const baseLiquidity = assetsList.reduce((sum, asset) => {
      const type = (asset.typology || '').toLowerCase();
      if (type.includes('liqui')) {
        return sum + (asset.marketValue || 0);
      }
      return sum;
    }, 0);
    return baseLiquidity + manualAdjustment;
  }, [assetsList, manualAdjustment]);

  const currentFundLimits = useMemo(() => {
    if (!fund) return null;
    const found = fundLimits.find(l => 
      fund.name.toUpperCase().includes(l.nameKeywords) || 
      fund.id === l.code
    );
    if (found) return found;
    // Default to PATRIMONIS (code 54)
    return fundLimits.find(l => l.code === '54');
  }, [fund, fundLimits]);

  // SEQUENTIAL CALCULATION LOGIC FOR REVIEW TABLE
  const sequentialReviewData = useMemo(() => {
    if (!fund) {
       return orders.map(o => ({ ...o, stats: null }));
    }
    let runningLiquidity = realLiquidity;
    // Use official equity allocation from Excel as the base value
    let runningEquityValue = (fund.aum || 0) * ((fund.equityAllocation || 0) / 100);
    // Use official derivative commitment from Excel as the base value
    let runningCommitmentValue = (fund.aum || 0) * ((fund.derivativeCommitment || 0) / 100);
    
    const runningIssuerMap = new Map<string | number, number>();
    assetsList.forEach(a => {
      if (a.typology === 'Liquidez') return;
      if (a.typology === 'Garantías') return;
      if (a.typology === 'Participaciones IIC') return;
      if (String(a.issuerTicker).trim() === '1002') return; // Exclude Spanish State (1002)
      
      const derType = String(a.derivativeType || '').toUpperCase().trim();
      const isIndexOrFx = derType === 'DIV' || derType === 'IRV' || derType === 'INDICE' || derType === 'ÍNDICE';
      if (isIndexOrFx) return;
      // Also filter by name for index derivatives
      const nameLower = (a.name || '').toLowerCase();
      const isIndexByName = nameLower.includes('s&p') || nameLower.includes('msci') || nameLower.includes('ibex') || nameLower.includes('eurostoxx') || nameLower.includes('nasdaq') || nameLower.includes('russell') || nameLower.includes('dax') || nameLower.includes('nikkei');
      if (a.typology === 'Derivados' && isIndexByName) return;

      const issuerId = getIssuerId(a);
      const currentVal = runningIssuerMap.get(issuerId) || 0;
      runningIssuerMap.set(issuerId, currentVal + (a.marketValue || 0));
    });

    return orders.map(order => {
      const isBuy = order.side === 'buy';
      const orderAmount = order.operationType === 'Derivados' ? 0 : (order.amountEur || 0);
      
      const liquidityOperationPct = (orderAmount / adjustedAum) * 100;
      
      // Store commitment before this order
      const commitmentBeforePct = (runningCommitmentValue / adjustedAum) * 100;

      if (isBuy) {
        runningLiquidity -= orderAmount;
      } else {
        runningLiquidity += orderAmount;
      }

      // Rule 2: Equity Exposure Calculation for Pre-Trade
      const typologyUpper = String(order.asset.typology || '').toUpperCase().trim();
      const isOrderEquity = typologyUpper === 'RENTA VARIABLE' || typologyUpper === 'ACCIONES' || typologyUpper === 'PARTICIPACIONES IIC';
      const category = String(order.derivativeCategory || '').toUpperCase().trim();
      const isOrderDerivEquity = order.operationType === 'Derivados' && (category === 'ÍNDICE' || category === 'INDICE' || category === 'ACCIONES' || category === 'IRV');

      if (order.operationType === 'Derivados') {
        if (isOrderDerivEquity) {
          // Calculate Delta-Equivalent Exposure Impact
          // Use underlyingPrice for exposure, not the premium (amountEur)
          const multiplier = Number(order.multiplier) || 1;
          const delta = Number(order.delta) || 1;
          const uPrice = order.derivativeInstrumentType === 'Futuros' ? (Number(order.price) || 0) : (Number(order.underlyingPrice) || Number(order.price) || 0);
          const fx = Number(order.asset.exchangeRate) || 1;
          
          const q = isBuy ? order.quantity : -order.quantity;
          const exposureImpact = (q * uPrice * multiplier * delta) / fx;
          
          runningEquityValue += exposureImpact;
        }
      } else if (isOrderEquity) {
        if (isBuy) runningEquityValue += order.amountEur;
        else runningEquityValue -= order.amountEur;
      }

      if (order.operationType === 'Derivados') {
        const consumption = String(order.commitmentConsumption || '').toUpperCase().trim();
        const orderCommitment = Number(order.commitment) || 0;
        if (consumption === 'SÍ' || consumption === 'SI') {
          runningCommitmentValue += orderCommitment;
        } else if (consumption === 'NO' && String(order.noConsumptionReason || '').toUpperCase().includes('DESHACER')) {
          // Only reduce commitment for position unwinding, not for hedges
          runningCommitmentValue = Math.max(0, runningCommitmentValue - orderCommitment);
        }
      }

      const issuerId = getIssuerId(order.asset);
      
      const derType = String(order.asset.derivativeType || '').toUpperCase().trim();
      const isExcluded = 
         order.asset.typology === 'Liquidez' ||
         order.asset.typology === 'Garantías' ||
         order.asset.typology === 'Participaciones IIC' ||
         String(order.asset.issuerTicker).trim() === '1002' || // Exclude Spanish State (1002)
         (derType === 'DIV' || derType === 'IRV' || derType === 'INDICE' || derType === 'ÍNDICE') ||
         (order.operationType === 'Derivados' && (
           category === 'ÍNDICE' || 
           category === 'INDICE' || 
           category === 'DIVISA' || 
           category === 'DIV' || 
           category === 'IRV'
         ));

      if (!isExcluded) {
        const currentIssuerVal = runningIssuerMap.get(issuerId) || 0;
        const exposureValue = order.operationType === 'Derivados' ? (order.commitment || 0) : orderAmount;
        const impact = isBuy ? exposureValue : -exposureValue;
        runningIssuerMap.set(issuerId, Math.max(0, currentIssuerVal + impact));
      }

      let concentrationSum = 0;
      runningIssuerMap.forEach((val) => {
        const weight = val / adjustedAum;
        if (weight > 0.05) { 
          concentrationSum += weight;
        }
      });
      const concentrationPct = concentrationSum * 100;
      const issuerWeightPct = ((runningIssuerMap.get(issuerId) || 0) / adjustedAum) * 100;
      const complies51040 = isBuy ? (concentrationPct <= 40 || issuerWeightPct <= 5) : true;
      
      const equityPct = (runningEquityValue / adjustedAum) * 100;
      const commitmentPct = (runningCommitmentValue / adjustedAum) * 100;
      const maxCommitment = (fund.id === '701' || fund.name.toUpperCase().includes('REGATA')) ? 200 : 90;
      const compliesCommitment = commitmentPct <= maxCommitment;

      const liquidityAvailablePct = (runningLiquidity / adjustedAum) * 100;
      const compliesLiquidity = liquidityAvailablePct >= 0;

      let compliesEquity = true;
      if (currentFundLimits) {
        const min = currentFundLimits.minEquity * 100;
        const max = currentFundLimits.maxEquity * 100;
        if (isBuy) {
          compliesEquity = equityPct <= max;
        } else {
          compliesEquity = equityPct >= min;
        }
      }

      const portfolioAsset = assetsList.find(a => a.ticker === order.asset.ticker);
      const holdings = order.operationType === 'Renta Fija' ? (portfolioAsset?.nominal || 0) : (portfolioAsset?.quantity || 0);

      // Rating Validation (Fund 5 = Occident Renta fija)
      let compliesRating = true;
      if ((fund.id === '5' || fund.name.toUpperCase().includes('OCCIDENT')) && order.operationType === 'Renta Fija') {
        const ratingVal = getRatingValue(order.rating);
        compliesRating = ratingVal >= 3; // 3 is BBB-
      }

      // Short Selling Check
      const isShortSell = order.operationType !== 'Derivados' && !isBuy && (holdings - (order.nominal || order.quantity) < 0);

      // IIC Individual Limit (20%)
      let compliesIIC = true;
      let iicWeightPct = 0;
      if (order.asset.typology === 'Participaciones IIC') {
        const currentVal = (portfolioAsset?.marketValue || 0);
        const impact = isBuy ? orderAmount : -orderAmount;
        iicWeightPct = ((currentVal + impact) / adjustedAum) * 100;
        compliesIIC = iicWeightPct <= 20;
      }

      const maxEquity = currentFundLimits ? currentFundLimits.maxEquity * 100 : null;
      const minEquity = currentFundLimits ? currentFundLimits.minEquity * 100 : null;

      return {
        ...order,
        stats: {
          liquidityAvailablePct,
          compliesLiquidity,
          liquidityOperationPct,
          complies51040,
          concentrationPct,
          compliesEquity,
          equityPct,
          maxEquity,
          minEquity,
          commitmentBeforePct,
          compliesCommitment,
          commitmentPct,
          compliesIIC,
          iicWeightPct,
          holdings,
          compliesRating,
          isShortSell
        }
      };
    });
  }, [orders, realLiquidity, adjustedAum, assetsList, currentFundLimits, issuerMap]);

  const formatCurrency = (val: number, currency: string = 'EUR') => {
    return new Intl.NumberFormat('de-DE', { 
      style: 'currency', 
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val);
  };

  const generatePDF = (ordersToPrint: any[] = sequentialReviewData, boletaId?: string) => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    doc.text(`Comprobaciones PRE-Trade - ${fund ? fund.name : 'Todas las IICs'}`, 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, 30);
    const bId = boletaId || `GES-${Date.now().toString().slice(-6)}`;
    doc.text(`ID Boleta: #${bId}`, 14, 35);

    const tableBody = [
      [{ content: `IIC: ${fund ? fund.name : 'Todas las IICs'}`, colSpan: 14, styles: { fontStyle: 'bold', fillColor: [240, 240, 240], halign: 'left' } }],
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
    
    doc.save(`Boleta_${fund ? fund.ticker : 'GLOBAL'}_${bId}.pdf`);
    return bId;
  };

  const handleConfirmAndGeneratePDF = () => {
    const boletaId = generatePDF();
    const newBoleta: Boleta = {
      id: boletaId,
      fundId: fund ? fund.id : 'GLOBAL',
      fundName: fund ? fund.name : 'Todas las IICs',
      timestamp: new Date().toISOString(),
      orders: [...sequentialReviewData],
      generatedBy: currentUser ? `${currentUser.name} ${currentUser.surname}` : 'Gestor'
    };
    onSaveBoleta(newBoleta);
    onConfirmAndGenerate(orders);
  };

  const handleSendAndGeneratePDF = (order: PreTradeOrder) => {
    const orderWithStats = sequentialReviewData.find(o => o.id === order.id);
    const boletaId = generatePDF([orderWithStats || order]);
    const newBoleta: Boleta = {
      id: boletaId,
      fundId: fund ? fund.id : order.fundId,
      fundName: fund ? fund.name : (funds.find(f => f.id === order.fundId)?.name || 'IIC Desconocida'),
      timestamp: new Date().toISOString(),
      orders: [orderWithStats || order],
      generatedBy: currentUser ? `${currentUser.name} ${currentUser.surname}` : 'Gestor'
    };
    onSaveBoleta(newBoleta);
    onSendOrder(order);
  };

  const handleRemoveOrder = (id: string) => {
    setOrders(prev => prev.filter(o => o.id !== id));
    onRemoveOrder(id);
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
          <div className="flex items-center gap-6">
            <FundSelector 
              selectedFundId={fund ? fund.id : ''} 
              funds={funds} 
              onFundChange={onFundChange} 
            />
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
                    <th className="px-6 py-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fund && sequentialReviewData.length > 0 && (
                    <tr className="bg-slate-50/80">
                      <td colSpan={11} className="px-6 py-2 font-bold text-slate-600 text-[10px] uppercase tracking-wider border-b border-slate-200">
                        IIC: {fund.name} ({fund.id})
                      </td>
                    </tr>
                  )}
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
                          {!fund && (
                            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                              {funds.find(f => f.id === row.fundId)?.name || row.fundId}
                            </div>
                          )}
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
                             
                             {currentFundLimits && (
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

                             {row.operationType === 'Renta Fija' && (fund && (fund.id === '5' || fund.name.toUpperCase().includes('OCCIDENT'))) && (
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
                          ) : (
                            <span className="text-slate-300 italic text-[10px]">Filtra por IIC para ver cumplimiento</span>
                          )}
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

            {/* Boletas Sidebar */}
            <div className="w-full md:w-72 bg-slate-50 flex flex-col border-l border-slate-200">
              <div className="p-4 border-bottom border-slate-200 bg-white">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <FileText size={14} />
                  Boletas Generadas
                </h3>
              </div>
              <div className="flex-grow overflow-auto p-2 space-y-2">
                {boletas.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-xs text-slate-400">No hay boletas generadas aún.</p>
                  </div>
                ) : (
                  boletas.map(boleta => (
                    <button
                      key={boleta.id}
                      onClick={() => generatePDF(boleta.orders, boleta.id)}
                      className="w-full text-left p-3 rounded-lg bg-white border border-slate-200 hover:border-brand-300 hover:shadow-sm transition-all group"
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
                        <span className="text-[10px] text-brand-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                          Ver PDF <Sparkles size={10} />
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
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
