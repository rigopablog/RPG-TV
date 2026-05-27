/**
 * Real-Debrid token validation proxy.
 *
 * The browser can't call api.real-debrid.com directly because RD doesn't
 * send CORS headers. This route forwards the validation request server-side
 * and returns just a yes/no plus the user's username on success.
 */
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 10

export async function POST(req: NextRequest) {
  const token = req.headers.get('x-rd-token') ?? ''
  if (!token) {
    return NextResponse.json({ valid: false, error: 'no-token' }, { status: 400 })
  }

  try {
    const r = await fetch('https://api.real-debrid.com/rest/1.0/user', {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    })

    if (!r.ok) {
      return NextResponse.json({ valid: false, status: r.status }, { status: 200 })
    }

    const data = (await r.json()) as { username?: string; type?: string; premium?: number }
    return NextResponse.json({
      valid: true,
      username: data.username,
      type: data.type,
      premium: data.premium,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ valid: false, error: msg }, { status: 200 })
  }
}
