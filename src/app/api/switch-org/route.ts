import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { orgId } = await req.json()
  const res = NextResponse.json({ ok: true })
  res.cookies.set('selected_org_id', orgId, {
    path: '/',
    httpOnly: false,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
  })
  return res
}
