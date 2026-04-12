import { redirect } from 'next/navigation'
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

  // Busca a organização do usuário
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role, org_id, organizations(id, name)')
    .eq('user_id', user!.id)
    .single()

  // Sem organização → onboarding para criar o escritório
  if (!membership) redirect('/onboarding')

  const orgRaw = (membership as NonNullable<typeof membership>).organizations
  const org = (Array.isArray(orgRaw) ? orgRaw[0] : orgRaw) as { id: string; name: string }
  const role = (membership as NonNullable<typeof membership>).role as OrgRole

  // Verifica se usuário deve trocar a senha no primeiro acesso
  const { data: profile } = await supabase
    .from('profiles')
    .select('must_change_password')
    .eq('id', user!.id)
    .single()

  const mustChangePassword = profile?.must_change_password === true

  return (
    <OrgProvider orgId={org.id} orgName={org.name} role={role} mustChangePassword={mustChangePassword}>
      <ViewerGuard />
      <PasswordChangeGuard />
      <InactivityLogout />
      <AppShell>{children}</AppShell>
    </OrgProvider>
  )
}
