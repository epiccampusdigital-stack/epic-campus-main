import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import type { InventoryItem } from '@/types/kitchen'
import { expirySortPriority } from '@/lib/kitchen/expiryHelpers'

export async function fetchActiveInventory(): Promise<InventoryItem[]> {
  const sortItems = (items: InventoryItem[]) =>
    [...items].sort((a, b) => {
      const expDiff = expirySortPriority(a) - expirySortPriority(b)
      if (expDiff !== 0) return expDiff
      return a.itemName.localeCompare(b.itemName)
    })

  try {
    const snap = await getDocs(query(collection(db, 'inventory'), where('isActive', '==', true)))
    return sortItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as InventoryItem)))
  } catch (err) {
    console.error('[fetchActiveInventory] indexed query failed, falling back', err)
    const snap = await getDocs(collection(db, 'inventory'))
    return sortItems(
      snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as InventoryItem))
        .filter((i) => i.isActive !== false),
    )
  }
}
