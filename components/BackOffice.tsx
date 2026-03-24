import React, { useState } from 'react';
import { PostTradeOrder, PostTradeOrderStatus, PostTradeExecutionData, User, Fund } from '../types';
import { FundSelector } from './FundSelector';
import { CheckCircle, HelpCircle, Pin, Search, RotateCcw, PlusCircle, X, Save, Calendar, Clock, DollarSign, FileText, FileSpreadsheet, Briefcase, ListFilter } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface BackOfficeProps {
  selectedFundId: string | null;
  funds: Fund[];
  onFundChange: (id: string) => void;
  orders: PostTradeOrder[];
  setOrders: React.Dispatch<React.SetStateAction<PostTradeOrder[]>>;
  onReturnToPreTrade: (orderId: string) => void;
  currentUser: User | null;
  readOnly?: boolean;
}

export const BackOffice: React.FC<BackOfficeProps> = ({ selectedFundId, funds, onFundChange, orders, setOrders, onReturnToPreTrade, currentUser, readOnly = false }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllFunds, setShowAllFunds] = useState(false);
  const [dateFilter, setDateFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<PostTradeOrder | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState<{
    status: 'EJECUTADA' | 'VIVA';
    orderType: 'A mercado' | 'Limitada' | 'Al Average';
    broker: 'GVC Gaesco' | 'Renta 4' | 'Nomura' | 'Bestinver' | 'Bankinter';
    depositary: 'CACEIS' | 'BNP' | 'Bankinter';
    callTime: string;
    executionPrice: string;
    validityDate: string;
    valueDate: string;
    notes: string;
  }>({
    status: 'EJECUTADA',
    orderType: 'A mercado',
    broker: 'GVC Gaesco',
    depositary: 'CACEIS',
    callTime: '',
    executionPrice: '',
    validityDate: '',
    valueDate: '',
    notes: ''
  });

  const handleOpenModal = (order: PostTradeOrder) => {
    setSelectedOrder(order);
    if (order.executionData) {
      setFormData({
        status: order.status === 'SIN_DATOS' ? 'EJECUTADA' : (order.status as 'EJECUTADA' | 'VIVA'),
        orderType: order.executionData.orderType,
        broker: order.executionData.broker || 'GVC Gaesco',
        depositary: order.executionData.depositary || 'CACEIS',
        callTime: order.executionData.callTime,
        executionPrice: order.executionData.executionPrice?.toString() || '',
        validityDate: order.executionData.validityDate || '',
        valueDate: order.executionData.valueDate || '',
        notes: order.executionData.notes || ''
      });
    } else {
      setFormData({
        status: 'EJECUTADA',
        orderType: 'A mercado',
        broker: 'GVC Gaesco',
        depositary: 'CACEIS',
        callTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        executionPrice: order.price ? order.price.toString() : '',
        validityDate: new Date().toISOString().split('T')[0],
        valueDate: order.valueDate || new Date().toISOString().split('T')[0],
        notes: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!selectedOrder) return;

    const executionData: PostTradeExecutionData = {
      orderType: formData.orderType,
      broker: selectedOrder.operationType === 'Divisa' ? undefined : formData.broker,
      depositary: selectedOrder.operationType === 'Divisa' ? formData.depositary : undefined,
      callTime: formData.callTime,
      executionPrice: formData.executionPrice ? parseFloat(formData.executionPrice) : undefined,
      validityDate: formData.validityDate || undefined,
      valueDate: selectedOrder.operationType === 'Divisa' ? formData.valueDate : undefined,
      notes: formData.notes
    };

    setOrders(prev => prev.map(o => 
      o.id === selectedOrder.id 
        ? { 
            ...o, 
            status: formData.status, 
            executionData,
            processedAt: new Date().toISOString()
          } 
        : o
    ));
    setIsModalOpen(false);
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const ordersToPrint = orders.filter(o => o.status === 'EJECUTADA' || o.status === 'VIVA');

    if (ordersToPrint.length === 0) {
      alert("No hay órdenes EJECUTADAS o VIVAS para generar el informe.");
      return;
    }

    doc.setFontSize(18);
    doc.text(`Boleta de Órdenes (Back-Office)`, 14, 22);
    doc.setFontSize(10);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, 30);

    const tableBody = ordersToPrint.map(row => {
      const price = row.executionData?.executionPrice ?? row.price;
      const brokerOrDepositary = row.operationType === 'Divisa' 
        ? row.executionData?.depositary || '-' 
        : row.executionData?.broker || '-';
      
      const statusOrValueDate = row.operationType === 'Divisa' && row.executionData?.valueDate
        ? `FV: ${new Date(row.executionData.valueDate).toLocaleDateString('es-ES')}`
        : (row.status === 'VIVA' && row.executionData?.validityDate 
            ? new Date(row.executionData.validityDate).toLocaleDateString('es-ES') 
            : row.status);

      return [
        row.fundId || '-',
        row.fundName || '-',
        row.side === 'buy' ? 'COMPRA' : 'VENTA',
        row.asset.ticker,
        row.quantity.toLocaleString('es-ES'),
        price.toLocaleString('es-ES', { minimumFractionDigits: 4, maximumFractionDigits: 4 }),
        row.executionData?.callTime || '-',
        brokerOrDepositary,
        row.executionData?.notes || '-',
        statusOrValueDate
      ];
    });

    autoTable(doc, {
      startY: 40,
      head: [['Cód. IIC', 'Nombre IIC', 'C/V', 'Ticker', 'Títulos', 'Precio', 'Hora', 'Bróker/Dep.', 'Obs.', 'Estado/FV']],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [63, 63, 65], textColor: [255, 255, 255], fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: [50, 50, 50] },
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

    doc.save(`Boleta_BackOffice_${Date.now()}.pdf`);
  };

  const generateXLSX = () => {
    const ordersToPrint = orders.filter(o => o.status === 'EJECUTADA' || o.status === 'VIVA');
    
    if (ordersToPrint.length === 0) {
      alert("No hay órdenes EJECUTADAS o VIVAS para generar el informe.");
      return;
    }

    const data = ordersToPrint.map(row => {
      const price = row.executionData?.executionPrice ?? row.price;
      const brokerOrDepositary = row.operationType === 'Divisa' 
        ? row.executionData?.depositary || '-' 
        : row.executionData?.broker || '-';
      
      const statusOrValueDate = row.operationType === 'Divisa' && row.executionData?.valueDate
        ? `FV: ${new Date(row.executionData.valueDate).toLocaleDateString('es-ES')}`
        : (row.status === 'VIVA' && row.executionData?.validityDate 
            ? new Date(row.executionData.validityDate).toLocaleDateString('es-ES') 
            : row.status);

      return {
        'Código IIC': row.fundId || '-',
        'Nombre IIC': row.fundName || '-',
        'C/V': row.side === 'buy' ? 'COMPRA' : 'VENTA',
        'Ticker': row.asset.ticker,
        'Títulos': row.quantity,
        'Precio': price.toLocaleString('es-ES', { minimumFractionDigits: 4, maximumFractionDigits: 4 }),
        'Hora Grabación': row.executionData?.callTime || '-',
        'Bróker/Dep.': brokerOrDepositary,
        'Observaciones': row.executionData?.notes || '-',
        'Estado/FV': statusOrValueDate
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Órdenes");
    XLSX.writeFile(wb, `Boleta_BackOffice_${Date.now()}.xlsx`);
  };

  // Filter out SIN_DATOS as requested
  const informedOrders = orders.filter(o => o.status !== 'SIN_DATOS');

  const filteredOrders = informedOrders.filter(order => {
    // 1. Filter by Fund
    if (!showAllFunds && selectedFundId && order.fundId !== selectedFundId) {
      return false;
    }

    // 2. Filter by Date
    if (dateFilter) {
      const orderDate = order.processedAt ? new Date(order.processedAt).toISOString().split('T')[0] : '';
      if (orderDate !== dateFilter) return false;
    }

    // 3. Filter by Search Query
    return (
      order.asset.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.status.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.fundName && order.fundName.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  const getStatusConfig = (status: PostTradeOrderStatus) => {
    switch (status) {
      case 'EJECUTADA':
        return {
          color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: <CheckCircle size={14} />,
          label: 'Ejecutada'
        };
      case 'VIVA':
        return {
          color: 'bg-amber-50 text-amber-700 border-amber-200',
          icon: <Pin size={14} />,
          label: 'Viva'
        };
      case 'SIN_DATOS':
      default:
        return {
          color: 'bg-rose-50 text-rose-700 border-rose-200',
          icon: <HelpCircle size={14} />,
          label: 'Sin Datos'
        };
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in">
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center text-brand-600">
              <Briefcase size={24} />
            </div>
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Back-Office: Gestión de Liquidaciones</h2>
          </div>
          <p className="text-slate-500">Visualiza y gestiona las órdenes informadas para su liquidación final.</p>
        </div>
        <div className="flex items-center gap-4">
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
              className="pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm focus:ring-brand-500 focus:border-brand-500 bg-white shadow-sm"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
            {dateFilter && (
              <button 
                onClick={() => setDateFilter('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="relative mb-6">
        <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por Ticker, Nombre o Estado..."
          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {filteredOrders.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
            <Search size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-1">No hay órdenes informadas</h3>
          <p className="text-slate-500">Solo aparecerán aquí las órdenes que hayan sido procesadas en Post-Trade.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOrders.map(order => {
            const statusConfig = getStatusConfig(order.status);
            return (
              <div key={order.id} className={`bg-white p-5 rounded-xl border shadow-sm flex flex-col justify-between transition-all hover:shadow-md ${order.status === 'EJECUTADA' ? 'border-emerald-100' : 'border-amber-100'}`}>
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full border ${statusConfig.color} flex items-center gap-1.5 uppercase tracking-wide`}>
                      {statusConfig.icon} {statusConfig.label}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {order.processedAt ? new Date(order.processedAt).toLocaleDateString() : 'Pendiente'}
                    </span>
                  </div>
                  
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 truncate" title={order.fundName}>
                    {order.fundName || order.fundId}
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 leading-tight mb-1">{order.asset.name}</h3>
                  {order.asset.ticker && !order.asset.ticker.startsWith('POS-') && (
                    <div className="text-xs font-bold text-brand-600 mb-4 uppercase tracking-wider">{order.asset.ticker}</div>
                  )}
                  {(!order.asset.ticker || order.asset.ticker.startsWith('POS-')) && <div className="mb-4"></div>}
                  
                  <div className="bg-slate-50 rounded-lg p-3 mb-4 border border-slate-100">
                    <div className="flex justify-between items-center text-sm mb-1">
                      <span className={`font-bold ${order.side === 'buy' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {order.side === 'buy' ? 'COMPRA' : 'VENTA'}
                      </span>
                      <span className="font-mono font-bold text-slate-700">{order.quantity.toLocaleString()} tit.</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-500">
                      <span>Precio Subyacente:</span>
                      <span className="font-mono">{order.price.toFixed(2)} {order.currency}</span>
                    </div>
                  </div>

                  {/* Display Execution Data Summary if available */}
                  {order.executionData && (
                    <div className="mb-4 text-xs text-slate-500 space-y-1 bg-slate-50/50 p-2 rounded border border-slate-100">
                      <div className="flex justify-between">
                        <span>{order.operationType === 'Divisa' ? 'Depositario:' : 'Bróker:'}</span>
                        <span className="font-bold">{order.operationType === 'Divisa' ? order.executionData.depositary : order.executionData.broker}</span>
                      </div>
                      {order.operationType === 'Divisa' && order.executionData.valueDate && (
                        <div className="flex justify-between">
                          <span>Fecha Valor:</span>
                          <span className="font-bold">{new Date(order.executionData.valueDate).toLocaleDateString('es-ES')}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Tipo:</span>
                        <span>{order.executionData.orderType}</span>
                      </div>
                      {order.executionData.executionPrice && (
                        <div className="flex justify-between">
                          <span>Precio Ejec.:</span>
                          <span className="font-mono">{order.executionData.executionPrice}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {!readOnly && (
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => handleOpenModal(order)}
                    className="flex-1 bg-slate-800 text-white px-4 py-2.5 rounded-lg text-xs font-bold hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <PlusCircle size={14} />
                    EDITAR INFORMACIÓN
                  </button>
                  <button
                    onClick={() => onReturnToPreTrade(order.id)}
                    className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-brand-600 hover:border-brand-200 hover:bg-brand-50 transition-colors"
                    title="Devolver a Pre-Trade"
                  >
                    <RotateCcw size={16} />
                  </button>
                </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-end gap-4 mt-8 pb-8 border-t border-slate-200 pt-6">
        <button 
          onClick={generatePDF}
          className="px-6 py-2 rounded-lg font-bold text-brand-600 border-2 border-brand-600 hover:bg-brand-50 transition-colors flex items-center gap-2"
        >
          <FileText size={20} />
          Boleta en PDF
        </button>
        <button 
          onClick={generateXLSX}
          className="px-6 py-2 rounded-lg font-bold text-white bg-brand-600 hover:bg-brand-700 shadow-lg shadow-brand-200 flex items-center gap-2 transition-transform active:scale-95"
        >
          <FileSpreadsheet size={20} />
          Boleta en XLSX
        </button>
      </div>

      {/* MODAL */}
      {isModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Información de Ejecución</h3>
                <p className="text-xs text-slate-500">{selectedOrder.asset.name} ({selectedOrder.asset.ticker})</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              
              {/* Status Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Estado de la Operación</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setFormData({...formData, status: 'EJECUTADA'})}
                    className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 transition-all ${
                      formData.status === 'EJECUTADA' 
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                        : 'border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/50'
                    }`}
                  >
                    <CheckCircle size={18} />
                    <span className="font-bold">Ejecutada</span>
                  </button>
                  <button
                    onClick={() => setFormData({...formData, status: 'VIVA'})}
                    className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 transition-all ${
                      formData.status === 'VIVA' 
                        ? 'border-amber-500 bg-amber-50 text-amber-700' 
                        : 'border-slate-200 hover:border-amber-200 hover:bg-amber-50/50'
                    }`}
                  >
                    <Pin size={18} />
                    <span className="font-bold">Viva</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Order Type */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipología</label>
                  <select 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 bg-white"
                    value={formData.orderType}
                    onChange={e => setFormData({...formData, orderType: e.target.value as any})}
                  >
                    <option value="A mercado">A mercado</option>
                    <option value="Limitada">Limitada</option>
                    <option value="Al Average">Al Average</option>
                  </select>
                </div>

                  {/* Broker or Depositary */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    {selectedOrder.operationType === 'Divisa' ? 'Depositario' : 'Bróker'}
                  </label>
                  {selectedOrder.operationType === 'Divisa' ? (
                    <select 
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 bg-white"
                      value={formData.depositary}
                      onChange={e => setFormData({...formData, depositary: e.target.value as any})}
                    >
                      <option value="CACEIS">CACEIS</option>
                      <option value="BNP">BNP</option>
                      <option value="Bankinter">Bankinter</option>
                    </select>
                  ) : (
                    <select 
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 bg-white"
                      value={formData.broker}
                      onChange={e => setFormData({...formData, broker: e.target.value as any})}
                    >
                      <option value="GVC Gaesco">GVC Gaesco</option>
                      <option value="Renta 4">Renta 4</option>
                      <option value="Nomura">Nomura</option>
                      <option value="Bestinver">Bestinver</option>
                      <option value="Bankinter">Bankinter</option>
                    </select>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Call Time */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hora Llamada</label>
                  <div className="relative">
                    <Clock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="time" 
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500"
                      value={formData.callTime}
                      onChange={e => setFormData({...formData, callTime: e.target.value})}
                    />
                  </div>
                </div>

                {/* Execution Price - Show if Executed OR Limited */}
                {(formData.status === 'EJECUTADA' || formData.orderType === 'Limitada') && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Precio {formData.orderType === 'Limitada' ? 'Límite' : 'Ejecución'}</label>
                    <div className="relative">
                      <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="number" 
                        step="0.0001"
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500"
                        value={formData.executionPrice}
                        onChange={e => setFormData({...formData, executionPrice: e.target.value})}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Value Date for FX */}
              {selectedOrder.operationType === 'Divisa' && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha Valor</label>
                  <div className="relative">
                    <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="date" 
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500"
                      value={formData.valueDate}
                      onChange={e => setFormData({...formData, valueDate: e.target.value})}
                    />
                  </div>
                </div>
              )}

              {/* Validity Date - Show if Limited */}
              {formData.orderType === 'Limitada' && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Validez</label>
                  <div className="relative">
                    <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="date" 
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500"
                      value={formData.validityDate}
                      onChange={e => setFormData({...formData, validityDate: e.target.value})}
                    />
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Observaciones</label>
                <div className="relative">
                  <FileText size={16} className="absolute left-3 top-3 text-slate-400" />
                  <textarea 
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 min-h-[80px]"
                    placeholder="Notas adicionales..."
                    value={formData.notes}
                    onChange={e => setFormData({...formData, notes: e.target.value})}
                  />
                </div>
              </div>

            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-600 font-bold hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave}
                className="px-6 py-2 rounded-lg font-bold text-white bg-brand-600 hover:bg-brand-700 shadow-lg shadow-brand-200 flex items-center gap-2 transition-transform active:scale-95"
              >
                <Save size={18} />
                Guardar Información
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
