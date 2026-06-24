'use client'

import { QRCodeSVG } from 'qrcode.react'

export interface StudentIDCardProps {
  studentId: string
  studentName: string
  course: string
  location: string
  intake: string
  idNumber: string
  photoUrl?: string
  size?: 'normal' | 'large'
}

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function StudentIDCard({
  studentId,
  studentName,
  course,
  location,
  intake,
  idNumber,
  photoUrl,
  size = 'normal',
}: StudentIDCardProps) {
  const scale = size === 'large' ? 1.4 : 1
  const W = Math.round(480 * scale)
  const H = Math.round(290 * scale)
  const fs = (n: number) => Math.round(n * scale)
  const split = Math.round(178 * scale)
  const initials = getInitials(studentName)
  const shortCourse = course.length > 26 ? course.slice(0, 26) + '…' : course
  const shortName = studentName.length > 20 ? studentName.slice(0, 20) + '…' : studentName
  const shortLocation = location.length > 22 ? location.slice(0, 22) + '…' : location

  return (
    <div
      id="student-id-card"
      style={{
        width: W,
        height: H,
        borderRadius: fs(16),
        overflow: 'hidden',
        boxShadow: '0 12px 40px rgba(11,61,107,0.22)',
        display: 'block',
        flexShrink: 0,
      }}
    >
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' }}
      >
        {/* ── LEFT PANEL — navy ── */}
        <rect width={split} height={H} fill="#0B3D6B" />

        {/* Subtle diagonal accent on left */}
        <polygon
          points={`0,${H * 0.55} ${split},${H * 0.38} ${split},${H * 0.62} 0,${H * 0.80}`}
          fill="#1A6BAD"
          opacity="0.18"
        />

        {/* EPIC wordmark */}
        <text
          x={fs(22)}
          y={fs(44)}
          fontFamily="Arial,sans-serif"
          fontWeight="900"
          fontSize={fs(24)}
          fill="#ffffff"
          letterSpacing="1"
        >
          EPIC
        </text>
        <text
          x={fs(22)}
          y={fs(60)}
          fontFamily="Arial,sans-serif"
          fontWeight="400"
          fontSize={fs(9)}
          fill="#E8A020"
          letterSpacing="3"
        >
          CAMPUS
        </text>

        {/* Gold thin line under wordmark */}
        <rect x={fs(22)} y={fs(68)} width={fs(108)} height={fs(1)} fill="#E8A020" opacity="0.5" />

        {/* Photo circle — centered on left panel */}
        {photoUrl ? (
          <>
            <defs>
              <clipPath id="photoClip">
                <circle cx={split / 2} cy={fs(148)} r={fs(44)} />
              </clipPath>
            </defs>
            <circle cx={split / 2} cy={fs(148)} r={fs(47)} fill="#E8A020" opacity="0.3" />
            <circle cx={split / 2} cy={fs(148)} r={fs(44)} fill="#071F36" />
            <image
              href={photoUrl}
              x={split / 2 - fs(44)}
              y={fs(104)}
              width={fs(88)}
              height={fs(88)}
              clipPath="url(#photoClip)"
              preserveAspectRatio="xMidYMid slice"
            />
          </>
        ) : (
          <>
            <circle cx={split / 2} cy={fs(148)} r={fs(47)} fill="#E8A020" opacity="0.25" />
            <circle cx={split / 2} cy={fs(148)} r={fs(44)} fill="#071F36" />
            <text
              x={split / 2}
              y={fs(156)}
              fontFamily="Arial,sans-serif"
              fontWeight="800"
              fontSize={fs(26)}
              fill="rgba(255,255,255,0.25)"
              textAnchor="middle"
            >
              {initials}
            </text>
          </>
        )}

        {/* ID number bottom of left panel */}
        <text
          x={split / 2}
          y={fs(220)}
          fontFamily="Courier New,monospace"
          fontWeight="700"
          fontSize={fs(10)}
          fill="rgba(255,255,255,0.5)"
          textAnchor="middle"
          letterSpacing="1"
        >
          {idNumber}
        </text>
        <text
          x={split / 2}
          y={fs(236)}
          fontFamily="Arial,sans-serif"
          fontWeight="400"
          fontSize={fs(8)}
          fill="rgba(255,255,255,0.25)"
          textAnchor="middle"
          letterSpacing="2"
        >
          STUDENT ID
        </text>

        {/* www bottom left */}
        <text
          x={split / 2}
          y={H - fs(12)}
          fontFamily="Arial,sans-serif"
          fontWeight="400"
          fontSize={fs(7.5)}
          fill="rgba(255,255,255,0.2)"
          textAnchor="middle"
        >
          www.epiccampus.live
        </text>

        {/* ── RIGHT PANEL — light ── */}
        <rect x={split} y={0} width={W - split} height={H} fill="#F5F7FB" />

        {/* Gold top accent strip on right */}
        <rect x={split} y={0} width={W - split} height={fs(4)} fill="#E8A020" />

        {/* STUDENT ID label top right */}
        <text
          x={W - fs(18)}
          y={fs(22)}
          fontFamily="Arial,sans-serif"
          fontWeight="700"
          fontSize={fs(8)}
          fill="#9AA5B4"
          textAnchor="end"
          letterSpacing="2"
        >
          STUDENT ID
        </text>

        {/* Student name */}
        <text
          x={split + fs(20)}
          y={fs(52)}
          fontFamily="Arial,sans-serif"
          fontWeight="800"
          fontSize={fs(20)}
          fill="#0B3D6B"
        >
          {shortName}
        </text>

        {/* Course badge */}
        <rect
          x={split + fs(20)}
          y={fs(62)}
          width={fs(Math.min(220, shortCourse.length * 6.8 + 24))}
          height={fs(19)}
          rx={fs(4)}
          fill="#0B3D6B"
        />
        <text
          x={split + fs(30)}
          y={fs(75)}
          fontFamily="Arial,sans-serif"
          fontWeight="700"
          fontSize={fs(9)}
          fill="white"
        >
          {shortCourse}
        </text>

        {/* Divider */}
        <rect x={split + fs(20)} y={fs(92)} width={W - split - fs(40)} height={fs(0.5)} fill="#DDE3EC" />

        {/* Details */}
        <text
          x={split + fs(20)}
          y={fs(112)}
          fontFamily="Arial,sans-serif"
          fontWeight="600"
          fontSize={fs(8.5)}
          fill="#9AA5B4"
          letterSpacing="1.5"
        >
          CAMPUS
        </text>
        <text
          x={split + fs(20)}
          y={fs(128)}
          fontFamily="Arial,sans-serif"
          fontWeight="600"
          fontSize={fs(12)}
          fill="#0B3D6B"
        >
          {shortLocation}
        </text>

        <text
          x={split + fs(20)}
          y={fs(152)}
          fontFamily="Arial,sans-serif"
          fontWeight="600"
          fontSize={fs(8.5)}
          fill="#9AA5B4"
          letterSpacing="1.5"
        >
          INTAKE
        </text>
        <text
          x={split + fs(20)}
          y={fs(168)}
          fontFamily="Arial,sans-serif"
          fontWeight="600"
          fontSize={fs(12)}
          fill="#0B3D6B"
        >
          {intake}
        </text>

        <text
          x={split + fs(20)}
          y={fs(192)}
          fontFamily="Arial,sans-serif"
          fontWeight="600"
          fontSize={fs(8.5)}
          fill="#9AA5B4"
          letterSpacing="1.5"
        >
          VALID THROUGH
        </text>
        <text
          x={split + fs(20)}
          y={fs(208)}
          fontFamily="Arial,sans-serif"
          fontWeight="600"
          fontSize={fs(12)}
          fill="#E8A020"
        >
          December {new Date().getFullYear()}
        </text>

        {/* Divider before QR */}
        <rect x={split + fs(20)} y={fs(220)} width={W - split - fs(40)} height={fs(0.5)} fill="#DDE3EC" />

        {/* QR code bottom right */}
        <foreignObject x={W - fs(88)} y={fs(228)} width={fs(70)} height={fs(50)}>
          <div>
            <QRCodeSVG
              value={`https://www.epiccampus.live/verify/${studentId}`}
              size={fs(50)}
              level="M"
              bgColor="#F5F7FB"
              fgColor="#0B3D6B"
            />
          </div>
        </foreignObject>

        {/* epiccampus.live bottom right */}
        <text
          x={split + fs(20)}
          y={H - fs(10)}
          fontFamily="Arial,sans-serif"
          fontWeight="600"
          fontSize={fs(8)}
          fill="#9AA5B4"
        >
          epiccampus.live
        </text>
        <text
          x={W - fs(18)}
          y={H - fs(10)}
          fontFamily="Arial,sans-serif"
          fontWeight="700"
          fontSize={fs(8)}
          fill="#E8A020"
          textAnchor="end"
        >
          EPIC CAMPUS {new Date().getFullYear()}
        </text>
      </svg>
    </div>
  )
}
