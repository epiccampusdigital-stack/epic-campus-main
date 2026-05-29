'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { doc, setDoc, updateDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import ExamTimer from '@/components/exam/ExamTimer'
import {
  computeTotalScore,
  getAttempt,
  getGrade,
} from '@/lib/exam/helpers'
import { db, storage } from '@/lib/firebase/client'
import type { SpeakingPrompt } from '@/types'

interface SpeakingSectionProps {
  paperId: string
  attemptId: string
  prompts: SpeakingPrompt[]
  timeLimitMinutes: number
}

export default function SpeakingSection({
  paperId,
  attemptId,
  prompts,
  timeLimitMinutes,
}: SpeakingSectionProps) {
  const router = useRouter()
  const sorted = [...prompts].sort((a, b) => a.partNumber - b.partNumber)
  const [index, setIndex] = useState(0)
  const [startedAt, setStartedAt] = useState<Date>(new Date())
  const [recording, setRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [prepLeft, setPrepLeft] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const active = sorted[index]

  useEffect(() => {
    getAttempt(attemptId).then((a) => {
      if (a?.startedAt) setStartedAt(new Date(a.startedAt))
    })
  }, [attemptId])

  useEffect(() => {
    if (prepLeft === null || prepLeft <= 0) return
    const t = setInterval(() => setPrepLeft((p) => (p !== null && p > 0 ? p - 1 : 0)), 1000)
    return () => clearInterval(t)
  }, [prepLeft])

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
  }, [audioUrl])

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mediaRecorder = new MediaRecorder(stream)
    mediaRecorderRef.current = mediaRecorder
    chunksRef.current = []

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      setAudioBlob(blob)
      if (audioUrl) URL.revokeObjectURL(audioUrl)
      setAudioUrl(URL.createObjectURL(blob))
      stream.getTracks().forEach((t) => t.stop())
    }

    mediaRecorder.start()
    setRecording(true)
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  const startPrep = () => {
    if (active?.prepTime) setPrepLeft(active.prepTime)
  }

  const uploadAndSave = async (prompt: SpeakingPrompt, blob: Blob) => {
    const path = `examAudio/${attemptId}/speaking_${prompt.partNumber}.webm`
    const storageRef = ref(storage, path)
    await uploadBytes(storageRef, blob)
    const url = await getDownloadURL(storageRef)
    await setDoc(
      doc(db, 'examAttempts', attemptId, 'speakingSubmissions', prompt.id),
      {
        partNumber: prompt.partNumber,
        audioUrl: url,
        transcription: '',
        score: null,
        feedback: '',
        markingStatus: 'pending_review',
      },
    )
  }

  const finishExam = useCallback(async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      const attempt = await getAttempt(attemptId)
      const readingScore = attempt?.readingScore ?? 0
      const listeningScore = attempt?.listeningScore ?? 0
      const writingScore = attempt?.writingScore ?? 0
      const totalScore = computeTotalScore({
        readingScore,
        listeningScore,
        writingScore,
        speakingScore: null,
      })
      const grade = getGrade(totalScore)

      await updateDoc(doc(db, 'examAttempts', attemptId), {
        speakingScore: null,
        totalScore,
        grade,
        status: 'completed',
        endedAt: new Date().toISOString(),
        markingStatus: 'partial',
      })

      router.push(`/exams/${paperId}/results?attemptId=${attemptId}`)
    } finally {
      setSubmitting(false)
    }
  }, [attemptId, paperId, router, submitting])

  const handleNext = async () => {
    if (active && audioBlob) {
      await uploadAndSave(active, audioBlob)
    }
    if (index < sorted.length - 1) {
      setIndex((i) => i + 1)
      setAudioBlob(null)
      if (audioUrl) URL.revokeObjectURL(audioUrl)
      setAudioUrl(null)
      setPrepLeft(null)
    } else {
      await finishExam()
    }
  }

  if (!active) {
    return (
      <div className="p-8 text-center text-[#5A6A7A]">No speaking prompts available.</div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-jakarta text-xl font-bold text-[#0B3D6B]">
          Speaking — Part {active.partNumber}
        </h1>
        <ExamTimer
          startedAt={startedAt}
          timeLimitMinutes={timeLimitMinutes}
          onExpire={finishExam}
        />
      </div>

      <div className="rounded-xl border border-[#DDE3EC] bg-white p-6">
        <p className="font-inter text-[#0D1B2A]">{active.prompt}</p>
        {active.prepTime > 0 && prepLeft === null && !recording && !audioBlob && (
          <button
            type="button"
            onClick={startPrep}
            className="mt-4 rounded-lg bg-[#0B3D6B] px-4 py-2 text-sm font-bold text-white"
          >
            Start {active.prepTime}s preparation
          </button>
        )}
        {prepLeft !== null && prepLeft > 0 && (
          <p className="mt-4 text-lg font-bold text-[#E8A020]">
            Preparation: {prepLeft}s
          </p>
        )}
        {(prepLeft === 0 || active.prepTime === 0) && (
          <div className="mt-6 flex flex-wrap gap-3">
            {!recording && !audioBlob && (
              <button
                type="button"
                onClick={startRecording}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white"
              >
                ● Record
              </button>
            )}
            {recording && (
              <button
                type="button"
                onClick={stopRecording}
                className="rounded-lg border-2 border-red-600 px-4 py-2 text-sm font-bold text-red-600"
              >
                ■ Stop
              </button>
            )}
            {audioUrl && (
              <audio controls src={audioUrl} className="w-full max-w-md">
                <track kind="captions" />
              </audio>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 flex justify-end">
        <button
          type="button"
          disabled={submitting || (!audioBlob && index === sorted.length - 1)}
          onClick={handleNext}
          className="rounded-lg bg-[#E8A020] px-6 py-2 font-jakarta text-sm font-bold text-[#0B3D6B] disabled:opacity-50"
        >
          {index < sorted.length - 1
            ? 'Next Part →'
            : submitting
              ? 'Submitting…'
              : 'Submit Exam'}
        </button>
      </div>
    </div>
  )
}
