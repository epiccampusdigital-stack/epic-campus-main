import { getEmojiForItem } from './emojiSearch'

export interface FoodItem {
  name: string
  emoji: string
  category: 'grains' | 'protein' | 'vegetables' | 'dairy' | 'condiments' | 'beverages' | 'other'
  sinhalaName?: string
}

export const FOOD_LIBRARY: FoodItem[] = [
  { name: 'Rice', emoji: '🍚', category: 'grains', sinhalaName: 'බත්' },
  { name: 'Bread', emoji: '🍞', category: 'grains', sinhalaName: 'පාන්' },
  { name: 'Noodles', emoji: '🍜', category: 'grains', sinhalaName: 'නූඩ්ල්ස්' },
  { name: 'Flour', emoji: '🌾', category: 'grains' },
  { name: 'Dhal', emoji: '🫘', category: 'grains', sinhalaName: 'පරිප්පු' },
  { name: 'Chicken', emoji: '🍗', category: 'protein', sinhalaName: 'කුකුල් මස්' },
  { name: 'Eggs', emoji: '🥚', category: 'protein', sinhalaName: 'බිත්තර' },
  { name: 'Fish', emoji: '🐟', category: 'protein', sinhalaName: 'මාළු' },
  { name: 'Canned fish', emoji: '🐠', category: 'protein' },
  { name: 'Beef', emoji: '🥩', category: 'protein', sinhalaName: 'හරක් මස්' },
  { name: 'Tomatoes', emoji: '🍅', category: 'vegetables', sinhalaName: 'තක්කාලි' },
  { name: 'Onions', emoji: '🧅', category: 'vegetables', sinhalaName: 'ලූනු' },
  { name: 'Potatoes', emoji: '🥔', category: 'vegetables', sinhalaName: 'ආළු' },
  { name: 'Carrots', emoji: '🥕', category: 'vegetables', sinhalaName: 'කැරට්' },
  { name: 'Cabbage', emoji: '🥬', category: 'vegetables', sinhalaName: 'ගෝවා' },
  { name: 'Pumpkin', emoji: '🎃', category: 'vegetables', sinhalaName: 'වට්ටක්කා' },
  { name: 'Beans', emoji: '🫛', category: 'vegetables' },
  { name: 'Green chilli', emoji: '🌶️', category: 'vegetables', sinhalaName: 'මිරිස්' },
  { name: 'Garlic', emoji: '🧄', category: 'vegetables', sinhalaName: 'සූදුළූනු' },
  { name: 'Milk powder', emoji: '🥛', category: 'dairy', sinhalaName: 'කිරිපිටි' },
  { name: 'Butter', emoji: '🧈', category: 'dairy' },
  { name: 'Coconut milk', emoji: '🥥', category: 'dairy', sinhalaName: 'පොල් කිරි' },
  { name: 'Coconut oil', emoji: '🫙', category: 'condiments', sinhalaName: 'පොල් තෙල්' },
  { name: 'Salt', emoji: '🧂', category: 'condiments', sinhalaName: 'ලුණු' },
  { name: 'Sugar', emoji: '🍬', category: 'condiments', sinhalaName: 'සීනි' },
  { name: 'Chilli powder', emoji: '🌶️', category: 'condiments' },
  { name: 'Curry powder', emoji: '🫙', category: 'condiments', sinhalaName: 'කරිපිංචා' },
  { name: 'Soy sauce', emoji: '🍶', category: 'condiments' },
  { name: 'Tea leaves', emoji: '🍵', category: 'beverages', sinhalaName: 'තේ' },
  { name: 'Coffee', emoji: '☕', category: 'beverages' },
  { name: 'Other', emoji: '📦', category: 'other' },
]

export const CATEGORY_PILLS: {
  id: FoodItem['category'] | ''
  label: string
  emoji: string
}[] = [
  { id: '', label: 'All', emoji: '🍽️' },
  { id: 'grains', label: 'Grains', emoji: '🌾' },
  { id: 'protein', label: 'Protein', emoji: '🍗' },
  { id: 'vegetables', label: 'Veg', emoji: '🥬' },
  { id: 'dairy', label: 'Dairy', emoji: '🥛' },
  { id: 'condiments', label: 'Condiments', emoji: '🧂' },
  { id: 'beverages', label: 'Beverages', emoji: '🍵' },
]

export function getFoodEmoji(itemName: string): string {
  // First check the curated FOOD_LIBRARY for exact/partial match
  const found = FOOD_LIBRARY.find(
    (f) =>
      f.name.toLowerCase() === itemName.toLowerCase() ||
      itemName.toLowerCase().includes(f.name.toLowerCase()),
  )
  if (found?.emoji) return found.emoji
  // Fall back to emoji-mart search + SL fallbacks
  return getEmojiForItem(itemName)
}

export function findFoodItem(itemName: string): FoodItem | undefined {
  const lower = itemName.toLowerCase().trim()
  return FOOD_LIBRARY.find(
    (f) =>
      f.name.toLowerCase() === lower ||
      lower.includes(f.name.toLowerCase()) ||
      f.name.toLowerCase().includes(lower),
  )
}

export function getFoodByCategory(category: FoodItem['category']): FoodItem[] {
  return FOOD_LIBRARY.filter((f) => f.category === category)
}

export const MEAL_SESSION_VISUAL: Record<
  string,
  { emoji: string; sinhala: string; time: string }
> = {
  breakfast: { emoji: '🌅', sinhala: 'උදේ ආහාරය', time: '7:00 AM – 9:00 AM' },
  lunch: { emoji: '☀️', sinhala: 'දිවා ආහාරය', time: '12:00 PM – 1:30 PM' },
  dinner: { emoji: '🌙', sinhala: 'රාත්‍රී ආහාරය', time: '6:30 PM – 8:00 PM' },
  tea: { emoji: '☕', sinhala: 'තේ වේල', time: '3:30 PM – 4:30 PM' },
}

export const WASTE_REASON_VISUAL: {
  id: import('@/types/kitchen').WasteReason
  label: string
  emoji: string
}[] = [
  { id: 'overcooked', label: 'Overcooked', emoji: '🔥' },
  { id: 'expired', label: 'Expired', emoji: '⏰' },
  { id: 'leftover', label: 'Leftover', emoji: '🍽️' },
  { id: 'spoiled', label: 'Spoiled', emoji: '🤢' },
  { id: 'dropped', label: 'Dropped', emoji: '💧' },
  { id: 'other', label: 'Other', emoji: '❓' },
]
