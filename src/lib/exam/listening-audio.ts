import { doc, updateDoc } from 'firebase/firestore'
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db, storage } from '@/lib/firebase/client'

const ACCEPTED_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav']
const ACCEPTED_EXT = ['.mp3', '.wav']

export function isValidListeningAudioFile(file: File): boolean {
  const name = file.name.toLowerCase()
  const hasExt = ACCEPTED_EXT.some((ext) => name.endsWith(ext))
  const hasType =
    ACCEPTED_TYPES.includes(file.type) || file.type === '' || file.type.startsWith('audio/')
  return hasExt && (hasType || file.type === '')
}

export function listeningAudioStoragePath(paperId: string, questionId: string): string {
  return `exam-audio/${paperId}/${questionId}.mp3`
}

export async function uploadListeningQuestionAudio(
  paperId: string,
  questionId: string,
  file: File,
): Promise<string> {
  if (!isValidListeningAudioFile(file)) {
    throw new Error('Only .mp3 and .wav files are allowed.')
  }

  const path = listeningAudioStoragePath(paperId, questionId)
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file, { contentType: file.type || 'audio/mpeg' })
  const downloadUrl = await getDownloadURL(storageRef)

  await updateDoc(doc(db, 'examPapers', paperId, 'listeningQuestions', questionId), {
    audioUrl: downloadUrl,
  })

  return downloadUrl
}

export async function removeListeningQuestionAudio(
  paperId: string,
  questionId: string,
): Promise<void> {
  try {
    await deleteObject(ref(storage, listeningAudioStoragePath(paperId, questionId)))
  } catch {
    /* file may not exist */
  }

  await updateDoc(doc(db, 'examPapers', paperId, 'listeningQuestions', questionId), {
    audioUrl: null,
  })
}
