'use client'

import { useState } from 'react'

const PROGRAMS = [
  'Japan SSW Program',
  'Korean Language Program',
  'Chinese Language Program',
  'IELTS Residential',
  'NVQ Programs',
  'General inquiry',
]

const inputClass =
  'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[14px] text-[#0D1B2A] outline-none focus:border-[#E8A020] transition-colors dark:border-white/10 dark:bg-white/[0.04] dark:text-white'

export default function ContactForm() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [program, setProgram] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || (!email.trim() && !phone.trim())) {
      setError('Please enter your name and at least an email or phone number.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/leads/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), email: email.trim(), program, message: message.trim() }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? 'Could not send your message. Please try again.')
      }
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your message. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <span className="ti ti-circle-check text-[28px] text-emerald-600 dark:text-emerald-400" />
        </div>
        <h3 className="font-jakarta text-[20px] font-bold text-[#0B3D6B] dark:text-white">Message sent!</h3>
        <p className="mt-2 text-[14px] text-[#5A6A7A] dark:text-white/40">We&apos;ll contact you soon.</p>
      </div>
    )
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#5A6A7A] dark:text-white/50">Full name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Kasun Perera" className={inputClass} />
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#5A6A7A] dark:text-white/50">Phone number</label>
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+94 77 000 0000" className={inputClass} />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#5A6A7A] dark:text-white/50">Email address</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="kasun@email.com" className={inputClass} />
      </div>
      <div>
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#5A6A7A] dark:text-white/50">I am interested in</label>
        <select value={program} onChange={e => setProgram(e.target.value)} className={inputClass}>
          <option value="">Select a program</option>
          {PROGRAMS.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#5A6A7A] dark:text-white/50">Message</label>
        <textarea
          rows={5}
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Tell us about yourself and what you are looking for..."
          className={`${inputClass} resize-none`}
        />
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0B3D6B] py-4 text-[14px] font-black text-white transition-colors hover:bg-[#1A6BAD] disabled:opacity-60"
      >
        {submitting ? (
          <>
            <span className="ti ti-loader-2 animate-spin text-[16px]" />
            Sending...
          </>
        ) : (
          <>
            Send message
            <span className="ti ti-send text-[16px]" />
          </>
        )}
      </button>
    </form>
  )
}
