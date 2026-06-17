import { findFoodItem, getFoodEmoji } from '@/lib/kitchen/foodImages'
import type {
  DailyMenu,
  DailyMenuIngredient,
  IngredientUsed,
  InventoryItem,
  MealTemplate,
  SelectedIngredient,
  StockUnit,
} from '@/types/kitchen'

export function scaleQuantity(
  baseQty: number,
  baseStudentCount: number,
  todayStudentCount: number,
): number {
  if (baseStudentCount <= 0) return baseQty
  return Math.round(baseQty * (todayStudentCount / baseStudentCount) * 10) / 10
}

export function inventoryToSelected(item: InventoryItem, qty = 1): SelectedIngredient {
  const food = findFoodItem(item.itemName)
  return {
    itemId: item.id,
    itemName: item.itemName,
    sinhalaName: food?.sinhalaName,
    emoji: getFoodEmoji(item.itemName),
    qty,
    unit: item.unit,
    unitCost: item.unitCost,
  }
}

export function templateToSelected(
  template: MealTemplate,
  inventory: InventoryItem[],
): SelectedIngredient[] {
  return template.ingredients
    .map((ing) => {
      const item = inventory.find((i) => i.id === ing.itemId)
      const food = findFoodItem(ing.itemName)
      return {
        itemId: ing.itemId,
        itemName: ing.itemName,
        sinhalaName: food?.sinhalaName,
        emoji: ing.emoji || getFoodEmoji(ing.itemName),
        qty: ing.qty,
        unit: (item?.unit ?? ing.unit) as StockUnit,
        unitCost: item?.unitCost ?? ing.unitCost,
      }
    })
    .filter((s) => s.itemId)
}

export function dailyMenuToSelected(
  menu: DailyMenu,
  todayStudentCount: number,
  inventory: InventoryItem[],
): SelectedIngredient[] {
  return menu.ingredients.map((ing) => {
    const item = inventory.find((i) => i.id === ing.itemId)
    const qty = scaleQuantity(ing.baseQty, menu.baseStudentCount, todayStudentCount)
    return {
      itemId: ing.itemId,
      itemName: ing.itemName,
      sinhalaName: ing.sinhalaName ?? findFoodItem(ing.itemName)?.sinhalaName,
      emoji: ing.emoji || getFoodEmoji(ing.itemName),
      qty,
      unit: (item?.unit ?? ing.unit) as StockUnit,
      unitCost: item?.unitCost ?? ing.unitCost,
    }
  })
}

export function rescaleMenuIngredients(
  baseIngredients: DailyMenuIngredient[],
  baseStudentCount: number,
  todayStudentCount: number,
  inventory: InventoryItem[],
): SelectedIngredient[] {
  return baseIngredients.map((ing) => {
    const item = inventory.find((i) => i.id === ing.itemId)
    return {
      itemId: ing.itemId,
      itemName: ing.itemName,
      sinhalaName: ing.sinhalaName ?? findFoodItem(ing.itemName)?.sinhalaName,
      emoji: ing.emoji || getFoodEmoji(ing.itemName),
      qty: scaleQuantity(ing.baseQty, baseStudentCount, todayStudentCount),
      unit: (item?.unit ?? ing.unit) as StockUnit,
      unitCost: item?.unitCost ?? ing.unitCost,
    }
  })
}

export function selectedToIngredients(selected: SelectedIngredient[]): IngredientUsed[] {
  return selected
    .filter((s) => s.qty > 0)
    .map((s) => ({
      itemId: s.itemId,
      itemName: s.itemName,
      qtyUsed: s.qty,
      unit: s.unit,
      unitCost: s.unitCost,
      totalCost: s.qty * s.unitCost,
    }))
}

export function estimateCost(selected: SelectedIngredient[]): number {
  return selected.reduce((sum, s) => sum + s.qty * s.unitCost, 0)
}

export function stockWarnings(
  selected: SelectedIngredient[],
  inventory: InventoryItem[],
): Array<{ itemName: string; needed: number; available: number; unit: string }> {
  return selected
    .filter((s) => {
      const item = inventory.find((i) => i.id === s.itemId)
      return item && s.qty > item.currentStock
    })
    .map((s) => {
      const item = inventory.find((i) => i.id === s.itemId)!
      return {
        itemName: s.itemName,
        needed: s.qty,
        available: item.currentStock,
        unit: s.unit,
      }
    })
}
