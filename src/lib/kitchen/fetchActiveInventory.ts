import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import type { InventoryItem } from '@/types/kitchen'

export async function fetchActiveInventory(): Promise<InventoryItem[]> {
  try {
    const snap = await getDocs(query(collection(db, 'inventory'), where('isActive', '==', true)))
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as InventoryItem))
      .sort((a, b) => a.itemName.localeCompare(b.itemName))
  } catch (err) {
    console.error('[fetchActiveInventory] indexed query failed, falling back', err)
    const snap = await getDocs(collection(db, 'inventory'))
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as InventoryItem))
      .filter((i) => i.isActive !== false)
      .sort((a, b) => a.itemName.localeCompare(b.itemName))
  }
}
