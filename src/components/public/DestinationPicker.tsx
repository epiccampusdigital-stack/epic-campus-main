'use client'

import { useCallback, useState } from 'react'
import {
  getRecommendation,
  type QuizAnswers,
} from '@/lib/public/destinationPickerLogic'

type StepIndex = 0 | 1 | 2 | 3
type SlideDirection = 'forward' | 'back'

const STEPS: {
  key: keyof QuizAnswers
  title: string
  options: { value: string; label: string }[]
}[] = [
  {
    key: 'goal',
    title: 'What is your main goal?',
    options: [
      { value: 'work', label: '🏭 Work & earn money abroad' },
      { value: 'study', label: '🎓 Study at a university' },
      { value: 'both', label: '🌍 Both work and study' },
      { value: 'certificate', label: '📜 Get a recognised certificate' },
    ],
  },
  {
    key: 'education',
    title: 'What is your education level?',
    options: [
      { value: 'ol', label: '📚 Completed O/Ls' },
      { value: 'al', label: '🎓 Completed A/Ls' },
      { value: 'diploma', label: '🏫 Diploma/degree' },
      { value: 'working', label: '💼 Already working' },
    ],
  },
  {
    key: 'timeline',
    title: 'How soon do you want to go?',
    options: [
      { value: '6months', label: '⚡ Within 6 months' },
      { value: '1year', label: '📅 Within 1 year' },
      { value: 'planning', label: '🔄 Still planning (1-2 years)' },
      { value: 'learn', label: '💬 Just want to learn more' },
    ],
  },
  {
    key: 'english',
    title: 'What is your English level?',
    options: [
      { value: 'basic', label: '😰 Basic — I struggle' },
      { value: 'okay', label: '🙂 Okay — simple conversations' },
      { value: 'good', label: '😊 Good — comfortable' },
      { value: 'excellent', label: '🌟 Excellent — near fluent' },
    ],
  },
]

function ProgressDots({ step, showResults }: { step: StepIndex; showResults: boolean }) {
  return (
    <div className="mb-8 flex items-center justify-center gap-3">
      {STEPS.map((_, i) => {
        const done = showResults || i < step
        const active = !showResults && i === step
        return (
          <div
            key={i}
            className={`h-3 w-3 rounded-full transition-all duration-300 ${
              done
                ? 'bg-[#E8A020] scale-100'
                : active
                  ? 'scale-125 bg-[#0B3D6B] ring-4 ring-[#0B3D6B]/20'
                  : 'bg-[#DDE3EC]'
            }`}
          />
        )
      })}
    </div>
  )
}

export default function DestinationPicker() {
  const [step, setStep] = useState<StepIndex>(0)
  const [showResults, setShowResults] = useState(false)
  const [direction, setDirection] = useState<SlideDirection>('forward')
  const [answers, setAnswers] = useState<QuizAnswers>({})
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const recommendation = showResults ? getRecommendation(answers) : null

  const goBack = useCallback(() => {
    if (showResults) {
      setDirection('back')
      setShowResults(false)
      return
    }
    if (step > 0) {
      setDirection('back')
      setStep((s) => (s - 1) as StepIndex)
    }
  }, [step, showResults])

  const selectOption = useCallback((key: keyof QuizAnswers, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }))
    setDirection('forward')

    if (step < 3) {
      setTimeout(() => setStep((s) => (s + 1) as StepIndex), 200)
    } else {
      setTimeout(() => setShowResults(true), 200)
    }
  }, [step])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!recommendation || !name.trim() || !phone.trim()) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch('/api/leads/destination-picker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          recommendedPath: recommendation.path,
          quizAnswers: answers,
        }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? 'Submission failed')
      }
      setSubmitted(true)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function restart() {
    setStep(0)
    setShowResults(false)
    setAnswers({})
    setName('')
    setPhone('')
    setSubmitted(false)
    setSubmitError('')
    setDirection('forward')
  }

  const slideClass =
    direction === 'forward' ? 'animate-slide-in-right' : 'animate-slide-in-left'

  return (
    <div className="mx-auto max-w-xl px-4">
      <style jsx>{`
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(24px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-24px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.35s ease-out;
        }
        .animate-slide-in-left {
          animation: slideInLeft 0.35s ease-out;
        }
      `}</style>

      <div className="rounded-2xl border border-[#DDE3EC] bg-white p-6 shadow-lg sm:p-8">
        <ProgressDots step={step} showResults={showResults} />

        {!showResults && (
          <div key={step} className={slideClass}>
            <h3 className="mb-6 text-center font-jakarta text-xl font-bold text-[#0B3D6B]">
              {STEPS[step].title}
            </h3>
            <div className="grid gap-3">
              {STEPS[step].options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => selectOption(STEPS[step].key, opt.value)}
                  className="min-h-[56px] rounded-xl border-2 border-[#DDE3EC] bg-[#F5F7FB] px-4 py-4 text-left font-jakarta text-sm font-semibold text-[#0D1B2A] transition-all hover:border-[#E8A020] hover:bg-[#E8A020]/10 active:scale-[0.98] sm:text-base"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {showResults && recommendation && !submitted && (
          <div key="results" className={slideClass}>
            <div className="text-center">
              <span className="text-[80px] leading-none" role="img" aria-hidden="true">
                {recommendation.flag}
              </span>
              <h3 className="mt-4 font-jakarta text-2xl font-bold text-[#E8A020]">
                {recommendation.headline}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-gray-600">
                {recommendation.reason}
              </p>
            </div>

            <ul className="mt-6 space-y-2">
              {recommendation.bullets.map((b) => (
                <li
                  key={b}
                  className="flex gap-2 text-sm text-[#0D1B2A]"
                >
                  <span className="mt-0.5 shrink-0 text-[#E8A020]">✓</span>
                  {b}
                </li>
              ))}
            </ul>

            <div className="mt-6 flex justify-center">
              <span className="rounded-full bg-[#0B3D6B]/10 px-4 py-2 text-xs font-semibold text-[#0B3D6B]">
                {recommendation.timeline}
              </span>
            </div>

            <form onSubmit={(e) => void handleSubmit(e)} className="mt-8 space-y-4 border-t border-[#DDE3EC] pt-8">
              <p className="text-center font-jakarta text-lg font-bold text-[#0B3D6B]">
                Get your FREE personalised study plan
              </p>
              <div>
                <label htmlFor="dp-name" className="mb-1 block text-xs font-medium text-[#5A6A7A]">
                  Your name *
                </label>
                <input
                  id="dp-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="min-h-[44px] w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 text-sm"
                  placeholder="Full name"
                />
              </div>
              <div>
                <label htmlFor="dp-phone" className="mb-1 block text-xs font-medium text-[#5A6A7A]">
                  Phone number *
                </label>
                <input
                  id="dp-phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="min-h-[44px] w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 text-sm"
                  placeholder="07X XXX XXXX"
                />
                <p className="mt-1 text-[10px] text-[#5A6A7A]">Sri Lankan mobile, e.g. 076 254 8383</p>
              </div>
              {submitError && (
                <p className="text-center text-xs font-medium text-red-600">{submitError}</p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="min-h-[48px] w-full rounded-xl bg-[#E8A020] font-jakarta text-base font-bold text-[#0B3D6B] hover:bg-[#F5B942] disabled:opacity-60"
              >
                {submitting ? 'Sending…' : 'Get My Free Plan'}
              </button>
            </form>
          </div>
        )}

        {showResults && submitted && (
          <div key="thanks" className={slideClass}>
            <div className="py-6 text-center">
              <span className="text-5xl">🎉</span>
              <h3 className="mt-4 font-jakarta text-xl font-bold text-[#0B3D6B]">
                Thank you {name}! 🎉
              </h3>
              <p className="mt-3 text-sm text-gray-600">
                Our team will call you within 24 hours.
              </p>
              <p className="mt-6 font-jakarta text-lg font-bold text-[#0B3D6B]">
                <a href="tel:+94762548383" className="hover:text-[#E8A020]">
                  076 254 8383
                </a>
              </p>
              <button
                type="button"
                onClick={restart}
                className="mt-8 text-sm font-semibold text-[#0B3D6B] underline"
              >
                Take the quiz again
              </button>
            </div>
          </div>
        )}

        {(step > 0 || showResults) && !submitted && (
          <div className="mt-6 flex justify-start">
            <button
              type="button"
              onClick={goBack}
              className="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-[#5A6A7A] hover:text-[#0B3D6B]"
            >
              <span className="ti ti-arrow-left" aria-hidden="true" />
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
