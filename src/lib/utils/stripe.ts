const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''

export const stripeConfigured =
  (key.startsWith('pk_live_') || key.startsWith('pk_test_')) &&
  !key.includes('placeholder')
