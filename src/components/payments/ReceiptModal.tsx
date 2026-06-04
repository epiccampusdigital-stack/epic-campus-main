'use client'

import { useRef } from 'react'
import {
  formatAmount,
  formatPaymentDate,
  getMethodLabel,
  getTypeLabel,
} from '@/lib/payments/helpers'
import { downloadReceiptPdf } from '@/lib/payments/downloadReceiptPdf'
import type { Payment } from '@/types'

interface ReceiptModalProps {
  payment: Payment | null
  open: boolean
  onClose: () => void
}

export default function ReceiptModal({ payment, open, onClose }: ReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null)

  if (!open || !payment) return null

  const isPaid = payment.status === 'paid'
  const stampLabel = isPaid ? 'PAID' : payment.status === 'pending' ? 'PENDING' : payment.status.toUpperCase()
  const stampClass = isPaid
    ? 'border-emerald-500 text-emerald-600 bg-emerald-50'
    : 'border-amber-500 text-amber-600 bg-amber-50'

  function handlePrint() {
    window.print()
  }

  async function handleDownloadPdf() {
    if (!receiptRef.current || !payment) return
    try {
      await downloadReceiptPdf(receiptRef.current, `${payment.receiptNumber}.pdf`)
    } catch (err) {
      console.error('[ReceiptModal] PDF download failed:', err)
      window.print()
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-[#0D1B2A]/50 backdrop-blur-sm print:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:static print:block print:p-0">
        <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-xl bg-white shadow-2xl print:max-h-none print:shadow-none">
          <div className="flex items-center justify-between border-b border-[#DDE3EC] px-4 py-3 print:hidden">
            <h2 className="font-jakarta font-bold text-[#0D1B2A] dark:text-white">
              Payment Receipt
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-[#5A6A7A] hover:bg-[#F5F7FB]"
              aria-label="Close"
            >
              <span className="ti ti-x text-xl" aria-hidden="true" />
            </button>
          </div>

          <div className="overflow-y-auto p-4 print:overflow-visible">
            <div
              ref={receiptRef}
              id="epic-receipt"
              className="relative rounded-lg border-2 border-[#0B3D6B]/20 bg-white p-6"
            >
              <div className="mb-4 text-center">
                <img
                  src="/images/logo-transparent.png"
                  alt="Epic Campus"
                  className="mx-auto h-14 object-contain"
                />
                <p className="mt-1 font-jakarta text-sm font-bold text-[#0B3D6B]">
                  Epic Campus
                </p>
                <p className="text-xs text-[#5A6A7A]">We Create Your Future</p>
              </div>

              <div className="mb-4 flex items-start justify-between border-b border-[#DDE3EC] pb-4">
                <div>
                  <p className="text-xs uppercase text-[#5A6A7A]">Receipt No</p>
                  <p className="font-jakarta font-bold text-[#0B3D6B]">
                    {payment.receiptNumber}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase text-[#5A6A7A]">Date</p>
                  <p className="text-sm font-medium text-[#0D1B2A] dark:text-white">
                    {formatPaymentDate(payment.paymentDate)}
                  </p>
                </div>
              </div>

              <div className="mb-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#5A6A7A]">Student</span>
                  <span className="font-medium text-[#0D1B2A] dark:text-white">{payment.studentName}</span>
                </div>
                {payment.studentCode && (
                  <div className="flex justify-between">
                    <span className="text-[#5A6A7A]">Student ID</span>
                    <span className="text-[#0D1B2A] dark:text-white">{payment.studentCode}</span>
                  </div>
                )}
                {payment.agentName && (
                  <div className="flex justify-between">
                    <span className="text-[#5A6A7A]">Agent</span>
                    <span className="text-[#0D1B2A] dark:text-white">{payment.agentName}</span>
                  </div>
                )}
                {payment.courseName && (
                  <div className="flex justify-between">
                    <span className="text-[#5A6A7A]">Course</span>
                    <span className="text-right text-[#0D1B2A] dark:text-white">{payment.courseName}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-[#5A6A7A]">Type</span>
                  <span className="capitalize text-[#0D1B2A] dark:text-white">{getTypeLabel(payment.type)}</span>
                </div>
              </div>

              <div className="mb-4 rounded-lg bg-[#F5F7FB] py-4 text-center">
                <p className="text-xs uppercase tracking-wide text-[#5A6A7A]">Amount Received</p>
                <p className="font-jakarta text-3xl font-bold text-[#0B3D6B]">
                  {formatAmount(payment.amount, payment.currency)}
                </p>
              </div>

              <div className="mb-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#5A6A7A]">Method</span>
                  <span className="text-[#0D1B2A] dark:text-white">{getMethodLabel(payment.method)}</span>
                </div>
                {payment.bankReference && (
                  <div className="flex justify-between">
                    <span className="text-[#5A6A7A]">Reference</span>
                    <span className="text-[#0D1B2A] dark:text-white">{payment.bankReference}</span>
                  </div>
                )}
                {payment.stripeId && (
                  <div className="flex justify-between">
                    <span className="text-[#5A6A7A]">Stripe ID</span>
                    <span className="truncate text-[#0D1B2A] dark:text-white">{payment.stripeId}</span>
                  </div>
                )}
              </div>

              <div
                className={`absolute right-6 top-24 rotate-[-12deg] rounded border-2 px-4 py-1 text-lg font-black tracking-widest ${stampClass}`}
              >
                {stampLabel}
              </div>

              {payment.notes && (
                <p className="mb-4 text-xs text-[#5A6A7A]">Note: {payment.notes}</p>
              )}

              <div className="border-t border-[#DDE3EC] pt-4 text-center text-xs text-[#5A6A7A]">
                <p className="font-medium text-[#0B3D6B]">Epic Campus — Galle</p>
                <p>42 Matara Road, Galle, Sri Lanka</p>
                <p>+94 91 222 3456 · info@epiccampus.lk</p>
                <p className="mt-1">epiccampus.live</p>
              </div>
            </div>
          </div>

          <div className="flex gap-2 border-t border-[#DDE3EC] p-4 print:hidden">
            <button
              type="button"
              onClick={handlePrint}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-[#0B3D6B] py-2.5 font-jakarta text-sm font-semibold text-[#0B3D6B] hover:bg-[#0B3D6B]/5"
            >
              <span className="ti ti-printer" aria-hidden="true" />
              Print
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#E8A020] py-2.5 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942]"
            >
              <span className="ti ti-download" aria-hidden="true" />
              Download PDF
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
