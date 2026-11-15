'use client'

import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Search, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
import { registrarAcao, diaLocal } from '@/lib/atividade'
import { apenasVigentes, chaveAlvara, dataBR, diasParaVencer, prazoTexto } from '@/lib/prazo'
import AgendaVencimentos from '@/components/ui/AgendaVencimentos'
import MenuAcoes from '@/components/ui/MenuAcoes'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

type Alvara = {
  id: string
  empresa_id: string
  tipo: string
  orgao_emissor: string
  numero: string | null
  data_emissao: string | null
  data_vencimento: string | null
  observacoes: string | null
  empresas?: { razao_social: string; municipio?: string; cnpj?: string; url_portal_alvara?: string }
}

const FORM_EMPTY = {
  empresa_id: '', tipo: 'fixo', orgao_emissor: '',
  numero: '', data_emissao: '', data_vencimento: '', observacoes: '',
}

const TIPO_LABEL: Record<string, string> = { fixo: 'fixo', temporario: 'temporário', provisorio: 'provisório' }

function AlvarasPage() {
  const { orgId } = useOrg()
  const searchParams = useSearchParams()
  const empresaFiltro = searchParams.get('empresa')
  const [supabase] = useState(createClient)

  const [dados,    setDados]    = useState<Alvara[]>([])
  const [empresas, setEmpresas] = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)

  // Modais
  const [modalNovo,     setModalNovo]     = useState(false)
  const [editItem,      setEditItem]      = useState<Alvara | null>(null)
  const [renovarItem,   setRenovarItem]   = useState<Alvara | null>(null)
  const [historicoItem, setHistoricoItem] = useState<Alvara | null>(null)
  const [excluirItem,   setExcluirItem]   = useState<Alvara | null>(null)

  // Forms
  const [form,      setForm]      = useState(FORM_EMPTY)
  const [renovForm, setRenovForm] = useState({ data_emissao: '', data_vencimento: '', numero: '', observacoes: '' })
  const [saving,    setSaving]    = useState(false)

  // Filtros
  const [busca,       setBusca]       = useState('')
  const [filtroOrgao, setFiltroOrgao] = useState('')

  const load = useCallback(async () => {
    if (!orgId) return
    const [res, empRes] = await Promise.all([
      supabase.from('alvaras')
        .select('*, empresas!inner(razao_social, municipio, cnpj, url_portal_alvara, org_id)')
        .eq('empresas.org_id', orgId) // só alvarás de empresas da organização selecionada
        .order('data_vencimento', { ascending: true }),
      supabase.from('empresas').select('id, razao_social').eq('org_id', orgId).order('razao_social'),
    ])
    if (res.error) toast.error('Erro ao carregar alvarás: ' + res.error.message)
    setDados((res.data || []) as Alvara[])
    setEmpresas(empRes.data || [])
    setLoading(false)
  }, [supabase, orgId])

  useEffect(() => { load() }, [load])

  // Vindo da ficha da empresa com ?renovar=ID: abre direto a renovação daquele documento
  const renovarId = searchParams.get('renovar')
  const renovarAberto = useRef(false)
  useEffect(() => {
    if (!renovarId || renovarAberto.current || dados.length === 0) return
    const item = dados.find(d => d.id === renovarId)
    if (item) { renovarAberto.current = true; openRenovar(item) }
  }, [renovarId, dados])

  // ── Criar novo ───────────────────────────────────────────────────────────────
  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('alvaras').insert([{
      empresa_id: form.empresa_id, tipo: form.tipo,
      orgao_emissor: form.orgao_emissor,
      numero: form.numero || null, data_emissao: form.data_emissao || null,
      data_vencimento: form.data_vencimento || null, observacoes: form.observacoes || null,
    }])
    setSaving(false)
    if (error) { toast.error('Erro: ' + error.message); return }
    registrarAcao('Cadastro', `Alvará ${form.tipo} (${form.orgao_emissor}) cadastrado`, { empresaId: form.empresa_id })
    toast.success('Alvará cadastrado!')
    setModalNovo(false); setForm(FORM_EMPTY); load()
  }

  // ── Editar ───────────────────────────────────────────────────────────────────
  function openEdit(item: Alvara) {
    setForm({
      empresa_id: item.empresa_id, tipo: item.tipo,
      orgao_emissor: item.orgao_emissor, numero: item.numero || '',
      data_emissao: item.data_emissao || '', data_vencimento: item.data_vencimento || '',
      observacoes: item.observacoes || '',
    })
    setEditItem(item)
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editItem) return
    setSaving(true)
    const { error } = await supabase.from('alvaras').update({
      tipo: form.tipo, orgao_emissor: form.orgao_emissor,
      numero: form.numero || null, data_emissao: form.data_emissao || null,
      data_vencimento: form.data_vencimento || null, observacoes: form.observacoes || null,
    }).eq('id', editItem.id)
    setSaving(false)
    if (error) { toast.error('Erro: ' + error.message); return }
    registrarAcao('Atualização', `Alvará ${form.tipo} (${form.orgao_emissor}) atualizado`, { empresaId: editItem.empresa_id })
    toast.success('Alvará atualizado!')
    setEditItem(null); setForm(FORM_EMPTY); load()
  }

  // ── Renovar: cria um registro novo e o anterior fica no histórico ────────────
  function openRenovar(item: Alvara) {
    setRenovForm({ data_emissao: diaLocal(), data_vencimento: '', numero: item.numero || '', observacoes: '' })
    setRenovarItem(item)
  }

  async function handleRenovar(e: React.FormEvent) {
    e.preventDefault()
    if (!renovarItem) return
    setSaving(true)
    const { error } = await supabase.from('alvaras').insert([{
      empresa_id: renovarItem.empresa_id, tipo: renovarItem.tipo,
      orgao_emissor: renovarItem.orgao_emissor,
      numero: renovForm.numero || null,
      data_emissao: renovForm.data_emissao || null,
      data_vencimento: renovForm.data_vencimento || null,
      observacoes: renovForm.observacoes || null,
    }])
    setSaving(false)
    if (error) { toast.error('Erro: ' + error.message); return }
    registrarAcao('Renovação', `Alvará ${renovarItem.tipo} (${renovarItem.orgao_emissor}) renovado`, { empresaId: renovarItem.empresa_id })
    toast.success('Renovação registrada!')
    setRenovarItem(null); load()
  }

  // ── Excluir ──────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!excluirItem) return
    const { error } = await supabase.from('alvaras').delete().eq('id', excluirItem.id)
    if (error) { toast.error('Erro ao excluir: ' + error.message); return }
    setDados(prev => prev.filter(i => i.id !== excluirItem.id))
    setExcluirItem(null)
    toast.success('Alvará excluído.')
  }

  function abrirPortal(item: Alvara) {
    const cnpj = (item.empresas?.cnpj || '').replace(/\D/g, '')
    if (cnpj) navigator.clipboard?.writeText(cnpj).then(() => toast.success('CNPJ copiado: é só colar no portal')).catch(() => {})
  }

  // ── Listas derivadas ─────────────────────────────────────────────────────────
  const orgaos = Array.from(new Set(dados.map(d => d.orgao_emissor).filter(Boolean))).sort()
  const empresaNome = empresaFiltro ? (empresas.find(e => e.id === empresaFiltro)?.razao_social || '') : ''

  // Só o alvará vigente de cada empresa/órgão; os anteriores ficam no histórico
  const vigentes = apenasVigentes(dados, chaveAlvara)
  const filtrados = vigentes.filter(item => {
    if (empresaFiltro && item.empresa_id !== empresaFiltro) return false
    if (filtroOrgao && item.orgao_emissor !== filtroOrgao) return false
    if (busca) {
      const q = busca.toLowerCase()
      const alvo = [item.empresas?.razao_social, item.empresas?.municipio, item.orgao_emissor, item.numero].join(' ').toLowerCase()
      if (!alvo.includes(q)) return false
    }
    return true
  })
  const historico = historicoItem
    ? dados.filter(d => chaveAlvara(d) === chaveAlvara(historicoItem)).sort((a, b) => (b.data_vencimento || '').localeCompare(a.data_vencimento || ''))
    : []

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
          <h1 className="text-2xl font-bold text-slate-900">Alvarás</h1>
          <p className="text-sm text-slate-600 mt-1">
            {filtrados.length} {filtrados.length === 1 ? 'alvará vigente' : 'alvarás vigentes'}{empresaNome ? ` de ${empresaNome}` : ''}, organizados pela data em que vencem
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 h-11 px-3 bg-white border border-slate-300 rounded-lg text-slate-500">
            <Search className="w-4 h-4" aria-hidden="true" />
            <input value={busca} onChange={e => setBusca(e.target.value)}
              aria-label="Buscar empresa, cidade ou órgão" placeholder="Buscar empresa, cidade ou órgão"
              className="w-56 bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-500" />
          </label>
          <select value={filtroOrgao} onChange={e => setFiltroOrgao(e.target.value)} aria-label="Órgão emissor"
            className="h-11 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 max-w-[14rem]">
            <option value="">Todos os órgãos</option>
            {orgaos.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <button data-atalho="novo" onClick={() => { setForm({ ...FORM_EMPTY, empresa_id: empresaFiltro || '' }); setModalNovo(true) }}
            className="h-11 px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 whitespace-nowrap">
            Novo alvará
          </button>
        </div>
      </header>

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, k) => <div key={k} className="h-16 bg-white rounded-xl border border-slate-200 animate-pulse" />)}</div>
      ) : (
        <AgendaVencimentos
          itens={filtrados}
          nome={{ um: 'alvará', varios: 'alvarás' }}
          mostrarEmDia={!!busca || !!empresaFiltro}
          vazio={vigentes.length === 0 ? 'Nenhum alvará cadastrado.' : 'Nenhum alvará encontrado com esses filtros.'}
          linha={(item, dias) => (
            <>
              <div className="flex-1 min-w-[16rem]">
                <Link href={`/empresas/${item.empresa_id}`} className="font-semibold text-slate-900 hover:underline underline-offset-2 break-words">
                  {item.empresas?.razao_social || '—'}
                </Link>
                <p className="text-sm text-slate-600">
                  Alvará {TIPO_LABEL[item.tipo] || item.tipo} · {item.orgao_emissor || 'órgão não informado'}
                  {item.numero ? ` · nº ${item.numero}` : ''} · {prazoTexto(dias)}
                </p>
                {item.observacoes && <p className="text-sm text-slate-500 break-words">{item.observacoes}</p>}
              </div>
              <div className="flex items-center gap-1 ml-auto">
                {item.empresas?.url_portal_alvara && (
                  <a href={item.empresas.url_portal_alvara} target="_blank" rel="noopener noreferrer" onClick={() => abrirPortal(item)}
                    className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg text-sm font-semibold text-blue-700 hover:bg-blue-50">
                    Abrir portal<span className="sr-only"> do alvará de {item.empresas?.razao_social}</span>
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  </a>
                )}
                <button onClick={() => openRenovar(item)} className={btnSec}>Renovar</button>
                <MenuAcoes acoes={[
                  { label: 'Histórico de renovações', onClick: () => setHistoricoItem(item) },
                  { label: 'Editar', onClick: () => openEdit(item) },
                  { label: 'Excluir', onClick: () => setExcluirItem(item), perigo: true },
                ]} />
              </div>
            </>
          )}
        />
      )}

      {/* Novo */}
      <Modal open={modalNovo} title="Novo alvará" onClose={() => { setModalNovo(false); setForm(FORM_EMPTY) }}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label" htmlFor="al-emp">Empresa *</label>
            <select id="al-emp" required value={form.empresa_id} onChange={e => setForm({ ...form, empresa_id: e.target.value })} className="input">
              <option value="">Selecione...</option>
              {empresas.map(e => <option key={e.id} value={e.id}>{e.razao_social}</option>)}
            </select>
          </div>
          <AlvaraFormFields form={form} setForm={setForm} />
          <Rodape onCancel={() => { setModalNovo(false); setForm(FORM_EMPTY) }} saving={saving} label="Cadastrar" />
        </form>
      </Modal>

      {/* Editar */}
      <Modal open={!!editItem} title={`Editar alvará · ${editItem?.empresas?.razao_social || ''}`} onClose={() => { setEditItem(null); setForm(FORM_EMPTY) }}>
        <form onSubmit={handleUpdate} className="space-y-4">
          <AlvaraFormFields form={form} setForm={setForm} />
          <Rodape onCancel={() => { setEditItem(null); setForm(FORM_EMPTY) }} saving={saving} label="Salvar alterações" />
        </form>
      </Modal>

      {/* Renovar */}
      <Modal open={!!renovarItem} title={`Renovar alvará · ${renovarItem?.empresas?.razao_social || ''}`} onClose={() => setRenovarItem(null)}>
        {renovarItem && (
          <form onSubmit={handleRenovar} className="space-y-4">
            <p className="text-sm text-slate-600">
              {renovarItem.orgao_emissor} · vencimento atual {dataBR(renovarItem.data_vencimento)}. O alvará anterior fica guardado no histórico.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="rn-em">Data de emissão</label>
                <input id="rn-em" type="date" value={renovForm.data_emissao} onChange={e => setRenovForm(f => ({ ...f, data_emissao: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="rn-ve">Novo vencimento *</label>
                <input id="rn-ve" type="date" required value={renovForm.data_vencimento} onChange={e => setRenovForm(f => ({ ...f, data_vencimento: e.target.value }))} className="input" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="rn-nu">Número do alvará</label>
              <input id="rn-nu" value={renovForm.numero} placeholder="Novo número, se houver" onChange={e => setRenovForm(f => ({ ...f, numero: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="rn-ob">Observações</label>
              <input id="rn-ob" value={renovForm.observacoes} placeholder="Ex.: renovado pelo portal, protocolo 123" onChange={e => setRenovForm(f => ({ ...f, observacoes: e.target.value }))} className="input" />
            </div>
            <Rodape onCancel={() => setRenovarItem(null)} saving={saving} label="Confirmar renovação" />
          </form>
        )}
      </Modal>

      {/* Histórico */}
      <Modal open={!!historicoItem} title={`Histórico · ${historicoItem?.empresas?.razao_social || ''}`} onClose={() => setHistoricoItem(null)}>
        {historicoItem && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">{historicoItem.orgao_emissor}</p>
            <ol className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {historico.map((h, i) => (
                <li key={h.id} className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold text-slate-900">Vencimento {dataBR(h.data_vencimento)}</span>
                    <span className="text-slate-600">{i === 0 ? 'Vigente' : 'Anterior'}</span>
                  </div>
                  <p className="text-slate-600">
                    {[h.data_emissao ? `emitido em ${dataBR(h.data_emissao)}` : '', h.numero ? `nº ${h.numero}` : ''].filter(Boolean).join(' · ') || 'sem dados de emissão'}
                  </p>
                  {h.observacoes && <p className="text-slate-500">{h.observacoes}</p>}
                  {i > 0 && (
                    <button onClick={() => { setHistoricoItem(null); setExcluirItem(h) }} className="mt-1 text-sm font-semibold text-red-700 hover:underline">Excluir este registro</button>
                  )}
                </li>
              ))}
            </ol>
            <button onClick={() => { const item = historicoItem; setHistoricoItem(null); openRenovar(item) }}
              className="h-10 px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800">Registrar nova renovação</button>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!excluirItem} title="Excluir alvará" danger
        message={`Excluir o alvará de "${excluirItem?.empresas?.razao_social || ''}" com vencimento em ${dataBR(excluirItem?.data_vencimento)}? Esta ação não pode ser desfeita.`}
        onConfirm={handleDelete} onCancel={() => setExcluirItem(null)} />
    </div>
  )
}

// ── Componentes auxiliares ─────────────────────────────────────────────────────

function AlvaraFormFields({ form, setForm }: { form: typeof FORM_EMPTY; setForm: React.Dispatch<React.SetStateAction<typeof FORM_EMPTY>> }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="af-tipo">Tipo *</label>
          <select id="af-tipo" required value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} className="input">
            <option value="fixo">Fixo</option>
            <option value="temporario">Temporário</option>
            <option value="provisorio">Provisório</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="af-orgao">Órgão emissor *</label>
          <input id="af-orgao" required value={form.orgao_emissor} placeholder="Ex.: Prefeitura Municipal"
            onChange={e => setForm(f => ({ ...f, orgao_emissor: e.target.value }))} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="af-num">Número do alvará</label>
          <input id="af-num" value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="af-em">Data de emissão</label>
          <input id="af-em" type="date" value={form.data_emissao} onChange={e => setForm(f => ({ ...f, data_emissao: e.target.value }))} className="input" />
        </div>
        <div className="col-span-2">
          <label className="label" htmlFor="af-ve">Data de vencimento</label>
          <input id="af-ve" type="date" value={form.data_vencimento} onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value }))} className="input" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="af-obs">Observações</label>
        <input id="af-obs" value={form.observacoes} placeholder="Anotações internas sobre este alvará"
          onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} className="input" />
      </div>
    </>
  )
}

function Rodape({ onCancel, saving, label }: { onCancel: () => void; saving: boolean; label: string }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button type="button" onClick={onCancel} className="btn-secondary">Cancelar</button>
      <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Salvando...' : label}</button>
    </div>
  )
}

export default function AlvarasPageWrapper() {
  return <Suspense><AlvarasPage /></Suspense>
}
