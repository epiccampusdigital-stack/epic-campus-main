import ContactForm from '@/components/public/ContactForm'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Contact Us — EPIC Campus',
  description: 'Get in touch with EPIC Campus. Visit us in Galle, call or email us.',
}

function toTelHref(line: string): string {
  const digits = line.replace(/\s+/g, '')
  if (digits.startsWith('+')) return `tel:${digits}`
  if (digits.startsWith('0')) return `tel:+94${digits.slice(1)}`
  return `tel:${digits}`
}

export default function ContactPage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#03080f] py-20">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(26,107,173,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(26,107,173,0.07)_1px,transparent_1px)] bg-[size:40px_40px]" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(11,61,107,0.4)_0%,transparent_70%)]" />
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[4px] text-[#E8A020]">Get in touch</p>
          <h1 className="font-jakarta text-[48px] font-black leading-tight text-white">Contact us</h1>
          <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-white/40">
            We are here to help. Reach out to our team and we will get back to you within 24 hours.
          </p>
        </div>
      </section>

      {/* Main content */}
      <section className="bg-white py-20 dark:bg-[#04090f]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">

          {/* Prominent WhatsApp CTA — above the form */}
          <div className="mb-12 flex flex-col items-center">
            <a
              href="https://wa.me/94912228383"
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-8 py-4 text-[15px] font-black text-white shadow-sm transition-colors hover:bg-[#1ebe57] sm:w-auto"
            >
              <span className="ti ti-brand-whatsapp text-[20px]" />
              Chat with us on WhatsApp
            </a>
            <p className="mt-2 text-center text-[12px] text-[#5A6A7A] dark:text-white/40">
              Usually responds within 1 hour · Mon–Sat 8am–6pm
            </p>
          </div>

          <div className="grid grid-cols-1 gap-10 lg:grid-cols-5">

            {/* Contact info */}
            <div className="space-y-6 lg:col-span-2">
              <div className="rounded-2xl bg-[#0B3D6B] p-7 text-white">
                <h2 className="font-jakarta text-[20px] font-black mb-6">Find us</h2>
                <div className="space-y-5">
                  {[
                    {
                      icon: 'ti-map-pin',
                      title: 'Main Office',
                      lines: ['No. 59/2, Sri Dewamitta Road', 'China Garden, Galle', 'Sri Lanka'],
                    },
                    {
                      icon: 'ti-map-pin',
                      title: 'Training Campus',
                      lines: ['Idurovita, Ataniketha', 'Thiththagalla, Ahangama', 'Galle, Sri Lanka'],
                    },
                    {
                      icon: 'ti-phone',
                      title: 'Phone',
                      lines: ['+94 91 222 83 83', '076 254 8383', '076 380 8383'],
                    },
                    {
                      icon: 'ti-mail',
                      title: 'Email',
                      lines: ['info@epiccampus.lk'],
                    },
                    {
                      icon: 'ti-world',
                      title: 'Website',
                      lines: ['www.epiccampus.live'],
                    },
                  ].map(item => (
                    <div key={item.title} className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E8A020]/20 mt-0.5">
                        <span className={`ti ${item.icon} text-[#E8A020] text-[14px]`} />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-[#E8A020] uppercase tracking-wider mb-1">{item.title}</p>
                        {item.lines.map(line => (
                          item.icon === 'ti-phone' ? (
                            <a key={line} href={toTelHref(line)} className="block text-[13px] text-white/60 hover:text-white hover:underline">{line}</a>
                          ) : (
                            <p key={line} className="text-[13px] text-white/60">{line}</p>
                          )
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Social */}
              <div className="rounded-2xl border border-[#DDE3EC] bg-white p-6 dark:border-white/[0.08] dark:bg-white/[0.04]">
                <h3 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white mb-4">Follow us</h3>
                <div className="flex gap-3">
                  {[
                    { icon: 'ti-brand-facebook', href: 'https://facebook.com/epicschoolofcomputing', label: 'Facebook' },
                    { icon: 'ti-brand-instagram', href: 'https://instagram.com/epiccampusdigital', label: 'Instagram' },
                    { icon: 'ti-brand-tiktok', href: 'https://tiktok.com/@epic_campus', label: 'TikTok' },
                  ].map(s => (
                    <a key={s.icon} href={s.href} target="_blank" rel="noopener noreferrer"
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#DDE3EC] text-[#5A6A7A] hover:border-[#0B3D6B] hover:text-[#0B3D6B] transition-all dark:border-white/10 dark:text-white/40 dark:hover:border-[#E8A020] dark:hover:text-[#E8A020]">
                      <span className={`ti ${s.icon} text-[18px]`} />
                    </a>
                  ))}
                </div>
              </div>

              {/* Hours */}
              <div className="rounded-2xl border border-[#DDE3EC] bg-white p-6 dark:border-white/[0.08] dark:bg-white/[0.04]">
                <h3 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white mb-4">Office hours</h3>
                <div className="space-y-2">
                  {[
                    { day: 'Monday — Friday', time: '8:00 AM — 5:00 PM' },
                    { day: 'Saturday', time: '8:00 AM — 1:00 PM' },
                    { day: 'Sunday', time: 'Closed' },
                  ].map(h => (
                    <div key={h.day} className="flex justify-between text-[13px]">
                      <span className="text-[#5A6A7A] dark:text-white/50">{h.day}</span>
                      <span className={`font-semibold ${h.time === 'Closed' ? 'text-red-500' : 'text-[#0B3D6B] dark:text-white'}`}>{h.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Contact form */}
            <div className="lg:col-span-3">
              <div className="rounded-2xl border border-[#DDE3EC] bg-white p-8 dark:border-white/[0.08] dark:bg-white/[0.04]">
                <h2 className="font-jakarta text-[24px] font-black text-[#0B3D6B] dark:text-white mb-1">Send us a message</h2>
                <p className="text-[14px] text-[#5A6A7A] dark:text-white/40 mb-8">We will get back to you within 24 hours.</p>
                <ContactForm />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
