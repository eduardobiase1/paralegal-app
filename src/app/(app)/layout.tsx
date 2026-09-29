import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { OrgProvider, OrgRole } from '@/lib/org-context'
import AppShell from '@/components/layout/AppShell'
import InactivityLogout from '@/components/InactivityLogout'
import ViewerGuard from '@/components/ViewerGuard'
import PasswordChangeGuard from '@/components/PasswordChangeGuard'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Busca todas as organizações do usuário
  const { data: memberships } = await supabase
    .from('organization_members')
    .select('role, org_id, organizations(id, name)')
    .eq('user_id', user!.id)

  // Sem organização → onboarding para criar o escritório
  if (!memberships || memberships.length === 0) redirect('/onboarding')

  // Lê o cookie de org selecionada
  const cookieStore = await cookies()
  const selectedOrgId = cookieStore.get('selected_org_id')?.value

  // Escolhe a membership: a do cookie (se válida) ou a primeira
  const membership = (selectedOrgId
    ? memberships.find(m => {
        const o = Array.isArray(m.organizations) ? m.organizations[0] : m.organizations
        return (o as any)?.id === selectedOrgId
      })
    : null) ?? memberships[0]

  const orgRaw = (membership as NonNullable<typeof membership>).organizations
  const org = (Array.isArray(orgRaw) ? orgRaw[0] : orgRaw) as { id: string; name: string }
  const role = (membership as NonNullable<typeof membership>).role as OrgRole

  // Monta lista de todas as orgs para o switcher
  const allOrgs = memberships.map(m => {
    const o = Array.isArray(m.organizations) ? m.organizations[0] : m.organizations
    return { id: (o as any).id, name: (o as any).name, role: m.role as OrgRole }
  })

  // Verifica se usuário deve trocar a senha no primeiro acesso
  const { data: profile } = await supabase
    .from('profiles')
    .select('must_change_password')
    .eq('id', user!.id)
    .single()

  const mustChangePassword = profile?.must_change_password === true

  return (
    <OrgProvider orgId={org.id} orgName={org.name} role={role} mustChangePassword={mustChangePassword} allOrgs={allOrgs}>
      <ViewerGuard />
      <PasswordChangeGuard />
      <InactivityLogout />
      <AppShell>{children}</AppShell>
    </OrgProvider>
  )
}
