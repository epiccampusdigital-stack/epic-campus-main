import { findFoodItem, getFoodEmoji } from '@/lib/kitchen/foodImages'
import type {
  DailyMenuIngredient,
  IngredientUsed,
  InventoryItem,
  MealTemplateIngredient,
  SelectedIngredient,
} from '@/types/kitchen'

export function inventoryToSelected(item: InventoryItem, qty = 1): SelectedIngredient {
  const food = findFoodItem(item.itemName)
  return {
    itemId: item.id,
    itemName: item.itemName,
    emoji: getFoodEmoji(item.itemName),
    sinhalaName: food?.sinhalaName,
    qty,
    unit: item.unit,
    unitCost: item.unitCost,
  }
}

export function templateToSelected(
  ing: MealTemplateIngredient,
  inventory: InventoryItem[],
): SelectedIngredient | null {
  const item = inventory.find((i) => i.id === ing.itemId)
  if (!item) return null
  const food = findFoodItem(item.itemName)
  return {
    itemId: item.id,
    itemName: item.itemName,
    emoji: ing.emoji || getFoodEmoji(item.itemName),
    sinhalaName: food?.sinhalaName,
    qty: ing.qty,
    unit: ing.unit,
    unitCost: item.unitCost,
  }
}

export function menuIngredientsToSelected(
  ingredients: DailyMenuIngredient[],
  baseStudentCount: number,
  todayStudentCount: number,
  inventory: InventoryItem[],
): SelectedIngredient[] {
  return ingredients.reduce<SelectedIngredient[]>((acc, ing) => {
      const item = inventory.find((i) => i.id === ing.itemId)
      if (!item) return acc
      const qty = scaleQuantity(ing.baseQty, baseStudentCount, todayStudentCount)
      acc.push({
        itemId: item.id,
        itemName: item.itemName,
        emoji: ing.emoji || getFoodEmoji(item.itemName),
        sinhalaName: ing.sinhalaName ?? findFoodItem(item.itemName)?.sinhalaName,
        qty,
        unit: ing.unit,
        unitCost: item.unitCost,
      })
      return acc
    }, [])
}

export function scaleQuantity(
  baseQty: number,
  baseCount: number,
  todayCount: number,
): number {
  if (baseCount <= 0) return baseQty
  return Math.round(baseQty * (todayCount / baseCount) * 10) / 10
}

export function selectedToIngredientsUsed(selected: SelectedIngredient[]): IngredientUsed[] {
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

export function selectedToTemplateIngredients(
  selected: SelectedIngredient[],
): MealTemplateIngredient[] {
  return selected.map((s) => ({
    itemId: s.itemId,
    itemName: s.itemName,
    emoji: s.emoji,
    qty: s.qty,
    unit: s.unit,
    unitCost: s.unitCost,
  }))
}

export function selectedToMenuIngredients(
  selected: SelectedIngredient[],
): DailyMenuIngredient[] {
  return selected.map((s) => ({
    itemId: s.itemId,
    itemName: s.itemName,
    sinhalaName: s.sinhalaName,
    emoji: s.emoji,
    baseQty: s.qty,
    unit: s.unit,
    unitCost: s.unitCost,
  }))
}

export function mergeSelectedIngredients(items: SelectedIngredient[]): SelectedIngredient[] {
  const map = new Map<string, SelectedIngredient>()
  for (const item of items) {
    const existing = map.get(item.itemId)
    if (existing) {
      map.set(item.itemId, { ...existing, qty: existing.qty + item.qty })
    } else {
      map.set(item.itemId, { ...item })
    }
  }
  return Array.from(map.values())
}
