import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCNPJ } from '@/lib/utils'
import { Empresa } from '@/types'

export const dynamic = 'force-dynamic'

const statusLabel: Record<string, { label: string; class: string }> = {
  ativa: { label: 'Ativa', class: 'badge-ok' },
  inativa: { label: 'Inativa', class: 'badge-vencido' },
  em_abertura: { label: 'Em Abertura', class: 'badge-atencao' },
}

export default async function EmpresasPage() {
  const supabase = await createClient()
  const { data: empresas } = await supabase
    .from('empresas')
    .select('*')
    .order('razao_social')

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Empresas</h1>
          <p className="text-sm text-gray-500 mt-0.5">{empresas?.length ?? 0} empresa(s) cadastrada(s)</p>
        </div>
        <Link href="/empresas/nova" className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nova Empresa
        </Link>
      </div>

      <div className="card">
        {!empresas?.length ? (
          <div className="p-12 text-center text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <p className="font-medium">Nenhuma empresa cadastrada</p>
            <p className="text-sm mt-1">Clique em "Nova Empresa" para começar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Cód.</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Razão Social</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">CNPJ</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Cidade/UF</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {empresas.map((emp: Empresa) => {
                  const st = statusLabel[emp.status] ?? statusLabel.ativa
                  return (
                    <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-gray-500">#{emp.codigo}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{emp.razao_social}</div>
                        {emp.nome_fantasia && (
                          <div className="text-xs text-gray-500">{emp.nome_fantasia}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-600">{emp.cnpj ? formatCNPJ(emp.cnpj) : <span className="text-xs text-yellow-600 font-sans">Em Abertura</span>}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {emp.cidade && emp.uf ? `${emp.cidade}/${emp.uf}` : emp.cidade || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={st.class}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <Link
                            href={`/empresas/${emp.id}`}
                            className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            title="Ver detalhes"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </Link>
                          <Link
                            href={`/empresas/${emp.id}?edit=1`}
                            className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </Link>
                          {emp.logradouro && (
                            <a
                              href={`https://www.google.com/maps?q=${encodeURIComponent(
                                [emp.logradouro, emp.numero, emp.bairro, emp.cidade, emp.uf].filter(Boolean).join(', ')
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Ver no Maps"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
