import Link from 'next/link'
import PublicNav from '@/components/public/PublicNav'
import PublicFooter from '@/components/public/PublicFooter'
import EnrollmentForm from '@/components/enrollment/EnrollmentForm'

export const metadata = {
  title: 'Enroll — EPIC Campus',
  description: 'Start your journey to Japan, Korea, China or global career success. Enroll at EPIC Campus today.',
}

export default function EnrollPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#F5F7FB]">
      <PublicNav />

      <main className="flex-1 px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-[#0B3D6B]"
          >
            <span className="ti ti-arrow-left" />
            Back to Home
          </Link>
          <h1 className="font-jakarta text-4xl font-bold text-[#0B3D6B]">
            Enroll at EPIC Campus
          </h1>
          <p className="mt-3 text-base text-gray-500">
            Start your journey to Japan, Korea, China or global career success
          </p>
          <div className="mx-auto mt-4 h-1 w-16 rounded-full bg-[#E8A020]" />
        </div>

        <div className="mx-auto mt-10 max-w-2xl">
          <EnrollmentForm />
        </div>

        <div className="mx-auto mt-8 max-w-2xl">
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="ti ti-lock text-[#E8A020]" />
              Secure application submission
            </span>
            <span className="flex items-center gap-1.5">
              <span className="ti ti-shield-check text-[#E8A020]" />
              Your data is safe
            </span>
            <span className="flex items-center gap-1.5">
              <span className="ti ti-headset text-[#E8A020]" />
              Our team will contact you within 24 hours
            </span>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}
