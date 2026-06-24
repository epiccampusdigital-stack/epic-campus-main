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
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
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
  const W = Math.round(420 * scale)
  const H = Math.round(260 * scale)

  const fs = (n: number) => Math.round(n * scale)

  return (
    <div
      id="student-id-card"
      style={{
        width: W,
        height: H,
        borderRadius: Math.round(16 * scale),
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(11,61,107,0.18)',
        display: 'block',
        flexShrink: 0,
        background: '#fff',
      }}
    >
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' }}
      >
        {/* Background */}
        <rect width={W} height={H} fill="#ffffff" />

        {/* Header bar */}
        <rect width={W} height={fs(58)} fill="#0B3D6B" />

        {/* Decorative diagonal accent */}
        <polygon
          points={`${W * 0.55},0 ${W},0 ${W},${fs(58)} ${W * 0.70},${fs(58)}`}
          fill="#1A6BAD"
          opacity="0.4"
        />

        {/* EPIC Campus text in header */}
        <text
          x={fs(18)}
          y={fs(24)}
          fontFamily="Arial, sans-serif"
          fontWeight="800"
          fontSize={fs(15)}
          fill="#ffffff"
          letterSpacing="0.5"
        >
          EPIC
        </text>
        <text
          x={fs(18)}
          y={fs(41)}
          fontFamily="Arial, sans-serif"
          fontWeight="400"
          fontSize={fs(10)}
          fill="rgba(255,255,255,0.75)"
          letterSpacing="2"
        >
          CAMPUS
        </text>

        {/* Vertical gold line separator */}
        <rect x={fs(70)} y={fs(12)} width={fs(1.5)} height={fs(34)} fill="#E8A020" opacity="0.7" />

        {/* Tagline */}
        <text
          x={fs(80)}
          y={fs(28)}
          fontFamily="Arial, sans-serif"
          fontWeight="300"
          fontSize={fs(8)}
          fill="rgba(255,255,255,0.6)"
          letterSpacing="1.5"
        >
          WE CREATE YOUR FUTURE
        </text>

        {/* STUDENT ID badge */}
        <rect
          x={W - fs(108)}
          y={fs(14)}
          width={fs(92)}
          height={fs(28)}
          rx={fs(6)}
          fill="#E8A020"
        />
        <text
          x={W - fs(62)}
          y={fs(32)}
          fontFamily="Arial, sans-serif"
          fontWeight="800"
          fontSize={fs(9)}
          fill="#0B3D6B"
          textAnchor="middle"
          letterSpacing="1.5"
        >
          STUDENT ID
        </text>

        {/* Gold accent line under header */}
        <rect y={fs(58)} width={W} height={fs(3)} fill="#E8A020" />

        {/* Course badge pill */}
        <rect
          x={fs(18)}
          y={fs(75)}
          width={Math.min(fs(200), course.length * fs(6.5) + fs(20))}
          height={fs(20)}
          rx={fs(10)}
          fill="#E8A020"
        />
        <text
          x={fs(28)}
          y={fs(89)}
          fontFamily="Arial, sans-serif"
          fontWeight="700"
          fontSize={fs(8.5)}
          fill="#0B3D6B"
        >
          {course.length > 28 ? course.slice(0, 28) + '…' : course}
        </text>

        {/* Student name */}
        <text
          x={fs(18)}
          y={fs(115)}
          fontFamily="Arial, sans-serif"
          fontWeight="800"
          fontSize={fs(18)}
          fill="#0B3D6B"
        >
          {studentName.length > 22 ? studentName.slice(0, 22) + '…' : studentName}
        </text>

        {/* ID Number */}
        <text
          x={fs(18)}
          y={fs(135)}
          fontFamily="Courier New, monospace"
          fontWeight="700"
          fontSize={fs(10)}
          fill="#1A6BAD"
          letterSpacing="1"
        >
          {idNumber}
        </text>

        {/* Location pin */}
        <circle cx={fs(22)} cy={fs(152)} r={fs(4)} fill="#0B3D6B" />
        <polygon
          points={`${fs(19)},${fs(153)} ${fs(25)},${fs(153)} ${fs(22)},${fs(160)}`}
          fill="#0B3D6B"
        />
        <text
          x={fs(30)}
          y={fs(157)}
          fontFamily="Arial, sans-serif"
          fontWeight="400"
          fontSize={fs(9.5)}
          fill="#5A6A7A"
        >
          {location.length > 25 ? location.slice(0, 25) + '…' : location}
        </text>

        {/* Intake */}
        <text
          x={fs(18)}
          y={fs(175)}
          fontFamily="Arial, sans-serif"
          fontWeight="400"
          fontSize={fs(9)}
          fill="#94a3b8"
        >
          {intake}
        </text>

        {/* Photo circle */}
        {photoUrl ? (
          <>
            <defs>
              <clipPath id="photoClip">
                <circle cx={W - fs(82)} cy={fs(108)} r={fs(36)} />
              </clipPath>
            </defs>
            <circle cx={W - fs(82)} cy={fs(108)} r={fs(39)} fill="#E8A020" />
            <image
              href={photoUrl}
              x={W - fs(118)}
              y={fs(72)}
              width={fs(72)}
              height={fs(72)}
              clipPath="url(#photoClip)"
              preserveAspectRatio="xMidYMid slice"
            />
          </>
        ) : (
          <>
            <circle cx={W - fs(82)} cy={fs(108)} r={fs(39)} fill="#E8A020" />
            <circle cx={W - fs(82)} cy={fs(108)} r={fs(36)} fill="#0B3D6B" />
            <text
              x={W - fs(82)}
              y={fs(116)}
              fontFamily="Arial, sans-serif"
              fontWeight="800"
              fontSize={fs(20)}
              fill="#ffffff"
              textAnchor="middle"
            >
              {getInitials(studentName)}
            </text>
          </>
        )}

        {/* QR code via foreignObject */}
        <foreignObject x={W - fs(78)} y={fs(155)} width={fs(62)} height={fs(62)}>
          <div>
            <QRCodeSVG
              value={`https://www.epiccampus.live/verify/${studentId}`}
              size={fs(62)}
              level="M"
              bgColor="#ffffff"
              fgColor="#0B3D6B"
            />
          </div>
        </foreignObject>

        {/* Footer bar */}
        <rect y={H - fs(32)} width={W} height={fs(32)} fill="#0B3D6B" />

        <text
          x={fs(16)}
          y={H - fs(11)}
          fontFamily="Arial, sans-serif"
          fontWeight="600"
          fontSize={fs(9)}
          fill="#E8A020"
        >
          www.epiccampus.live
        </text>

        <text
          x={W - fs(16)}
          y={H - fs(11)}
          fontFamily="Arial, sans-serif"
          fontWeight="600"
          fontSize={fs(9)}
          fill="rgba(255,255,255,0.7)"
          textAnchor="end"
        >
          Valid: {new Date().getFullYear()}
        </text>

        {/* Watermark diagonal lines */}
        {[0.15, 0.35, 0.55, 0.75, 0.95].map((t, i) => (
          <line
            key={i}
            x1={W * t}
            y1={fs(61)}
            x2={W * t + fs(20)}
            y2={H - fs(32)}
            stroke="#0B3D6B"
            strokeWidth="0.5"
            opacity="0.04"
          />
        ))}
      </svg>
    </div>
  )
}
