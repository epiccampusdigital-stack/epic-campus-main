import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { safePdfText } from '@/lib/utils/pdfText'

const NAVY = rgb(0.043, 0.239, 0.42)
const GOLD = rgb(0.91, 0.627, 0.125)
const GRAY = rgb(0.4, 0.4, 0.4)

export async function generateEnrollmentCertificate(data: {
  studentName: string
  program: string
  enrollmentDate: string
  studentId: string
}): Promise<Uint8Array> {
  const studentName = safePdfText(data.studentName)
  const program = safePdfText(data.program)
  const enrollmentDate = safePdfText(data.enrollmentDate)
  const studentId = safePdfText(data.studentId)

  const doc = await PDFDocument.create()
  const page = doc.addPage([595, 842])
  const { width, height } = page.getSize()
  const font = await doc.embedFont(StandardFonts.HelveticaBold)
  const fontReg = await doc.embedFont(StandardFonts.Helvetica)

  page.drawRectangle({ x: 20, y: 20, width: width - 40, height: height - 40, borderColor: GOLD, borderWidth: 3 })
  page.drawRectangle({ x: 25, y: 25, width: width - 50, height: height - 50, borderColor: NAVY, borderWidth: 1 })

  page.drawText('EPIC CAMPUS', { x: 180, y: height - 80, size: 32, font, color: NAVY })
  page.drawText('WE CREATE YOUR FUTURE', { x: 165, y: height - 105, size: 12, font: fontReg, color: GOLD })

  page.drawLine({ start: { x: 60, y: height - 120 }, end: { x: width - 60, y: height - 120 }, thickness: 1, color: GOLD })

  page.drawText('CERTIFICATE OF ENROLLMENT', { x: 130, y: height - 170, size: 22, font, color: NAVY })

  page.drawText('This is to certify that', { x: 200, y: height - 230, size: 14, font: fontReg, color: GRAY })
  page.drawText(studentName, { x: 200 - studentName.length * 5, y: height - 270, size: 24, font, color: NAVY })

  page.drawLine({ start: { x: 100, y: height - 280 }, end: { x: width - 100, y: height - 280 }, thickness: 0.5, color: GRAY })

  page.drawText('is officially enrolled in', { x: 195, y: height - 310, size: 14, font: fontReg, color: GRAY })
  page.drawText(program, { x: 200 - program.length * 4, y: height - 345, size: 20, font, color: GOLD })

  page.drawText(`Enrollment Date: ${enrollmentDate}`, { x: 195, y: height - 395, size: 12, font: fontReg, color: GRAY })
  page.drawText(`Student ID: ${studentId}`, { x: 220, y: height - 415, size: 12, font: fontReg, color: GRAY })

  page.drawLine({ start: { x: 60, y: 120 }, end: { x: width - 60, y: 120 }, thickness: 1, color: GOLD })
  page.drawText('No. 59/2, Sri Dewamitta Road, China Garden, Galle, Sri Lanka', { x: 130, y: 95, size: 10, font: fontReg, color: GRAY })
  page.drawText('+94 91 222 83 83  |  info@epiccampus.lk  |  epiccampus.live', { x: 140, y: 78, size: 10, font: fontReg, color: GRAY })

  page.drawLine({ start: { x: 100, y: 165 }, end: { x: 230, y: 165 }, thickness: 0.5, color: NAVY })
  page.drawText('Authorized Signature', { x: 110, y: 150, size: 10, font: fontReg, color: GRAY })

  page.drawLine({ start: { x: 350, y: 165 }, end: { x: 480, y: 165 }, thickness: 0.5, color: NAVY })
  page.drawText('Institute Seal', { x: 385, y: 150, size: 10, font: fontReg, color: GRAY })

  return doc.save()
}

export async function generateExamCertificate(data: {
  studentName: string
  paperName: string
  score: string
  grade: string
  date: string
  remarks?: string
}): Promise<Uint8Array> {
  const studentName = safePdfText(data.studentName)
  const paperName = safePdfText(data.paperName)
  const score = safePdfText(data.score)
  const grade = safePdfText(data.grade)
  const date = safePdfText(data.date)
  const remarks = data.remarks ? safePdfText(data.remarks) : undefined

  const doc = await PDFDocument.create()
  const page = doc.addPage([595, 842])
  const { width, height } = page.getSize()
  const font = await doc.embedFont(StandardFonts.HelveticaBold)
  const fontReg = await doc.embedFont(StandardFonts.Helvetica)

  page.drawRectangle({ x: 20, y: 20, width: width - 40, height: height - 40, borderColor: GOLD, borderWidth: 3 })
  page.drawRectangle({ x: 25, y: 25, width: width - 50, height: height - 50, borderColor: NAVY, borderWidth: 1 })

  page.drawText('EPIC CAMPUS', { x: 180, y: height - 80, size: 32, font, color: NAVY })
  page.drawText('JAPANESE LANGUAGE PROGRAM', { x: 155, y: height - 105, size: 12, font: fontReg, color: GOLD })

  page.drawLine({ start: { x: 60, y: height - 120 }, end: { x: width - 60, y: height - 120 }, thickness: 1, color: GOLD })

  page.drawText('CERTIFICATE OF ACHIEVEMENT', { x: 135, y: height - 165, size: 22, font, color: NAVY })

  page.drawText('This is to certify that', { x: 200, y: height - 225, size: 14, font: fontReg, color: GRAY })
  page.drawText(studentName, { x: 200 - studentName.length * 5, y: height - 265, size: 24, font, color: NAVY })
  page.drawLine({ start: { x: 100, y: height - 275 }, end: { x: width - 100, y: height - 275 }, thickness: 0.5, color: GRAY })

  page.drawText('has successfully completed', { x: 185, y: height - 305, size: 14, font: fontReg, color: GRAY })
  page.drawText(paperName, { x: 200 - paperName.length * 4, y: height - 340, size: 20, font, color: GOLD })

  page.drawRectangle({ x: 200, y: height - 420, width: 180, height: 60, borderColor: NAVY, borderWidth: 1.5, color: rgb(0.95, 0.97, 1) })
  page.drawText('SCORE', { x: 265, y: height - 378, size: 10, font: fontReg, color: GRAY })
  page.drawText(score, { x: 262, y: height - 405, size: 22, font, color: NAVY })

  page.drawText(`Grade: ${grade}`, { x: 250, y: height - 445, size: 14, font, color: GOLD })
  page.drawText(`Date: ${date}`, { x: 235, y: height - 470, size: 12, font: fontReg, color: GRAY })

  if (remarks) {
    page.drawText('AI Examiner Remarks:', { x: 80, y: height - 510, size: 11, font, color: NAVY })
    const words = remarks.split(' ')
    let line = ''
    let y = height - 530
    for (const word of words) {
      if ((line + word).length > 70) {
        page.drawText(line.trim(), { x: 80, y, size: 10, font: fontReg, color: GRAY })
        y -= 15
        line = ''
      }
      line += `${word} `
    }
    if (line) page.drawText(line.trim(), { x: 80, y, size: 10, font: fontReg, color: GRAY })
  }

  page.drawLine({ start: { x: 60, y: 120 }, end: { x: width - 60, y: 120 }, thickness: 1, color: GOLD })
  page.drawText('No. 59/2, Sri Dewamitta Road, China Garden, Galle, Sri Lanka', { x: 130, y: 95, size: 10, font: fontReg, color: GRAY })
  page.drawText('+94 91 222 83 83  |  info@epiccampus.lk  |  epiccampus.live', { x: 140, y: 78, size: 10, font: fontReg, color: GRAY })

  page.drawLine({ start: { x: 100, y: 165 }, end: { x: 230, y: 165 }, thickness: 0.5, color: NAVY })
  page.drawText('Authorized Signature', { x: 110, y: 150, size: 10, font: fontReg, color: GRAY })

  return doc.save()
}

export function downloadPDF(bytes: Uint8Array, filename: string) {
  const copy = Uint8Array.from(bytes)
  const blob = new Blob([copy], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
