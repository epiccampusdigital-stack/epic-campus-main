export interface AccommodationHouse {
  id: string
  name: string               // e.g. "Ahangama House 1"
  address: string
  landlordName: string
  landlordPhone: string
  monthlyRent: number
  rentDueDay: number         // day of month rent is due, e.g. 5
  capacity: number           // max students
  status: 'active' | 'inactive'
  notes?: string
  createdAt: string
}

export interface AccommodationBill {
  id: string
  houseId: string
  month: string              // "July 2026"
  year: number
  monthKey: string           // "2026-07" for querying
  rentAmount: number
  rentPaid: boolean
  rentPaidDate?: string
  ceb: number
  water: number
  internet: number
  other: number
  otherNote?: string
  totalBill: number          // auto = rentAmount + ceb + water + internet + other
  createdAt: string
}

export interface InventoryItem {
  id: string
  houseId: string
  itemName: string
  category: 'Furniture' | 'Appliance' | 'Kitchen' | 'Bathroom' | 'Bedding' | 'Other'
  present: boolean
  condition: 'good' | 'fair' | 'poor' | 'missing'
  notes?: string
}

export type InventoryCategory = InventoryItem['category']
export type ItemCondition = InventoryItem['condition']
