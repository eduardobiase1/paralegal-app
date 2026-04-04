'use client'

import { Suspense, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ContractTemplate, Contrato, Empresa } from '@/types'
import { formatDate } from '@/lib/utils'
import Modal from '@/components/ui/Modal'
import ContratoGerador from '@/components/modules/ContratoGerador'
import TemplateUpload from '@/components/modules/TemplateUpload'
import toast from 'react-hot-toast'
import { useSearchParams } from 'next/navigation'

function ContratosPageInner() {
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<'gerar' | 'historico' | 'templates'>('gerar')
  const [templates, setTemplates] = useState<ContractTemplate[]>([])
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)
  const [gerarModal, setGerarModal] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null)
  const [supabase] = useState(createClient)

  async function load() {
    setLoading(true)
    const [{ data: tmpl }, { data: contr }, { data: emps }] = await Promise.all([
      supabase.from('contract_templates').select('*').eq('ativo', true).order('nome'),
      supabase.from('contratos').select('*, empresa:empresas(razao_social)').order('created_at', { ascending: false }).limit(50),
      supabase.from('empresas').select('id, razao_social, cnpj').order('razao_social'),
    ])
    setTemplates(tmpl ?? [])
    setContratos((contr ?? []).map((c: any) => ({ ...c, razao_social: c.empresa?.razao_social })))
    setEmpresas((emps ?? []) as Empresa[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Contratos</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-6">
        {[
          { key: 'gerar', label: 'Gerar Contrato' },
          { key: 'historico', label: 'Histórico' },
          { key: 'templates', label: 'Templates' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'gerar' && (
        <div>
          <p className="text-sm text-gray-600 mb-4">Selecione um template para gerar um novo contrato:</p>
          {loading ? (
            <div className="text-gray-400">Carregando...</div>
          ) : !templates.length ? (
            <div className="card p-12 text-center text-gray-500">
              <p className="font-medium">Nenhum template cadastrado</p>
              <p className="text-sm mt-1">Acesse a aba "Templates" para fazer upload de modelos Word</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setSelectedTemplate(t); setGerarModal(true) }}
                  className="card p-5 text-left hover:border-primary-300 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 group-hover:text-primary-600">{t.nome}</p>
                      {t.descricao && <p className="text-sm text-gray-500 mt-0.5">{t.descricao}</p>}
                      <p className="text-xs text-gray-400 mt-1">{t.arquivo_nome}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'historico' && (
        <div className="card">
          {loading ? (
            <div className="p-12 text-center text-gray-400">Carregando...</div>
          ) : !contratos.length ? (
            <div className="p-12 text-center text-gray-500">Nenhum contrato gerado ainda</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Empresa</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Template</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Gerado em</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {contratos.map((c: any) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{c.razao_social}</td>
                      <td className="px-4 py-3 text-gray-600">{c.template_nome}</td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(c.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        {c.arquivo_url && (
                          <a href={c.arquivo_url} download className="btn-secondary text-xs py-1 px-2">
                            Baixar
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'templates' && (
        <div className="space-y-4">
          <div className="card">
            <div className="card-header">
              <h2 className="font-semibold text-gray-900">Upload de Template</h2>
            </div>
            <div className="card-body">
              <TemplateUpload onSuccess={load} />
            </div>
          </div>

          {templates.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h2 className="font-semibold text-gray-900">Templates cadastrados</h2>
              </div>
              <div className="divide-y">
                {templates.map(t => (
                  <div key={t.id} className="px-6 py-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{t.nome}</p>
                      <p className="text-sm text-gray-500">{t.arquivo_nome}</p>
                    </div>
                    <button
                      onClick={async () => {
                        await supabase.from('contract_templates').update({ ativo: false }).eq('id', t.id)
                        toast.success('Template removido')
                        load()
                      }}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {selectedTemplate && (
        <Modal
          open={gerarModal}
          onClose={() => { setGerarModal(false); setSelectedTemplate(null) }}
          title={`Gerar: ${selectedTemplate.nome}`}
          size="xl"
        >
          <ContratoGerador
            template={selectedTemplate}
            empresas={empresas}
            defaultEmpresaId={searchParams.get('empresa') || ''}
            onSuccess={() => { setGerarModal(false); setSelectedTemplate(null); setTab('historico'); load() }}
          />
        </Modal>
      )}
    </div>
  )
}

export default function ContratosPage() {
  return <Suspense><ContratosPageInner /></Suspense>
}
