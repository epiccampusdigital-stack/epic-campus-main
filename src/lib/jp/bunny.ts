import crypto from 'crypto'

// Server-only: Bunny Stream API keys must never reach the client bundle.
// This module is imported only from API routes (src/app/api/jp/*).

function getBunnyEnv() {
  const libraryId = process.env.BUNNY_LIBRARY_ID
  const cdnHostname = process.env.BUNNY_CDN_HOSTNAME
  const apiKey = process.env.BUNNY_API_KEY
  const tokenKey = process.env.BUNNY_TOKEN_KEY

  if (!libraryId || !cdnHostname || !apiKey || !tokenKey) {
    throw new Error(
      'Bunny Stream env vars missing — require BUNNY_LIBRARY_ID, BUNNY_CDN_HOSTNAME, BUNNY_API_KEY, BUNNY_TOKEN_KEY',
    )
  }

  return { libraryId, cdnHostname, apiKey, tokenKey }
}

export type BunnyVideoStatus =
  | 'queued'
  | 'processing'
  | 'encoding'
  | 'finished'
  | 'resolution_finished'
  | 'failed'
  | 'unknown'

function mapBunnyStatus(status: number): BunnyVideoStatus {
  switch (status) {
    case 0: return 'queued'
    case 1: return 'processing'
    case 2: return 'encoding'
    case 3: return 'finished'
    case 4: return 'resolution_finished'
    case 5: return 'failed'
    default: return 'unknown'
  }
}

export interface BunnyVideoInfo {
  guid: string
  title: string
  status: BunnyVideoStatus
  length: number
  thumbnailFileName: string | null
}

export async function createBunnyVideo(title: string): Promise<{ guid: string }> {
  const { libraryId, apiKey } = getBunnyEnv()

  const res = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos`, {
    method: 'POST',
    headers: {
      AccessKey: apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ title }),
  })

  if (!res.ok) {
    throw new Error(`Bunny createVideo failed: ${res.status} ${await res.text()}`)
  }

  const data = await res.json()
  return { guid: String(data.guid) }
}

export async function getBunnyVideo(guid: string): Promise<BunnyVideoInfo> {
  const { libraryId, apiKey } = getBunnyEnv()

  const res = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${guid}`, {
    headers: { AccessKey: apiKey, Accept: 'application/json' },
  })

  if (!res.ok) {
    throw new Error(`Bunny getVideo failed: ${res.status} ${await res.text()}`)
  }

  const data = await res.json()
  return {
    guid: String(data.guid),
    title: String(data.title ?? ''),
    status: mapBunnyStatus(Number(data.status)),
    length: Number(data.length ?? 0),
    thumbnailFileName: data.thumbnailFileName ?? null,
  }
}

export async function deleteBunnyVideo(guid: string): Promise<void> {
  const { libraryId, apiKey } = getBunnyEnv()

  const res = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${guid}`, {
    method: 'DELETE',
    headers: { AccessKey: apiKey, Accept: 'application/json' },
  })

  if (!res.ok) {
    throw new Error(`Bunny deleteVideo failed: ${res.status} ${await res.text()}`)
  }
}

export function signBunnyEmbedToken(guid: string, ttlSeconds = 3600): { token: string; expires: number } {
  const { tokenKey } = getBunnyEnv()
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds
  const token = crypto.createHash('sha256').update(`${tokenKey}${guid}${expires}`).digest('hex')
  return { token, expires }
}

export function buildBunnyEmbedUrl(guid: string, token: string, expires: number): string {
  const { libraryId } = getBunnyEnv()
  return `https://iframe.mediadelivery.net/embed/${libraryId}/${guid}?token=${token}&expires=${expires}`
}

// Used by the video-upload route to hand the admin client a direct-upload
// target — never expose BUNNY_API_KEY outside an admin/owner-gated route.
export function buildBunnyUploadTarget(guid: string): { uploadUrl: string; accessKey: string } {
  const { libraryId, apiKey } = getBunnyEnv()
  return {
    uploadUrl: `https://video.bunnycdn.com/library/${libraryId}/videos/${guid}`,
    accessKey: apiKey,
  }
}
