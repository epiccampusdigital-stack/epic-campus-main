import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
// @ts-ignore — service-account.json is gitignored; place it at the project root before running
import * as serviceAccount from '../service-account.json'

initializeApp({ credential: cert(serviceAccount as any) })
const db = getFirestore()

async function seed() {
  const month = '2026-06'
  const bills = [
    { house: 'Home 01',  ceb: 1400,    water: 3200  },
    { house: 'Home 08',  ceb: 4300,    water: 7500  },
    { house: 'Home 19',  ceb: 11000,   water: 4600  },
    { house: 'Home 20',  ceb: 27200,   water: 14500 },
    { house: 'Home 24',  ceb: 12500,   water: 3500  },
    { house: 'Home 25',  ceb: -9020,   water: 15000 },
    { house: 'Home 26',  ceb: 0,       water: 3500  },
    { house: 'Home 27',  ceb: 500,     water: 25000 },
    { house: 'Home 33',  ceb: 6500,    water: 8700  },
    { house: 'Home 41',  ceb: 7600,    water: 9700  },
    { house: 'Home 42',  ceb: 73000,   water: 13500 },
    { house: 'Campus',   ceb: 138500,  water: 419250 },
    { house: 'Hampton Hall', ceb: 1000, water: 13100 },
  ]

  for (const bill of bills) {
    const docId = `${bill.house.replace(/\s+/g, '-').toLowerCase()}_${month}`
    await db.collection('utilityBills').doc(docId).set({
      house: bill.house,
      month,
      ceb: bill.ceb,
      water: bill.water,
      total: bill.ceb + bill.water,
      currency: 'LKR',
      createdAt: Timestamp.now(),
      notes: 'Seeded from June 2026 utility details PDF',
    })
    console.log(`✓ ${bill.house} — CEB: ${bill.ceb}, Water: ${bill.water}`)
  }

  console.log('\n✅ All June 2026 utility bills seeded.')
  console.log(`Total CEB: Rs. ${bills.reduce((s,b)=>s+b.ceb,0).toLocaleString()}`)
  console.log(`Total Water: Rs. ${bills.reduce((s,b)=>s+b.water,0).toLocaleString()}`)
}

seed().catch(console.error)
