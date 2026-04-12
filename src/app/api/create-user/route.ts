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

    // ── Se o e-mail já existe, busca o usuário e apenas vincula à org ──────────
    let userId: string | null = null

    if (createError) {
      const msg = createError.message?.toLowerCase() ?? ''
      if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('email address has already')) {
        // Busca o usuário existente pelo e-mail
        const { data: list } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
        const existing = list?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())
        if (!existing) {
          return NextResponse.json({ error: 'Usuário já existe mas não foi possível localizá-lo.' }, { status: 409 })
        }
        userId = existing.id

        // Verifica se já é membro desta org
        const { data: existingMember } = await adminClient
          .from('organization_members')
          .select('id')
          .eq('org_id', orgId)
          .eq('user_id', userId)
          .single()
        if (existingMember) {
          return NextResponse.json({ error: 'Este usuário já é membro desta organização.' }, { status: 409 })
        }

        // Atualiza a senha para a temporária fornecida pelo admin
        await adminClient.auth.admin.updateUserById(userId, { password })
      } else {
        return NextResponse.json({ error: createError.message }, { status: 400 })
      }
    } else {
      userId = created?.user?.id ?? null
    }

    if (!userId) {
      return NextResponse.json({ error: 'Erro ao obter ID do usuário.' }, { status: 500 })
    }

    // ── Vincula à organização ─────────────────────────────────────────────────
    const { error: memberError } = await adminClient
      .from('organization_members')
      .insert({ org_id: orgId, user_id: userId, role })
    if (memberError) {
      return NextResponse.json({ error: `Erro ao vincular usuário à organização: ${memberError.message}` }, { status: 500 })
    }

    // ── Cria/atualiza perfil com must_change_password = true ──────────────────
    await adminClient
      .from('profiles')
      .upsert(
        { id: userId, email, nome: email.split('@')[0], ativo: true, must_change_password: true },
        { onConflict: 'id' }
      )

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[/api/create-user] erro:', err)
    return NextResponse.json({ error: err?.message ?? 'Erro interno.' }, { status: 500 })
  }
}
