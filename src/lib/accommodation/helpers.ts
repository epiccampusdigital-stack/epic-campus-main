import { collection, doc, writeBatch } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import type { InventoryCategory } from '@/types/accommodation'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** "2026-07" → "July 2026" */
export function monthKeyToLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  if (!y || !m) return key
  return `${MONTH_NAMES[m - 1]} ${y}`
}

/** Current month key, e.g. "2026-07" */
export function currentMonthKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export interface MonthOption {
  key: string
  label: string
  month: string
  year: number
}

/** Current month + previous (count - 1) months, newest first. */
export function monthOptionsList(count: number): MonthOption[] {
  const out: MonthOption[] = []
  const base = new Date()
  for (let i = 0; i < count; i++) {
    const dt = new Date(base.getFullYear(), base.getMonth() - i, 1)
    const y = dt.getFullYear()
    const m = dt.getMonth() + 1
    out.push({
      key: `${y}-${String(m).padStart(2, '0')}`,
      label: `${MONTH_NAMES[m - 1]} ${y}`,
      month: `${MONTH_NAMES[m - 1]} ${y}`,
      year: y,
    })
  }
  return out
}

/** Derive a location badge from the house name. */
export function locationFromName(name: string): string {
  const n = (name || '').toLowerCase()
  if (n.includes('ahangama')) return 'Ahangama'
  if (n.includes('waduraba')) return 'Waduraba'
  if (n.includes('pinnaduwa')) return 'Pinnaduwa'
  if (n.includes('galle')) return 'Galle'
  if (n.includes('hampton')) return 'Hampton'
  return 'Other'
}

interface SeedHouse {
  id: string
  name: string
  capacity: number
  monthlyRent: number
  rentDueDay: number
}

export const SEED_HOUSES: SeedHouse[] = [
  { id: 'house-01', name: 'Ahangama House 1', capacity: 6, monthlyRent: 25000, rentDueDay: 5 },
  { id: 'house-02', name: 'Ahangama House 2', capacity: 6, monthlyRent: 25000, rentDueDay: 5 },
  { id: 'house-03', name: 'Ahangama House 3', capacity: 6, monthlyRent: 22000, rentDueDay: 5 },
  { id: 'house-04', name: 'Ahangama House 4', capacity: 6, monthlyRent: 22000, rentDueDay: 5 },
  { id: 'house-05', name: 'Ahangama House 5', capacity: 4, monthlyRent: 18000, rentDueDay: 5 },
  { id: 'house-06', name: 'Ahangama House 6', capacity: 4, monthlyRent: 18000, rentDueDay: 5 },
  { id: 'house-07', name: 'Ahangama House 7', capacity: 8, monthlyRent: 30000, rentDueDay: 10 },
  { id: 'house-08', name: 'Ahangama House 8', capacity: 8, monthlyRent: 30000, rentDueDay: 10 },
  { id: 'house-09', name: 'Waduraba House 1', capacity: 6, monthlyRent: 20000, rentDueDay: 5 },
  { id: 'house-10', name: 'Waduraba House 2', capacity: 6, monthlyRent: 20000, rentDueDay: 5 },
  { id: 'house-11', name: 'Pinnaduwa House 1', capacity: 6, monthlyRent: 18000, rentDueDay: 5 },
  { id: 'house-12', name: 'Pinnaduwa House 2', capacity: 6, monthlyRent: 18000, rentDueDay: 5 },
  { id: 'house-13', name: 'Galle House 1', capacity: 4, monthlyRent: 35000, rentDueDay: 1 },
  { id: 'house-14', name: 'Galle House 2', capacity: 4, monthlyRent: 35000, rentDueDay: 1 },
  { id: 'house-15', name: 'Hampton House', capacity: 10, monthlyRent: 45000, rentDueDay: 1 },
]

export const DEFAULT_INVENTORY: { category: InventoryCategory; items: string[] }[] = [
  { category: 'Furniture', items: ['Bed Frame', 'Mattress', 'Wardrobe', 'Study Table', 'Chair', 'Shelf Unit', 'Curtains'] },
  { category: 'Appliance', items: ['Ceiling Fan', 'Table Fan', 'Light Bulbs', 'Extension Cord'] },
  { category: 'Kitchen', items: ['Gas Cooker', 'Gas Cylinder', 'Pots & Pans Set', 'Plates & Bowls', 'Cups & Glasses', 'Cutlery Set', 'Kitchen Rack'] },
  { category: 'Bathroom', items: ['Shower Head', 'Towel Rail', 'Mirror', 'Bucket & Mug'] },
  { category: 'Bedding', items: ['Pillow', 'Pillow Cover', 'Bed Sheet'] },
  { category: 'Other', items: ['Door Lock & Key', 'Window Latch', 'Fire Extinguisher'] },
]

/**
 * One-time seed: writes the 15 houses (ids house-01..house-15) plus a default
 * inventory checklist into each house's inventory subcollection. Batched in
 * chunks to stay under Firestore's 500-op limit. Returns the number of houses.
 */
export async function seedAccommodations(createdBy: string): Promise<number> {
  const nowIso = new Date().toISOString()
  let batch = writeBatch(db)
  let ops = 0

  const flush = async (force = false) => {
    if (force || ops >= 400) {
      await batch.commit()
      batch = writeBatch(db)
      ops = 0
    }
  }

  for (const h of SEED_HOUSES) {
    batch.set(doc(db, 'accommodations', h.id), {
      name: h.name,
      address: '',
      landlordName: '',
      landlordPhone: '',
      monthlyRent: h.monthlyRent,
      rentDueDay: h.rentDueDay,
      capacity: h.capacity,
      status: 'active',
      notes: '',
      createdAt: nowIso,
      createdBy,
    })
    ops += 1
    await flush()

    for (const group of DEFAULT_INVENTORY) {
      for (const itemName of group.items) {
        batch.set(doc(collection(db, 'accommodations', h.id, 'inventory')), {
          houseId: h.id,
          itemName,
          category: group.category,
          present: true,
          condition: 'good',
          notes: '',
        })
        ops += 1
        await flush()
      }
    }
  }

  await flush(true)
  return SEED_HOUSES.length
}
