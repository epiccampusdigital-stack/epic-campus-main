'use client'

import { useState } from 'react'
import Link from 'next/link'

export function AuthPageBackground({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-screen min-h-[100dvh] w-full flex-col items-center justify-center overflow-x-hidden px-4 py-6"
      style={{
        background: '#0B3D6B',
        backgroundImage:
          'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      <div className="flex w-full min-w-0 max-w-[440px] flex-col items-center">
        {children}
      </div>
    </div>
  )
}

export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="box-border w-full min-w-0 rounded-[20px] p-6 sm:px-11 sm:py-12"
      style={{
        background: '#FFFFFF',
        borderTop: '3px solid #E8A020',
      }}
    >
      {children}
    </div>
  )
}

export function AuthBrandHeader() {
  return (
    <div
      className="mb-2 w-full rounded-xl px-4 py-3 sm:px-6 sm:py-4"
      style={{
        textAlign: 'center',
        background: '#0B3D6B',
      }}
    >
      <img
        src="/images/logo-transparent.png"
        alt="Epic Campus"
        className="mx-auto block h-[60px] w-auto max-w-full object-contain sm:h-20"
      />
    </div>
  )
}

export function AuthHeading({
  title,
  subtitle,
}: {
  title: string
  subtitle: string
}) {
  return (
    <div className="mb-6 text-center sm:mb-8">
      <h1
        className="font-jakarta text-[22px] font-bold leading-tight sm:text-[26px]"
        style={{ color: '#0D1B2A' }}
      >
        {title}
      </h1>
      <p className="font-inter mt-2 text-sm" style={{ color: '#5A6A7A' }}>
        {subtitle}
      </p>
    </div>
  )
}

export function GoogleIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

export function GoogleButton({
  onClick,
  disabled,
  loading,
}: {
  onClick: () => void
  disabled?: boolean
  loading?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-12 max-h-12 min-h-[48px] w-full min-w-0 items-center justify-center gap-2.5 rounded-[10px] border-[1.5px] border-[#DDE3EC] bg-white px-4 transition-colors hover:border-[#0B3D6B] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? (
        <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-[#0B3D6B] border-t-transparent" />
      ) : (
        <GoogleIcon />
      )}
      <span
        className="font-inter truncate text-sm font-medium leading-none"
        style={{ color: '#0D1B2A' }}
      >
        {loading ? 'Signing in...' : 'Continue with Google'}
      </span>
    </button>
  )
}

export function EmailDivider() {
  return (
    <div className="my-5 flex min-w-0 items-center gap-2 sm:my-6 sm:gap-3">
      <div className="h-px min-w-0 flex-1" style={{ background: '#DDE3EC' }} />
      <span
        className="font-inter shrink-0 text-[11px] sm:text-xs"
        style={{ color: '#5A6A7A' }}
      >
        or continue with email
      </span>
      <div className="h-px min-w-0 flex-1" style={{ background: '#DDE3EC' }} />
    </div>
  )
}

const labelStyle = {
  fontSize: 11,
  color: '#5A6A7A',
  letterSpacing: '0.08em',
} as const

function borderColor(focused: boolean, hasError?: boolean) {
  if (hasError) return '#DC2626'
  if (focused) return '#E8A020'
  return '#DDE3EC'
}

export function BottomBorderInput({
  id,
  label,
  type = 'text',
  value,
  onChange,
  disabled,
  error,
  autoComplete,
  placeholder,
}: {
  id: string
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  error?: string
  autoComplete?: string
  placeholder?: string
}) {
  const [focused, setFocused] = useState(false)

  return (
    <div className="mb-5 min-w-0 sm:mb-6">
      <label htmlFor={id} className="mb-2 block uppercase font-inter" style={labelStyle}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full min-w-0 border-0 border-b-2 bg-transparent px-1 py-2.5 font-inter text-base outline-none disabled:opacity-60 sm:text-[15px]"
        style={{
          borderBottomColor: borderColor(focused, !!error),
          color: '#0D1B2A',
        }}
      />
      {error && (
        <p className="mt-1 font-inter text-xs" style={{ color: '#DC2626' }}>
          {error}
        </p>
      )}
    </div>
  )
}

export function BottomBorderPassword({
  id,
  label,
  value,
  onChange,
  disabled,
  error,
  autoComplete,
  show,
  onToggleShow,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  error?: string
  autoComplete?: string
  show: boolean
  onToggleShow: () => void
}) {
  const [focused, setFocused] = useState(false)

  return (
    <div className="mb-5 min-w-0 sm:mb-6">
      <label htmlFor={id} className="mb-2 block uppercase font-inter" style={labelStyle}>
        {label}
      </label>
      <div className="relative min-w-0">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          autoComplete={autoComplete}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="w-full min-w-0 border-0 border-b-2 bg-transparent py-2.5 pl-1 pr-14 font-inter text-base outline-none disabled:opacity-60 sm:text-[15px]"
          style={{
            borderBottomColor: borderColor(focused, !!error),
            color: '#0D1B2A',
          }}
        />
        <button
          type="button"
          onClick={onToggleShow}
          disabled={disabled}
          className="absolute right-1 top-1/2 -translate-y-1/2 font-inter text-xs disabled:opacity-60"
          style={{ color: '#5A6A7A' }}
        >
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
      {error && (
        <p className="mt-1 font-inter text-xs" style={{ color: '#DC2626' }}>
          {error}
        </p>
      )}
    </div>
  )
}

export function BottomBorderSelect({
  id,
  label,
  value,
  onChange,
  disabled,
  error,
  children,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  error?: string
  children: React.ReactNode
}) {
  const [focused, setFocused] = useState(false)

  return (
    <div className="mb-5 min-w-0 sm:mb-6">
      <label htmlFor={id} className="mb-2 block uppercase font-inter" style={labelStyle}>
        {label}
      </label>
      <div className="relative min-w-0">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="w-full min-w-0 appearance-none border-0 border-b-2 bg-transparent py-2.5 pl-1 pr-7 font-inter text-base outline-none disabled:opacity-60 sm:text-[15px]"
          style={{
            borderBottomColor: borderColor(focused, !!error),
            color: value ? '#0D1B2A' : '#5A6A7A',
          }}
        >
          {children}
        </select>
        <svg
          className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M6 9l6 6 6-6"
            stroke="#5A6A7A"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      {error && (
        <p className="mt-1 font-inter text-xs" style={{ color: '#DC2626' }}>
          {error}
        </p>
      )}
    </div>
  )
}

export function GoldSubmitButton({
  loading,
  disabled,
  loadingText,
  children,
}: {
  loading?: boolean
  disabled?: boolean
  loadingText: string
  children: React.ReactNode
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="font-jakarta mt-6 flex h-12 min-h-[48px] w-full min-w-0 items-center justify-center rounded-[10px] border-0 text-[15px] font-bold transition-colors hover:bg-[#F5B942] disabled:cursor-not-allowed disabled:opacity-60 sm:mt-8"
      style={{
        background: '#E8A020',
        color: '#0B3D6B',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[#0B3D6B] border-t-transparent" />
          {loadingText}
        </span>
      ) : (
        children
      )}
    </button>
  )
}

export function AuthBottomLink({
  text,
  linkText,
  href,
}: {
  text: string
  linkText: string
  href: string
}) {
  return (
    <p className="mt-4 text-center font-inter text-[13px]" style={{ color: '#5A6A7A' }}>
      {text}{' '}
      <Link href={href} className="text-[#0B3D6B] transition-colors hover:text-[#E8A020]">
        {linkText}
      </Link>
    </p>
  )
}

export function AuthSiteFooter() {
  return (
    <p
      className="mt-4 w-full text-center font-inter text-xs sm:mt-6"
      style={{ color: 'rgba(255,255,255,0.35)' }}
    >
      epiccampus.live
    </p>
  )
}

export function AuthErrorBanner({ message }: { message: string }) {
  return (
    <div
      className="mb-5 min-w-0 break-words rounded-lg px-4 py-3 font-inter text-[13px] sm:mb-6"
      style={{
        color: '#DC2626',
        background: '#FEF2F2',
        border: '1px solid #FECACA',
      }}
    >
      {message}
    </div>
  )
}
