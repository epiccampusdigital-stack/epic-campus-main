import { Suspense } from 'react'
import PublicNav from '@/components/public/PublicNav'
import PublicFooter from '@/components/public/PublicFooter'
import EnrollmentSuccess from '@/components/enrollment/EnrollmentSuccess'

export const metadata = {
  title: 'Enrollment Successful — EPIC Campus',
}

function SuccessLoader({ enrollmentId }: { enrollmentId: string }) {
  return <EnrollmentSuccess enrollmentId={enrollmentId} />
}

export default async function EnrollSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ enrollment_id?: string }>
}) {
  const params = await searchParams
  const enrollmentId = params.enrollment_id ?? ''

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F7FB]">
      <PublicNav />

      <main className="flex-1 px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-xl">
          <Suspense
            fallback={
              <div className="flex justify-center py-16">
                <span className="ti ti-loader-2 animate-spin text-3xl text-[#0B3D6B]" />
              </div>
            }
          >
            <SuccessLoader enrollmentId={enrollmentId} />
          </Suspense>
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}
