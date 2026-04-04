import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatDate, formatCNPJ } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import { StatusCor } from '@/types'

export const dynamic = 'force-dynamic'

interface AlertItem {
  id: string
  razao_social: string
  cnpj?: string
  tipo: string
  data_vencimento: string
  status_cor: StatusCor
  dias_para_vencer: number
  href: string
  categoria: string
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const [
    { data: empresas },
    { data: certidoesAlert },
    { data: alvarasAlert },
    { data: licencasAlert },
    { data: certificadosAlert },
    { data: processos },
    { data: gargalos },
  ] = await Promise.all([
    supabase.from('empresas').select('id, status').then(r => ({
      data: {
        total: r.data?.length ?? 0,
        ativas: r.data?.filter(e => e.status === 'ativa').length ?? 0,
        em_abertura: r.data?.filter(e => e.status === 'em_abertura').length ?? 0,
      }
    })),
    supabase.from('v_certidoes_status')
      .select('id, razao_social, cnpj, tipo, data_vencimento, status_cor, dias_para_vencer')
      .in('status_cor', ['vencido', 'critico', 'atencao'])
      .order('dias_para_vencer', { ascending: true })
      .limit(10),
    supabase.from('v_alvaras_status')
      .select('id, razao_social, cnpj, tipo, data_vencimento, status_cor, dias_para_vencer')
      .in('status_cor', ['vencido', 'critico', 'atencao'])
      .order('dias_para_vencer', { ascending: true })
      .limit(10),
    supabase.from('v_licencas_status')
      .select('id, razao_social, cnpj, orgao, data_vencimento, status_cor, dias_para_vencer')
      .in('status_cor', ['vencido', 'critico', 'atencao'])
      .order('dias_para_vencer', { ascending: true })
      .limit(10),
    supabase.from('v_certificados_status')
      .select('id, razao_social, cnpj, uso, data_vencimento, status_cor, dias_para_vencer')
      .in('status_cor', ['vencido', 'critico', 'atencao', 'alerta'])
      .order('dias_para_vencer', { ascending: true })
      .limit(10),
    supabase.from('processos_societarios')
      .select('id, tipo, status, empresa:empresas(razao_social)')
      .eq('status', 'em_andamento'),
    supabase.from('processo_etapas')
      .select('id, nome, status, updated_at, processo:processos_societarios(empresa:empresas(razao_social), tipo)')
      .eq('status', 'em_andamento')
      .lt('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
  ])

  const allAlerts: AlertItem[] = [
    ...(certidoesAlert ?? []).map((c: any) => ({ ...c, tipo: c.tipo, href: '/certidoes', categoria: 'Certidão' })),
    ...(alvarasAlert ?? []).map((a: any) => ({ ...a, tipo: a.tipo, href: '/alvaras', categoria: 'Alvará' })),
    ...(licencasAlert ?? []).map((l: any) => ({ ...l, tipo: l.orgao, href: '/licencas', categoria: 'Licença' })),
    ...(certificadosAlert ?? []).map((c: any) => ({ ...c, tipo: c.uso, href: '/certificados', categoria: 'Certificado' })),
  ].sort((a, b) => (a.dias_para_vencer ?? 0) - (b.dias_para_vencer ?? 0))

  const TIPO_LABELS: Record<string, string> = {
    abertura: 'Abertura', alteracao_contratual: 'Alteração Contratual',
    encerramento: 'Encerramento', transferencia_entrada: 'Transf. Entrada',
    transferencia_saida: 'Transf. Saída',
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Visão geral de todas as empresas</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          label="Total de Empresas"
          value={(empresas as any)?.total ?? 0}
          sub={`${(empresas as any)?.ativas ?? 0} ativas`}
          color="blue"
          href="/empresas"
        />
        <KPICard
          label="Alertas Críticos"
          value={allAlerts.filter(a => a.status_cor === 'critico' || a.status_cor === 'vencido').length}
          sub="vencidos ou ≤ 30 dias"
          color="red"
        />
        <KPICard
          label="Processos em Andamento"
          value={(processos ?? []).length}
          sub="societários abertos"
          color="purple"
          href="/societario"
        />
        <KPICard
          label="Gargalos"
          value={(gargalos ?? []).length}
          sub="etapas paradas há +7 dias"
          color="orange"
          href="/societario"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alertas de vencimento */}
        <div className="card lg:col-span-2">
          <div className="card-header">
            <h2 className="font-semibold text-gray-900">Alertas de Vencimento</h2>
            <span className="text-sm text-gray-500">{allAlerts.length} item(s)</span>
          </div>
          {!allAlerts.length ? (
            <div className="p-8 text-center text-gray-500">
              <div className="text-4xl mb-2">✅</div>
              <p className="font-medium">Tudo em dia!</p>
              <p className="text-sm">Nenhum vencimento próximo</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Empresa</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Categoria</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Tipo</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Vencimento</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {allAlerts.slice(0, 20).map(a => (
                    <tr key={`${a.categoria}-${a.id}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 truncate max-w-[180px]">{a.razao_social}</div>
                        {a.cnpj && <div className="text-xs text-gray-500 font-mono">{formatCNPJ(a.cnpj)}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{a.categoria}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 truncate max-w-[100px]">{a.tipo}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(a.data_vencimento)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={a.status_cor} diasParaVencer={a.dias_para_vencer} />
                      </td>
                      <td className="px-4 py-3">
                        <Link href={a.href} className="text-xs text-primary-600 hover:underline">
                          Ver
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Processos em andamento */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold text-gray-900">Processos em Andamento</h2>
            <Link href="/societario" className="text-sm text-primary-600 hover:underline">Ver todos</Link>
          </div>
          {!(processos ?? []).length ? (
            <div className="p-6 text-center text-gray-500 text-sm">Nenhum processo em andamento</div>
          ) : (
            <div className="divide-y">
              {(processos as any[] ?? []).slice(0, 8).map((p: any) => (
                <div key={p.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm text-gray-900">{p.empresa?.razao_social}</p>
                    <p className="text-xs text-gray-500">{TIPO_LABELS[p.tipo] ?? p.tipo}</p>
                  </div>
                  <Link href={`/societario/${p.id}`} className="text-xs text-primary-600 hover:underline">
                    Checklist
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Gargalos */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold text-gray-900">Gargalos</h2>
            <span className="text-xs text-gray-400">Etapas paradas +7 dias</span>
          </div>
          {!(gargalos ?? []).length ? (
            <div className="p-6 text-center text-gray-500 text-sm">Nenhum gargalo identificado</div>
          ) : (
            <div className="divide-y">
              {(gargalos as any[] ?? []).slice(0, 8).map((g: any) => (
                <div key={g.id} className="px-4 py-3">
                  <p className="font-medium text-sm text-gray-900">{g.processo?.empresa?.razao_social}</p>
                  <p className="text-xs text-orange-600 font-medium mt-0.5">⚠ {g.nome}</p>
                  <p className="text-xs text-gray-400">
                    Parado desde {new Date(g.updated_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function KPICard({
  label, value, sub, color, href
}: {
  label: string; value: number; sub: string; color: string; href?: string
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  }

  const card = (
    <div className={`card p-5 ${href ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}`}>
      <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl mb-3 ${colorMap[color]}`}>
        <span className="text-lg font-bold">{value}</span>
      </div>
      <p className="font-semibold text-gray-900">{label}</p>
      <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
    </div>
  )

  return href ? <Link href={href}>{card}</Link> : card
}
