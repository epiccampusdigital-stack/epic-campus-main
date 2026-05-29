'use client'

import { useState } from 'react'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'

const PROGRAMS = ['Japan SSW', 'Korea D2/D4', 'China', 'IELTS', 'NVQ']

export default function ContactPage() {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    program: '',
    message: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.fullName || !form.email || !form.phone || !form.program) {
      setError('Please fill in all required fields.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await addDoc(collection(db, 'inquiries'), {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        program: form.program,
        message: form.message.trim(),
        status: 'new',
        createdAt: serverTimestamp(),
      })
      setSuccess(true)
      setForm({ fullName: '', email: '', phone: '', program: '', message: '' })
    } catch {
      setError('Something went wrong. Please call us at +94 91 222 83 83.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <section className="bg-[#0B3D6B] py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="font-jakarta text-4xl font-bold">Contact Us</h1>
          <p className="mt-3 text-white/80">
            Ready to start your journey? Send us an inquiry and our team will respond within 24
            hours.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-3">
            <div className="lg:col-span-2">
              {success ? (
                <div className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center">
                  <span className="text-4xl">✅</span>
                  <h2 className="mt-4 font-jakarta text-xl font-bold text-[#0B3D6B]">
                    Inquiry Submitted!
                  </h2>
                  <p className="mt-2 text-[#5A6A7A]">
                    Thank you for contacting Epic Campus. Our team will reach out to you shortly.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSuccess(false)}
                    className="mt-6 text-sm font-semibold text-[#1A6BAD] hover:underline"
                  >
                    Submit another inquiry
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={handleSubmit}
                  className="rounded-2xl border border-[#DDE3EC] bg-white p-8"
                >
                  <h2 className="font-jakarta text-xl font-bold text-[#0B3D6B]">
                    Application / Inquiry Form
                  </h2>
                  <div className="mt-6 grid gap-5 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="text-sm font-medium text-[#0D1B2A]">
                        Full Name *
                      </label>
                      <input
                        required
                        value={form.fullName}
                        onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-[#DDE3EC] px-4 py-2.5 text-sm focus:border-[#0B3D6B] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-[#0D1B2A]">Email *</label>
                      <input
                        required
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-[#DDE3EC] px-4 py-2.5 text-sm focus:border-[#0B3D6B] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-[#0D1B2A]">Phone *</label>
                      <input
                        required
                        type="tel"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-[#DDE3EC] px-4 py-2.5 text-sm focus:border-[#0B3D6B] focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-sm font-medium text-[#0D1B2A]">
                        Program of Interest *
                      </label>
                      <select
                        required
                        value={form.program}
                        onChange={(e) => setForm({ ...form, program: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-[#DDE3EC] px-4 py-2.5 text-sm focus:border-[#0B3D6B] focus:outline-none"
                      >
                        <option value="">Select a program</option>
                        {PROGRAMS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-sm font-medium text-[#0D1B2A]">Message</label>
                      <textarea
                        rows={4}
                        value={form.message}
                        onChange={(e) => setForm({ ...form, message: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-[#DDE3EC] px-4 py-2.5 text-sm focus:border-[#0B3D6B] focus:outline-none"
                        placeholder="Tell us about your goals and any questions you have…"
                      />
                    </div>
                  </div>
                  {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="mt-6 rounded-lg bg-[#E8A020] px-8 py-3 font-jakarta text-sm font-bold text-[#0B3D6B] disabled:opacity-60"
                  >
                    {submitting ? 'Submitting…' : 'Submit Inquiry'}
                  </button>
                </form>
              )}
            </div>

            <aside className="space-y-6">
              <div className="rounded-2xl border border-[#DDE3EC] bg-white p-6">
                <h3 className="font-jakarta font-bold text-[#0B3D6B]">Contact Details</h3>
                <ul className="mt-4 space-y-3 text-sm text-[#5A6A7A]">
                  <li>
                    📍 No. 59/2, Sri Dewamitta Road,
                    <br />
                    China Garden, Galle
                  </li>
                  <li>
                    <a href="tel:+94912228383" className="hover:text-[#0B3D6B]">
                      📞 +94 91 222 83 83
                    </a>
                  </li>
                  <li>
                    <a href="mailto:info@epiccampus.lk" className="hover:text-[#0B3D6B]">
                      📧 info@epiccampus.lk
                    </a>
                  </li>
                </ul>
                <a
                  href="https://wa.me/94912228383"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 flex items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white"
                >
                  <span className="ti ti-brand-whatsapp text-lg" />
                  WhatsApp Us
                </a>
              </div>

              <div className="overflow-hidden rounded-2xl border border-[#DDE3EC] bg-[#F5F7FB]">
                <div className="flex h-48 items-center justify-center text-[#5A6A7A]">
                  <div className="text-center">
                    <span className="ti ti-map-pin text-4xl text-[#0B3D6B]" />
                    <p className="mt-2 text-sm">Epic Campus, Galle</p>
                    <p className="text-xs">Google Maps embed</p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </>
  )
}
