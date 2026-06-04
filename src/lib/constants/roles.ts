export const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  owner: 'Owner',
  reception: 'Reception',
  accountant: 'Accountant',
  teacher: 'Teacher',
  examCoordinator: 'Exam Coordinator',
  student: 'Student',
  company: 'Partner Company',
}

export const COMPANY_ROLES = ['company']

export const MANAGEMENT_ROLES = ['admin', 'owner', 'reception', 'accountant', 'teacher']
export const EXAM_ROLES = ['admin', 'teacher', 'examCoordinator']
export const EXAM_PORTAL_ROLES = ['student', 'examCoordinator', 'admin', 'teacher', 'owner']
export const EXAM_MANAGEMENT_ROLES = ['admin', 'owner', 'examCoordinator', 'teacher']
export const EXAM_ADMIN_ROLES = ['admin', 'owner', 'examCoordinator', 'teacher']
export const BUSINESS_ROLES = ['admin', 'owner']
export const STUDENT_ROLES = ['student']
