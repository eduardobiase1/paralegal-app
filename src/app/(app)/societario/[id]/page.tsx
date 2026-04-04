import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ProcessoChecklist from '@/components/modules/ProcessoChecklist'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ProcessoPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: processo }, { data: etapas }, { data: profiles }] = await Promise.all([
    supabase
      .from('processos_societarios')
      .select('*, empresa:empresas(razao_social, cnpj)')
      .eq('id', id)
      .single(),
    supabase
      .from('processo_etapas')
      .select('*')
      .eq('processo_id', id)
      .order('ordem'),
    supabase.from('profiles').select('id, nome').eq('ativo', true),
  ])

  if (!processo) notFound()

  return (
    <ProcessoChecklist
      processo={processo}
      etapas={etapas ?? []}
      profiles={profiles ?? []}
    />
  )
}
