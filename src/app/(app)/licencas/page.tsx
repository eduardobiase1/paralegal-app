'use client'

import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Search, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
import { registrarAcao, diaLocal } from '@/lib/atividade'
import { dataBR, prazoTexto } from '@/lib/prazo'
import AgendaVencimentos from '@/components/ui/AgendaVencimentos'
import MenuAcoes from '@/components/ui/MenuAcoes'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

const FORM_EMPTY = {
  empresa_id: '',
  orgao: 'VISA_MUNICIPAL',
  numero_licenca: '',
  atividade_sanitaria: '',
  data_emissao: '',
  data_vencimento: '',
  observacoes: '',
}

const ORGAO_LABEL: Record<string, string> = { VISA_MUNICIPAL: 'VISA municipal', ANVISA: 'ANVISA' }

function LicencasPage() {
  const { orgId } = useOrg()
  const searchParams = useSearchParams()
  const empresaFiltro = searchParams.get('empresa')
  const [supabase] = useState(createClient)
  const [dados, setDados] = useState<any[]>([])
  const [empresas, setEmpresas] = useState<any[]>([])
  const [modal, setModal] = useState<'novo' | 'editar' | 'renovar' | null>(null)
  const [editItem, setEditItem] = useState<any | null>(null)
  const [excluirItem, setExcluirItem] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(FORM_EMPTY)

  const load = useCallback(async () => {
    if (!orgId) return
    const [res, empRes] = await Promise.all([
      // só licenças de empresas da organização selecionada
      supabase.from('licencas_sanitarias').select('*, empresas!inner(razao_social, cnpj, url_portal_visa, org_id)').eq('empresas.org_id', orgId).order('data_vencimento', { ascending: true }),
      supabase.from('empresas').select('id, razao_social').eq('org_id', orgId).order('razao_social'),
    ])
    if (res.error) toast.error('Erro ao carregar licenças: ' + res.error.message)
    setDados(res.data || [])
    setEmpresas(empRes.data || [])
    setLoading(false)
  }, [supabase, orgId])

  useEffect(() => { load() }, [load])

  // Vindo do Briefing ou da ficha da empresa com ?renovar=ID: abre direto a renovação
  const renovarId = searchParams.get('renovar')
  const renovarAberto = useRef<string | null>(null)
  useEffect(() => {
    if (!renovarId || renovarAberto.current === renovarId || loading) return
    renovarAberto.current = renovarId
    const item = dados.find((d: any) => d.id === renovarId)
    if (item) abrir(item, 'renovar')
    else toast.error('Não encontrei essa licença para renovar. Ela pode ter sido excluída ou ser de outra organização.')
  }, [renovarId, dados, loading])

  function fechar() { setModal(null); setEditItem(null); setForm(FORM_EMPTY) }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      empresa_id: form.empresa_id,
      orgao: form.orgao,
      numero_licenca: form.numero_licenca || null,
      atividade_sanitaria: form.atividade_sanitaria || null,
      data_emissao: form.data_emissao || null,
      data_vencimento: form.data_vencimento || null,
      observacoes: form.observacoes || null,
    }
    const { error } = editItem
      ? await supabase.from('licencas_sanitarias').update(payload).eq('id', editItem.id)
      : await supabase.from('licencas_sanitarias').insert([payload])
    setSaving(false)
    if (error) { toast.error(`Erro: ${error.message}`); return }
    const acao = modal === 'renovar' ? 'Renovação' : editItem ? 'Atualização' : 'Cadastro'
    toast.success(modal === 'renovar' ? 'Renovação registrada!' : editItem ? 'Licença atualizada!' : 'Licença cadastrada!')
    registrarAcao(acao, `Licença sanitária (${ORGAO_LABEL[form.orgao] || form.orgao}) ${modal === 'renovar' ? 'renovada' : editItem ? 'atualizada' : 'cadastrada'}`, { empresaId: form.empresa_id })
    fechar()
    load()
  }

  function abrir(item: any, modo: 'editar' | 'renovar') {
    setForm({
      empresa_id: item.empresa_id,
      orgao: item.orgao || 'VISA_MUNICIPAL',
      numero_licenca: item.numero_licenca || '',
      atividade_sanitaria: item.atividade_sanitaria || '',
      // ao renovar: emissão hoje e vencimento em branco, para informar a nova validade
      data_emissao: modo === 'renovar' ? diaLocal() : item.data_emissao || '',
      data_vencimento: modo === 'renovar' ? '' : item.data_vencimento || '',
      observacoes: item.observacoes || '',
    })
    setEditItem(item)
    setModal(modo)
  }

  function openNovo() {
    setForm({ ...FORM_EMPTY, empresa_id: empresaFiltro || '' })
    setEditItem(null)
    setModal('novo')
  }

  // Vindo da busca rápida (Ctrl+K) com ?novo=1: abre direto o cadastro
  const novoAberto = useRef(false)
  useEffect(() => {
    if (searchParams.get('novo') && !novoAberto.current && !loading) { novoAberto.current = true; openNovo() }
  }, [searchParams, loading])

  async function handleDelete() {
    if (!excluirItem) return
    const { error } = await supabase.from('licencas_sanitarias').delete().eq('id', excluirItem.id)
    if (error) { toast.error('Erro ao excluir: ' + error.message); return }
    setDados(prev => prev.filter(i => i.id !== excluirItem.id))
    setExcluirItem(null)
    toast.success('Licença excluída.')
  }

  function abrirPortal(item: any) {
    const cnpj = (item.empresas?.cnpj || '').replace(/\D/g, '')
    if (cnpj) navigator.clipboard?.writeText(cnpj).then(() => toast.success('CNPJ copiado: é só colar no portal')).catch(() => {})
  }

  const empresaNome = empresaFiltro ? (empresas.find(e => e.id === empresaFiltro)?.razao_social || '') : ''
  const filtrados = dados.filter(i => {
    if (empresaFiltro && i.empresa_id !== empresaFiltro) return false
    if (!search) return true
    const q = search.toLowerCase()
    return [i.empresas?.razao_social, ORGAO_LABEL[i.orgao] || i.orgao, i.atividade_sanitaria, i.numero_licenca].join(' ').toLowerCase().includes(q)
  })

  const btnSec = 'h-10 px-4 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-900 hover:bg-slate-50'

  return (
    <div className="p-4 md:p-6 xl:p-8 space-y-5">
      {empresaFiltro && (
        <div className="flex items-center gap-3 text-sm">
          <Link href={`/empresas/${empresaFiltro}`} className="font-semibold text-blue-700 hover:underline">← Voltar para a empresa</Link>
          <span className="text-slate-600">{empresaNome}</span>
        </div>
      )}

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Licenças sanitárias</h1>
          <p className="text-sm text-slate-600 mt-1">
            {filtrados.length} {filtrados.length === 1 ? 'licença' : 'licenças'}{empresaNome ? ` de ${empresaNome}` : ''}, organizadas pela data em que vencem
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 h-11 px-3 bg-white border border-slate-300 rounded-lg text-slate-500">
            <Search className="w-4 h-4" aria-hidden="true" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              aria-label="Buscar empresa, órgão ou atividade" placeholder="Buscar empresa, órgão ou atividade"
              className="w-56 bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-500" />
          </label>
          <button data-atalho="novo" onClick={openNovo} className="h-11 px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 whitespace-nowrap">
            Nova licença
          </button>
        </div>
      </header>

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, k) => <div key={k} className="h-16 bg-white rounded-xl border border-slate-200 animate-pulse" />)}</div>
      ) : (
        <AgendaVencimentos
          itens={filtrados}
          nome={{ um: 'licença', varios: 'licenças', feminino: true }}
          mostrarEmDia={!!search || !!empresaFiltro}
          vazio={dados.length === 0 ? 'Nenhuma licença sanitária cadastrada.' : 'Nenhuma licença encontrada com esses filtros.'}
          linha={(item, dias) => (
            <>
              <div className="flex-1 min-w-[16rem]">
                <Link href={`/empresas/${item.empresa_id}`} className="font-semibold text-slate-900 hover:underline underline-offset-2 break-words">
                  {item.empresas?.razao_social || '—'}
                </Link>
                <p className="text-sm text-slate-600">
                  {ORGAO_LABEL[item.orgao] || item.orgao}
                  {item.numero_licenca ? ` · nº ${item.numero_licenca}` : ''}
                  {item.atividade_sanitaria ? ` · ${item.atividade_sanitaria}` : ''} · {prazoTexto(dias)}
                </p>
                {item.observacoes && <p className="text-sm text-slate-500 break-words">{item.observacoes}</p>}
              </div>
              <div className="flex items-center gap-1 ml-auto">
                {item.empresas?.url_portal_visa && (
                  <a href={item.empresas.url_portal_visa} target="_blank" rel="noopener noreferrer" onClick={() => abrirPortal(item)}
                    className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg text-sm font-semibold text-blue-700 hover:bg-blue-50">
                    Abrir portal<span className="sr-only"> da licença de {item.empresas?.razao_social}</span>
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  </a>
                )}
                <button onClick={() => abrir(item, 'renovar')} className={btnSec}>Renovar</button>
                <MenuAcoes acoes={[
                  { label: 'Editar', onClick: () => abrir(item, 'editar') },
                  { label: 'Excluir', onClick: () => setExcluirItem(item), perigo: true },
                ]} />
              </div>
            </>
          )}
        />
      )}

      <Modal open={!!modal} onClose={fechar}
        title={modal === 'renovar' ? `Renovar licença · ${editItem?.empresas?.razao_social || ''}` : modal === 'editar' ? 'Editar licença sanitária' : 'Nova licença sanitária'}>
        <form onSubmit={handleSave} className="space-y-4">
          {modal === 'renovar' && editItem && (
            <p className="text-sm text-slate-600">Vencimento atual: {dataBR(editItem.data_vencimento)}. Informe a nova validade.</p>
          )}
          {modal !== 'renovar' && (
            <div>
              <label className="label" htmlFor="li-emp">Empresa *</label>
              <select id="li-emp" required value={form.empresa_id} onChange={e => setForm({ ...form, empresa_id: e.target.value })} className="input">
                <option value="">Selecione...</option>
                {empresas.map(e => <option key={e.id} value={e.id}>{e.razao_social}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="li-org">Órgão *</label>
              <select id="li-org" required value={form.orgao} onChange={e => setForm({ ...form, orgao: e.target.value })} className="input">
                <option value="VISA_MUNICIPAL">VISA municipal</option>
                <option value="ANVISA">ANVISA</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="li-num">Nº da licença</label>
              <input id="li-num" value={form.numero_licenca} onChange={e => setForm({ ...form, numero_licenca: e.target.value })} className="input" />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="li-atv">Atividade sanitária</label>
              <input id="li-atv" value={form.atividade_sanitaria} onChange={e => setForm({ ...form, atividade_sanitaria: e.target.value })}
                placeholder="Ex.: manipulação de alimentos" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="li-em">Data de emissão</label>
              <input id="li-em" type="date" value={form.data_emissao} onChange={e => setForm({ ...form, data_emissao: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="li-ve">{modal === 'renovar' ? 'Novo vencimento *' : 'Data de vencimento'}</label>
              <input id="li-ve" type="date" required={modal === 'renovar'} value={form.data_vencimento} onChange={e => setForm({ ...form, data_vencimento: e.target.value })} className="input" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="li-obs">Observações</label>
            <input id="li-obs" value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} className="input" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={fechar} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Salvando...' : modal === 'renovar' ? 'Confirmar renovação' : modal === 'editar' ? 'Salvar alterações' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!excluirItem} title="Excluir licença" danger
        message={`Excluir a licença sanitária de "${excluirItem?.empresas?.razao_social || ''}"? Esta ação não pode ser desfeita.`}
        onConfirm={handleDelete} onCancel={() => setExcluirItem(null)} />
    </div>
  )
}

export default function LicencasPageWrapper() {
  return <Suspense><LicencasPage /></Suspense>
}
