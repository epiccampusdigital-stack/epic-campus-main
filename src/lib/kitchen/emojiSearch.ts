interface EmojiMartEmoji {
  id: string
  name: string
  keywords: string[]
  skins: { native: string }[]
}

interface EmojiMartData {
  emojis: Record<string, EmojiMartEmoji>
}

let emojiData: EmojiMartData | null = null

function getEmojiData(): EmojiMartData {
  if (!emojiData) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    emojiData = require('@emoji-mart/data') as EmojiMartData
  }
  return emojiData
}

export function searchEmoji(query: string, maxResults = 5): string[] {
  if (!query || query.trim().length < 2) return []
  const q = query.toLowerCase().trim()
  const results: Array<{ emoji: string; score: number }> = []

  for (const emoji of Object.values(getEmojiData().emojis)) {
    const native = emoji.skins?.[0]?.native
    if (!native) continue

    let score = 0
    const nameLower = emoji.name.toLowerCase()

    // Exact name match
    if (nameLower === q) score = 100
    // Name starts with query
    else if (nameLower.startsWith(q)) score = 80
    // Name contains query
    else if (nameLower.includes(q)) score = 60
    // Keyword exact match
    else if (emoji.keywords?.some((k) => k === q)) score = 50
    // Keyword starts with query
    else if (emoji.keywords?.some((k) => k.startsWith(q))) score = 30
    // Keyword contains query
    else if (emoji.keywords?.some((k) => k.includes(q))) score = 10

    if (score > 0) results.push({ emoji: native, score })
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map((r) => r.emoji)
}

// Keep a small hardcoded fallback for common Sri Lankan kitchen items
// that emoji keywords don't cover well
export const SL_KITCHEN_FALLBACKS: Record<string, string> = {
  'halmasso': '🐟',
  'hal masso': '🐟',
  'goraka': '🟤',
  'maldive fish': '🐟',
  'umbalakada': '🐟',
  'kurakkan': '🌾',
  'pittu': '🫓',
  'hoppers': '🫓',
  'string hoppers': '🌾',
  'kottu': '🍽️',
  'dhal': '🫘',
  'parippu': '🫘',
  'pol': '🥥',
  'coconut': '🥥',
  'rampe': '🌿',
  'pandan': '🌿',
  'karapincha': '🌿',
  'curry leaves': '🌿',
  'sera': '🌿',
  'lemongrass': '🌿',
  'sausage': '🌭',
  'sesame': '🫙',
  'sesame oil': '🫙',
  'turmeric': '🟡',
  'termeric': '🟡',
  'suduru': '🫙',
  'cumin': '🫙',
  'soya': '🫘',
  'soya meat': '🫘',
  'soya sauce': '🫙',
  'soya sause': '🫙',
  'stock powder': '🧂',
  'sunquick': '🧃',
  'sweet potato': '🍠',
  'batala': '🍠',
  'manioc': '🍠',
  'cassava': '🍠',
  'jackfruit': '🍈',
  'del': '🍈',
  'breadfruit': '🍈',
  'kos': '🍈',
  'banana': '🍌',
  'kesel': '🍌',
  'papaya': '🍈',
  'pineapple': '🍍',
  'mango': '🥭',
  'amba': '🥭',
  'washing powder': '🧴',
  'dish soap': '🧴',
  'bleach': '🧴',
  'detergent': '🧴',
  'tissue': '🧻',
  'toilet paper': '🧻',
  'garbage bag': '🗑️',
  'trash bag': '🗑️',
  'gloves': '🧤',
  'sponge': '🧽',
  'vinegar': '🫙',
  'salt pieces': '🧂',
  'salt powder': '🧂',
  'salt': '🧂',
  'pepper': '🌶️',
  'chilli': '🌶️',
  'chili': '🌶️',
  'cardamom': '🫙',
  'cinnamon': '🫙',
  'cloves': '🫙',
  'mustard': '🫙',
  'fenugreek': '🫙',
  'uluhaal': '🫙',
  'honey': '🍯',
  'jam': '🍯',
  'peanut butter': '🥜',
  'biscuit': '🍪',
  'cracker': '🍘',
  'chocolate': '🍫',
  'ice': '🧊',
  'milo': '☕',
  'ovaltine': '☕',
  'horlicks': '☕',
}

export function getEmojiForItem(itemName: string): string {
  const lower = itemName.toLowerCase().trim()
  // Check SL fallbacks first
  for (const [key, emoji] of Object.entries(SL_KITCHEN_FALLBACKS)) {
    if (lower.includes(key) || key.includes(lower)) return emoji
  }
  // Then search emoji-mart
  const results = searchEmoji(lower, 1)
  return results[0] ?? '📦'
}
