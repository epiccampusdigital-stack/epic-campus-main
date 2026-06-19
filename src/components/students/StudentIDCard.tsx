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
}: StudentIDCardProps) {
  return (
    <div
      style={{
        width: 380,
        height: 240,
        borderRadius: 16,
        overflow: 'hidden',
        background: '#ffffff',
        border: '1.5px solid #DDE3EC',
        boxShadow: '0 4px 24px rgba(11,61,107,0.10)',
        fontFamily: 'Arial, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      {/* HEADER */}
      <div
        style={{
          background: '#0B3D6B',
          height: 52,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          flexShrink: 0,
        }}
      >
        {/* Logo + text */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/logo-transparent.png"
            alt="EPIC Campus"
            style={{ height: 32, width: 'auto', objectFit: 'contain' }}
          />
        </div>
        <div style={{
          background: '#E8A020',
          borderRadius: 6,
          padding: '3px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}>
          <span style={{
            color: '#0B3D6B',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}>
            STUDENT ID
          </span>
        </div>
      </div>

      {/* BODY */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'row',
        padding: '12px 16px',
        gap: 12,
        minHeight: 0,
      }}>
        {/* LEFT: Student info */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 5,
          minWidth: 0,
          overflow: 'hidden',
        }}>
          <div style={{
            fontSize: 17,
            fontWeight: 700,
            color: '#0B3D6B',
            lineHeight: 1.2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 200,
          }}>
            {studentName}
          </div>
          <div style={{
            display: 'inline-flex',
            background: '#E8A020',
            borderRadius: 99,
            padding: '2px 10px',
            width: 'fit-content',
            maxWidth: 195,
            overflow: 'hidden',
          }}>
            <span style={{
              color: '#0B3D6B',
              fontSize: 10,
              fontWeight: 700,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {course}
            </span>
          </div>
          <div style={{
            fontSize: 11,
            color: '#5A6A7A',
            fontFamily: 'monospace',
            marginTop: 2,
          }}>
            ID: {idNumber}
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            color: '#5A6A7A',
          }}>
            {/* Location pin SVG - no emoji */}
            <svg width="10" height="12" viewBox="0 0 10 12" fill="none">
              <path d="M5 0C2.79 0 1 1.79 1 4c0 3 4 8 4 8s4-5 4-8c0-2.21-1.79-4-4-4zm0 5.5A1.5 1.5 0 1 1 5 2.5a1.5 1.5 0 0 1 0 3z" fill="#0B3D6B"/>
            </svg>
            <span style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 150,
            }}>
              {location}
            </span>
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>
            {intake}
          </div>
        </div>

        {/* RIGHT: Photo + QR */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
          width: 90,
        }}>
          {/* Photo */}
          <div style={{
            width: 54,
            height: 54,
            borderRadius: '50%',
            background: '#0B3D6B',
            border: '2.5px solid #E8A020',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontSize: 16,
            fontWeight: 700,
            flexShrink: 0,
          }}>
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              getInitials(studentName)
            )}
          </div>
          {/* QR */}
          <QRCodeSVG
            value={`https://www.epiccampus.live/verify/${studentId}`}
            size={60}
            level="M"
            bgColor="#ffffff"
            fgColor="#0B3D6B"
            style={{ borderRadius: 4 }}
          />
        </div>
      </div>

      {/* FOOTER */}
      <div style={{
        background: '#E8A020',
        height: 30,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: 10,
          color: '#0B3D6B',
          fontWeight: 600,
        }}>
          www.epiccampus.live
        </span>
        <span style={{
          fontSize: 10,
          color: '#0B3D6B',
          fontWeight: 600,
        }}>
          Valid: {new Date().getFullYear()}
        </span>
      </div>
    </div>
  )
}
