'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { doc, setDoc, updateDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import ExamTopbar from '@/components/exam/ExamTopbar'
import { computeTotalScore, getAttempt, getGrade } from '@/lib/exam/helpers'
import { db, storage } from '@/lib/firebase/client'
import type { SpeakingPrompt } from '@/types'

interface SpeakingSectionProps {
  paperId: string
  attemptId: string
  prompts: SpeakingPrompt[]
  timeLimitMinutes: number
  paperCode?: string
}

export default function SpeakingSection({
  paperId,
  attemptId,
  prompts,
  timeLimitMinutes,
  paperCode = '',
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
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [mediaSupported, setMediaSupported] = useState(true)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const active = sorted[index]

  useEffect(() => {
    setMediaSupported(typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia)
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
    return () => { if (audioUrl) URL.revokeObjectURL(audioUrl) }
  }, [audioUrl])

  const finishExam = useCallback(async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      const attempt = await getAttempt(attemptId)
      const readingScore = attempt?.readingScore ?? 0
      const listeningScore = attempt?.listeningScore ?? 0
      const writingScore = attempt?.writingScore ?? 0
      const totalScore = computeTotalScore({ readingScore, listeningScore, writingScore, speakingScore: null })
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

  // Timer
  const finishRef = useRef(finishExam)
  useEffect(() => { finishRef.current = finishExam })

  useEffect(() => {
    const elapsed = Math.floor((Date.now() - startedAt.getTime()) / 1000)
    const remaining = Math.max(0, timeLimitMinutes * 60 - elapsed)
    setTimeLeft(remaining)
    if (remaining === 0) { finishRef.current(); return }
    const t = setInterval(() => {
      setTimeLeft((p) => {
        const next = (p ?? 1) - 1
        if (next <= 0) { finishRef.current(); return 0 }
        return next
      })
    }, 1000)
    return () => clearInterval(t)
  }, [startedAt, timeLimitMinutes])

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
    await setDoc(doc(db, 'examAttempts', attemptId, 'speakingSubmissions', prompt.id), {
      partNumber: prompt.partNumber,
      audioUrl: url,
      transcription: '',
      score: null,
      feedback: '',
      markingStatus: 'pending_review',
    })
  }

  const handleNext = async () => {
    if (active && audioBlob) await uploadAndSave(active, audioBlob)
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
      <div className="p-8 text-center text-gray-500">No speaking prompts available.</div>
    )
  }

  const showRecordControls = prepLeft === 0 || active.prepTime === 0

  return (
    <div className="flex flex-col min-h-screen">
      <ExamTopbar
        paperCode={paperCode}
        section="speaking"
        timeLeft={timeLeft ?? undefined}
        currentQ={index + 1}
        totalQ={sorted.length}
      />

      <div className="max-w-xl mx-auto px-5 py-8 w-full">

        {/* Prompt card */}
        <div className="bg-white border border-gray-100 rounded-xl p-6 mb-6 text-center shadow-sm">
          <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-3">
            Prompt {index + 1} of {sorted.length}
          </div>
          <p className="text-[15px] text-gray-800 leading-relaxed mb-2">
            {active.prompt}
          </p>
          <div className="flex justify-center gap-4 mt-4 text-[11px] text-gray-400">
            {active.prepTime > 0 && <span>⏱ Prep: {active.prepTime}s</span>}
          </div>
        </div>

        {/* Browser not supported warning */}
        {!mediaSupported && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-center mb-4">
            <p className="text-sm text-red-600 font-medium">⚠ Audio recording not supported</p>
            <p className="text-xs text-red-500 mt-1">Please use Chrome or Firefox to record your answer.</p>
          </div>
        )}

        {/* Prep button */}
        {active.prepTime > 0 && prepLeft === null && !recording && !audioBlob && (
          <div className="flex justify-center mb-6">
            <button
              type="button"
              onClick={startPrep}
              className="px-5 py-2.5 bg-[#0B3D6B] text-white rounded-[7px] text-sm font-medium
                         hover:bg-[#0B3D6B]/90 transition-colors"
            >
              Start {active.prepTime}s preparation
            </button>
          </div>
        )}

        {/* Countdown */}
        {prepLeft !== null && prepLeft > 0 && (
          <div className="text-center mb-6">
            <div className="text-4xl font-bold text-[#E8A020] tabular-nums mb-1">{prepLeft}</div>
            <div className="text-sm text-gray-500">Preparation time remaining</div>
          </div>
        )}

        {/* Recording controls */}
        {showRecordControls && mediaSupported && (
          <div className="flex flex-col items-center gap-4 mb-6">
            {!recording && !audioBlob && (
              <>
                <button
                  type="button"
                  onClick={startRecording}
                  className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white
                             flex items-center justify-center shadow-lg transition-colors"
                  aria-label="Record"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <circle cx="10" cy="10" r="7" />
                  </svg>
                </button>
                <p className="text-sm text-gray-500">Tap to record your answer</p>
              </>
            )}
            {recording && (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-sm text-red-600 font-medium">Recording…</span>
                </div>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="w-16 h-16 rounded-full bg-[#0B3D6B] text-white
                             flex items-center justify-center shadow-lg transition-colors
                             hover:bg-[#0B3D6B]/90"
                  aria-label="Stop"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <rect x="0" y="0" width="16" height="16" rx="2" />
                  </svg>
                </button>
                <p className="text-sm text-gray-500">Tap to stop recording</p>
              </>
            )}
            {audioUrl && !recording && (
              <div className="w-full">
                <p className="text-sm text-green-600 font-medium text-center mb-3">✓ Recording complete</p>
                <audio controls src={audioUrl} className="w-full max-w-sm mx-auto block">
                  <track kind="captions" />
                </audio>
              </div>
            )}
          </div>
        )}

        {/* Next / submit */}
        <div className="flex justify-center">
          <button
            type="button"
            disabled={submitting || (!audioBlob && index === sorted.length - 1)}
            onClick={handleNext}
            className="px-6 py-2.5 bg-[#E8A020] text-white rounded-[7px] text-sm font-medium
                       hover:bg-[#E8A020]/90 transition-colors disabled:opacity-50"
          >
            {index < sorted.length - 1
              ? 'Next Part →'
              : submitting
                ? 'Submitting…'
                : 'Submit Exam'}
          </button>
        </div>
      </div>
    </div>
  )
}
