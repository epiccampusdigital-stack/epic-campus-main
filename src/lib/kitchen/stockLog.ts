import { addDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'

export type StockChangeType = 'add' | 'remove' | 'adjust'
export type StockLogSource = 'kitchen' | 'supplies'

export interface StockLogInput {
  itemId: string
  itemName: string
  changeType: StockChangeType
  previousQty: number
  newQty: number
  unit: string
  changedBy: string
  changedByName: string
  source: StockLogSource
}

export interface StockLogRecord extends Omit<StockLogInput, 'changedBy'> {
  id: string
  difference: number
  changedBy: string
  createdAt: Timestamp | null
}

/**
 * Best-effort unified stock-change log. Writes to the top-level `inventoryLogs`
 * collection (source-tagged) AFTER the caller has already committed the real
 * inventory/supplies update. Any failure here is swallowed so it can never block
 * or roll back the primary stock write.
 */
export async function writeStockLog(input: StockLogInput): Promise<void> {
  try {
    await addDoc(collection(db, 'inventoryLogs'), {
      itemId: input.itemId,
      itemName: input.itemName,
      changeType: input.changeType,
      previousQty: input.previousQty,
      newQty: input.newQty,
      difference: Number((input.newQty - input.previousQty).toFixed(4)),
      unit: input.unit,
      changedBy: input.changedBy,
      changedByName: input.changedByName,
      source: input.source,
      createdAt: serverTimestamp(),
    })
  } catch (err) {
    console.error('[writeStockLog]', err)
  }
}

export function parseStockLog(id: string, data: Record<string, unknown>): StockLogRecord {
  return {
    id,
    itemId: String(data.itemId ?? ''),
    itemName: String(data.itemName ?? 'Item'),
    changeType: (data.changeType as StockChangeType) ?? 'adjust',
    previousQty: Number(data.previousQty ?? 0),
    newQty: Number(data.newQty ?? 0),
    difference: Number(data.difference ?? Number(data.newQty ?? 0) - Number(data.previousQty ?? 0)),
    unit: String(data.unit ?? ''),
    changedBy: String(data.changedBy ?? ''),
    changedByName: String(data.changedByName ?? 'Staff'),
    source: (data.source as StockLogSource) ?? 'kitchen',
    createdAt: (data.createdAt as Timestamp) ?? null,
  }
}
