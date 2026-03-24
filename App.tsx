import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { FileDropZone } from './components/FileDropZone';
import { Dashboard } from './components/Dashboard';
import { OperationsDesk } from './components/OperationsDesk';
import { FundLimitEditor } from './components/FundLimitEditor';
import { MasterDataModal } from './components/MasterDataModal';
import { Login } from './components/Login';
import { UploadedFile, AppPhase, WorkspaceTab, Fund, User, Asset, PostTradeOrder, PreTradeOrder } from './types';
import { PostTrade } from './components/PostTrade';
import { PreTrade } from './components/PreTrade';
import { RefreshCw, XCircle, Sparkles, BrainCircuit, ShieldAlert, ShieldCheck, Database, FileSpreadsheet, Eye } from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { FUND_LIMITS, FundLimit } from './data/fundLimits';
import * as XLSX from 'xlsx';

const App: React.FC = () => {
  const [phase, setPhase] = useState<AppPhase>('login');
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('dashboard');
  const [preTradeOrders, setPreTradeOrders] = useState<PreTradeOrder[]>([]);
  const [postTradeOrders, setPostTradeOrders] = useState<PostTradeOrder[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // File State - GESTOR
  const [positionFile, setPositionFile] = useState<UploadedFile | null>(null);
  const [officialFile, setOfficialFile] = useState<UploadedFile | null>(null);

  // File State - CONTROL
  const [masterFile, setMasterFile] = useState<UploadedFile | null>(null);
  const [limitsFile, setLimitsFile] = useState<UploadedFile | null>(null);
  
  // Data State
  const [funds, setFunds] = useState<Fund[]>([]);
  const [selectedFundId, setSelectedFundId] = useState<string | null>(null);
  const [fundLimits, setFundLimits] = useState<FundLimit[]>(FUND_LIMITS);
  
  // Modal State
  const [showMasterModal, setShowMasterModal] = useState(false);
  
  // Validation & Processing State
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Helper to read Excel file
  const readExcelFile = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0]; // Assume first sheet
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(sheet);
          resolve(jsonData);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  // Helper to clean numeric values
  const parseNumeric = (val: any): number => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    if (typeof val === 'string') {
      let clean = val.replace(/[€$£\s]/g, '');
      if (clean.includes(',') && clean.includes('.')) {
        clean = clean.replace(/\./g, '').replace(',', '.');
      } else if (clean.includes(',')) {
        clean = clean.replace(',', '.');
      }
      return parseFloat(clean) || 0;
    }
    return 0;
  };

  // Helper to normalize typology
  const normalizeTypology = (val: any): string => {
    if (!val) return 'Otros';
    const s = String(val).toLowerCase();
    if (s.includes('variable') || s.includes('equity') || s.includes('rv') || s.includes('acciones')) return 'Renta Variable';
    if (s.includes('fija') || s.includes('fixed') || s.includes('rf') || s.includes('bono') || s.includes('letras')) return 'Renta Fija';
    if (s.includes('iic') || s.includes('fondo') || s.includes('etf')) return 'Participaciones IIC';
    if (s.includes('derivado') || s.includes('futuro') || s.includes('opcion')) return 'Derivados';
    if (s.includes('repo') || s.includes('garant')) return 'Garantías';
    if (s.includes('liqui') || s.includes('cash') || s.includes('tesor')) return 'Liquidez';
    return 'Otros';
  };

  // GENERIC FILE HANDLER
  const handleFileSelect = async (file: File, type: 'position' | 'official' | 'master' | 'limits') => {
    let setFile: React.Dispatch<React.SetStateAction<UploadedFile | null>>;
    
    switch(type) {
        case 'position': setFile = setPositionFile; break;
        case 'official': setFile = setOfficialFile; break;
        case 'master': setFile = setMasterFile; break;
        case 'limits': setFile = setLimitsFile; break;
        default: return;
    }

    setFile({
      name: file.name,
      size: `${(file.size / 1024).toFixed(2)} KB`,
      date: '...',
      status: 'loading'
    });

    try {
      const rawData = await readExcelFile(file);
      
      setTimeout(() => {
        setFile(prev => prev ? {
          ...prev,
          date: new Date().toISOString().split('T')[0], 
          status: 'success',
          rawContent: rawData
        } : null);
      }, 800);

    } catch (error) {
      console.error("Error reading file", error);
      setFile(prev => prev ? { ...prev, status: 'error' } : null);
      setValidationError("No se pudo leer el archivo Excel. Asegúrate de que es un formato válido (.xlsx, .csv)");
    }
  };

  // AI Analysis Function - Multi-Fund Aware (ONLY FOR GESTOR)
  const analyzeFilesWithGemini = async (posFile: UploadedFile, offFile: UploadedFile) => {
    setIsAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const posHeaders = posFile.rawContent && posFile.rawContent.length > 0 ? Object.keys(posFile.rawContent[0]) : [];
      const offHeaders = offFile.rawContent && offFile.rawContent.length > 0 ? Object.keys(offFile.rawContent[0]) : [];

      if (posHeaders.length === 0) throw new Error("El archivo de posiciones no contiene cabeceras válidas.");

      const prompt = `
        Actúa como un Experto en Datos Financieros.
        Tengo dos archivos Excel que contienen información de MULTIPLES FONDOS DE INVERSION.
        Necesito mapear las columnas para poder cruzar los datos usando el Código IIC (Identificador del Fondo).

        INPUT 1: HEADERS Archivo Posiciones (Detalle de Activos):
        ${JSON.stringify(posHeaders)}

        INPUT 2: HEADERS Archivo Datos Oficiales (Cabecera de Fondos):
        ${JSON.stringify(offHeaders)}

        TAREA:
        Identifica los nombres EXACTOS de las columnas en cada archivo para mapear los campos.

        1. "positionsMapping":
           - fundId: Columna que identifica a qué fondo pertenece la posición.
           - ticker: Símbolo del activo.
           - issuerCode: IMPORTANTE. Columna con el Código de Emisor (ej. 4210, 1030).
           - name: Nombre del activo.
           - isin: Código ISIN.
           - quantity: Cantidad/Títulos.
           - lastPrice: Precio.
           - marketValue: Valor de Mercado / Riesgo EUR.
           - currency: Divisa.
           - exchangeRate: Tipo de Cambio.
           - typology: Tipo de Activo.
           - derivativeType: Tipo de Derivado (ej. DIV, IRV, EQ).

        2. "officialMapping":
           - fundId: Columna con el ID del fondo.
           - name: Nombre del fondo.
           - aum: Patrimonio Total.
           - cash: Liquidez / Tesorería.
           - equityExposure: Exposición Renta Variable / % RV (Dato directo, NO suma de posiciones).
           - valuationDate: Fecha de valoración.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              positionsMapping: {
                type: Type.OBJECT,
                properties: {
                  fundId: { type: Type.STRING },
                  ticker: { type: Type.STRING },
                  issuerCode: { type: Type.STRING, description: "Columna del Código numérico del Emisor" },
                  name: { type: Type.STRING },
                  isin: { type: Type.STRING },
                  quantity: { type: Type.STRING },
                  lastPrice: { type: Type.STRING },
                  marketValue: { type: Type.STRING },
                  currency: { type: Type.STRING },
                  exchangeRate: { type: Type.STRING },
                  typology: { type: Type.STRING },
                  derivativeType: { type: Type.STRING, description: "Columna Tipo Derivado (DIV, IRV...)" },
                },
                required: ["fundId", "ticker", "marketValue"]
              },
              officialMapping: {
                type: Type.OBJECT,
                properties: {
                  fundId: { type: Type.STRING },
                  name: { type: Type.STRING },
                  aum: { type: Type.STRING },
                  cash: { type: Type.STRING },
                  equityExposure: { type: Type.STRING, description: "Columna con el % o valor de Exposición a Renta Variable" },
                  valuationDate: { type: Type.STRING },
                },
                required: ["fundId", "name", "aum", "cash"]
              }
            }
          }
        }
      });

      const text = response.text;
      if (!text) throw new Error("No response text");
      
      const config = JSON.parse(text);

      if (posFile.rawContent && offFile.rawContent) {
        const fundsMap = new Map<string, Fund>();
        const pm = config.positionsMapping;
        const om = config.officialMapping;

        const isValidRowId = (id: any): boolean => {
           if (!id) return false;
           const s = String(id).trim().toLowerCase();
           if (s === 'undefined' || s === 'null' || s === '') return false;
           if (s.includes('filtros') || s.includes('valoracion') || s.includes('total') || s.startsWith('nuevo_')) return false;
           return true;
        };

        // 1. Initialize Funds from Official File
        offFile.rawContent.forEach((row: any) => {
           const rawId = row[om.fundId];
           if (isValidRowId(rawId)) {
             const fId = String(rawId).trim();
             
             // Parse Equity Exposure (can be % or absolute, heuristic check)
             let eqAlloc = parseNumeric(row[om.equityExposure]);
             // If it's small (e.g. 0.85), it's likely a decimal percentage -> convert to 85
             // If it's large (e.g. 85), it's likely a percentage
             // If it's huge (e.g. 1000000), it's likely absolute value -> convert to % of AUM
             const aum = parseNumeric(row[om.aum]);
             
             if (eqAlloc > 100 && aum > 0) {
                eqAlloc = (eqAlloc / aum) * 100;
             } else if (eqAlloc <= 1 && eqAlloc > 0) {
                eqAlloc = eqAlloc * 100;
             }

             fundsMap.set(fId, {
               id: fId,
               name: row[om.name] || `Fondo ${fId}`,
               ticker: row[om.name] ? String(row[om.name]).substring(0,6).toUpperCase() : fId,
               aum: aum,
               cash: parseNumeric(row[om.cash]),
               currency: 'EUR', 
               valuationDate: row[om.valuationDate],
               equityAllocation: eqAlloc, // Set directly from file
               liquidity: 0,
               positions: []
             });
           }
        });

        // 2. Process Positions
        posFile.rawContent.forEach((row: any, index: number) => {
          const rawId = row[pm.fundId];
          if (isValidRowId(rawId)) {
            const fId = String(rawId).trim();
            if (!fundsMap.has(fId)) {
               fundsMap.set(fId, {
                 id: fId,
                 name: `Fondo Desconocido (${fId})`,
                 ticker: `UNK-${fId}`,
                 aum: 0, cash: 0, currency: 'EUR', equityAllocation: 0, liquidity: 0, positions: []
               });
            }
            const fund = fundsMap.get(fId)!;
            const mVal = parseNumeric(row[pm.marketValue]);
            // Extract Issuer Code securely
            const issuerCode = row[pm.issuerCode] ? String(row[pm.issuerCode]).trim() : '';
            const ticker = row[pm.ticker] ? String(row[pm.ticker]).trim() : `POS-${index}`;

            if (mVal !== 0) {
              fund.positions.push({
                ticker: ticker,
                name: row[pm.name] ? String(row[pm.name]).trim() : 'Sin Nombre',
                isin: row[pm.isin] ? String(row[pm.isin]).trim() : '',
                quantity: parseNumeric(row[pm.quantity]),
                lastPrice: parseNumeric(row[pm.lastPrice]),
                marketValue: mVal,
                currency: row[pm.currency] ? String(row[pm.currency]).trim() : 'EUR',
                exchangeRate: parseNumeric(row[pm.exchangeRate]) || 1,
                typology: normalizeTypology(row[pm.typology]),
                derivativeType: row[pm.derivativeType] ? String(row[pm.derivativeType]).trim().toUpperCase() : undefined,
                // Priority: Excel Issuer Column > Ticker
                issuerTicker: issuerCode || ticker, 
              });
            }
          }
        });

        // 3. Final Calculations
        const processedFunds = Array.from(fundsMap.values()).map(fund => {
          let totalPositionsVal = fund.positions.reduce((sum, p) => sum + p.marketValue, 0);
          if (fund.aum === 0) {
             fund.aum = totalPositionsVal + fund.cash;
          }
          // REMOVED: Recalculation of equityAllocation from positions
          // const equityValue = fund.positions
          //   .filter(p => p.typology === 'Renta Variable')
          //   .reduce((sum, p) => sum + p.marketValue, 0);
          // fund.equityAllocation = fund.aum > 0 ? (equityValue / fund.aum) * 100 : 0;
          
          fund.liquidity = fund.aum > 0 ? (fund.cash / fund.aum) * 100 : 0;
          return fund;
        });

        setFunds(processedFunds);
        if (processedFunds.length > 0) {
           setSelectedFundId(processedFunds[0].id);
        }
        setPhase('workspace');
      } else {
        throw new Error("Archivos sin contenido válido");
      }
    } catch (error) {
      console.error("Analysis failed", error);
      setValidationError("Error procesando archivos de Gestor.");
    } finally {
      setIsAnalyzing(false);
      setIsProcessing(false);
    }
  };

  // GESTOR TRIGGER EFFECT
  useEffect(() => {
    if (currentUser?.rol === 'Gestor' && positionFile?.status === 'success' && officialFile?.status === 'success') {
      setIsProcessing(true);
      setValidationError(null);
      setTimeout(() => {
        analyzeFilesWithGemini(positionFile, officialFile);
      }, 500);
    } 
  }, [positionFile, officialFile, currentUser]);

  // CONTROL TRIGGER EFFECT (Simplified for now)
  useEffect(() => {
    if (currentUser?.rol === 'Control' && masterFile?.status === 'success' && limitsFile?.status === 'success') {
      setIsProcessing(true);
      setValidationError(null);
      // For now, just simulate a transition to workspace for Control
      // In real implementation, this would process Compliance data
      setTimeout(() => {
        setPhase('workspace');
      }, 1500);
    }
  }, [masterFile, limitsFile, currentUser]);


  const handleReset = () => {
    setPositionFile(null);
    setOfficialFile(null);
    setMasterFile(null);
    setLimitsFile(null);
    setValidationError(null);
    setPhase('upload');
    setFunds([]);
    setSelectedFundId(null);
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setPhase('upload');
  };

  const handleSendOrder = (order: PreTradeOrder) => {
    // 1. Add to Post-Trade if not already there
    setPostTradeOrders(prev => {
      if (prev.some(o => o.id === order.id)) return prev;
      const postTradeOrder: PostTradeOrder = {
        ...order,
        status: 'SIN_DATOS',
        processedBy: currentUser?.name || 'Gestor',
        processedAt: new Date().toISOString()
      };
      return [...prev, postTradeOrder];
    });

    // 2. Update status in Pre-Trade
    setPreTradeOrders(prev => prev.map(o => 
      o.id === order.id ? { ...o, preTradeStatus: 'sent' } : o
    ));
  };

  const handleConfirmAndGenerate = (orders: PreTradeOrder[]) => {
    // 1. Add to Post-Trade
    setPostTradeOrders(prev => {
      const newOrders = orders
        .filter(o => !prev.some(p => p.id === o.id))
        .map(order => ({
          ...order,
          status: 'SIN_DATOS' as const,
          processedBy: currentUser?.name || 'Gestor',
          processedAt: new Date().toISOString()
        }));
      return [...prev, ...newOrders];
    });

    // 2. Update status in Pre-Trade
    setPreTradeOrders(prev => prev.map(o => ({ ...o, preTradeStatus: 'sent' })));
    
    setActiveTab('post-trade'); // Switch to post-trade tab after confirmation
  };

  const handleReturnToPreTrade = (orderId: string) => {
    // 1. Remove from Post-Trade
    setPostTradeOrders(prev => prev.filter(o => o.id !== orderId));
    
    // 2. Update status in Pre-Trade
    setPreTradeOrders(prev => prev.map(o => 
      o.id === orderId ? { ...o, preTradeStatus: 'pending' } : o
    ));
  };

  const activeFund = useMemo(() => 
    funds.find(f => f.id === selectedFundId) || null
  , [funds, selectedFundId]);

  if (phase === 'login') {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen flex flex-col font-sans text-slate-600 bg-slate-50/50">
      <Header 
        showNavigation={phase === 'workspace'}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        user={currentUser}
      />

      <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        
        {/* LOADING STATE - Generic for both roles */}
        {isAnalyzing && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white p-8 rounded-2xl shadow-2xl border border-brand-100 max-w-sm w-full text-center relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-300 via-brand-500 to-brand-300 animate-pulse"></div>
               <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-6 text-brand-600 animate-bounce">
                 <Sparkles size={32} />
               </div>
               <h3 className="text-xl font-bold text-slate-900 mb-2">Procesando Información</h3>
               <p className="text-slate-500 text-sm mb-6">
                 {currentUser?.rol === 'Gestor' ? 'Calculando NAVs y posiciones...' : 'Verificando reglas de cumplimiento...'}
               </p>
               <div className="flex justify-center gap-2">
                 <div className="w-2 h-2 bg-brand-400 rounded-full animate-ping"></div>
                 <div className="w-2 h-2 bg-brand-400 rounded-full animate-ping delay-75"></div>
                 <div className="w-2 h-2 bg-brand-400 rounded-full animate-ping delay-150"></div>
               </div>
            </div>
          </div>
        )}

        {phase === 'upload' && !isAnalyzing && (
          <div className="animate-in fade-in zoom-in-95 duration-500 max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Buenos días {currentUser?.name}</h2>
              <p className="mt-3 text-lg text-slate-500 max-w-2xl mx-auto">
                {currentUser?.rol === 'Control' 
                  ? 'Panel de Cumplimiento Normativo. Carga los ficheros de control.'
                  : 'Para iniciar sesión diaria, por favor sube los ficheros de cartera.'
                }
              </p>
            </div>

            {validationError && (
              <div className="mb-8 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-md shadow-sm flex items-start gap-3">
                <XCircle className="text-red-500 mt-0.5 flex-shrink-0" />
                <div className="flex-grow">
                  <h3 className="text-sm font-bold text-red-800 uppercase tracking-wide">Validación Fallida</h3>
                  <p className="text-sm text-red-700 mt-1">{validationError}</p>
                </div>
                <button 
                  onClick={handleReset}
                  className="text-sm font-medium text-red-700 underline hover:text-red-900"
                >
                  Reiniciar
                </button>
              </div>
            )}

            {/* --- GESTOR UPLOAD VIEW --- */}
            {currentUser?.rol === 'Gestor' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
                <div className="hidden md:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 bg-white p-2 rounded-full shadow-sm border border-slate-200 text-slate-300">
                  <RefreshCw size={20} className={isProcessing ? "animate-spin text-brand-500" : ""} />
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Fichero Datos Carteras</span>
                  <FileDropZone 
                    id="upload-off"
                    title="Cargar Datos Oficiales"
                    description="Sube el fichero Excel (.xlsx) de Datos (con AUM y columna IIC)"
                    requiredColumns={[]}
                    file={officialFile}
                    onFileSelect={(f) => handleFileSelect(f, 'official')}
                    onRemove={() => setOfficialFile(null)}
                    disabled={isProcessing}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Fichero Cartera de Inversiones</span>
                  <FileDropZone 
                    id="upload-pos"
                    title="Cargar Posiciones"
                    description="Sube el fichero Excel (.xlsx) de Cartera (con columna IIC)"
                    requiredColumns={[]}
                    file={positionFile}
                    onFileSelect={(f) => handleFileSelect(f, 'position')}
                    onRemove={() => setPositionFile(null)}
                    disabled={isProcessing}
                  />
                </div>
              </div>
            )}

            {/* --- CONTROL UPLOAD VIEW --- */}
            {currentUser?.rol === 'Control' && (
              <div className="space-y-8">
                
                {/* Header Actions */}
                <div className="flex justify-end mb-2">
                   <button
                     onClick={() => setShowMasterModal(true)}
                     className="bg-white border border-brand-200 text-brand-700 hover:bg-brand-50 hover:border-brand-300 px-4 py-2 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 transition-all"
                   >
                     <Eye size={16} /> Ver Maestro Actual
                   </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
                  <div className="hidden md:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 bg-white p-2 rounded-full shadow-sm border border-slate-200 text-slate-300">
                    <ShieldAlert size={20} className={isProcessing ? "animate-pulse text-brand-500" : ""} />
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Base de Datos de Activos</span>
                    <FileDropZone 
                      id="upload-master"
                      title="Maestro de Instrumentos"
                      description="Sube el fichero Excel con características de activos (ISIN, Divisa, Rating...)"
                      requiredColumns={[]}
                      file={masterFile}
                      onFileSelect={(f) => handleFileSelect(f, 'master')}
                      onRemove={() => setMasterFile(null)}
                      disabled={isProcessing}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Parámetros de Riesgo</span>
                    <FileDropZone 
                      id="upload-limits"
                      title="Incumplimientos y Límites"
                      description="Sube el fichero Excel de definición de límites regulatorios e internos"
                      requiredColumns={[]}
                      file={limitsFile}
                      onFileSelect={(f) => handleFileSelect(f, 'limits')}
                      onRemove={() => setLimitsFile(null)}
                      disabled={isProcessing}
                    />
                  </div>
                </div>

                {/* Fund Limit Editor Section */}
                <FundLimitEditor 
                  limits={fundLimits} 
                  onSave={(newLimits) => setFundLimits(newLimits)} 
                />
              </div>
            )}
            
            <div className="mt-12 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-xs font-medium border border-blue-100">
                <BrainCircuit size={14} />
                <span>Powered by Gemini 3 Flash & SheetJS</span>
              </div>
            </div>
          </div>
        )}

        {/* --- WORKSPACE RENDER LOGIC --- */}
        {phase === 'workspace' && currentUser?.rol === 'Gestor' && (
           <>
             {activeTab === 'dashboard' && (
                <Dashboard 
                  reconciliationDate={positionFile?.date || "2026-02-10"} 
                  funds={funds}
                  selectedFundId={selectedFundId}
                  onFundChange={setSelectedFundId}
                />
             )}
             {activeTab === 'operations' && activeFund && (
                <OperationsDesk 
                  fund={activeFund} 
                  fundLimits={fundLimits} // Pass dynamic limits
                  currentUser={currentUser}
                   onConfirmAndGenerate={handleConfirmAndGenerate}
                   preTradeOrders={preTradeOrders}
                   setPreTradeOrders={setPreTradeOrders}
                />
             )}
              {activeTab === 'pre-trade' && activeFund && (
                 <PreTrade 
                   fund={activeFund}
                   fundLimits={fundLimits}
                   currentUser={currentUser}
                   orders={preTradeOrders}
                   setOrders={setPreTradeOrders}
                   onConfirmAndGenerate={handleConfirmAndGenerate}
                   onSendOrder={handleSendOrder}
                   onBack={() => setActiveTab('operations')}
                 />
              )}
              {activeTab === 'post-trade' && (
                 <PostTrade 
                   orders={postTradeOrders} 
                   setOrders={setPostTradeOrders}
                   onReturnToPreTrade={handleReturnToPreTrade}
                   currentUser={currentUser}
                 />
              )}
           </>
        )}

        {phase === 'workspace' && currentUser?.rol === 'Control' && (
          <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
               <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                 <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                   <ShieldCheck size={24} />
                 </div>
                 <div>
                   <h3 className="text-lg font-bold text-slate-800">Estado Normativo</h3>
                   <p className="text-sm text-green-600 font-medium">100% Validado</p>
                 </div>
               </div>
               
               <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                 <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                   <FileSpreadsheet size={24} />
                 </div>
                 <div>
                   <h3 className="text-lg font-bold text-slate-800">Ficheros Cargados</h3>
                   <p className="text-sm text-slate-500">2 Archivos hoy</p>
                 </div>
               </div>

               <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer border-brand-200 bg-brand-50/30"
                    onClick={() => setShowMasterModal(true)}>
                 <div className="w-12 h-12 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center">
                   <Database size={24} />
                 </div>
                 <div>
                   <h3 className="text-lg font-bold text-slate-800">Maestro Activos</h3>
                   <p className="text-sm text-brand-700 font-medium">Ver Base de Datos &rarr;</p>
                 </div>
               </div>
             </div>

             <div className="bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
               <div className="max-w-md mx-auto">
                 <h3 className="text-xl font-bold text-slate-400 mb-2">Panel de Control en Construcción</h3>
                 <p className="text-slate-400">
                   Las funcionalidades de compliance automatizado y generación de informes regulatorios estarán disponibles próximamente.
                 </p>
               </div>
             </div>
          </div>
        )}

      </main>

      {/* --- MODALS --- */}
      {showMasterModal && (
        <MasterDataModal onClose={() => setShowMasterModal(false)} />
      )}
    </div>
  );
};

export default App;