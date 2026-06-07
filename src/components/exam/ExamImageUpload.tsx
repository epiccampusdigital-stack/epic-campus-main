'use client'

import { useRef, useState } from 'react'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '@/lib/firebase/client'

interface ExamImageUploadProps {
  paperId: string
  questionId: string
  section: string
  onUploaded: (url: string) => void
  existingUrl?: string
}

const ACCEPTED = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp'

export default function ExamImageUpload({
  paperId,
  questionId,
  section,
  onUploaded,
  existingUrl,
}: ExamImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string>(existingUrl ?? '')
  const [error, setError] = useState('')

  async function handleFile(file: File) {
    setError('')
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      const path = `exam-images/${paperId}/${section}/${questionId}.${ext}`
      const storageRef = ref(storage, path)
      await uploadBytes(storageRef, file)
      const url = await getDownloadURL(storageRef)
      setPreview(url)
      onUploaded(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  function handleRemove() {
    setPreview('')
    onUploaded('')
  }

  if (preview) {
    return (
      <div className="mt-2">
        <img
          src={preview}
          alt="Question image"
          className="max-h-40 rounded-lg border border-gray-200 object-contain"
        />
        <div className="mt-1 flex gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-xs text-[#0B3D6B] hover:underline"
          >
            Replace
          </button>
          <button
            type="button"
            onClick={handleRemove}
            className="text-xs text-red-600 hover:underline"
          >
            Remove
          </button>
        </div>
        <input ref={inputRef} type="file" accept={ACCEPTED} className="hidden" onChange={handleChange} />
      </div>
    )
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed
                   border-gray-200 py-4 text-sm text-gray-400 hover:border-[#0B3D6B]/40
                   hover:text-[#0B3D6B] transition-colors disabled:opacity-50"
      >
        {uploading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#0B3D6B] border-t-transparent" />
            Uploading…
          </>
        ) : (
          <>
            <span className="ti ti-photo text-base" aria-hidden="true" />
            Click to upload image
          </>
        )}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <input ref={inputRef} type="file" accept={ACCEPTED} className="hidden" onChange={handleChange} />
    </div>
  )
}
