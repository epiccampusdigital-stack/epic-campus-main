import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { generateCertificatePDF, generateCertificateNumber } from '@/lib/certificates/generateCertificate'

export const dynamic = 'force-dynamic'

const COURSE_NAMES: Record<string, string> = {
  'japan-ssw': 'Japanese Language & SSW Program',
  'korea': 'Korean Language Program',
  'china': 'Chinese Language Program',
  'ielts': 'IELTS Preparation Program',
  'nvq': 'National Vocational Qualification',
}

export async function POST(req: NextRequest) {
  try {
    const { studentId } = await req.json() as { studentId: string }
    if (!studentId) return NextResponse.json({ error: 'studentId required' }, { status: 400 })

    const studentSnap = await adminDb.collection('students').doc(studentId).get()
    if (!studentSnap.exists) return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    const student = studentSnap.data()!

    const existingCert = await adminDb.collection('certificates')
      .where('studentId', '==', studentId)
      .where('courseId', '==', student.courseId as string)
      .limit(1)
      .get()

    if (!existingCert.empty) {
      const cert = existingCert.docs[0].data()
      const pdfBytes = await generateCertificatePDF({
        studentName: cert.studentName as string,
        courseId: cert.courseId as string,
        courseName: cert.courseName as string,
        batch: cert.batch as string,
        completionDate: cert.completionDate as string,
        certificateNumber: cert.certificateNumber as string,
        verifyUrl: cert.verifyUrl as string,
      })
      const base64 = Buffer.from(pdfBytes).toString('base64')
      return NextResponse.json({ success: true, certificateNumber: cert.certificateNumber, pdfBase64: base64, alreadyExists: true })
    }

    const certNumber = generateCertificateNumber(
      String(student.studentCode ?? studentId.slice(0, 6)),
      String(student.courseId ?? 'course')
    )
    const completionDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    const verifyUrl = `epiccampus.live/verify/${certNumber}`

    const certData = {
      studentName: String(student.name ?? student.displayName ?? 'Student'),
      courseId: String(student.courseId ?? 'course'),
      courseName: COURSE_NAMES[String(student.courseId)] ?? 'Course',
      batch: String(student.batch ?? `Batch ${String(student.batchNumber ?? '')}`),
      completionDate,
      certificateNumber: certNumber,
      verifyUrl,
    }

    const pdfBytes = await generateCertificatePDF(certData)

    await adminDb.collection('certificates').add({
      ...certData,
      studentId,
      studentCode: String(student.studentCode ?? ''),
      issuedAt: new Date().toISOString(),
      status: 'active',
    })

    // Send WhatsApp with verify link
    try {
      const phone = student.phone ?? student.mobile
      if (phone) {
        const { sendCertificateIssued } = await import('@/lib/twilio/helpers')
        await sendCertificateIssued(
          String(phone),
          certData.studentName,
          certData.courseName,
          certNumber
        )
      }
    } catch (err) {
      console.error('[CertWhatsApp]', err)
    }

    const base64 = Buffer.from(pdfBytes).toString('base64')
    return NextResponse.json({ success: true, certificateNumber: certNumber, pdfBase64: base64 })
  } catch (err) {
    console.error('[GenerateCertificate]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
