'use client'

import type { BatchAccountSettings } from '@/lib/access/accountActivation'

/**
 * The three-state Account Activation control, extracted verbatim from the
 * student profile page so the profile and the admin drill-down share ONE UI.
 * Purely presentational — the caller owns the state and the Firestore write,
 * because the two pages persist differently (single doc vs. row in a list).
 */
export type ActivationChoice = 'inherit' | 'active' | 'inactive'

/** Firestore override value -> select value. */
export function activationChoiceFromOverride(
  override: boolean | null | undefined,
): ActivationChoice {
  return override === true ? 'active' : override === false ? 'inactive' : 'inherit'
}

/** Select value -> Firestore override value. `inherit` clears the override. */
export function overrideFromActivationChoice(choice: ActivationChoice): boolean | null {
  return choice === 'inherit' ? null : choice === 'active'
}

/** Label shown inside the "Inherit batch (…)" option. */
export function batchActivationLabel(batchSettings: BatchAccountSettings | null): string {
  if (!batchSettings) return 'no batch setting — Inactive'
  return batchSettings.accountActivated ? 'Active' : 'Inactive'
}

interface AccountActivationControlProps {
  /** Current select value. */
  value: ActivationChoice
  onChange: (value: ActivationChoice) => void
  onSave: () => void
  saving: boolean
  /** Resolved state from resolveAccountActivation() — drives the badge. */
  resolved: boolean
  /** Batch fallback label, from batchActivationLabel(). */
  batchLabel: string
  /** Transient save confirmation / error text. */
  message?: string
  /** Tighter spacing for the per-student rows in the admin drill-down. */
  compact?: boolean
  /** Distinguishes multiple controls on one page for screen readers. */
  ariaLabel?: string
}

export default function AccountActivationControl({
  value,
  onChange,
  onSave,
  saving,
  resolved,
  batchLabel,
  message,
  compact = false,
  ariaLabel,
}: AccountActivationControlProps) {
  return (
    <div className={`flex flex-wrap items-center ${compact ? 'gap-2' : 'gap-3'}`}>
      <select
        value={value}
        aria-label={ariaLabel ?? 'Account Activation'}
        onChange={(e) => onChange(e.target.value as ActivationChoice)}
        className={`rounded-xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.06] text-[#0D1B2A] dark:text-white outline-none focus:border-[#0B3D6B] ${
          compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'
        }`}
      >
        <option value="inherit">Inherit batch ({batchLabel})</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
      <span
        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${
          resolved
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-red-200 bg-red-50 text-red-700'
        }`}
      >
        Resolved: {resolved ? 'Active' : 'Inactive'}
      </span>
      <button
        type="button"
        disabled={saving}
        onClick={onSave}
        className={`rounded-xl bg-[#0B3D6B] font-semibold text-white hover:bg-[#0a3460] disabled:opacity-60 ${
          compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
        }`}
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
      {message && <span className="text-xs text-emerald-600">{message}</span>}
    </div>
  )
}
