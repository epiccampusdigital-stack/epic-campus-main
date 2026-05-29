'use client'

import { useRef } from 'react'
import { downloadReceiptPdf } from '@/lib/payments/downloadReceiptPdf'
import {
  formatPayrollAmount,
  formatPeriodLabel,
  getEmployeeDisplayId,
  getGrossEarnings,
  getPaymentMethodLabel,
  getRoleDisplay,
} from '@/lib/payroll/helpers'
import type { PayrollRecord } from '@/types'

interface SalarySlipProps {
  record: PayrollRecord | null
  open: boolean
  onClose: () => void
}

export default function SalarySlip({ record, open, onClose }: SalarySlipProps) {
  const slipRef = useRef<HTMLDivElement>(null)

  if (!open || !record) return null

  const grossBase = getGrossEarnings(record)
  const stampClass =
    record.status === 'paid'
      ? 'border-emerald-500 text-emerald-600 bg-emerald-50'
      : record.status === 'processing'
        ? 'border-amber-500 text-amber-600 bg-amber-50'
        : 'border-sky-500 text-sky-600 bg-sky-50'

  function handlePrint() {
    window.print()
  }

  async function handleDownloadPdf() {
    if (!slipRef.current || !record) return
    try {
      await downloadReceiptPdf(
        slipRef.current,
        `${record.payrollId}-salary-slip.pdf`,
      )
    } catch (err) {
      console.error('[SalarySlip] PDF download failed:', err)
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
            <h2 className="font-jakarta font-bold text-[#0D1B2A]">Salary Slip</h2>
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
              ref={slipRef}
              id="epic-salary-slip"
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
                <p className="text-xs text-[#5A6A7A]">Salary Slip</p>
              </div>

              <div className="mb-4 flex items-start justify-between border-b border-[#DDE3EC] pb-4">
                <div>
                  <p className="text-xs uppercase text-[#5A6A7A]">Payroll ID</p>
                  <p className="font-jakarta font-bold text-[#0B3D6B]">
                    {record.payrollId}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase text-[#5A6A7A]">Pay Period</p>
                  <p className="text-sm font-medium text-[#0D1B2A]">
                    {formatPeriodLabel(record.period)}
                  </p>
                </div>
              </div>

              <div className="mb-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#5A6A7A]">Employee</span>
                  <span className="font-medium text-[#0D1B2A]">
                    {record.staffName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5A6A7A]">Role</span>
                  <span className="text-[#0D1B2A]">
                    {getRoleDisplay(record.role)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5A6A7A]">Employee ID</span>
                  <span className="text-[#0D1B2A]">
                    {getEmployeeDisplayId(record.staffId)}
                  </span>
                </div>
              </div>

              <div className="mb-4">
                <p className="mb-2 font-jakarta text-xs font-semibold uppercase text-[#0B3D6B]">
                  Earnings
                </p>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-[#DDE3EC]">
                      <td className="py-2 text-[#5A6A7A]">Basic</td>
                      <td className="py-2 text-right font-medium text-[#0D1B2A]">
                        {formatPayrollAmount(grossBase)}
                      </td>
                    </tr>
                    {record.bonus > 0 && (
                      <tr className="border-b border-[#DDE3EC]">
                        <td className="py-2 text-[#5A6A7A]">Bonus</td>
                        <td className="py-2 text-right text-[#0D1B2A]">
                          {formatPayrollAmount(record.bonus)}
                        </td>
                      </tr>
                    )}
                    {record.commission > 0 && (
                      <tr className="border-b border-[#DDE3EC]">
                        <td className="py-2 text-[#5A6A7A]">Commission</td>
                        <td className="py-2 text-right text-[#0D1B2A]">
                          {formatPayrollAmount(record.commission)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mb-4">
                <p className="mb-2 font-jakarta text-xs font-semibold uppercase text-[#0B3D6B]">
                  Deductions
                </p>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-[#DDE3EC]">
                      <td className="py-2 text-[#5A6A7A]">Tax</td>
                      <td className="py-2 text-right text-[#0D1B2A]">
                        {formatPayrollAmount(record.tax)}
                      </td>
                    </tr>
                    <tr className="border-b border-[#DDE3EC]">
                      <td className="py-2 text-[#5A6A7A]">Advances</td>
                      <td className="py-2 text-right text-[#0D1B2A]">
                        {formatPayrollAmount(record.advances)}
                      </td>
                    </tr>
                    <tr className="border-b border-[#DDE3EC]">
                      <td className="py-2 text-[#5A6A7A]">Other</td>
                      <td className="py-2 text-right text-[#0D1B2A]">
                        {formatPayrollAmount(record.otherDeductions)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mb-4 rounded-lg bg-[#F5F7FB] py-4 text-center">
                <p className="text-xs uppercase tracking-wide text-[#5A6A7A]">
                  Net Pay
                </p>
                <p className="font-jakarta text-3xl font-bold text-[#E8A020]">
                  {formatPayrollAmount(record.netPay)}
                </p>
              </div>

              <div className="mb-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#5A6A7A]">Payment Method</span>
                  <span className="text-[#0D1B2A]">
                    {getPaymentMethodLabel(record.paymentMethod)}
                  </span>
                </div>
                {record.bankDetails && (
                  <p className="mt-1 text-xs text-[#5A6A7A]">
                    {record.bankDetails}
                  </p>
                )}
              </div>

              <div
                className={`absolute right-6 top-28 rotate-[-12deg] rounded border-2 px-4 py-1 text-lg font-black uppercase tracking-widest ${stampClass}`}
              >
                {record.status}
              </div>

              <div className="mt-6 border border-dashed border-[#DDE3EC] py-6 text-center">
                <p className="text-xs uppercase tracking-widest text-[#5A6A7A]">
                  Company Stamp
                </p>
              </div>

              {record.notes && (
                <p className="mt-4 text-xs text-[#5A6A7A]">Note: {record.notes}</p>
              )}

              <div className="mt-4 border-t border-[#DDE3EC] pt-4 text-center text-xs text-[#5A6A7A]">
                <p className="font-medium text-[#0B3D6B]">Epic Campus — Galle</p>
                <p>42 Matara Road, Galle, Sri Lanka</p>
                <p>+94 91 222 3456 · info@epiccampus.lk</p>
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
