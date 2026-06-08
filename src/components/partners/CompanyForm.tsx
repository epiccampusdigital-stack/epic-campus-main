'use client'

import { useEffect, useState } from 'react'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '@/lib/firebase/client'
import { formatPartnerFee, savePartnerCompany } from '@/lib/partners/helpers'
import { useManagement } from '@/components/layout/ManagementContext'
import { logAuditEvent } from '@/lib/audit/helpers'
import type { PartnerCompany, PartnerFeeCurrency, PartnerFeeStatus } from '@/types'

export interface CompanyFormValues {
  name: string
  industry: string
  country: 'japan'
  contactName: string
  contactEmail: string
  contactPhone: string
  placementFee: string
  placementFeeCurrency: PartnerFeeCurrency
  feeStatus: PartnerFeeStatus
  status: 'active' | 'inactive'
  portalEmail: string
  portalPassword: string
}

const EMPTY: CompanyFormValues = {
  name: '',
  industry: '',
  country: 'japan',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  placementFee: '',
  placementFeeCurrency: 'LKR',
  feeStatus: 'unpaid',
  status: 'active',
  portalEmail: '',
  portalPassword: '',
}

interface CompanyFormProps {
  open: boolean
  onClose: () => void
  company?: PartnerCompany | null
  onSaved: () => void
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A] dark:text-gray-400">
      {children}
    </label>
  )
}

export default function CompanyForm({ open, onClose, company, onSaved }: CompanyFormProps) {
  const { user } = useManagement()
  const [form, setForm] = useState<CompanyFormValues>(EMPTY)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    if (company) {
      setForm({
        name: company.name,
        industry: company.industry,
        country: company.country,
        contactName: company.contactName,
        contactEmail: company.contactEmail,
        contactPhone: company.contactPhone,
        placementFee: String(company.placementFee || ''),
        placementFeeCurrency: company.placementFeeCurrency,
        feeStatus: company.feeStatus,
        status: company.status,
        portalEmail: company.contactEmail,
        portalPassword: '',
      })
    } else {
      setForm(EMPTY)
    }
    setLogoFile(null)
    setError('')
  }, [open, company])

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!form.name.trim()) {
      setError('Company name is required.')
      return
    }

    setSaving(true)
    setError('')

    try {
      let companyId = company?.id ?? null
      let logoUrl = company?.logoUrl

      if (!companyId) {
        companyId = await savePartnerCompany(null, {
          name: form.name.trim(),
          industry: form.industry.trim(),
          country: form.country,
          contactName: form.contactName.trim(),
          contactEmail: form.contactEmail.trim(),
          contactPhone: form.contactPhone.trim(),
          placementFee: Number(form.placementFee) || 0,
          placementFeeCurrency: form.placementFeeCurrency,
          feeStatus: form.feeStatus,
          status: form.status,
          createdBy: user.uid,
        })
      }

      if (logoFile && companyId) {
        const storageRef = ref(storage, `company-logos/${companyId}`)
        await uploadBytes(storageRef, logoFile)
        logoUrl = await getDownloadURL(storageRef)
      }

      await savePartnerCompany(companyId, {
        name: form.name.trim(),
        industry: form.industry.trim(),
        country: form.country,
        contactName: form.contactName.trim(),
        contactEmail: form.contactEmail.trim(),
        contactPhone: form.contactPhone.trim(),
        logoUrl,
        placementFee: Number(form.placementFee) || 0,
        placementFeeCurrency: form.placementFeeCurrency,
        feeStatus: form.feeStatus,
        status: form.status,
        loginUid: company?.loginUid,
        createdBy: user.uid,
      })

      if (form.portalEmail && form.portalPassword && form.portalPassword.length >= 6) {
        const res = await fetch('/api/partners/create-company-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            email: form.portalEmail.trim(),
            password: form.portalPassword,
            displayName: form.name.trim(),
          }),
        })
        if (!res.ok) {
          const data = (await res.json()) as { error?: string }
          throw new Error(data.error ?? 'Portal account creation failed')
        }
      }

      await logAuditEvent({
        userId: user.uid,
        userEmail: user.email,
        userRole: user.role,
        action: company ? 'updated' : 'created',
        entityType: 'partnerCompany',
        entityId: companyId,
        details: `${company ? 'Updated' : 'Created'} partner company ${form.name}`,
      })

      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save company')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-[#0D1B2A]/40" onClick={onClose} aria-hidden="true" />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-white/90 dark:bg-[#0d1a2e]/90 backdrop-blur-2xl border-l border-white/80 dark:border-white/[0.08] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#DDE3EC] px-6 py-4 dark:border-gray-600">
          <h2 className="font-jakarta text-lg font-bold text-[#0D1B2A] dark:text-white">
            {company ? 'Edit Company' : 'Add Company'}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-[#F5F7FB]">
            <span className="ti ti-x text-xl" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <div>
              <FieldLabel>Company name</FieldLabel>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel>Industry</FieldLabel>
                <input
                  value={form.industry}
                  onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
                  className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </div>
              <div>
                <FieldLabel>Country</FieldLabel>
                <input
                  value="Japan"
                  readOnly
                  className="w-full rounded-lg border border-[#DDE3EC] bg-[#F5F7FB] px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-900/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel>Contact name</FieldLabel>
                <input
                  value={form.contactName}
                  onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
                  className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </div>
              <div>
                <FieldLabel>Contact phone</FieldLabel>
                <input
                  value={form.contactPhone}
                  onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
                  className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <FieldLabel>Contact email</FieldLabel>
              <input
                type="email"
                value={form.contactEmail}
                onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
                className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
            </div>

            <div>
              <FieldLabel>Logo</FieldLabel>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm"
              />
              {company?.logoUrl && !logoFile && (
                <img src={company.logoUrl} alt="" className="mt-2 h-12 w-12 rounded object-cover" />
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel>Placement fee</FieldLabel>
                <input
                  type="number"
                  min={0}
                  value={form.placementFee}
                  onChange={(e) => setForm((f) => ({ ...f, placementFee: e.target.value }))}
                  className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </div>
              <div>
                <FieldLabel>Currency</FieldLabel>
                <select
                  value={form.placementFeeCurrency}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      placementFeeCurrency: e.target.value as PartnerFeeCurrency,
                    }))
                  }
                  className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                >
                  <option value="LKR">LKR</option>
                  <option value="JPY">JPY</option>
                </select>
              </div>
            </div>

            {form.placementFee && (
              <p className="text-xs text-[#5A6A7A]">
                Preview:{' '}
                {formatPartnerFee(Number(form.placementFee) || 0, form.placementFeeCurrency)}
              </p>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel>Fee status</FieldLabel>
                <select
                  value={form.feeStatus}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, feeStatus: e.target.value as PartnerFeeStatus }))
                  }
                  className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                >
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="na">N/A</option>
                </select>
              </div>
              <div>
                <FieldLabel>Status</FieldLabel>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      status: e.target.value as 'active' | 'inactive',
                    }))
                  }
                  className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="rounded-lg border border-[#DDE3EC] bg-[#F5F7FB] p-4 dark:border-gray-600 dark:bg-gray-900">
              <p className="mb-3 font-jakarta text-sm font-bold text-[#0B3D6B] dark:text-white">
                Portal login (optional)
              </p>
              <div className="space-y-3">
                <div>
                  <FieldLabel>Login email</FieldLabel>
                  <input
                    type="email"
                    value={form.portalEmail}
                    onChange={(e) => setForm((f) => ({ ...f, portalEmail: e.target.value }))}
                    placeholder={company?.loginUid ? 'Leave blank to keep existing' : ''}
                    className="w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                </div>
                <div>
                  <FieldLabel>New password (min 6 chars)</FieldLabel>
                  <input
                    type="password"
                    value={form.portalPassword}
                    onChange={(e) => setForm((f) => ({ ...f, portalPassword: e.target.value }))}
                    className="w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 border-t border-[#DDE3EC] px-6 py-4 dark:border-gray-600">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-[#DDE3EC] py-2.5 text-sm font-medium dark:border-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-[#E8A020] py-2.5 font-jakarta text-sm font-bold text-[#0B3D6B] disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Company'}
            </button>
          </div>
        </form>
      </aside>
    </>
  )
}
