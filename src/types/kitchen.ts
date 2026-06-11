import { Timestamp } from 'firebase/firestore'

export type InventoryCategory = 'grains' | 'protein' | 'vegetables' | 'dairy' | 'condiments' | 'beverages' | 'other'
export type StockUnit = 'kg' | 'litres' | 'units' | 'grams'
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'tea'
export type WasteReason = 'overcooked' | 'expired' | 'leftover' | 'spoiled' | 'dropped' | 'other'
export type OrderStatus = 'draft' | 'submitted' | 'approved' | 'ordered' | 'received' | 'cancelled'

export interface InventoryItem {
  id: string
  itemName: string
  category: InventoryCategory
  unit: StockUnit
  currentStock: number
  minStockLevel: number
  unitCost: number
  lastUpdated: Timestamp
  updatedBy: string
  updatedByName: string
  isActive: boolean
  expiryDate?: string
  expiryAlertDays?: number
}

export interface KitchenBudget {
  id: string
  monthlyBudget: number
  updatedAt: Timestamp
  updatedBy: string
}

export interface IngredientUsed {
  itemId: string
  itemName: string
  qtyUsed: number
  unit: StockUnit
  unitCost: number
  totalCost: number
}

export interface MealLog {
  id: string
  date: string
  mealType: MealType
  studentCount: number
  staffCount: number
  totalServings: number
  ingredientsUsed: IngredientUsed[]
  estimatedCost: number
  costPerPerson: number
  notes: string
  loggedBy: string
  loggedByName: string
  createdAt: Timestamp
}

export interface WasteEntry {
  id: string
  date: string
  itemId: string
  itemName: string
  quantity: number
  unit: StockUnit
  reason: WasteReason
  estimatedLoss: number
  mealLogId?: string
  notes: string
  loggedBy: string
  loggedByName: string
  createdAt: Timestamp
}

export interface OrderItem {
  itemId: string
  itemName: string
  unit: StockUnit
  currentStock: number
  minStockLevel: number
  orderQty: number
  unitCost: number
  totalCost: number
}

export interface KitchenOrder {
  id: string
  items: OrderItem[]
  status: OrderStatus
  totalEstimate: number
  submittedBy: string
  submittedByName: string
  approvedBy?: string
  approvedByName?: string
  supplier?: string
  notes: string
  createdAt: Timestamp
  approvedAt?: Timestamp
  receivedAt?: Timestamp
}

export interface KitchenAISuggestion {
  suggestion: string
  priority: 'high' | 'medium' | 'low'
  potentialSaving: string
}
