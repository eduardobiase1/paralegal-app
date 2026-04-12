/**
 * POST /api/reset-password
 *
 * Admin redefine a senha de um usuário da sua organização.
 * Body: { userId, newPassword, orgId }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { userId, newPassword, orgId } = await req.json()

    if (!userId || !newPassword || !orgId) {
      return NextResponse.json({ error: 'userId, newPassword e orgId são obrigatórios.' }, { status: 400 })
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'A senha deve ter pelo menos 6 caracteres.' }, { status: 400 })
    }

    // Verifica que o chamador é admin da org
    const supabase = await createClient()
    const { data: { user: caller } } = await supabase.auth.getUser()
    if (!caller) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const { data: membership } = await supabase
      .from('organization_members')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', caller.id)
      .single()
    if (!membership || membership.role !== 'admin') {
      return NextResponse.json({ error: 'Apenas administradores podem redefinir senhas.' }, { status: 403 })
    }

    // Verifica que o usuário alvo pertence à mesma org
    const { data: targetMember } = await supabase
      .from('organization_members')
      .select('id')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .single()
    if (!targetMember) {
      return NextResponse.json({ error: 'Usuário não pertence a esta organização.' }, { status: 403 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!serviceRoleKey || !supabaseUrl) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurado.' }, { status: 500 })
    }
    const adminClient = createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Redefine a senha
    const { error: authError } = await adminClient.auth.admin.updateUserById(userId, { password: newPassword })
    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

    // Força troca de senha no próximo login
    await adminClient
      .from('profiles')
      .update({ must_change_password: true })
      .eq('id', userId)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[/api/reset-password] erro:', err)
    return NextResponse.json({ error: err?.message ?? 'Erro interno.' }, { status: 500 })
  }
}
