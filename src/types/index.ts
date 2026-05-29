export type Role = 'admin' | 'owner' | 'reception' | 'accountant' | 'teacher' | 'examCoordinator' | 'student'

export type CourseId = 'japan-ssw' | 'korea-d2d4' | 'china' | 'ielts' | 'nvq-it' | 'nvq-hospitality' | 'nvq-caregiving' | 'nvq-construction' | 'nvq-logistics'

export interface EpicUser {
  uid: string
  email: string
  displayName: string
  role: Role
  branchId?: string
  studentId?: string
  createdAt: string
}

export type StaffRole = Exclude<Role, 'student'>
export type StaffStatus = 'active' | 'pending' | 'suspended'
export type SalaryType = 'fixed' | 'hourly' | 'commission'

export interface StaffMember {
  id: string
  uid?: string
  email: string
  displayName: string
  role: StaffRole
  status: StaffStatus
  phone: string
  nic: string
  dateOfBirth?: string
  address?: string
  photoUrl?: string
  branchId: string
  startDate?: string
  salaryType: SalaryType
  baseSalary: number
  commissionRate?: number
  createdAt: string
  approvedBy?: string
  approvedAt?: string
}

export interface Student {
  id: string
  studentCode: string
  uid?: string
  name: string
  nic: string
  email?: string
  mobile: string
  address?: string
  dateOfBirth?: string
  photoUrl?: string
  courseId: CourseId
  batchId: string
  branchId: string
  enrollmentDate?: string
  expectedCompletionDate?: string
  feeAmount?: number
  feeCurrency?: 'LKR' | 'USD'
  registrationFee: number
  paymentStatus?: 'paid' | 'partial' | 'pending'
  status: 'active' | 'pending' | 'completed' | 'withdrawn'
  visaStatus?: 'not-started' | 'in-progress' | 'approved' | 'rejected'
  notes?: string
  createdAt: string
  createdBy: string
}

export interface StudentDocument {
  id: string
  name: string
  url: string
  uploadedAt: string
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'

export interface AttendanceRecord {
  id: string
  studentId: string
  studentName: string
  studentCode: string
  courseId: CourseId
  courseName: string
  batchName: string
  date: string
  status: AttendanceStatus
  sessionStart: string
  sessionEnd: string
  notes?: string
  markedBy: string
  createdAt: string
}

export interface VisaEvent {
  id: string
  status: Student['visaStatus']
  date: string
  notes?: string
}

export type PaymentType = 'tuition' | 'registration' | 'exam' | 'visa' | 'other'
export type PaymentMethod = 'cash' | 'bank-transfer' | 'stripe'
export type PaymentStatus = 'paid' | 'partial' | 'pending' | 'cancelled'

export interface Payment {
  id: string
  receiptNumber: string
  /** @deprecated use receiptNumber — kept for backward compatibility */
  receiptNo: string
  studentId: string
  studentName: string
  studentCode?: string
  courseId?: CourseId
  courseName?: string
  amount: number
  currency: 'LKR' | 'USD'
  type: PaymentType
  method: PaymentMethod
  bankReference?: string
  stripeId?: string
  status: PaymentStatus
  paymentDate: string
  notes?: string
  branchId: string
  createdAt: string
  createdBy: string
}

export interface Exam {
  id: string
  title: string
  type: 'internal' | 'mock' | 'official'
  courseId: CourseId
  officialExamType?: 'JLPT' | 'TOPIK' | 'IELTS' | 'JFT' | 'HSK'
  date: string
  batchId?: string
  branchId: string
  createdBy: string
}

export interface ExamResult {
  id: string
  examId: string
  studentId: string
  score?: number
  band?: string
  level?: string
  status: 'pass' | 'fail' | 'pending'
  notes?: string
  createdAt: string
  createdBy: string
}

export interface AuditLog {
  id: string
  userId: string
  userEmail: string
  userRole: Role
  action: AuditAction | string
  entityType: string
  entityId: string
  details: string
  ipAddress?: string
  createdAt: string
}

export type AuditAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'approved'
  | 'login'
  | 'logout'
  | 'payment_recorded'
  | 'student_registered'

export interface Lead {
  id: string
  name: string
  phone: string
  email?: string
  address?: string
  courseId: CourseId
  intakeDate?: string
  budget?: string
  educationLevel?: string
  source: LeadSource
  agentName?: string
  commissionRate?: number
  referralName?: string
  status: LeadStatus
  lastContact?: string
  nextFollowUp?: string
  inquiryDate?: string
  notes?: string
  convertedToStudentId?: string
  branchId: string
  createdAt: string
  createdBy: string
}

export type LeadSource =
  | 'walk-in'
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'whatsapp'
  | 'referral'
  | 'agent'
  | 'website'
  | 'other'

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'interested'
  | 'applied'
  | 'enrolled'
  | 'lost'

export type SessionType = 'class' | 'consultation' | 'exam'
export type SessionStatus = 'scheduled' | 'completed' | 'cancelled'
export type RecurringType = 'once' | 'weekly' | 'daily'
export type BookingStatus = 'open' | 'pending' | 'approved' | 'declined'

export interface ScheduleSession {
  id: string
  type: SessionType
  courseId: CourseId
  courseName?: string
  staffId: string
  staffName: string
  studentId?: string
  studentName?: string
  batchName?: string
  date: string
  startTime: string
  endTime: string
  location: string
  notes?: string
  status: SessionStatus
  bookingStatus?: BookingStatus
  isRecurring: boolean
  recurringType: RecurringType
  createdAt: string
  createdBy: string
}

export type PayrollStatus = 'paid' | 'pending' | 'processing'
export type PayrollPaymentMethod = 'bank-transfer' | 'cash'

export interface PayrollRecord {
  id: string
  payrollId: string
  staffId: string
  staffName: string
  role: StaffRole
  period: string
  salaryType: SalaryType
  baseSalary: number
  hoursWorked?: number
  hourlyRate?: number
  salesAmount?: number
  commissionRate?: number
  commission: number
  bonus: number
  tax: number
  advances: number
  otherDeductions: number
  deductions: number
  netPay: number
  status: PayrollStatus
  paymentMethod: PayrollPaymentMethod
  bankDetails?: string
  notes?: string
  processedBy: string
  processedAt?: string
  createdAt: string
}

export type ExamPaperLevel = 'A1' | 'A2' | 'B1' | 'A2-B1' | 'N5' | 'N4'
export type ExamPaperStatus = 'active' | 'draft'
export type ExamPaperLanguage = 'bilingual' | 'japanese'
export type ExamAttemptStatus = 'in_progress' | 'completed'
export type ExamMarkingStatus = 'pending' | 'complete' | 'pending_review' | 'partial'
export type ExamSection = 'reading' | 'listening' | 'writing' | 'speaking'

export interface ExamPaper {
  id: string
  code: string
  title: string
  level: ExamPaperLevel
  description: string
  status: ExamPaperStatus
  readingCount: number
  listeningCount: number
  readingMinutes: number
  listeningMinutes: number
  writingMinutes: number
  speakingMinutes: number
  language?: ExamPaperLanguage
  courseIds?: string[]
}

export interface ReadingQuestion {
  id: string
  questionNumber: number
  passageText: string
  questionText: string
  options: string[]
  correctAnswer: string
  explanation?: string
}

export interface ListeningQuestion {
  id: string
  questionNumber: number
  audioUrl: string | null
  questionText: string
  options: string[]
  correctAnswer: string
  explanation?: string
}

export interface WritingTask {
  id: string
  taskNumber: number
  prompt: string
  minWords: number
  timeMinutes: number
}

export interface SpeakingPrompt {
  id: string
  partNumber: number
  prompt: string
  prepTime: number
  timeLimit: number
}

export interface ExamAttempt {
  id: string
  studentId: string
  studentName: string
  paperId: string
  paperCode: string
  startedAt: string
  endedAt?: string
  status: ExamAttemptStatus
  readingScore?: number
  listeningScore?: number
  writingScore?: number
  speakingScore?: number | null
  totalScore?: number
  grade?: string
  markingStatus: ExamMarkingStatus
  createdAt: string
}

export interface ExamAnswer {
  questionId: string
  studentAnswer: string
  isCorrect?: boolean
  section: ExamSection
}

export interface WritingSubmission {
  taskNumber: number
  response: string
  wordCount: number
  score?: number
  feedback?: string
  markingStatus: ExamMarkingStatus
}

export interface SpeakingSubmission {
  partNumber: number
  audioUrl?: string
  transcription?: string
  score?: number | null
  feedback?: string
  markingStatus: ExamMarkingStatus
}
