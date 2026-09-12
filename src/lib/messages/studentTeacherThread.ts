import { addDoc, collection, doc, increment, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'

/**
 * Writes into the exact `messages/{studentId}` + `thread_teacher` schema that
 * /student/messages and the management /messages inbox already read and write —
 * the only live student ↔ teacher messaging system in the app (the separate
 * `conversations` collection in lib/messages/helpers.ts isn't wired to any page).
 * Extracted here so new callers reuse this instead of re-deriving the shape.
 */
export async function sendStudentTeacherThreadMessage(params: {
  studentId: string
  studentName: string
  studentEmail?: string
  text: string
}): Promise<void> {
  await addDoc(collection(db, 'messages', params.studentId, 'thread_teacher'), {
    text: params.text,
    senderRole: 'student',
    senderName: params.studentName,
    senderId: params.studentId,
    createdAt: serverTimestamp(),
    read: false,
  })

  await setDoc(
    doc(db, 'messages', params.studentId),
    {
      studentId: params.studentId,
      studentName: params.studentName,
      studentEmail: params.studentEmail ?? '',
      lastMessageTeacher: params.text,
      lastAtTeacher: serverTimestamp(),
      unreadByTeacher: increment(1),
      unreadByStudent: 0,
    },
    { merge: true },
  )
}
