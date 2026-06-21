import { Timestamp } from 'firebase/firestore'

export type SuppliesCategory =
  | 'stationery'
  | 'first_aid'

export type StationerySubcategory =
  | 'writing'
  | 'paper'
  | 'filing'
  | 'printing'
  | 'other_stationery'

export type FirstAidSubcategory =
  | 'medicines'
  | 'bandages'
  | 'sanitization'
  | 'equipment'
  | 'other_firstaid'

export type SupplyUnit =
  | 'units'
  | 'boxes'
  | 'packets'
  | 'bottles'
  | 'rolls'
  | 'reams'

export interface SupplyItem {
  id: string
  itemName: string
  category: SuppliesCategory
  subcategory: StationerySubcategory | FirstAidSubcategory
  unit: SupplyUnit
  currentStock: number
  minStockLevel: number
  unitCost: number
  notes?: string
  expiryDate?: string
  lastRestockedDate?: string
  updatedBy: string
  updatedByName: string
  lastUpdated: Timestamp
  isActive: boolean
}

export interface SupplyBrand {
  id: string
  brandName: string
  supplierName: string
  pricePerUnit: number
  isPreferred: boolean
  createdAt: Timestamp
}

export interface SupplyHistoryEntry {
  id: string
  action: 'restocked' | 'removed' | 'adjusted'
  qty: number
  reason: string
  brand?: string
  supplier?: string
  invoiceNumber?: string
  notes?: string
  date: string
  by: string
  byName: string
  createdAt: Timestamp
}
