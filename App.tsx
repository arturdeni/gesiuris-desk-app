import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { OperationsDesk } from './components/OperationsDesk';
import { MasterDataModal } from './components/MasterDataModal';
import { Login } from './components/Login';
import { UploadedFile, AppPhase, WorkspaceTab, Fund, User, Asset, PostTradeOrder, PreTradeOrder, LiquidityAdjustment, Boleta } from './types';
import { UploadModal } from './components/UploadModal';
import { PostTrade } from './components/PostTrade';
import { PreTrade } from './components/PreTrade';
import { TradingAssistant } from './components/TradingAssistant';
import { BackOffice } from './components/BackOffice';
import { Compliance } from './components/Compliance';
import { ControlDashboard } from './components/ControlDashboard';
import { FUND_LIMITS, FundLimit } from './data/fundLimits';
import * as XLSX from 'xlsx';
import { supabase } from './lib/supabase';
import { mapExcelColumns } from './lib/excelMapper';
import {
  getUserProfile,
  getPreTradeOrders,
  getPostTradeOrders,
  getLiquidityAdjustments,
  insertPreTradeOrder,
  deletePreTradeOrder,
  insertPostTradeOrder,
  updatePostTradeOrder,
  deletePostTradeOrder,
  insertBoleta,
  insertLiquidityAdjustment,
  rowToPreTradeOrder,
  rowToPostTradeOrder,
  getFundData,
  getHoldingsByFund,
  upsertFundData,
  upsertHoldings,
  deleteFundDataByDate,
  deleteHoldingsByDate,
  getGestorFunds,
  type FundDataRow,
  type HoldingRow,
} from './lib/api';

const App: React.FC = () => {
  const [phase, setPhase] = useState<AppPhase>('login');
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('dashboard');
  const [preTradeOrders, setPreTradeOrders] = useState<PreTradeOrder[]>([]);
  const [postTradeOrders, setPostTradeOrders] = useState<PostTradeOrder[]>([]);
  const [pendingOrders, setPendingOrders] = useState<PreTradeOrder[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  // Evita el flash de pantalla de Login mientras se verifica el JWT existente
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  // Referencia al canal Realtime activo (para poder cancelarlo en logout/unmount)
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  
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
  const [liquidityAdjustments, setLiquidityAdjustments] = useState<LiquidityAdjustment[]>([]);
  const [boletas, setBoletas] = useState<Boleta[]>([]);
  
  // Modal State
  const [showMasterModal, setShowMasterModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showTradingAssistant, setShowTradingAssistant] = useState(false);
  
  // Validation & Processing State
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // AUTH: Comprobar sesión existente al cargar la página
  useEffect(() => {
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        if (session) {
          await fetchUserProfile(session.user.id);
        } else {
          setIsAuthLoading(false);
          setPhase('login');
        }
      })
      .catch(() => {
        setIsAuthLoading(false);
        setPhase('login');
      });

    // Listener SOLO para invalidación de sesión externa (token revocado server-side)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        if (realtimeChannelRef.current) {
          supabase.removeChannel(realtimeChannelRef.current);
          realtimeChannelRef.current = null;
        }
        setCurrentUser(null);
        setPhase('login');
        setIsAuthLoading(false);
        setFunds([]);
        setPreTradeOrders([]);
        setPostTradeOrders([]);
        setPendingOrders([]);
        setBoletas([]);
        setLiquidityAdjustments([]);
        setPositionFile(null);
        setOfficialFile(null);
        setMasterFile(null);
        setLimitsFile(null);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }
    };
  }, []);

  // Fase 4: Suscripción Realtime a cambios en pre_trade_orders y post_trade_orders.
  // Usa optimistic-update dedup: los INSERTs propios (ya en state) se ignoran silenciosamente.
  const subscribeToRealtime = () => {
    if (realtimeChannelRef.current) return; // ya suscrito, no duplicar

    realtimeChannelRef.current = supabase
      .channel('app-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pre_trade_orders' },
        (payload) => {
          const { eventType } = payload;
          if (eventType === 'INSERT') {
            const order = rowToPreTradeOrder(payload.new as Record<string, unknown>);
            setPreTradeOrders(prev => prev.some(o => o.id === order.id) ? prev : [...prev, order]);
          } else if (eventType === 'UPDATE') {
            const order = rowToPreTradeOrder(payload.new as Record<string, unknown>);
            setPreTradeOrders(prev => prev.map(o => o.id === order.id ? order : o));
          } else if (eventType === 'DELETE') {
            const deletedId = (payload.old as Record<string, unknown>).id as string;
            setPreTradeOrders(prev => prev.filter(o => o.id !== deletedId));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_trade_orders' },
        (payload) => {
          const { eventType } = payload;
          if (eventType === 'INSERT') {
            const order = rowToPostTradeOrder(payload.new as Record<string, unknown>);
            setPostTradeOrders(prev => prev.some(o => o.id === order.id) ? prev : [...prev, order]);
          } else if (eventType === 'UPDATE') {
            const order = rowToPostTradeOrder(payload.new as Record<string, unknown>);
            setPostTradeOrders(prev => prev.map(o => o.id === order.id ? order : o));
          } else if (eventType === 'DELETE') {
            const deletedId = (payload.old as Record<string, unknown>).id as string;
            setPostTradeOrders(prev => prev.filter(o => o.id !== deletedId));
          }
        }
      )
      .subscribe();
  };

  // Cargar perfil del usuario desde la tabla `profiles` de Supabase
  const fetchUserProfile = async (userId: string) => {
    try {
      const profile = await getUserProfile(userId);

      if (!profile) {
        console.error('Perfil no encontrado para usuario:', userId);
        setPhase('login');
        setIsAuthLoading(false);
        return;
      }

      setCurrentUser(profile);
      // Restaurar preferencias de UI desde localStorage
      const savedTab = localStorage.getItem('gd_activeTab') as WorkspaceTab | null;
      if (savedTab) {
        setActiveTab(savedTab);
      } else if (profile.rol === 'Compliance') {
        setActiveTab('control-dashboard');
      } else if (profile.rol === 'Backoffice') {
        setActiveTab('back-office');
      }
      
      const savedFundId = localStorage.getItem('gd_selectedFundId');
      if (savedFundId) setSelectedFundId(savedFundId);
      setPhase('workspace');
      // Solo Master y Compliance abren modal de upload tras login
      // Gestor y Backoffice entran directo al workspace (cargan fondos desde DB)
      if (profile.rol === 'Master' || profile.rol === 'Compliance') {
        setShowUploadModal(true);
      }
      setIsAuthLoading(false);

      // Cargar datos en background (no bloquea la pantalla)
      try {
        const [preOrders, postOrders, adjustments] = await Promise.all([
          getPreTradeOrders(),
          getPostTradeOrders(),
          getLiquidityAdjustments(),
        ]);
        setPreTradeOrders(preOrders);
        setPostTradeOrders(postOrders);
        setLiquidityAdjustments(adjustments);

        // T-2.5: Cargar fondos desde DB (para todos los roles)
        await loadFundsFromDb(profile);
      } catch (e) {
        console.error('Error cargando datos iniciales:', e);
      }

      subscribeToRealtime();
    } catch (err) {
      console.error('fetchUserProfile failed:', err);
      setPhase('login');
      setIsAuthLoading(false);
    }
  };

  // Persistir solo preferencias de UI (no datos sensibles)
  useEffect(() => {
    localStorage.setItem('gd_activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (selectedFundId) localStorage.setItem('gd_selectedFundId', selectedFundId);
  }, [selectedFundId]);

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

  // Helper to normalize percentage values (handles 0.85 -> 85 and absolute -> %)
  const normalizePercentage = (val: number, aum: number): number => {
    if (aum <= 0) return val;
    
    // If it's huge (e.g. 1000000), it's likely an absolute value -> convert to % of AUM
    if (val > 500 || (val > 100 && val > aum * 0.001)) {
      return (val / aum) * 100;
    } 
    
    // If it's small (e.g. 1.2), it's likely a decimal percentage (120%) -> convert to 120
    // We use 10 as threshold to allow for high leverage but avoid confusing 10% with 1000%
    if (val <= 10 && val > 0) {
      return val * 100;
    }
    
    return val;
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

  // Analysis Function - Multi-Fund Aware (mapper determinístico local)
  const analyzeFilesWithGemini = async (posFile: UploadedFile, offFile: UploadedFile) => {
    try {
      const posHeaders = posFile.rawContent && posFile.rawContent.length > 0 ? Object.keys(posFile.rawContent[0]) : [];
      const offHeaders = offFile.rawContent && offFile.rawContent.length > 0 ? Object.keys(offFile.rawContent[0]) : [];

      if (posHeaders.length === 0) throw new Error("El archivo de posiciones no contiene cabeceras válidas.");

      // Mapper determinístico local — sin llamada a Edge Function
      const config = mapExcelColumns(posHeaders, offHeaders);

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

        const getRowValue = (row: any, key: string) => {
          if (!key) return undefined;
          if (row[key] !== undefined) return row[key];
          const normalizedKey = key.trim().toLowerCase();
          const actualKey = Object.keys(row).find(k => k.trim().toLowerCase() === normalizedKey);
          return actualKey ? row[actualKey] : undefined;
        };

        // 1. Initialize Funds from Official File
        offFile.rawContent.forEach((row: any) => {
           const rawId = row[om.fundId];
           if (isValidRowId(rawId)) {
             const fId = String(rawId).trim();
             const aum = parseNumeric(row[om.aum]);
             
             fundsMap.set(fId, {
               id: fId,
               name: row[om.name] || `Fondo ${fId}`,
               ticker: row[om.name] ? String(row[om.name]).substring(0,6).toUpperCase() : fId,
               aum: aum,
               cash: parseNumeric(row[om.cash]),
               currency: 'EUR', 
               valuationDate: row[om.valuationDate],
               equityAllocation: normalizePercentage(parseNumeric(row[om.equityExposure]), aum),
               derivativeCommitment: normalizePercentage(parseNumeric(row[om.derivativeCommitment]), aum),
               liquidity: 0,
               positions: []
             });
           }
        });

        // 2. Process Positions
        posFile.rawContent.forEach((row: any, index: number) => {
          const rawId = getRowValue(row, pm.fundId);
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
            const mVal = parseNumeric(getRowValue(row, pm.marketValue));
            // Extract Issuer Code securely
            const issuerCode = (getRowValue(row, pm.issuerCode) || getRowValue(row, 'Código Emisora') || getRowValue(row, 'Cod. Emisor')) 
              ? String(getRowValue(row, pm.issuerCode) || getRowValue(row, 'Código Emisora') || getRowValue(row, 'Cod. Emisor')).trim() 
              : '';
            const tickerVal = (getRowValue(row, pm.ticker) || getRowValue(row, 'Ticker Instrumento') || getRowValue(row, 'Ticker Instru') || getRowValue(row, 'Ticker')) 
              ? String(getRowValue(row, pm.ticker) || getRowValue(row, 'Ticker Instrumento') || getRowValue(row, 'Ticker Instru') || getRowValue(row, 'Ticker')).trim() 
              : `POS-${index}`;

            if (mVal !== 0) {
              let assetName = (getRowValue(row, pm.name) || getRowValue(row, 'Nombre Activo') || getRowValue(row, 'Nombre') || getRowValue(row, 'Descripción'))
                ? String(getRowValue(row, pm.name) || getRowValue(row, 'Nombre Activo') || getRowValue(row, 'Nombre') || getRowValue(row, 'Descripción')).trim()
                : 'Sin Nombre';

              const typologyVal = normalizeTypology(getRowValue(row, pm.typology));
              // FIX: For Currency/Liquidity assets, use the Currency column as name
              if (typologyVal === 'Liquidez' || String(getRowValue(row, pm.typology)).toLowerCase().includes('divisa')) {
                 const currencyVal = getRowValue(row, pm.currency);
                 if (currencyVal) {
                    assetName = String(currencyVal).trim();
                 }
              }

              fund.positions.push({
                ticker: tickerVal,
                name: assetName,
                isin: getRowValue(row, pm.isin) ? String(getRowValue(row, pm.isin)).trim() : '',
                quantity: parseNumeric(getRowValue(row, pm.quantity)),
                lastPrice: parseNumeric(getRowValue(row, pm.lastPrice)),
                marketValue: mVal,
                currency: getRowValue(row, pm.currency) ? String(getRowValue(row, pm.currency)).trim() : 'EUR',
                exchangeRate: parseNumeric(getRowValue(row, pm.exchangeRate)) || 1,
                typology: typologyVal,
                derivativeType: (getRowValue(row, pm.derivativeType) || getRowValue(row, 'Tipo Der')) 
                  ? String(getRowValue(row, pm.derivativeType) || getRowValue(row, 'Tipo Der')).trim().toUpperCase() 
                  : undefined,
                multiplier: parseNumeric(getRowValue(row, pm.multiplier) || getRowValue(row, 'Multi')),
                rating: getRowValue(row, pm.rating) ? String(getRowValue(row, pm.rating)).trim() : 'NR',
                nominal: parseNumeric(getRowValue(row, pm.nominal) || getRowValue(row, 'Nominal')),
                // Priority: Excel Issuer Column > Ticker
                issuerTicker: issuerCode || tickerVal, 
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
        setShowUploadModal(false);

        // T-2.4: Persistir fondos y holdings en DB (background, no bloquea UI)
        persistFundsToDb(processedFunds).catch(e =>
          console.error('persistFundsToDb:', e)
        );
      } else {
        throw new Error("Archivos sin contenido válido");
      }
    } catch (error) {
      console.error("Analysis failed", error);
      setValidationError("Error procesando archivos de Gestor.");
    } finally {
      setIsProcessing(false);
    }
  };

  /** T-2.4: Convierte Fund[] del frontend a FundDataRow[] + HoldingRow[] y hace upsert en DB */
  const persistFundsToDb = async (fundsToSave: Fund[]) => {
    const today = new Date().toISOString().split('T')[0];

    // 1. Upsert fund_data
    const fundRows: FundDataRow[] = fundsToSave.map(f => ({
      iic: f.id,
      name: f.name,
      aum: f.aum,
      equity_exp: f.equityAllocation,
      derivatives_exp: f.derivativeCommitment ?? 0,
      date: today,
    }));
    await upsertFundData(fundRows);

    // 2. Para cada fondo, borrar holdings anteriores y subir los nuevos
    for (const fund of fundsToSave) {
      // Borrar holdings anteriores de este fondo (resubida completa)
      await deleteHoldingsByDate(today).catch(() => {}); // Ignorar si no hay nada que borrar

      if (fund.positions.length === 0) continue;

      const holdingRows: HoldingRow[] = fund.positions.map(pos => ({
        type: pos.typology ?? null,
        ticker: pos.ticker ?? null,
        issuer_code: pos.issuerTicker ?? null,
        name: pos.name,
        currency: pos.currency,
        exch_rate: pos.exchangeRate ?? null,
        quantity: pos.quantity,
        last_px: pos.lastPrice,
        exposure: pos.marketValue,
        weight_pct: pos.weight ?? 0,
        iic: fund.id,
        der_type: pos.derivativeType ?? null,
        multiplier: pos.multiplier ?? null,
        date: today,
      }));
      await upsertHoldings(holdingRows);
    }

    console.log(`Persistidos ${fundRows.length} fondos y sus holdings en DB`);
  };

  /** T-2.5: Carga fondos + holdings desde DB y los convierte a Fund[] para el state */
  const loadFundsFromDb = async (profile: User) => {
    try {
      let fundDataRows = await getFundData();
      if (fundDataRows.length === 0) return; // No hay fondos en DB aún

      // Si es Gestor, filtrar solo los fondos asignados
      if (profile.rol === 'Gestor') {
        const assignedIics = await getGestorFunds(profile.id);
        if (assignedIics.length > 0) {
          fundDataRows = fundDataRows.filter(f => assignedIics.includes(f.iic));
        }
        // Si no tiene fondos asignados, no mostrar nada
        if (fundDataRows.length === 0) return;
      }

      // Cargar holdings para cada fondo
      const loadedFunds: Fund[] = await Promise.all(
        fundDataRows.map(async (fd) => {
          const holdings = await getHoldingsByFund(fd.iic);
          const positions: Asset[] = holdings.map(h => ({
            ticker: h.ticker ?? '',
            name: h.name,
            isin: '',
            lastPrice: h.last_px,
            currency: h.currency,
            quantity: h.quantity,
            marketValue: h.exposure,
            weight: h.weight_pct,
            issuerTicker: h.issuer_code ?? undefined,
            typology: h.type ?? undefined,
            derivativeType: h.der_type ?? undefined,
            exchangeRate: h.exch_rate ?? undefined,
            multiplier: h.multiplier ?? undefined,
          }));

          const totalCash = positions
            .filter(p => p.typology === 'Liquidez')
            .reduce((sum, p) => sum + p.marketValue, 0);

          return {
            id: fd.iic,
            name: fd.name,
            ticker: fd.name.substring(0, 6).toUpperCase(),
            aum: fd.aum,
            currency: 'EUR',
            equityAllocation: fd.equity_exp,
            derivativeCommitment: fd.derivatives_exp,
            liquidity: fd.aum > 0 ? (totalCash / fd.aum) * 100 : 0,
            cash: totalCash,
            valuationDate: fd.date,
            positions,
          } as Fund;
        })
      );

      // Solo setear fondos si no se han cargado ya (ej. por upload del Master)
      setFunds(prev => prev.length > 0 ? prev : loadedFunds);
      if (loadedFunds.length > 0) {
        setSelectedFundId(prev => prev ?? loadedFunds[0].id);
      }

      console.log(`Cargados ${loadedFunds.length} fondos desde DB`);
    } catch (e) {
      console.error('loadFundsFromDb:', e);
    }
  };

  // MASTER TRIGGER EFFECT — Master sube Excel posiciones+oficial (para TODOS los fondos)
  useEffect(() => {
    if (currentUser?.rol === 'Master' && positionFile?.status === 'success' && officialFile?.status === 'success') {
      setIsProcessing(true);
      setValidationError(null);
      setTimeout(() => {
        analyzeFilesWithGemini(positionFile, officialFile);
      }, 500);
    }
  }, [positionFile, officialFile, currentUser]);

  // COMPLIANCE TRIGGER EFFECT — Compliance sube maestro+límites
  useEffect(() => {
    if (currentUser?.rol === 'Compliance' && masterFile?.status === 'success' && limitsFile?.status === 'success') {
      setIsProcessing(true);
      setValidationError(null);
      setTimeout(() => {
        setPhase('workspace');
        setShowUploadModal(false);
      }, 1500);
    }
  }, [masterFile, limitsFile, currentUser]);


  const handleLogout = async () => {
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }
    await supabase.auth.signOut();
    setCurrentUser(null);
    setPhase('login');
    setFunds([]);
    setPreTradeOrders([]);
    setPostTradeOrders([]);
    setPendingOrders([]);
    setBoletas([]);
    setLiquidityAdjustments([]);
    setPositionFile(null);
    setOfficialFile(null);
    setMasterFile(null);
    setLimitsFile(null);
  };

  // Llamado por Login.tsx tras signInWithPassword exitoso
  const handleLoginSuccess = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await fetchUserProfile(session.user.id);
    }
  };

  const handleReset = () => {
    setPositionFile(null);
    setOfficialFile(null);
    setMasterFile(null);
    setLimitsFile(null);
    setValidationError(null);
    setPhase('workspace');
    setShowUploadModal(true);
    setFunds([]);
    setSelectedFundId(null);
    setLiquidityAdjustments([]);
    setPreTradeOrders([]);
    setPostTradeOrders([]);
    setPendingOrders([]);
    setBoletas([]);
  };

  const handleSendOrder = (order: PreTradeOrder) => {
    const postTradeOrder: PostTradeOrder = {
      ...order,
      status: 'SIN_DATOS',
      processedBy: currentUser?.name || 'Gestor',
      processedAt: new Date().toISOString()
    };

    // Optimistic update — inmediato en UI
    setPostTradeOrders(prev => prev.some(o => o.id === order.id) ? prev : [...prev, postTradeOrder]);
    setPreTradeOrders(prev => prev.map(o =>
      o.id === order.id ? { ...o, preTradeStatus: 'sent' } : o
    ));

    // Fase 3: persistir en background (orden secuencial: insert post-trade primero,
    // luego delete pre-trade para respetar la FK constraint pre_trade_id → pre_trade_orders.id)
    insertPostTradeOrder(postTradeOrder)
      .then(() => deletePreTradeOrder(order.id).catch(e => console.error('deletePreTradeOrder (send):', e)))
      .catch(e => console.error('insertPostTradeOrder:', e));
  };

  const handleConfirmAndGenerate = (orders: PreTradeOrder[]) => {
    const newPostTradeOrders = orders.map(order => ({
      ...order,
      status: 'SIN_DATOS' as const,
      processedBy: currentUser?.name || 'Gestor',
      processedAt: new Date().toISOString()
    }));

    // Optimistic update — inmediato en UI
    setPostTradeOrders(prev => {
      const toAdd = newPostTradeOrders.filter(o => !prev.some(p => p.id === o.id));
      return [...prev, ...toAdd];
    });
    const confirmedIds = new Set(orders.map(o => o.id));
    setPreTradeOrders(prev => prev.map(o =>
      confirmedIds.has(o.id) ? { ...o, preTradeStatus: 'sent' } : o
    ));
    setActiveTab('post-trade');

    // Fase 3: persistir en batch en background (orden secuencial: todos los inserts
    // de post-trade primero, luego los deletes de pre-trade por la FK constraint)
    Promise.all(
      newPostTradeOrders.map(o => insertPostTradeOrder(o).catch(e => console.error('insertPostTradeOrder:', e)))
    ).then(() =>
      Promise.all(orders.map(o => deletePreTradeOrder(o.id).catch(e => console.error('deletePreTradeOrder (confirm):', e))))
    );
  };

  const handleReturnToPreTrade = (orderId: string) => {
    // Capturamos la orden antes del optimistic update para poder re-insertarla en pre_trade_orders
    const returningOrder = postTradeOrders.find(o => o.id === orderId);

    // Optimistic update — inmediato en UI
    setPostTradeOrders(prev => prev.filter(o => o.id !== orderId));
    setPreTradeOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, preTradeStatus: 'pending' } : o
    ));

    // Fase 3: sincronizar en background
    deletePostTradeOrder(orderId).catch(e => console.error('deletePostTradeOrder:', e));
    if (returningOrder) {
      insertPreTradeOrder({ ...returningOrder, preTradeStatus: 'pending' })
        .catch(e => console.error('insertPreTradeOrder (return):', e));
    }
  };

  const handleAddPreTradeOrder = (order: PreTradeOrder) => {
    insertPreTradeOrder(order).catch(e => console.error('insertPreTradeOrder:', e));
  };

  const handleDeletePreTradeOrder = (id: string) => {
    deletePreTradeOrder(id).catch(e => console.error('deletePreTradeOrder:', e));
  };

  // T-10.5: Persistir datos de ejecución en DB cuando se editan en PostTrade
  const handleUpdatePostTradeOrder = (
    orderId: string,
    updates: Partial<Pick<PostTradeOrder, 'status' | 'processedBy' | 'processedAt' | 'executionData'>>
  ) => {
    updatePostTradeOrder(orderId, updates).catch(e =>
      console.error('updatePostTradeOrder:', e)
    );
  };

  const activeFund = useMemo(() => 
    funds.find(f => f.id === selectedFundId) || null
  , [funds, selectedFundId]);

  // Filtered orders for the active fund
  const filteredPreTradeOrders = useMemo(() => {
    if (!selectedFundId) return preTradeOrders;
    return preTradeOrders.filter(o => o.fundId === selectedFundId);
  }, [preTradeOrders, selectedFundId]);

  const filteredPostTradeOrders = useMemo(() => {
    if (!selectedFundId) return postTradeOrders;
    return postTradeOrders.filter(o => o.fundId === selectedFundId);
  }, [postTradeOrders, selectedFundId]);

  // Custom setters to isolate updates by fund
  const handleSetPreTradeOrders = (action: React.SetStateAction<PreTradeOrder[]>) => {
    setPreTradeOrders(prev => {
      if (!selectedFundId) {
        if (typeof action === 'function') return action(prev);
        return action;
      }
      const currentFundOrders = prev.filter(o => o.fundId === selectedFundId);
      const otherFundsOrders = prev.filter(o => o.fundId !== selectedFundId);
      
      let nextFundOrders: PreTradeOrder[];
      if (typeof action === 'function') {
        nextFundOrders = action(currentFundOrders);
      } else {
        nextFundOrders = action;
      }
      
      return [...otherFundsOrders, ...nextFundOrders];
    });
  };

  const handleSetPostTradeOrders = (action: React.SetStateAction<PostTradeOrder[]>) => {
    setPostTradeOrders(prev => {
      if (!selectedFundId) {
        if (typeof action === 'function') return action(prev);
        return action;
      }
      const currentFundOrders = prev.filter(o => o.fundId === selectedFundId);
      const otherFundsOrders = prev.filter(o => o.fundId !== selectedFundId);
      
      let nextFundOrders: PostTradeOrder[];
      if (typeof action === 'function') {
        nextFundOrders = action(currentFundOrders);
      } else {
        nextFundOrders = action;
      }
      
      return [...otherFundsOrders, ...nextFundOrders];
    });
  };

  const handleRemoveFile = (type: 'official' | 'position' | 'master' | 'limits') => {
    if (type === 'official') setOfficialFile(null);
    if (type === 'position') setPositionFile(null);
    if (type === 'master') setMasterFile(null);
    if (type === 'limits') setLimitsFile(null);
  };

  // Pantalla de carga mientras se verifica el JWT (evita flash de Login en recarga)
  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-brand-500 rounded-xl flex items-center justify-center text-white font-bold text-2xl animate-pulse">G</div>
          <p className="text-slate-400 text-sm">Cargando sesión...</p>
        </div>
      </div>
    );
  }

  if (phase === 'login') {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen flex flex-col font-sans text-slate-600 bg-slate-50/50">
      <Header 
        showNavigation={phase === 'workspace'}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        user={currentUser}
        onLogout={handleLogout}
      />

      <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        
        {/* --- WORKSPACE RENDER LOGIC --- */}
        {/* Master: acceso total (6 tabs, todos los fondos) */}
        {/* Gestor: 4 tabs (Dashboard, Mesa, Pre-Trade, Post-Trade), filtrado por fondos asignados */}
        {phase === 'workspace' && (currentUser?.rol === 'Master' || currentUser?.rol === 'Gestor' || currentUser?.rol === 'Compliance') && (
           <>
             {activeTab === 'dashboard' && (
                <Dashboard
                  reconciliationDate={positionFile?.date || "2026-02-10"}
                  funds={funds}
                  selectedFundId={selectedFundId}
                  onFundChange={setSelectedFundId}
                  adjustments={liquidityAdjustments}
                  onAddAdjustment={(adj) => {
                    setLiquidityAdjustments(prev => [...prev, adj]);
                    insertLiquidityAdjustment(adj).catch(e => console.error('insertLiquidityAdjustment:', e));
                  }}
                  currentUser={currentUser}
                  onUpdateData={() => setShowUploadModal(true)}
                  preTradeOrders={preTradeOrders}
                />
             )}
             {activeTab === 'operations' && activeFund && (
                <OperationsDesk
                  fund={activeFund}
                  funds={funds}
                  onFundChange={setSelectedFundId}
                  fundLimits={fundLimits}
                  currentUser={currentUser}
                   onConfirmAndGenerate={handleConfirmAndGenerate}
                   onSendOrder={handleSendOrder}
                   preTradeOrders={filteredPreTradeOrders}
                   setPreTradeOrders={handleSetPreTradeOrders}
                   onAddOrder={handleAddPreTradeOrder}
                   onRemoveOrder={handleDeletePreTradeOrder}
                   pendingOrders={pendingOrders}
                   setPendingOrders={setPendingOrders}
                   postTradeOrders={postTradeOrders}
                   manualAdjustment={liquidityAdjustments
                     .filter(a => a.fundId === activeFund.id)
                     .reduce((acc, curr) => acc + curr.amount, 0)}
                   aumAdjustment={liquidityAdjustments
                     .filter(a => a.fundId === activeFund.id && (a.reason === 'Suscripción' || a.reason === 'Reembolso'))
                     .reduce((acc, curr) => acc + curr.amount, 0)}
                />
             )}
              {activeTab === 'pre-trade' && activeFund && (
                 <PreTrade
                   fund={activeFund}
                   funds={funds}
                   onFundChange={setSelectedFundId}
                   fundLimits={fundLimits}
                   currentUser={currentUser}
                   orders={preTradeOrders}
                   setOrders={handleSetPreTradeOrders}
                   onRemoveOrder={handleDeletePreTradeOrder}
                   onConfirmAndGenerate={handleConfirmAndGenerate}
                   onSendOrder={handleSendOrder}
                   onBack={() => setActiveTab('operations')}
                   manualAdjustment={activeFund ? liquidityAdjustments
                     .filter(a => a.fundId === activeFund.id)
                     .reduce((acc, curr) => acc + curr.amount, 0) : 0}
                   aumAdjustment={activeFund ? liquidityAdjustments
                     .filter(a => a.fundId === activeFund.id && (a.reason === 'Suscripción' || a.reason === 'Reembolso'))
                     .reduce((acc, curr) => acc + curr.amount, 0) : 0}
                   liquidityAdjustments={liquidityAdjustments}
                   boletas={boletas.filter(b => b.fundId === activeFund.id)}
                   onSaveBoleta={(boleta) => {
                     setBoletas(prev => [boleta, ...prev]);
                     insertBoleta(boleta).catch(e => console.error('insertBoleta:', e));
                   }}
                 />
              )}
              {activeTab === 'post-trade' && (
                 <PostTrade
                   selectedFundId={selectedFundId}
                   funds={funds}
                   onFundChange={setSelectedFundId}
                   orders={postTradeOrders}
                   setOrders={setPostTradeOrders}
                   onReturnToPreTrade={handleReturnToPreTrade}
                   onUpdateOrder={handleUpdatePostTradeOrder}
                   currentUser={currentUser}
                 />
              )}
              {/* Back-Office solo lectura para Master (datos de ejecución se gestionan desde Post-Trade) */}
              {activeTab === 'back-office' && currentUser?.rol === 'Master' && (
                <BackOffice
                  selectedFundId={selectedFundId}
                  funds={funds}
                  onFundChange={setSelectedFundId}
                  orders={postTradeOrders}
                  setOrders={setPostTradeOrders}
                  onReturnToPreTrade={handleReturnToPreTrade}
                  currentUser={currentUser}
                  readOnly={true}
                />
              )}
              {activeTab === 'compliance' && (currentUser?.rol === 'Master' || currentUser?.rol === 'Compliance') && (
                <Compliance
                  selectedFundId={selectedFundId}
                  funds={funds}
                  onFundChange={setSelectedFundId}
                  orders={preTradeOrders}
                  boletas={boletas}
                  currentUser={currentUser}
                />
              )}
              {activeTab === 'control-dashboard' && (currentUser?.rol === 'Master' || currentUser?.rol === 'Compliance') && (
                <ControlDashboard 
                  funds={funds} 
                  fundLimits={fundLimits} 
                  adjustments={liquidityAdjustments} 
                />
              )}
           </>
        )}

        {/* Backoffice: vista de solo lectura — datos de liquidación post-trade */}
        {phase === 'workspace' && currentUser?.rol === 'Backoffice' && (
          <BackOffice
            selectedFundId={selectedFundId}
            funds={funds}
            onFundChange={setSelectedFundId}
            orders={postTradeOrders}
            setOrders={setPostTradeOrders}
            onReturnToPreTrade={handleReturnToPreTrade}
            currentUser={currentUser}
            readOnly={true}
          />
        )}

      </main>

      {/* --- MODALS --- */}
      <UploadModal 
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        currentUser={currentUser}
        isProcessing={isProcessing}
        validationError={validationError}
        handleReset={handleReset}
        officialFile={officialFile}
        positionFile={positionFile}
        onFileSelect={handleFileSelect}
        onRemoveFile={handleRemoveFile}
        masterFile={masterFile}
        limitsFile={limitsFile}
        fundLimits={fundLimits}
        setFundLimits={setFundLimits}
        onShowMasterModal={() => setShowMasterModal(true)}
      />

      {showMasterModal && (
        <MasterDataModal onClose={() => setShowMasterModal(false)} />
      )}
    </div>
  );
};

export default App;
