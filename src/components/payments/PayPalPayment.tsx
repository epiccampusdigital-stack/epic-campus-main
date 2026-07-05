'use client'

import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'

interface PayPalPaymentProps {
  amount: number
  currency: 'LKR' | 'USD'
  description: string
  planId?: string
  installmentIndex?: number
  onSuccess?: (captureId: string) => void
  onCancel?: () => void
  onError?: (err: unknown) => void
}

const CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? ''
const LKR_TO_USD = 0.0033

export default function PayPalPayment({
  amount,
  currency,
  description,
  planId,
  installmentIndex,
  onSuccess,
  onCancel,
  onError,
}: PayPalPaymentProps) {
  const usdAmount = currency === 'LKR'
    ? (amount * LKR_TO_USD).toFixed(2)
    : amount.toFixed(2)

  if (!CLIENT_ID || CLIENT_ID === 'YOUR_PAYPAL_CLIENT_ID_HERE') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
        <p className="text-sm font-bold text-amber-700">PayPal Not Configured</p>
        <p className="mt-1 text-xs text-amber-600">Contact reception to process payment.</p>
      </div>
    )
  }

  return (
    <PayPalScriptProvider options={{
      clientId: CLIENT_ID,
      currency: 'USD',
      intent: 'capture',
    }}>
      <div className="space-y-3">
        <div className="rounded-xl bg-[#003087] p-4 text-center text-white">
          <p className="text-xs text-white/60">Paying via PayPal</p>
          <p className="font-jakarta text-2xl font-black text-[#FFC439]">
            USD {usdAmount}
          </p>
          {currency === 'LKR' && (
            <p className="text-xs text-white/50">≈ LKR {amount.toLocaleString()}</p>
          )}
        </div>

        <PayPalButtons
          style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay' }}
          createOrder={async () => {
            const res = await fetch('/api/paypal/create-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ amount, currency, description }),
            })
            const data = await res.json() as { orderId: string }
            return data.orderId
          }}
          onApprove={async (data) => {
            const res = await fetch('/api/paypal/capture-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orderId: data.orderID }),
            })
            const capture = await res.json() as { status: string; captureId: string }
            if (capture.status === 'COMPLETED') {
              if (planId && installmentIndex !== undefined) {
                await updateDoc(doc(db, 'studentPaymentPlans', planId), {
                  [`installments.${installmentIndex}.status`]: 'paid',
                  [`installments.${installmentIndex}.paidAt`]: serverTimestamp(),
                  [`installments.${installmentIndex}.method`]: 'paypal',
                  [`installments.${installmentIndex}.captureId`]: capture.captureId,
                  updatedAt: serverTimestamp(),
                })
              }
              onSuccess?.(capture.captureId)
            }
          }}
          onCancel={onCancel}
          onError={onError}
        />
      </div>
    </PayPalScriptProvider>
  )
}
