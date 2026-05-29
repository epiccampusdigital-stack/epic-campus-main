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

export interface AttendanceRecord {
  id: string
  studentId: string
  date: string
  status: 'present' | 'absent' | 'late' | 'excused'
  notes?: string
}

export interface VisaEvent {
  id: string
  status: Student['visaStatus']
  date: string
  notes?: string
}

export interface Payment {
  id: string
  studentId: string
  studentName: string
  amount: number
  type: 'registration' | 'course' | 'hostel' | 'exam' | 'other'
  method: 'cash' | 'bank-transfer' | 'online' | 'cheque'
  status: 'paid' | 'partial' | 'pending' | 'cancelled'
  receiptNo: string
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
  module: 'students' | 'payments' | 'exams' | 'auth' | 'staff' | 'crm'
  action: string
  targetId: string
  details: string
  userId: string
  userRole: Role
  branchId?: string
  timestamp: string
}

export interface Lead {
  id: string
  name: string
  mobile: string
  courseInterest: CourseId
  source: 'walk-in' | 'referral' | 'social' | 'agent' | 'website'
  agentId?: string
  status: 'new' | 'contacted' | 'enrolled' | 'lost'
  branchId: string
  notes?: string
  createdAt: string
}
