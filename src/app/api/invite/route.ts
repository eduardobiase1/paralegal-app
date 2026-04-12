/**
 * POST /api/invite
 *
 * Convida um novo usuário para a organização do admin logado.
 * 1. Valida que o chamador é admin da org
 * 2. Chama supabase.auth.admin.inviteUserByEmail() → envia e-mail de convite
 * 3. Insere organization_members com role informado
 *
 * Variáveis de ambiente necessárias:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   ← chave service_role do projeto Supabase
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { email, role, orgId } = await req.json()

    // ── Validação básica ──────────────────────────────────────────────────────
    if (!email || !role || !orgId) {
      return NextResponse.json({ error: 'email, role e orgId são obrigatórios.' }, { status: 400 })
    }
    if (!['admin', 'operador', 'viewer'].includes(role)) {
      return NextResponse.json({ error: 'role inválido.' }, { status: 400 })
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
      return NextResponse.json({ error: 'Apenas administradores podem convidar usuários.' }, { status: 403 })
    }

    // ── Chave service_role ────────────────────────────────────────────────────
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!serviceRoleKey || !supabaseUrl) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY não configurado. Adicione nas variáveis de ambiente.' },
        { status: 500 }
      )
    }

    const adminClient = createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // ── Convida via Supabase Auth Admin API ───────────────────────────────────
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${req.nextUrl.origin}/login`,
    })

    if (inviteError) {
      // Se o usuário já existe, tenta buscar pelo email
      if (inviteError.message?.toLowerCase().includes('already registered')) {
        const { data: existingUsers } = await adminClient.auth.admin.listUsers()
        const existingUser = existingUsers?.users?.find(u => u.email === email)
        if (existingUser) {
          // Verifica se já é membro
          const { data: existingMember } = await supabase
            .from('organization_members')
            .select('id')
            .eq('org_id', orgId)
            .eq('user_id', existingUser.id)
            .single()

          if (existingMember) {
            return NextResponse.json({ error: 'Este usuário já é membro da organização.' }, { status: 409 })
          }

          // Adiciona à org
          await supabase.from('organization_members').insert({ org_id: orgId, user_id: existingUser.id, role })
          return NextResponse.json({ success: true, existing: true })
        }
      }
      return NextResponse.json({ error: inviteError.message }, { status: 400 })
    }

    const newUser = inviteData?.user
    if (!newUser) {
      return NextResponse.json({ error: 'Erro ao criar usuário.' }, { status: 500 })
    }

    // ── Insere na organização ─────────────────────────────────────────────────
    const { error: memberError } = await adminClient
      .from('organization_members')
      .insert({ org_id: orgId, user_id: newUser.id, role })

    if (memberError) {
      return NextResponse.json({ error: `Usuário convidado, mas erro ao vincular à org: ${memberError.message}` }, { status: 500 })
    }

    // ── Garante que profile existe ────────────────────────────────────────────
    await adminClient
      .from('profiles')
      .upsert({ id: newUser.id, email, nome: email.split('@')[0], ativo: true }, { onConflict: 'id', ignoreDuplicates: true })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[/api/invite] erro:', err)
    return NextResponse.json({ error: err?.message ?? 'Erro interno.' }, { status: 500 })
  }
}
