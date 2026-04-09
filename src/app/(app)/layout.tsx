import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OrgProvider, OrgRole } from '@/lib/org-context'
import Sidebar from '@/components/layout/Sidebar'
import InactivityLogout from '@/components/InactivityLogout'

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

  return (
    <OrgProvider orgId={org.id} orgName={org.name} role={role}>
      <InactivityLogout />
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 ml-64">
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </OrgProvider>
  )
}
