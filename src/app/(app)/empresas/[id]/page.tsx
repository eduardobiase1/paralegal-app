import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import EmpresaForm from '@/components/modules/EmpresaForm'
import EmpresaDetail from '@/components/modules/EmpresaDetail'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ edit?: string }>
}

export default async function EmpresaPage({ params, searchParams }: Props) {
  const { id } = await params
  const { edit } = await searchParams
  const supabase = await createClient()
  const { data: empresa } = await supabase
    .from('empresas')
    .select('*')
    .eq('id', id)
    .single()

  if (!empresa) notFound()

  if (edit) {
    return (
      <div className="p-6 max-w-4xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Editar Empresa</h1>
        <div className="card">
          <EmpresaForm empresa={empresa} />
        </div>
      </div>
    )
  }

  return <EmpresaDetail empresa={empresa} />
}
