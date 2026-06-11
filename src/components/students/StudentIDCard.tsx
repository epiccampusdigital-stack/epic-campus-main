'use client'

import { QRCodeSVG } from 'qrcode.react'
import { getInitials } from '@/lib/students/helpers'

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
  const scale = size === 'large' ? 'scale-110 origin-center' : ''
  const validYear = new Date().getFullYear()

  return (
    <div
      className={`w-[340px] h-[215px] rounded-xl overflow-hidden relative bg-white shadow-lg border border-gray-200 flex-shrink-0 flex flex-col ${scale}`}
    >
      <div className="w-full h-[38px] bg-[#0B3D6B] flex items-center justify-between px-3 shrink-0">
        <div className="text-sm font-bold leading-none">
          <span className="text-white">EPiC</span>{' '}
          <span className="text-[#E8A020]">campus</span>
        </div>
        <span className="text-[#E8A020] text-xs font-bold tracking-widest">STUDENT ID</span>
      </div>

      <div className="flex flex-row flex-1 min-h-0">
        <div className="flex-1 px-3 py-2 flex flex-col justify-center gap-1 min-w-0">
          <p className="text-[15px] font-bold text-[#0B3D6B] leading-tight truncate">
            {studentName}
          </p>
          <span className="inline-flex bg-[#E8A020] text-[#0B3D6B] text-[10px] font-bold px-2 py-0.5 rounded-full w-fit mt-0.5 truncate max-w-full">
            {course}
          </span>
          <p className="text-[11px] text-gray-500 font-mono">ID: {idNumber}</p>
          <p className="text-[11px] text-gray-400 truncate">📍 {location}</p>
          <p className="text-[11px] text-gray-400">{intake}</p>
        </div>

        <div className="w-[100px] flex flex-col items-center justify-center gap-1.5 pr-2 shrink-0">
          <div className="w-[52px] h-[52px] rounded-full bg-[#0B3D6B] flex items-center justify-center text-white text-lg font-bold border-2 border-[#E8A020] overflow-hidden">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              getInitials(studentName)
            )}
          </div>
          <QRCodeSVG
            value={`https://www.epiccampus.live/verify/${studentId}`}
            size={62}
            level="M"
            bgColor="#ffffff"
            fgColor="#0B3D6B"
            style={{ borderRadius: 4 }}
          />
        </div>
      </div>

      <div className="w-full h-[28px] bg-[#E8A020] flex items-center justify-between px-3 shrink-0">
        <span className="text-[10px] text-[#0B3D6B] font-semibold">www.epiccampus.live</span>
        <span className="text-[10px] text-[#0B3D6B] font-semibold">Valid: {validYear}</span>
      </div>
    </div>
  )
}
