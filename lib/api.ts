/**
 * lib/api.ts — Capa de acceso a datos de Supabase
 *
 * Regla: Los componentes NUNCA llaman a `supabase.from()` directamente.
 * Toda interacción con la base de datos pasa por este archivo.
 * Esto mantiene los componentes limpios y facilita los tests.
 */
import { supabase } from './supabase';
import type {
  User,
  PreTradeOrder,
  PostTradeOrder,
  Boleta,
  LiquidityAdjustment,
  Fund,
  Asset,
} from '../types';

// ============================================================
// USER PROFILE
// ============================================================

export async function getUserProfile(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name, surname, rol')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('getUserProfile:', error.message);
    return null;
  }
  return data as User;
}

// ============================================================
// PRE-TRADE ORDERS
// ============================================================

export async function getPreTradeOrders(): Promise<PreTradeOrder[]> {
  const { data, error } = await supabase
    .from('pre_trade_orders')
    .select('*')
    .order('added_at', { ascending: false });

  if (error) throw new Error(`getPreTradeOrders: ${error.message}`);
  return (data ?? []).map(rowToPreTradeOrder);
}

export async function getPreTradeOrdersByFund(fundId: string): Promise<PreTradeOrder[]> {
  const { data, error } = await supabase
    .from('pre_trade_orders')
    .select('*')
    .eq('fund_id', fundId)
    .order('added_at', { ascending: false });

  if (error) throw new Error(`getPreTradeOrdersByFund: ${error.message}`);
  return (data ?? []).map(rowToPreTradeOrder);
}

/**
 * Inserta una orden pre-trade.
 * IMPORTANTE: user_id se obtiene del JWT activo — nunca lo pasa el cliente.
 * Esto evita que alguien envíe un user_id de otro usuario.
 */
export async function insertPreTradeOrder(order: PreTradeOrder): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const { error } = await supabase.from('pre_trade_orders').insert({
    id: order.id,
    user_id: user.id,
    fund_id: order.fundId ?? '',
    fund_name: order.fundName ?? null,
    fund_ticker: order.fundTicker ?? null,
    asset_json: order.asset,
    side: order.side,
    quantity: order.quantity,
    price: order.price,
    currency: order.currency,
    amount_eur: order.amountEur,
    pre_trade_status: order.preTradeStatus ?? 'pending',
    added_at: order.addedAt,
  });

  if (error) throw new Error(`insertPreTradeOrder: ${error.message}`);
}

export async function updatePreTradeOrderStatus(
  orderId: string,
  status: 'pending' | 'sent'
): Promise<void> {
  const { error } = await supabase
    .from('pre_trade_orders')
    .update({ pre_trade_status: status })
    .eq('id', orderId);

  if (error) throw new Error(`updatePreTradeOrderStatus: ${error.message}`);
}

export async function deletePreTradeOrder(orderId: string): Promise<void> {
  const { error } = await supabase
    .from('pre_trade_orders')
    .delete()
    .eq('id', orderId);

  if (error) throw new Error(`deletePreTradeOrder: ${error.message}`);
}

// ============================================================
// POST-TRADE ORDERS
// ============================================================

export async function getPostTradeOrders(): Promise<PostTradeOrder[]> {
  const { data, error } = await supabase
    .from('post_trade_orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`getPostTradeOrders: ${error.message}`);
  return (data ?? []).map(rowToPostTradeOrder);
}

export async function insertPostTradeOrder(order: PostTradeOrder): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const { error } = await supabase.from('post_trade_orders').insert({
    id: order.id,
    pre_trade_id: order.id,
    user_id: user.id,
    fund_id: order.fundId ?? '',
    fund_name: order.fundName ?? null,
    fund_ticker: order.fundTicker ?? null,
    asset_json: order.asset,
    side: order.side,
    quantity: order.quantity,
    price: order.price,
    currency: order.currency,
    amount_eur: order.amountEur,
    status: order.status,
    processed_by: order.processedBy ?? null,
    processed_at: order.processedAt ?? null,
    execution_data: order.executionData ?? null,
    added_at: order.addedAt,
  });

  if (error) throw new Error(`insertPostTradeOrder: ${error.message}`);
}

export async function updatePostTradeOrder(
  orderId: string,
  updates: Partial<Pick<PostTradeOrder, 'status' | 'processedBy' | 'processedAt' | 'executionData'>>
): Promise<void> {
  const dbUpdates: Record<string, unknown> = {};
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.processedBy !== undefined) dbUpdates.processed_by = updates.processedBy;
  if (updates.processedAt !== undefined) dbUpdates.processed_at = updates.processedAt;
  if (updates.executionData !== undefined) dbUpdates.execution_data = updates.executionData;

  const { error } = await supabase
    .from('post_trade_orders')
    .update(dbUpdates)
    .eq('id', orderId);

  if (error) throw new Error(`updatePostTradeOrder: ${error.message}`);
}

export async function deletePostTradeOrder(orderId: string): Promise<void> {
  const { error } = await supabase
    .from('post_trade_orders')
    .delete()
    .eq('id', orderId);

  if (error) throw new Error(`deletePostTradeOrder: ${error.message}`);
}

// ============================================================
// BOLETAS
// ============================================================

export async function getBoletasByFund(fundId: string): Promise<Boleta[]> {
  const { data, error } = await supabase
    .from('boletas')
    .select('*')
    .eq('fund_id', fundId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`getBoletasByFund: ${error.message}`);
  return (data ?? []).map(rowToBoleta);
}

/**
 * Las boletas son snapshots legales: una vez insertadas NO se modifican.
 * orders_json guarda el estado exacto de las órdenes en el momento de confirmar.
 */
export async function insertBoleta(boleta: Boleta): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const { error } = await supabase.from('boletas').insert({
    id: boleta.id,
    fund_id: boleta.fundId,
    fund_name: boleta.fundName,
    orders_json: boleta.orders,
    generated_by: boleta.generatedBy,
    created_by: user.id,
  });

  if (error) throw new Error(`insertBoleta: ${error.message}`);
}

// ============================================================
// LIQUIDITY ADJUSTMENTS
// ============================================================

export async function getLiquidityAdjustments(): Promise<LiquidityAdjustment[]> {
  const { data, error } = await supabase
    .from('liquidity_adjustments')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`getLiquidityAdjustments: ${error.message}`);
  return (data ?? []).map(rowToLiquidityAdjustment);
}

export async function insertLiquidityAdjustment(adj: LiquidityAdjustment): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const { error } = await supabase.from('liquidity_adjustments').insert({
    id: adj.id,
    fund_id: adj.fundId,
    amount: adj.amount,
    reason: adj.reason,
    value_date: adj.valueDate ?? null,
    comment: adj.comment,
    user_name: adj.user,
    created_by: user.id,
  });

  if (error) throw new Error(`insertLiquidityAdjustment: ${error.message}`);
}

// ============================================================
// FUND DATA
// ============================================================

export interface FundDataRow {
  iic: string;
  name: string;
  aum: number;
  equity_exp: number;
  derivatives_exp: number;
  date: string;
}

export async function getFundData(): Promise<FundDataRow[]> {
  const { data, error } = await supabase
    .from('fund_data')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw new Error(`getFundData: ${error.message}`);
  return (data ?? []) as FundDataRow[];
}

export async function upsertFundData(rows: FundDataRow[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase
    .from('fund_data')
    .upsert(rows, { onConflict: 'iic' });

  if (error) throw new Error(`upsertFundData: ${error.message}`);
}

export async function deleteFundDataByDate(date: string): Promise<void> {
  const { error } = await supabase
    .from('fund_data')
    .delete()
    .eq('date', date);

  if (error) throw new Error(`deleteFundDataByDate: ${error.message}`);
}

// ============================================================
// HOLDINGS
// ============================================================

export interface HoldingRow {
  id?: string;
  type: string | null;
  ticker: string | null;
  issuer_code: string | null;
  name: string;
  currency: string;
  exch_rate: number | null;
  quantity: number;
  last_px: number;
  exposure: number;
  weight_pct: number;
  iic: string;
  der_type: string | null;
  multiplier: number | null;
  date: string;
}

export async function getHoldingsByFund(iic: string): Promise<HoldingRow[]> {
  const { data, error } = await supabase
    .from('holdings')
    .select('*')
    .eq('iic', iic)
    .order('weight_pct', { ascending: false });

  if (error) throw new Error(`getHoldingsByFund: ${error.message}`);
  return (data ?? []) as HoldingRow[];
}

export async function upsertHoldings(rows: HoldingRow[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase
    .from('holdings')
    .upsert(rows, { onConflict: 'id' });

  if (error) throw new Error(`upsertHoldings: ${error.message}`);
}

export async function deleteHoldingsByDate(date: string): Promise<void> {
  const { error } = await supabase
    .from('holdings')
    .delete()
    .eq('date', date);

  if (error) throw new Error(`deleteHoldingsByDate: ${error.message}`);
}

export async function deleteHoldingsByFund(iic: string): Promise<void> {
  const { error } = await supabase
    .from('holdings')
    .delete()
    .eq('iic', iic);

  if (error) throw new Error(`deleteHoldingsByFund: ${error.message}`);
}

// ============================================================
// GESTOR-FUNDS ASSIGNMENT
// ============================================================

export interface GestorFundAssignment {
  id?: string;
  gestor_id: string;
  fund_iic: string;
}

/** Obtener los IIC de fondos asignados a un gestor */
export async function getGestorFunds(gestorId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('gestor_funds')
    .select('fund_iic')
    .eq('gestor_id', gestorId);

  if (error) throw new Error(`getGestorFunds: ${error.message}`);
  return (data ?? []).map(r => r.fund_iic);
}

/** Asignar fondos a un gestor (usado por Master) */
export async function assignGestorFunds(gestorId: string, fundIics: string[]): Promise<void> {
  // Borrar asignaciones previas
  const { error: delError } = await supabase
    .from('gestor_funds')
    .delete()
    .eq('gestor_id', gestorId);
  if (delError) throw new Error(`assignGestorFunds (delete): ${delError.message}`);

  if (fundIics.length === 0) return;

  const rows = fundIics.map(iic => ({ gestor_id: gestorId, fund_iic: iic }));
  const { error } = await supabase
    .from('gestor_funds')
    .insert(rows);
  if (error) throw new Error(`assignGestorFunds (insert): ${error.message}`);
}

/** Obtener todas las asignaciones (para vista de admin/Master) */
export async function getAllGestorFunds(): Promise<GestorFundAssignment[]> {
  const { data, error } = await supabase
    .from('gestor_funds')
    .select('*');

  if (error) throw new Error(`getAllGestorFunds: ${error.message}`);
  return (data ?? []) as GestorFundAssignment[];
}

// ============================================================
// MAPPERS: columnas DB (snake_case) → interfaces TypeScript (camelCase)
// ============================================================

export function rowToPreTradeOrder(row: Record<string, unknown>): PreTradeOrder {
  return {
    id: row.id as string,
    asset: row.asset_json as PreTradeOrder['asset'],
    side: row.side as 'buy' | 'sell',
    quantity: Number(row.quantity),
    price: Number(row.price),
    currency: row.currency as string,
    amountEur: Number(row.amount_eur),
    preTradeStatus: row.pre_trade_status as 'pending' | 'sent',
    addedAt: row.added_at as string,
    fundId: row.fund_id as string,
    fundName: row.fund_name as string | undefined,
    fundTicker: row.fund_ticker as string | undefined,
  };
}

export function rowToPostTradeOrder(row: Record<string, unknown>): PostTradeOrder {
  return {
    ...rowToPreTradeOrder(row),
    status: row.status as PostTradeOrder['status'],
    processedBy: row.processed_by as string | undefined,
    processedAt: row.processed_at as string | undefined,
    executionData: row.execution_data as PostTradeOrder['executionData'],
  };
}

function rowToBoleta(row: Record<string, unknown>): Boleta {
  return {
    id: row.id as string,
    fundId: row.fund_id as string,
    fundName: row.fund_name as string,
    timestamp: row.created_at as string,
    orders: row.orders_json as PreTradeOrder[],
    generatedBy: row.generated_by as string,
  };
}

function rowToLiquidityAdjustment(row: Record<string, unknown>): LiquidityAdjustment {
  return {
    id: row.id as string,
    fundId: row.fund_id as string,
    amount: Number(row.amount),
    reason: row.reason as LiquidityAdjustment['reason'],
    valueDate: row.value_date as string | undefined,
    comment: row.comment as string,
    timestamp: row.created_at as string,
    user: row.user_name as string,
  };
}
