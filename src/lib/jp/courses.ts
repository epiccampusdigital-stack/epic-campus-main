import { adminDb } from '@/lib/firebase/admin'
import type { JpCourse, JpModule, JpLesson } from '@/types'

// Server-only: uses the Firebase Admin SDK so admin/owner-gated API routes
// can read/write course content without needing a signed-in client context.
// Mirrors the jpCourses/{courseId}/modules/{moduleId}/lessons/{lessonId}
// structure already defined in firestore.rules.

function courseRef(courseId: string) {
  return adminDb.collection('jpCourses').doc(courseId)
}

function modulesRef(courseId: string) {
  return courseRef(courseId).collection('modules')
}

function moduleRef(courseId: string, moduleId: string) {
  return modulesRef(courseId).doc(moduleId)
}

function lessonsRef(courseId: string, moduleId: string) {
  return moduleRef(courseId, moduleId).collection('lessons')
}

function lessonRef(courseId: string, moduleId: string, lessonId: string) {
  return lessonsRef(courseId, moduleId).doc(lessonId)
}

export async function getJpCourse(courseId: string): Promise<JpCourse | null> {
  const snap = await courseRef(courseId).get()
  if (!snap.exists) return null
  return { id: snap.id, ...(snap.data() as Omit<JpCourse, 'id'>) }
}

export async function upsertJpCourse(course: JpCourse): Promise<void> {
  const { id, ...data } = course
  await courseRef(id).set(data, { merge: true })
}

export async function listJpModules(courseId: string): Promise<JpModule[]> {
  const snap = await modulesRef(courseId).orderBy('order').get()
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<JpModule, 'id'>) }))
}

export async function upsertJpModule(courseId: string, module: JpModule): Promise<void> {
  const { id, ...data } = module
  await moduleRef(courseId, id).set(data, { merge: true })
}

export async function deleteJpModule(courseId: string, moduleId: string): Promise<void> {
  await moduleRef(courseId, moduleId).delete()
}

export async function listJpLessons(courseId: string, moduleId: string): Promise<JpLesson[]> {
  const snap = await lessonsRef(courseId, moduleId).orderBy('order').get()
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<JpLesson, 'id'>) }))
}

export async function upsertJpLesson(courseId: string, moduleId: string, lesson: JpLesson): Promise<void> {
  const { id, ...data } = lesson
  await lessonRef(courseId, moduleId, id).set(data, { merge: true })
}

export async function deleteJpLesson(courseId: string, moduleId: string, lessonId: string): Promise<void> {
  await lessonRef(courseId, moduleId, lessonId).delete()
}

export interface JpLessonLocation {
  courseId: string
  moduleId: string
  lesson: JpLesson
}

// Lessons are only addressable by (courseId, moduleId, lessonId) per the
// rules-defined subcollection path, but callers like the video-token route
// only have a lessonId. Traverses courses/modules to locate it by doc ID —
// avoids a collectionGroup query, which would need an index we're not
// allowed to add in this prompt.
export async function findJpLessonById(lessonId: string): Promise<JpLessonLocation | null> {
  const coursesSnap = await adminDb.collection('jpCourses').get()
  for (const courseDoc of coursesSnap.docs) {
    const modulesSnap = await modulesRef(courseDoc.id).get()
    for (const moduleDoc of modulesSnap.docs) {
      const lessonSnap = await lessonRef(courseDoc.id, moduleDoc.id, lessonId).get()
      if (lessonSnap.exists) {
        return {
          courseId: courseDoc.id,
          moduleId: moduleDoc.id,
          lesson: { id: lessonSnap.id, ...(lessonSnap.data() as Omit<JpLesson, 'id'>) },
        }
      }
    }
  }
  return null
}
