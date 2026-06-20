import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.RUMIK_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'RUMIK_API_KEY not configured' }, { status: 500 })
  }

  const body = await req.json()
  const { text, model = 'muga', description, language, speaker } = body

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 })
  }

  const payload: Record<string, unknown> = { text: text.trim(), model }

  // Pass description + language for both muga and mulberry
  if (description) payload.description = description
  if (language)    payload.language    = language
  if (speaker)     payload.speaker     = speaker

  const rumikRes = await fetch('https://silk-api.rumik.ai/v1/tts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!rumikRes.ok) {
    const err = await rumikRes.json().catch(() => ({ error: 'Unknown error' }))
    return NextResponse.json({ error: err.error ?? 'Rumik API error', code: err.code }, { status: rumikRes.status })
  }

  const audioBuffer = await rumikRes.arrayBuffer()
  return new NextResponse(audioBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'audio/wav',
      'Cache-Control': 'no-store',
    },
  })
}
