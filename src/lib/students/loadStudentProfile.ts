import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { parseStudent } from '@/lib/students/helpers'
import type { Student } from '@/types'

async function createMinimalStudentFromUser(
  uid: string,
  userData: Record<string, unknown>,
  studentDocId: string,
): Promise<Student> {
  const minimal: Record<string, unknown> = {
    uid,
    email: String(userData.email ?? ''),
    name: String(userData.displayName ?? userData.name ?? 'Student'),
    mobile: String(userData.mobile ?? ''),
    courseId: 'japan-ssw',
    batchId: String(userData.batchId ?? ''),
    branchId: String(userData.branchId ?? 'galle-main'),
    status: 'active',
    paymentStatus: 'pending',
    createdAt: new Date().toISOString(),
    createdBy: 'portal-auto',
  }

  await setDoc(doc(db, 'students', studentDocId), minimal, { merge: true })

  if (userData.studentId !== studentDocId) {
    try {
      await setDoc(
        doc(db, 'users', uid),
        { studentId: studentDocId },
        { merge: true },
      )
    } catch (err) {
      console.warn('[loadStudentProfile] Could not sync studentId on user doc:', err)
    }
  }

  console.info('[loadStudentProfile] Auto-created minimal student profile:', {
    uid,
    studentDocId,
  })

  return parseStudent(studentDocId, { ...minimal, uid })
}

export async function loadStudentProfile(
  uid: string,
  options?: { studentId?: string; email?: string },
): Promise<Student | null> {
  const studentId = options?.studentId?.trim()
  const email = options?.email?.trim().toLowerCase()

  if (studentId) {
    const snap = await getDoc(doc(db, 'students', studentId))
    if (snap.exists()) {
      const student = parseStudent(snap.id, snap.data() as Record<string, unknown>)
      if (!student.uid || student.uid !== uid) {
        try {
          await updateDoc(doc(db, 'students', snap.id), { uid })
        } catch (err) {
          console.warn('[loadStudentProfile] Could not sync uid on student doc:', snap.id, err)
        }
      }
      return { ...student, uid }
    }
  }

  const byDocId = await getDoc(doc(db, 'students', uid))
  if (byDocId.exists()) {
    const student = parseStudent(byDocId.id, byDocId.data() as Record<string, unknown>)
    if (!student.uid || student.uid !== uid) {
      try {
        await updateDoc(doc(db, 'students', uid), { uid })
      } catch (err) {
        console.warn('[loadStudentProfile] Could not sync uid on doc-by-id:', uid, err)
      }
    }
    return { ...student, uid }
  }

  const byUid = await getDocs(query(collection(db, 'students'), where('uid', '==', uid)))
  if (!byUid.empty) {
    const d = byUid.docs[0]
    return parseStudent(d.id, d.data() as Record<string, unknown>)
  }

  if (email) {
    const byEmail = await getDocs(
      query(collection(db, 'students'), where('email', '==', email)),
    )
    if (!byEmail.empty) {
      const d = byEmail.docs[0]
      const data = d.data() as Record<string, unknown>
      if (!data.uid || String(data.uid) !== uid) {
        try {
          await updateDoc(doc(db, 'students', d.id), { uid })
          console.info('[loadStudentProfile] Linked uid via email fallback:', {
            uid,
            studentDocId: d.id,
            email,
          })
        } catch (err) {
          console.warn('[loadStudentProfile] Email fallback uid update failed:', err)
        }
      }
      return parseStudent(d.id, { ...data, uid })
    }
  }

  const userSnap = await getDoc(doc(db, 'users', uid))
  if (userSnap.exists()) {
    const userData = userSnap.data() as Record<string, unknown>
    const studentDocId = studentId || String(userData.studentId ?? uid)
    return createMinimalStudentFromUser(uid, userData, studentDocId)
  }

  console.warn('[loadStudentProfile] No student profile or user doc for uid:', uid, {
    studentId,
    email,
  })
  return null
}
