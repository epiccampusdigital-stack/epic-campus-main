import { Timestamp } from 'firebase/firestore'

export type InventoryCategory = 'grains' | 'protein' | 'vegetables' | 'dairy' | 'condiments' | 'beverages' | 'other'
export type StockUnit = 'kg' | 'litres' | 'units' | 'grams'
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'tea' | 'morning-tea' | 'evening-tea'
export type WasteReason = 'overcooked' | 'expired' | 'leftover' | 'spoiled' | 'dropped' | 'other'
export type WasteType = 'food_waste' | 'spoiled' | 'other'
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
  notes?: string
  lastRestockedDate?: string
  emoji?: string
}

export interface ItemBrand {
  id: string
  brandName: string
  supplierName: string
  pricePerUnit: number
  isPreferred: boolean
  createdAt: Timestamp
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
  // Simplified weight-based waste log (new form). Legacy item-based entries omit these.
  wasteType?: WasteType
  weightKg?: number
  spoiledItems?: string
  expiredItems?: string
  mealType?: string
  loggedAt?: Timestamp
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
  /** Inventory category, carried so the order list can group by category. */
  category?: InventoryCategory
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

export interface SelectedIngredient {
  itemId: string
  itemName: string
  emoji: string
  sinhalaName?: string
  qty: number
  unit: StockUnit
  unitCost: number
}

export interface MealTemplateIngredient {
  itemId: string
  itemName: string
  emoji: string
  qty: number
  unit: StockUnit
  unitCost: number
}

export interface MealTemplate {
  id: string
  name: string
  sinhalaName: string
  mealType: MealType
  ingredients: MealTemplateIngredient[]
  createdAt: Timestamp
  createdBy: string
  location: string
  usageCount: number
}

export interface DailyMenuIngredient {
  itemId: string
  itemName: string
  sinhalaName?: string
  emoji: string
  baseQty: number
  unit: StockUnit
  unitCost: number
}

export interface DailyMenu {
  id: string
  menuName: string
  sinhalaName: string
  mealType: MealType
  location: string
  isActive: boolean
  baseStudentCount: number
  ingredients: DailyMenuIngredient[]
  createdAt: Timestamp
  updatedAt: Timestamp
  createdBy: string
}

export interface IntakeItemRow {
  inventoryItemId: string
  itemName: string
  quantityReceived: number
  unitCost: number
  lineTotal: number
}

export interface KitchenIntake {
  id: string
  intakeDate: string
  supplier: string
  invoiceNumber: string
  invoiceTotal: number
  receiptUrl: string | null
  receiptFileName: string | null
  notes: string
  items: IntakeItemRow[]
  createdAt: Timestamp
  createdBy: string
  createdByName: string
  location: string
}
