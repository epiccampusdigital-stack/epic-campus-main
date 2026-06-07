export type Role =
  | 'admin'
  | 'owner'
  | 'reception'
  | 'accountant'
  | 'teacher'
  | 'examCoordinator'
  | 'student'
  | 'company'
  | 'parent'

export type CourseId = 'japan-ssw' | 'korea-d2d4' | 'china' | 'ielts' | 'nvq-it' | 'nvq-hospitality' | 'nvq-caregiving' | 'nvq-construction' | 'nvq-logistics'

export type StudentLocation = 'ahangama' | 'galle' | 'waduraba' | 'pinnaduwa'

export interface EpicUser {
  uid: string
  email: string
  displayName: string
  role: Role
  branchId?: string
  /** Reception / staff campus assignment */
  locationAssigned?: StudentLocation
  /** Student document id (student or parent role) */
  studentId?: string
  /** Partner company document id when role is company */
  companyId?: string
  createdAt: string
}

export type StaffRole = Exclude<Role, 'student' | 'company' | 'parent'>
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
  locationAssigned?: StudentLocation
  startDate?: string
  salaryType: SalaryType
  baseSalary: number
  commissionRate?: number
  createdAt: string
  approvedBy?: string
  approvedAt?: string
}

export type PaymentType = 'tuition' | 'registration' | 'exam' | 'visa' | 'other'
export type PaymentMethod = 'cash' | 'bank-transfer' | 'stripe'
export type PaymentStatus = 'paid' | 'partial' | 'pending' | 'cancelled'

export type BatchDuration = '45days' | '90days' | 'custom'
export type CourseBatchStatus = 'active' | 'completed' | 'overdue'

export interface StudentFeeLineItem {
  paid: boolean
  amount: number
  method?: PaymentMethod
  paymentDate?: string
  reference?: string
  stripePaymentLinkUrl?: string
}

export interface StudentOtherExpense {
  id: string
  description: string
  amount: number
  paid: boolean
  method?: PaymentMethod
  paymentDate?: string
  reference?: string
  stripePaymentLinkUrl?: string
}

export interface StudentFeeSchedule {
  registration: StudentFeeLineItem
  course: StudentFeeLineItem
  otherExpenses: StudentOtherExpense[]
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
  batchDuration?: BatchDuration
  batchCustomDays?: number
  batchStartDate?: string
  batchEndDate?: string
  location?: StudentLocation
  agentId?: string
  agentName?: string
  feeSchedule?: StudentFeeSchedule
  enrollmentDate?: string
  expectedCompletionDate?: string
  feeAmount?: number
  feeCurrency?: 'LKR' | 'USD'
  registrationFee: number
  paymentStatus?: 'paid' | 'partial' | 'pending'
  status: 'active' | 'pending' | 'completed' | 'withdrawn'
  visaStatus?: 'not-started' | 'in-progress' | 'approved' | 'rejected'
  notes?: string
  /** 6-digit code for parent/guardian registration */
  parentAccessCode?: string
  parentAccessEnabled?: boolean
  /** Firebase uid of linked parent account */
  parentId?: string
  createdAt: string
  createdBy: string
}

export interface ParentAccount {
  id: string
  parentName: string
  email: string
  phone: string
  studentId: string
  studentName: string
  linkedAt: string
  createdAt: string
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

export type VisaApplicationStatus =
  | 'documents'
  | 'submitted'
  | 'processing'
  | 'approved'
  | 'rejected'

export interface VisaDocumentItem {
  name: string
  uploaded: boolean
  verified: boolean
}

export interface VisaApplication {
  id: string
  studentId: string
  studentName: string
  program: string
  visaType: string
  status: VisaApplicationStatus
  documents: VisaDocumentItem[]
  submittedAt?: string
  updatedAt: string
  notes: string
  whatsappPhone?: string
}

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
  agentId?: string
  agentName?: string
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

export type TeacherSessionStatus = 'scheduled' | 'completed' | 'cancelled'

export interface TeacherSession {
  id: string
  teacherId: string
  teacherName: string
  studentId: string
  studentName: string
  topic: string
  description: string
  scheduledAt: string
  duration: number
  status: TeacherSessionStatus
  notes: string
  createdAt: string
}

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
  passageContext?: string
  questionText: string
  options: string[]
  correctAnswer: string
  explanation?: string
  imageUrl?: string
  groupType?: string
  groupInstruction?: string
}

export interface ListeningQuestion {
  id: string
  questionNumber: number
  audioUrl: string | null
  questionText: string
  options: string[]
  correctAnswer: string
  explanation?: string
  transcript?: string
  playLimit?: number
}

export interface WritingTask {
  id: string
  taskNumber: number
  prompt: string
  minWords: number
  timeMinutes: number
  taskType?: string
  instruction?: string
  minimumCharacters?: number
  maximumCharacters?: number
  imageUrl?: string
  exampleAnswer?: string
}

export interface SpeakingPrompt {
  id: string
  partNumber: number
  prompt: string
  prepTime: number
  timeLimit: number
  promptType?: string
  promptText?: string
  japaneseCue?: string
  preparationTime?: number
  speakingTime?: number
  imageUrl?: string
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

export type PartnerCountry = 'japan'
export type PartnerFeeCurrency = 'LKR' | 'JPY'
export type PartnerFeeStatus = 'paid' | 'unpaid' | 'na'
export type PartnerCompanyStatus = 'active' | 'inactive'

export interface PartnerCompany {
  id: string
  name: string
  country: PartnerCountry
  industry: string
  contactName: string
  contactEmail: string
  contactPhone: string
  logoUrl?: string
  placementFee: number
  placementFeeCurrency: PartnerFeeCurrency
  feeStatus: PartnerFeeStatus
  status: PartnerCompanyStatus
  loginUid?: string
  createdAt: string
  createdBy: string
}

export type CandidateShortlistStatus =
  | 'viewing'
  | 'shortlisted'
  | 'interview_requested'
  | 'interview_confirmed'
  | 'placed'
  | 'rejected'

export interface CandidateShortlist {
  id: string
  companyId: string
  companyName: string
  studentId: string
  studentName: string
  status: CandidateShortlistStatus
  interviewDate?: string
  notes: string
  placementFee: number
  feePaid: boolean
  /** Denormalized for company portal */
  studentAge?: number
  japaneseLevel?: string
  examScoreSummary?: string
  batchStatus?: CourseBatchStatus
  placedAt?: string
  createdAt: string
  updatedAt: string
}

export interface PartnerNotification {
  id: string
  type: 'partner_interview_request'
  title: string
  message: string
  companyId: string
  companyName: string
  studentId: string
  studentDisplayName: string
  candidateShortlistId: string
  read: boolean
  createdAt: string
}

export type BroadcastAudience = 'all' | 'filtered'
export type BroadcastMediaType = 'image' | 'pdf'
export type BroadcastStatus = 'draft' | 'scheduled' | 'sent' | 'failed' | 'partial'
export type BroadcastLogStatus = 'sent' | 'failed' | 'pending'
export type BroadcastPaymentFilter = 'paid' | 'partial' | 'unpaid'

export interface BroadcastFilters {
  location?: StudentLocation[]
  course?: string[]
  visaStatus?: string[]
  paymentStatus?: BroadcastPaymentFilter
  batchStatus?: CourseBatchStatus[]
}

export interface BroadcastMessage {
  id: string
  title: string
  message: string
  mediaUrl?: string
  mediaType?: BroadcastMediaType
  audience: BroadcastAudience
  filters: BroadcastFilters
  recipientCount: number
  recipientNumbers: string[]
  status: BroadcastStatus
  scheduledAt?: string
  sentAt?: string
  createdBy: string
  createdByName: string
  createdAt: string
}

export interface BroadcastLog {
  id: string
  broadcastId: string
  studentId: string
  studentName: string
  phone: string
  status: BroadcastLogStatus
  error?: string
  sentAt: string
}

export interface BroadcastRecipient {
  studentId: string
  studentName: string
  phone: string
}

export type StudyMode =
  | 'general'
  | 'japanese-grammar'
  | 'japanese-vocab'
  | 'jlpt-practice'
  | 'ielts-writing'
  | 'ielts-speaking'
  | 'korean-basics'

export interface StudySession {
  id: string
  studentId: string
  mode: StudyMode
  startedAt: string
  endedAt?: string
  messageCount: number
  practiceQuestionsAnswered: number
  practiceQuestionsCorrect: number
}

export type EnrollmentProgram = 'japan-ssw' | 'korea' | 'china' | 'ielts' | 'nvq'
export type EnrollmentStatus = 'pending' | 'confirmed' | 'rejected'
export type EnrollmentPaymentStatus = 'pending' | 'paid' | 'failed'

export interface EnrollmentApplication {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  dateOfBirth: string
  address: string
  program: EnrollmentProgram
  location: StudentLocation
  batchDuration: BatchDuration
  batchCustomDays?: number
  registrationFeePaid: boolean
  courseFeePaid: boolean
  totalPaid: number
  stripeSessionId?: string
  stripePaymentStatus: EnrollmentPaymentStatus
  status: EnrollmentStatus
  studentId?: string
  createdAt: string
}
