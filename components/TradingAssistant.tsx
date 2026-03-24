import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Sparkles, X, Loader2, TrendingUp, TrendingDown, AlertCircle, CheckCircle2, Info, Ban } from 'lucide-react';
import { Fund, Asset, PreTradeOrder, OrderSide, OperationType } from '../types';
import { GoogleGenAI, Type } from "@google/genai";
import { FundLimit } from '../data/fundLimits';

interface TradingAssistantProps {
  fund: Fund;
  adjustedAum: number;
  availableLiquidity: number;
  fundLimits: FundLimit[];
  onProposeOrders: (orders: any[]) => void;
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  proposals?: any[];
  isRejected?: boolean;
  requiresClarification?: boolean;
}

export const TradingAssistant: React.FC<TradingAssistantProps> = ({ 
  fund, 
  adjustedAum, 
  availableLiquidity,
  fundLimits,
  onProposeOrders,
  isOpen,
  onClose
}) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'assistant', 
      content: `Hola, soy tu asistente de trading inteligente para **${fund.name}**. Puedo ayudarte a proponer operaciones basadas en porcentajes de patrimonio o cantidades específicas. ¿Qué tienes en mente?` 
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // Build fund context for the AI
      const exchangeRates = fund.positions
        .filter(p => p.currency !== 'EUR' && p.exchangeRate)
        .reduce((acc, p) => ({ ...acc, [p.currency]: p.exchangeRate }), {});

      const currentFundLimits = fundLimits.find(l =>
        fund.name.toUpperCase().includes(l.nameKeywords) ||
        fund.id === l.code
      );

      const patrimonisLimits = fundLimits.find(l => l.code === '54');

      const minEquity = (currentFundLimits?.minEquity !== undefined ? currentFundLimits.minEquity : (patrimonisLimits?.minEquity ?? -1)) * 100;
      const maxEquity = (currentFundLimits?.maxEquity !== undefined ? currentFundLimits.maxEquity : (patrimonisLimits?.maxEquity ?? 2)) * 100;

      const fundContext = {
        name: fund.name,
        ticker: fund.ticker,
        aum: adjustedAum,
        availableLiquidity: availableLiquidity,
        currency: fund.currency,
        exchangeRates,
        limits: {
          minEquity,
          maxEquity,
          maxCommitment: (fund.id === '701' || fund.name.toUpperCase().includes('REGATA')) ? 200 : 90
        },
        currentStats: {
          equityExposurePct: fund.equityAllocation,
          derivativeCommitmentPct: fund.derivativeCommitment,
          concentrationPct: 0,
          issuersAbove5Pct: fund.positions
            .filter(p => (p.marketValue / adjustedAum) > 0.05)
            .map(p => ({ name: p.name, weight: (p.marketValue / adjustedAum) * 100 }))
        },
        positions: fund.positions.map(p => ({
          ticker: p.ticker,
          name: p.name,
          quantity: p.quantity,
          marketValue: p.marketValue,
          weight: (p.marketValue / adjustedAum) * 100,
          currency: p.currency,
          lastPrice: p.lastPrice,
          multiplier: p.multiplier,
          derivativeType: p.derivativeType,
          issuerCode: p.issuerTicker
        }))
      };

      const history = messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

      // Initialize Gemini AI
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          ...history,
          { role: 'user', parts: [{ text: userMessage }] }
        ],
        config: {
          systemInstruction: `Eres un asistente experto en trading para una gestora de fondos (GESIURIS).
Tu tarea es analizar la petición del usuario y proponer órdenes de compra o venta, o pedir aclaraciones si falta información crítica.

CONTEXTO DEL FONDO ACTUAL:
${JSON.stringify(fundContext, null, 2)}

REGLAS ESTRICTAS DE VALIDACIÓN Y CUMPLIMIENTO (COMPLIANCE):
1. LÍMITES DE FOLLETO: Antes de proponer cualquier orden, DEBES calcular el impacto proyectado.
   - LIQUIDEZ (CASH): No puedes proponer compras que dejen la liquidez disponible (availableLiquidity: ${fundContext.availableLiquidity} EUR) en negativo.
   - EXPOSICIÓN RV: No puedes superar el maxEquity (${fundContext.limits?.maxEquity || 200}%) ni bajar del minEquity (${fundContext.limits?.minEquity || -100}%).
   - COMPROMISO DERIVADOS: No puedes superar el maxCommitment (${fundContext.limits?.maxCommitment || 90}%).
   - REGLA 5/10/40 (CONCENTRACIÓN):
     * Ningún emisor individual puede superar el 10% del patrimonio.
     * La suma de todos los emisores que pesan entre el 5% y el 10% no puede superar el 40% (Concentración).
     * EXCEPCIONES: Los derivados de ÍNDICE (S&P 500, Eurostoxx, etc.) y DIVISA (EUR/USD, etc.) NO computan para la regla 5/10/40. Las acciones individuales SÍ computan.
   - SI SE VIOLA UN LÍMITE: Marca "isRejected": true, deja "proposals" vacío [] y explica detalladamente qué límite se rompe.

2. CATEGORIZACIÓN DE ACTIVOS (CRÍTICO):
   - RENTA VARIABLE: Compra/venta directa de acciones (spot). operationType: "Renta Variable". SÍ aumentan exposición a Renta Variable. SÍ computan para la regla 5/10/40.
   - DIVISA: Futuros sobre EUR/USD (ECH6, etc.) o cualquier par de divisas. operationType: "Derivados", derivativeCategory: "Divisa". NO aumentan exposición a Renta Variable. NO computan para 5/10/40.
   - ÍNDICE: Futuros sobre S&P 500 (ES, ESH6), Nasdaq (NQ), Eurostoxx (SX5E), Ibex, etc. operationType: "Derivados", derivativeCategory: "Índice". SÍ aumentan exposición a Renta Variable. NO computan para 5/10/40.
   - DERIVADOS DE ACCIONES: Futuros u opciones sobre empresas concretas (ej: Apple, Puig, Santander). operationType: "Derivados", derivativeCategory: "Acciones". SÍ aumentan exposición a Renta Variable. SÍ computan para 5/10/40.
   - Consulta siempre la lista de "positions" para ver cómo están categorizados los activos que ya están en cartera. Si el usuario dice "comprar acciones" se refiere a RENTA VARIABLE (spot), no a derivados, a menos que mencione explícitamente "futuros" o "opciones".

3. DATOS FALTANTES: Si no puedes realizar los cálculos de cumplimiento porque falta información (ej. no sabes el multiplicador de un activo nuevo, o el precio actual), DEBES marcar "requiresClarification": true y pedir los datos necesarios al usuario antes de generar ninguna orden.
4. VENTAS/CIERRES: Comprueba siempre las "positions". No permitas ventas al descubierto (short selling) en Renta Variable si no hay posición previa. En DERIVADOS SÍ se permite vender sin posición previa (no es descubierto).
5. DERIVADOS:
   - operationType: "Derivados".
   - commitmentConsumption: DEBE ser "SÍ" (si aumenta el riesgo/exposición) o "NO" (si es para cerrar posición o cobertura).
      *IMPORTANTE*: Si el usuario pide "cubrir el riesgo de [DIVISA]" (ej. USD), esto se considera una COBERTURA PERFECTA de divisa y por tanto DEBES marcar commitmentConsumption como "NO" y explicarlo como tal. Por defecto usa "SÍ".
   - derivativeCategory: "Índice", "Acciones" o "Divisa".
   - derivativeInstrumentType: "Futuros" o "Opciones".
   - DELTA: Muy importante. Las CALL siempre tienen delta POSITIVA. Las PUT siempre tienen delta NEGATIVA. Si el usuario te da un valor positivo para una PUT (ej. 0.5), tú debes usarlo como negativo (-0.5).
   - PRECIOS:
     - "price": Es la PRIMA (premium) de la opción o el precio del futuro. Se usa para el cálculo de LIQUIDEZ (caja).
     - "underlyingPrice": Es el precio del ACTIVO SUBYACENTE. Es VITAL para el cálculo de COMPROMISO y EXPOSICIÓN en OPCIONES. En FUTUROS no es necesario (se usa el precio del futuro).
   - Multiplicador: Usa el de la cartera si existe. Si no, pídelo.
   - CÁLCULO COMPROMISO/EXPOSICIÓN:
      - En FUTUROS: price * multiplier * quantity.
      - En OPCIONES: underlyingPrice * multiplier * delta * quantity.
   - VENTAS: En derivados puedes vender (side: "sell") sin tener posición previa. No es descubierto.
5. RESPUESTA: Sé profesional y directo. Si rechazas una orden, sé pedagógico sobre la normativa de IICs.

FORMATO DE RESPUESTA (JSON):
{
  "explanation": "Respuesta textual al usuario.",
  "isRejected": boolean,
  "requiresClarification": boolean,
  "proposals": [...]
}
`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              explanation: { type: Type.STRING },
              isRejected: { type: Type.BOOLEAN },
              requiresClarification: { type: Type.BOOLEAN },
              proposals: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    ticker: { type: Type.STRING },
                    name: { type: Type.STRING },
                    side: { type: Type.STRING, enum: ['buy', 'sell'] },
                    quantity: { type: Type.NUMBER },
                    price: { type: Type.NUMBER },
                    currency: { type: Type.STRING },
                    exchangeRate: { type: Type.NUMBER },
                    operationType: { type: Type.STRING },
                    typology: { type: Type.STRING },
                    derivativeCategory: { type: Type.STRING, enum: ['Índice', 'Acciones', 'Divisa', 'IRV'] },
                    derivativeInstrumentType: { type: Type.STRING, enum: ['Futuros', 'Opciones'] },
                    commitmentConsumption: { type: Type.STRING, enum: ['SÍ', 'NO'] },
                    noConsumptionReason: { type: Type.STRING, enum: ['COBERTURA PERFECTA', 'CIERRE DE POSICIÓN'] },
                    multiplier: { type: Type.NUMBER },
                    delta: { type: Type.NUMBER },
                    underlyingPrice: { type: Type.NUMBER },
                    commitment: { type: Type.NUMBER },
                    reason: { type: Type.STRING }
                  },
                  required: ['ticker', 'name', 'side', 'quantity', 'price', 'currency', 'operationType']
                }
              }
            },
            required: ['explanation', 'isRejected', 'requiresClarification', 'proposals']
          }
        }
      });

      const text = response.text;
      if (!text) throw new Error('No response from Gemini');

      const result = JSON.parse(text);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: result.explanation,
        isRejected: result.isRejected,
        requiresClarification: result.requiresClarification,
        proposals: result.isRejected || result.requiresClarification ? [] : result.proposals 
      }]);
    } catch (error) {
      console.error("Error in TradingAssistant:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Lo siento, ha ocurrido un error al procesar tu petición. Por favor, inténtalo de nuevo." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const applyProposals = (proposals: any[]) => {
    // Convert proposals to PreTradeOrder format
    const orders = proposals.map(p => {
      const fx = Number(p.exchangeRate) || 1;
      const quantity = Number(p.quantity) || 0;
      const price = Number(p.price) || 0;
      const amountEur = (quantity * price) / fx;
      
      // Try to find multiplier from existing positions if not provided by AI
      const existingPos = fund.positions.find(pos => 
        pos.ticker === p.ticker || 
        pos.name.toLowerCase().includes(p.name.toLowerCase()) ||
        p.name.toLowerCase().includes(pos.name.toLowerCase())
      );
      
      const multiplier = Number(p.multiplier) || existingPos?.multiplier || 1;
      
      // Calculate commitment for derivatives
      // VITAL: If it's a future or option, it MUST be treated as 'Derivados' for commitment calculation
      const nameLower = p.name.toLowerCase();
      const tickerUpper = p.ticker.toUpperCase();
      const isDerivative = p.operationType === 'Derivados' || 
                          tickerUpper.includes('FUT') || 
                          tickerUpper.includes('OPT') ||
                          nameLower.includes('future') ||
                          nameLower.includes('futuro') ||
                          nameLower.includes('option') ||
                          nameLower.includes('opción') ||
                          p.derivativeInstrumentType === 'Futuros' ||
                          p.derivativeInstrumentType === 'Opciones' ||
                          (existingPos?.derivativeType && existingPos.derivativeType !== 'N/A');

      // Force Delta Sign based on Option Type
      let delta = Number(p.delta) || (isDerivative ? 1 : undefined);
      if (isDerivative && delta !== undefined) {
        const isPut = nameLower.includes('put') || tickerUpper.includes('P');
        const isCall = nameLower.includes('call') || tickerUpper.includes('C');
        
        if (isPut) {
          delta = -Math.abs(delta);
        } else if (isCall) {
          delta = Math.abs(delta);
        }
      }
      
      const category = String(p.derivativeCategory || '').toUpperCase().trim();
      const underlyingPrice = Number(p.underlyingPrice) || (isDerivative ? (p.derivativeInstrumentType === 'Futuros' ? price : (Number(p.underlyingPrice) || 0)) : undefined);

      let commitment = Number(p.commitment) || 0;
      if (isDerivative && commitment === 0) {
        // Commitment for limits is usually absolute, but we store it signed if we want to use it for exposure
        // However, the 'commitment' field in PreTradeOrder is used for the 90%/200% limit which is absolute.
        // We will calculate the absolute commitment for the limit, but we'll use delta for exposure.
        const uPrice = p.derivativeInstrumentType === 'Futuros' ? price : (underlyingPrice || price);
        commitment = (Math.abs(quantity) * uPrice * multiplier * Math.abs(delta || 1)) / fx;
      }

      // Normalize commitmentConsumption to SÍ or NO
      let consumption = String(p.commitmentConsumption || '').toUpperCase().trim();
      if (consumption !== 'SÍ' && consumption !== 'SI' && consumption !== 'NO') {
        // Heuristic: If it's a currency derivative and the user is talking about hedging
        const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content.toLowerCase() || '';
        const isHedgeRequest = lastUserMsg.includes('cubrir') || lastUserMsg.includes('cobertura');
        const isFxDerivative = isDerivative && (category === 'DIVISA' || tickerUpper.includes('EUR/USD') || tickerUpper.includes('ECH'));
        
        consumption = (isFxDerivative && isHedgeRequest) ? 'NO' : (isDerivative ? 'SÍ' : '');
      } else if (consumption === 'SI') {
        consumption = 'SÍ';
      }

      return {
        id: `AI-${Math.random().toString(36).substr(2, 9)}`,
        asset: {
          ticker: p.ticker,
          name: p.name,
          isin: '',
          lastPrice: price,
          currency: p.currency,
          quantity: 0, 
          marketValue: 0,
          exchangeRate: fx,
          typology: p.typology || (p.operationType === 'Derivados' ? 'Derivados' : (p.operationType === 'Acciones' ? 'Renta Variable' : (p.operationType || 'Renta Variable')))
        },
        side: p.side as OrderSide,
        quantity: quantity,
        price: price,
        currency: p.currency,
        amountEur: amountEur,
        commitment: commitment,
        addedAt: new Date().toISOString(),
        fundId: fund.id,
        fundName: fund.name,
        operationType: (isDerivative ? 'Derivados' : (p.operationType === 'Acciones' ? 'Renta Variable' : (p.operationType || 'Renta Variable'))) as OperationType,
        derivativeCategory: p.derivativeCategory || (isDerivative ? 'Índice' : undefined),
        derivativeInstrumentType: p.derivativeInstrumentType || (isDerivative ? 'Futuros' : undefined),
        commitmentConsumption: consumption as any,
        noConsumptionReason: p.noConsumptionReason,
        multiplier: multiplier,
        delta: delta,
        underlying: p.ticker,
        underlyingPrice: underlyingPrice,
      };
    });
    
    onProposeOrders(orders);
    setMessages(prev => [...prev, { role: 'assistant', content: "¡Hecho! He añadido las propuestas a tu cesta de Pre-Trade para que las revises." }]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 w-[450px] h-[650px] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col z-50 overflow-hidden animate-in slide-in-from-right-8 duration-300">
      {/* Header */}
      <div className="bg-slate-900 p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-500/20">
            <Sparkles size={20} />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm">Trading Assistant AI</h3>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Inteligencia Artificial Activa</span>
            </div>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-xl">
          <X size={20} />
        </button>
      </div>

      {/* Disclaimer legal IA */}
      <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex items-start gap-2">
        <AlertCircle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-[10px] text-amber-700 leading-tight">
          La responsabilidad final de las operaciones aconsejadas por la IA siempre es del gestor que firma la boleta pre-trade. La IA puede equivocarse.
        </p>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-grow overflow-y-auto p-6 space-y-6 bg-slate-50/50">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${
              msg.role === 'user' 
                ? 'bg-brand-600 text-white rounded-tr-none' 
                : msg.isRejected 
                  ? 'bg-rose-50 border border-rose-200 text-rose-700 rounded-tl-none'
                  : msg.requiresClarification
                    ? 'bg-amber-50 border border-amber-200 text-amber-700 rounded-tl-none'
                    : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'
            }`}>
              <div className="flex items-start gap-2">
                {msg.role === 'assistant' && msg.isRejected && <AlertCircle size={16} className="mt-0.5 shrink-0" />}
                {msg.role === 'assistant' && msg.requiresClarification && <Info size={16} className="mt-0.5 shrink-0" />}
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              </div>
              
              {msg.proposals && msg.proposals.length > 0 && (
                <div className="mt-4 space-y-3">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Propuestas de Operación</div>
                  {msg.proposals.map((prop, j) => (
                    <div key={j} className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between group hover:border-brand-300 transition-all">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${prop.side === 'buy' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                          {prop.side === 'buy' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-800">{prop.ticker}</div>
                          <div className="text-[10px] text-slate-500">{prop.quantity.toLocaleString()} @ {prop.price} {prop.currency}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-[10px] font-bold ${prop.side === 'buy' ? 'text-emerald-600' : 'text-rose-600'} uppercase`}>
                          {prop.side === 'buy' ? 'Compra' : 'Venta'}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {((prop.quantity * prop.price)).toLocaleString()} {prop.currency}
                        </div>
                      </div>
                    </div>
                  ))}
                  <button 
                    onClick={() => applyProposals(msg.proposals!)}
                    className="w-full py-2.5 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-700 transition-all shadow-md shadow-brand-600/20 flex items-center justify-center gap-2 mt-2"
                  >
                    <CheckCircle2 size={14} />
                    APLICAR PROPUESTAS A PRE-TRADE
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none p-4 shadow-sm flex items-center gap-3">
              <Loader2 size={16} className="animate-spin text-brand-600" />
              <span className="text-xs text-slate-500 font-medium">Analizando mercado y cartera...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-5 bg-white border-t border-slate-200">
        <div className="relative">
          <input 
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ej: Compra el 2% de Apple..."
            className="w-full pl-5 pr-14 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all"
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className={`absolute right-2 top-2 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              input.trim() && !isLoading 
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/20' 
                : 'bg-slate-100 text-slate-400'
            }`}
          >
            <Send size={18} />
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-400 px-1">
          <Info size={12} />
          <span>Las propuestas deben ser revisadas en el panel de Pre-Trade antes de ejecutarse.</span>
        </div>
      </div>
    </div>
  );
};
