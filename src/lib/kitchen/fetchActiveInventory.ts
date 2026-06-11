import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { getExpirySortKey } from '@/lib/kitchen/expiryHelpers'
import type { InventoryItem } from '@/types/kitchen'

export async function fetchActiveInventory(): Promise<InventoryItem[]> {
  let items: InventoryItem[]
  try {
    const snap = await getDocs(query(collection(db, 'inventory'), where('isActive', '==', true)))
    items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as InventoryItem))
  } catch (err) {
    console.error('[fetchActiveInventory] indexed query failed, falling back', err)
    const snap = await getDocs(collection(db, 'inventory'))
    items = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as InventoryItem))
      .filter((i) => i.isActive !== false)
  }

  return items.sort((a, b) => {
    const ka = getExpirySortKey(a)
    const kb = getExpirySortKey(b)
    if (ka !== kb) return ka - kb
    return a.itemName.localeCompare(b.itemName)
  })
}
