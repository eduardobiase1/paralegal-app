/**
 * POST /api/create-user
 *
 * Cria um usuário diretamente com email + senha temporária.
 * No primeiro login o sistema força a troca de senha.
 *
 * Body: { email, password, role, orgId }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { email, password, role, orgId } = await req.json()

    if (!email || !password || !role || !orgId) {
      return NextResponse.json({ error: 'email, password, role e orgId são obrigatórios.' }, { status: 400 })
    }
    if (!['admin', 'operador', 'viewer'].includes(role)) {
      return NextResponse.json({ error: 'role inválido.' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'A senha deve ter pelo menos 6 caracteres.' }, { status: 400 })
    }

    // ── Verifica que o chamador é admin da org ────────────────────────────────
    const supabase = await createClient()
    const { data: { user: caller } } = await supabase.auth.getUser()
    if (!caller) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }
    const { data: membership } = await supabase
      .from('organization_members')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', caller.id)
      .single()
    if (!membership || membership.role !== 'admin') {
      return NextResponse.json({ error: 'Apenas administradores podem criar usuários.' }, { status: 403 })
    }

    // ── Admin client ──────────────────────────────────────────────────────────
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!serviceRoleKey || !supabaseUrl) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurado.' }, { status: 500 })
    }
    const adminClient = createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // ── Cria usuário com senha (email já confirmado, sem envio de e-mail) ─────
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // confirma o e-mail automaticamente
    })

    if (createError) {
      if (createError.message?.toLowerCase().includes('already registered') ||
          createError.message?.toLowerCase().includes('already exists')) {
        return NextResponse.json({ error: 'Já existe um usuário com este e-mail.' }, { status: 409 })
      }
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }

    const newUser = created?.user
    if (!newUser) {
      return NextResponse.json({ error: 'Erro ao criar usuário.' }, { status: 500 })
    }

    // ── Vincula à organização ─────────────────────────────────────────────────
    const { error: memberError } = await adminClient
      .from('organization_members')
      .insert({ org_id: orgId, user_id: newUser.id, role })
    if (memberError) {
      return NextResponse.json({ error: `Usuário criado, mas erro ao vincular à org: ${memberError.message}` }, { status: 500 })
    }

    // ── Cria perfil com must_change_password = true ───────────────────────────
    await adminClient
      .from('profiles')
      .upsert(
        { id: newUser.id, email, nome: email.split('@')[0], ativo: true, must_change_password: true },
        { onConflict: 'id' }
      )

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[/api/create-user] erro:', err)
    return NextResponse.json({ error: err?.message ?? 'Erro interno.' }, { status: 500 })
  }
}
