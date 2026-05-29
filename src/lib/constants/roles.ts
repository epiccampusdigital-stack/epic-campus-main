export const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  owner: 'Owner',
  reception: 'Reception',
  accountant: 'Accountant',
  teacher: 'Teacher',
  examCoordinator: 'Exam Coordinator',
  student: 'Student',
}

export const MANAGEMENT_ROLES = ['admin', 'owner', 'reception', 'accountant', 'teacher']
export const EXAM_ROLES = ['admin', 'teacher', 'examCoordinator']
export const EXAM_PORTAL_ROLES = ['student', 'examCoordinator', 'admin', 'teacher']
export const EXAM_ADMIN_ROLES = ['admin', 'examCoordinator']
export const BUSINESS_ROLES = ['admin', 'owner']
export const STUDENT_ROLES = ['student']
