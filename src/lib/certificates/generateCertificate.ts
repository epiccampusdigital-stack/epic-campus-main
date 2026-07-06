import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

export interface CertificateData {
  studentName: string
  courseId: string
  courseName: string
  batch: string
  completionDate: string
  certificateNumber: string
  verifyUrl: string
}

const COURSE_FULL_NAMES: Record<string, string> = {
  'japan-ssw': 'Japanese Language & Specified Skilled Worker Program',
  'korea-d2d4': 'Korean Language Program',
  'china': 'Chinese Language Program',
  'ielts': 'IELTS Preparation Program',
  'nvq-it': 'National Vocational Qualification Program — Information Technology',
  'nvq-hospitality': 'National Vocational Qualification Program — Hospitality',
  'nvq-caregiving': 'National Vocational Qualification Program — Caregiving',
  'nvq-construction': 'National Vocational Qualification Program — Construction',
  'nvq-logistics': 'National Vocational Qualification Program — Logistics & Driving',
}

export async function generateCertificatePDF(data: CertificateData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([842, 595])
  const { width, height } = page.getSize()

  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

  const navy = rgb(0.043, 0.239, 0.42)
  const gold = rgb(0.91, 0.627, 0.125)
  const lightBlue = rgb(0.102, 0.42, 0.678)
  const white = rgb(1, 1, 1)
  const darkGray = rgb(0.2, 0.2, 0.2)
  const lightGray = rgb(0.6, 0.6, 0.6)

  page.drawRectangle({ x: 0, y: 0, width, height, color: white })
  page.drawRectangle({ x: 0, y: 0, width: 220, height, color: navy })
  page.drawRectangle({ x: 0, y: 0, width: 8, height, color: gold })
  page.drawRectangle({ x: 220, y: height - 6, width: width - 220, height: 6, color: gold })
  page.drawRectangle({ x: 220, y: 0, width: width - 220, height: 40, color: navy })

  page.drawCircle({ x: 110, y: height - 60, size: 80, color: white, opacity: 0.05 })
  page.drawCircle({ x: 110, y: height - 60, size: 60, color: white, opacity: 0.05 })
  page.drawCircle({ x: 30, y: 80, size: 60, color: white, opacity: 0.04 })

  page.drawText('EPIC', { x: 40, y: height - 90, size: 42, font: helveticaBold, color: white })
  page.drawText('campus', { x: 40, y: height - 118, size: 16, font: helvetica, color: gold })
  page.drawLine({ start: { x: 40, y: height - 130 }, end: { x: 180, y: height - 130 }, thickness: 1, color: lightGray, opacity: 0.3 })
  page.drawText('WE CREATE YOUR FUTURE', { x: 40, y: height - 158, size: 8, font: helveticaBold, color: gold })

  page.drawText('CERTIFICATE NO.', { x: 40, y: 220, size: 7, font: helveticaBold, color: lightGray })
  page.drawText(data.certificateNumber, { x: 40, y: 200, size: 10, font: helveticaBold, color: gold })
  page.drawText('BATCH', { x: 40, y: 160, size: 7, font: helveticaBold, color: lightGray })
  page.drawText(data.batch, { x: 40, y: 140, size: 14, font: helveticaBold, color: white })
  page.drawText('Verify at:', { x: 40, y: 90, size: 7, font: helvetica, color: lightGray })
  page.drawText(data.verifyUrl, { x: 40, y: 75, size: 6.5, font: helvetica, color: gold })

  const rightX = 260
  page.drawText('CERTIFICATE OF COMPLETION', { x: rightX, y: height - 70, size: 8, font: helveticaBold, color: lightBlue })
  page.drawText('This is to certify that', { x: rightX, y: height - 115, size: 13, font: helveticaOblique, color: lightGray })

  const nameSize = data.studentName.length > 25 ? 32 : 38
  page.drawText(data.studentName, { x: rightX, y: height - 170, size: nameSize, font: helveticaBold, color: navy })
  const nameWidth = helveticaBold.widthOfTextAtSize(data.studentName, nameSize)
  page.drawLine({ start: { x: rightX, y: height - 182 }, end: { x: rightX + Math.min(nameWidth, width - rightX - 40), y: height - 182 }, thickness: 2, color: gold })

  page.drawText('has successfully completed the', { x: rightX, y: height - 210, size: 13, font: helveticaOblique, color: lightGray })

  const courseName = COURSE_FULL_NAMES[data.courseId] ?? data.courseName
  const courseSize = courseName.length > 45 ? 13 : 16
  page.drawText(courseName, { x: rightX, y: height - 245, size: courseSize, font: helveticaBold, color: navy })
  page.drawText('at EPIC Campus, Sri Lanka', { x: rightX, y: height - 272, size: 12, font: helvetica, color: darkGray })

  page.drawLine({ start: { x: rightX, y: height - 298 }, end: { x: width - 40, y: height - 298 }, thickness: 0.5, color: lightGray })

  page.drawText('DATE OF COMPLETION', { x: rightX, y: height - 325, size: 7, font: helveticaBold, color: lightGray })
  page.drawText(data.completionDate, { x: rightX, y: height - 345, size: 13, font: helveticaBold, color: darkGray })

  const sigX = width - 200
  page.drawLine({ start: { x: sigX, y: height - 338 }, end: { x: sigX + 140, y: height - 338 }, thickness: 0.8, color: navy })
  page.drawText('Ishara Wewalwala', { x: sigX, y: height - 352, size: 10, font: helveticaBold, color: navy })
  page.drawText('Managing Director', { x: sigX, y: height - 366, size: 8, font: helvetica, color: lightGray })
  page.drawText('EPIC Campus (Pvt) Ltd', { x: sigX, y: height - 378, size: 8, font: helvetica, color: lightGray })

  page.drawText('EPIC Campus (Pvt) Ltd  |  epiccampus.live  |  Ahangama, Galle, Sri Lanka', { x: 240, y: 14, size: 8, font: helvetica, color: gold })

  return await pdfDoc.save()
}

export function generateCertificateNumber(studentCode: string, courseId: string): string {
  const year = new Date().getFullYear()
  const month = String(new Date().getMonth() + 1).padStart(2, '0')
  const courseCode = courseId.toUpperCase().slice(0, 3)
  const random = Math.floor(1000 + Math.random() * 9000)
  return `EC-${year}${month}-${courseCode}-${studentCode}-${random}`
}
