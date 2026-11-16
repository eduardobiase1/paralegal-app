'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
import { diaLocal } from '@/lib/atividade'
import { apenasVigentes, chaveAlvara, dataBR, diasParaVencer, prazoTexto } from '@/lib/prazo'
import { ETAPAS, etapaAtual, alertaEtapa } from '@/lib/certificadoFluxo'

// ── Tipos ─────────────────────────────────────────────────────────────────────
type Tier = 'critico' | 'urgente' | 'atencao'
type Aba = Tier | 'nao_comunicados' | 'revisao' | 'cadastro'

interface Item {
  key: string
  tier: Tier
  tipo: string            // "Certidão negativa", "Alvará"...
  empresaId: string
  empresaNome: string
  doc: string             // descrição do documento
  venc: string | null     // data de vencimento, quando houver
  prazo: string           // "venceu há 3 dias", "boleto vence amanhã"...
  vencido: boolean
  acao: { label: string; href: string }
  comunicar?: string      // link para comunicar o cliente (só certidões)
}

interface RevisaoDoc {
  key: string; tabela: 'certidoes' | 'alvaras' | 'licencas_sanitarias'; id: string
  empresaId: string; empresaNome: string; doc: string; venc: string | null
}

const ORDEM: Record<Tier, number> = { critico: 0, urgente: 1, atencao: 2 }

// Faixas do briefing: vencido ou até 5 dias = crítico · até 15 = urgente · até 30 = atenção
function tierPorDias(dias: number): Tier | null {
  if (dias <= 5) return 'critico'
  if (dias <= 15) return 'urgente'
  if (dias <= 30) return 'atencao'
  return null
}

const SNOOZE_KEY = 'briefing_snoozed'

export default function BriefingPage() {
  const { orgId } = useOrg()
  const [supabase] = useState(createClient)

  const [itens, setItens] = useState<Item[]>([])
  const [naoComunicados, setNaoComunicados] = useState<any[]>([])
  const [revisao, setRevisao] = useState<RevisaoDoc[]>([])
  const [semCertidao, setSemCertidao] = useState<Array<{ id: string; nome: string }>>([])
  const [semAlvara, setSemAlvara] = useState<Array<{ id: string; nome: string }>>([])
  const [processosParados, setProcessosParados] = useState(0)
  const [loading, setLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const [aba, setAba] = useState<Aba>('critico')
  const [busca, setBusca] = useState('')
  const [foco, setFoco] = useState<number | null>(null)

  // Empresas adiadas — valem só para o dia de hoje
  const [adiadas, setAdiadas] = useState<Set<string>>(new Set())
  useEffect(() => {
    try {
      const salvo = JSON.parse(localStorage.getItem(SNOOZE_KEY) || 'null')
      if (salvo?.date === diaLocal()) setAdiadas(new Set<string>(salvo.items))
    } catch {}
  }, [])
  function adiar(empresaKey: string, desfazer = false) {
    setAdiadas(prev => {
      const n = new Set(prev)
      if (desfazer) n.delete(empresaKey); else n.add(empresaKey)
      try { localStorage.setItem(SNOOZE_KEY, JSON.stringify({ date: diaLocal(), items: [...n] })) } catch {}
      return n
    })
  }

  async function load() {
    if (!orgId) return
    setLoading(true)
    try {
      const { data: orgEmpresas } = await supabase
        .from('empresas').select('*').eq('org_id', orgId)
      const empresasOrg = orgEmpresas || []
      const ids = empresasOrg.map(e => e.id)
      const nomeDe: Record<string, string> = {}
      for (const e of empresasOrg) nomeDe[e.id] = e.razao_social
      const vazio = Promise.resolve({ data: [] as any[] })

      const [procRes, certRes, alvRes, licRes, cdRes, notasRes] = await Promise.all([
        supabase.from('processos_societarios').select('id, updated_at, created_at').eq('org_id', orgId).eq('status', 'Andamento'),
        ids.length ? supabase.from('certidoes').select('*').in('empresa_id', ids) : vazio,
        ids.length ? supabase.from('alvaras').select('*').in('empresa_id', ids) : vazio,
        ids.length ? supabase.from('licencas_sanitarias').select('*').in('empresa_id', ids) : vazio,
        supabase.from('certificados_digitais').select('*, empresas(razao_social, org_id)'),
        supabase.from('processo_notas').select('processo_id, created_at').eq('org_id', orgId).order('created_at', { ascending: false }),
      ])

      const certidoes = (certRes.data || []) as any[]
      // Alvarás: cada renovação cria um registro novo, então só o vigente conta
      const alvaras = apenasVigentes((alvRes.data || []) as any[], chaveAlvara)
      const licencas = (licRes.data || []) as any[]
      const certificados = ((cdRes.data || []) as any[])
        .filter(c => c.empresa_id ? c.empresas?.org_id === orgId : c.org_id === orgId)

      const lista: Item[] = []
      const hoje = diaLocal()
      const agora = Date.now()

      // ── Certidões ───────────────────────────────────────────────────────────
      for (const c of certidoes) {
        const nome = nomeDe[c.empresa_id] || '—'
        const base = `/certidoes?empresa=${c.empresa_id}`

        // Follow-up: cliente comunicado e sem retorno
        if (c.followup_em && c.followup_em <= hoje) {
          const dias = c.comunicado_em ? Math.round((agora - new Date(c.comunicado_em).getTime()) / 86_400_000) : 30
          lista.push({
            key: `fu-${c.id}`, tier: 'critico', tipo: 'Retorno do cliente', empresaId: c.empresa_id, empresaNome: nome,
            doc: `Certidão ${c.tipo}${c.orgao_emissor ? ` · ${c.orgao_emissor}` : ''} · ${c.comunicado_count || 1}ª comunicação`,
            venc: c.data_vencimento, prazo: `sem retorno há ${dias} dias`, vencido: true,
            acao: { label: 'Registrar contato', href: `${base}&comunicar=${c.id}` },
          })
          continue
        }

        const dias = diasParaVencer(c.data_vencimento)
        if (dias === null) continue
        const tier = tierPorDias(dias)
        if (!tier) continue
        // Mexida há menos de 7 dias e ainda sem urgência: alguém já está cuidando
        if (c.updated_at && dias > 5 && (agora - new Date(c.updated_at).getTime()) / 86_400_000 < 7) continue
        const pendente = c.pendencia_status === 'impossivel_renovar'
        lista.push({
          key: `cert-${c.id}`, tier, tipo: 'Certidão negativa', empresaId: c.empresa_id, empresaNome: nome,
          doc: `${c.tipo}${c.orgao_emissor ? ` · ${c.orgao_emissor}` : ''}${pendente ? ' · pendente, não foi possível renovar' : ''}`,
          venc: c.data_vencimento, prazo: prazoTexto(dias), vencido: dias < 0,
          acao: { label: 'Renovar', href: `${base}&renovar=${c.id}` },
          comunicar: `${base}&comunicar=${c.id}`,
        })
      }

      // ── Alvarás e licenças ──────────────────────────────────────────────────
      for (const a of alvaras) {
        const dias = diasParaVencer(a.data_vencimento)
        const tier = dias === null ? null : tierPorDias(dias)
        if (dias === null || !tier) continue
        lista.push({
          key: `alv-${a.id}`, tier, tipo: 'Alvará', empresaId: a.empresa_id, empresaNome: nomeDe[a.empresa_id] || '—',
          doc: `Alvará ${a.tipo || ''}${a.orgao_emissor ? ` · ${a.orgao_emissor}` : ''}`.replace(/\s+/g, ' ').trim(),
          venc: a.data_vencimento, prazo: prazoTexto(dias), vencido: dias < 0,
          acao: { label: 'Renovar', href: `/alvaras?empresa=${a.empresa_id}&renovar=${a.id}` },
        })
      }
      for (const l of licencas) {
        const dias = diasParaVencer(l.data_vencimento)
        const tier = dias === null ? null : tierPorDias(dias)
        if (dias === null || !tier) continue
        lista.push({
          key: `lic-${l.id}`, tier, tipo: 'Licença sanitária', empresaId: l.empresa_id, empresaNome: nomeDe[l.empresa_id] || '—',
          doc: l.orgao === 'ANVISA' ? 'ANVISA' : 'VISA municipal',
          venc: l.data_vencimento, prazo: prazoTexto(dias), vencido: dias < 0,
          acao: { label: 'Renovar', href: `/licencas?empresa=${l.empresa_id}&renovar=${l.id}` },
        })
      }

      // ── Certificados digitais ───────────────────────────────────────────────
      const emRenovacao = new Set(certificados.filter(c => c.renovacao_de).map(c => c.renovacao_de))
      for (const cd of certificados) {
        const nome = cd.empresas?.razao_social || cd.empresa_nome_livre || '—'
        const empresaId = cd.empresa_id || `avulsa-${cd.id}`

        // Em processo: entra no briefing quando alguma etapa está atrasada
        if (!cd.certificado_finalizado && !cd.data_vencimento) {
          const etapa = etapaAtual(cd)
          const alerta = alertaEtapa(cd, etapa)
          if (alerta) {
            lista.push({
              key: `cdp-${cd.id}`, tier: /vencido|hoje|amanhã/.test(alerta) ? 'critico' : 'urgente',
              tipo: 'Certificado em processo', empresaId, empresaNome: nome,
              doc: `${cd.uso} ${cd.tipo} · ${ETAPAS[etapa].parado}`,
              venc: etapa === 3 ? cd.boleto_vencimento : null, prazo: alerta.charAt(0).toLowerCase() + alerta.slice(1), vencido: /vencido/.test(alerta),
              acao: { label: 'Abrir', href: `/certificados?abrir=${cd.id}` },
            })
          }
          continue
        }

        const dias = diasParaVencer(cd.data_vencimento)
        const tier = dias === null ? null : tierPorDias(dias)
        if (dias === null || !tier || emRenovacao.has(cd.id)) continue
        lista.push({
          key: `cd-${cd.id}`, tier, tipo: 'Certificado digital', empresaId, empresaNome: nome,
          doc: `${cd.uso} ${cd.tipo}${cd.titular ? ` · ${cd.titular}` : ''}`,
          venc: cd.data_vencimento, prazo: prazoTexto(dias), vencido: dias < 0,
          acao: { label: 'Ver certificado', href: `/certificados?abrir=${cd.id}` },
        })
      }
      setItens(lista)

      // ── Processos parados (têm briefing próprio; aqui só o contador) ────────
      const ultimaNota: Record<string, number> = {}
      for (const n of notasRes.data || []) if (!ultimaNota[n.processo_id]) ultimaNota[n.processo_id] = new Date(n.created_at).getTime()
      setProcessosParados((procRes.data || []).filter((p: any) => {
        const ultima = Math.max(new Date(p.updated_at || p.created_at).getTime(), ultimaNota[p.id] || 0)
        return Math.round((agora - ultima) / 86_400_000) >= 7
      }).length)

      // ── Não comunicados: certidões que não puderam ser renovadas e o cliente não foi avisado ──
      setNaoComunicados(certidoes
        .filter(c => c.pendencia_status === 'impossivel_renovar' && !c.comunicado_em)
        .map(c => ({ ...c, empresaNome: nomeDe[c.empresa_id] || '—' })))

      // ── Revisão mensal: documentos de empresas prioritárias sem revisão há 30 dias ──
      const prioritarias = new Set(empresasOrg.filter(e => (e as any).prioritaria).map(e => e.id))
      const limite = new Date(agora - 30 * 86_400_000).toISOString()
      const precisaRevisar = (d: any) => prioritarias.has(d.empresa_id) && (!d.briefing_revisado_em || d.briefing_revisado_em < limite)
      const rev: RevisaoDoc[] = [
        ...certidoes.filter(precisaRevisar).map(c => ({ key: `r-cert-${c.id}`, tabela: 'certidoes' as const, id: c.id, empresaId: c.empresa_id, empresaNome: nomeDe[c.empresa_id] || '—', doc: `Certidão ${c.tipo || ''}`.trim(), venc: c.data_vencimento })),
        ...alvaras.filter(precisaRevisar).map(a => ({ key: `r-alv-${a.id}`, tabela: 'alvaras' as const, id: a.id, empresaId: a.empresa_id, empresaNome: nomeDe[a.empresa_id] || '—', doc: `Alvará ${a.tipo || ''}`.trim(), venc: a.data_vencimento })),
        ...licencas.filter(precisaRevisar).map(l => ({ key: `r-lic-${l.id}`, tabela: 'licencas_sanitarias' as const, id: l.id, empresaId: l.empresa_id, empresaNome: nomeDe[l.empresa_id] || '—', doc: 'Licença sanitária', venc: l.data_vencimento })),
      ].sort((a, b) => a.empresaNome.localeCompare(b.empresaNome, 'pt-BR') || a.doc.localeCompare(b.doc))
      setRevisao(rev)

      // ── Cadastro pendente: empresas ativas sem certidão ou sem alvará ───────
      const ativas = empresasOrg.filter(e => {
        const sit = String(e.situacao || '').toUpperCase()
        return sit === 'ATIVA' || sit === '' || String(e.status || '').toLowerCase() === 'ativa'
      })
      const comCert = new Set(certidoes.map(c => c.empresa_id))
      const comAlv = new Set(alvaras.map(a => a.empresa_id))
      const porNome = (a: { nome: string }, b: { nome: string }) => a.nome.localeCompare(b.nome, 'pt-BR')
      setSemCertidao(ativas.filter(e => !comCert.has(e.id)).map(e => ({ id: e.id, nome: e.razao_social })).sort(porNome))
      setSemAlvara(ativas.filter(e => !comAlv.has(e.id)).map(e => ({ id: e.id, nome: e.razao_social })).sort(porNome))

      setUpdatedAt(new Date())
    } catch (e: any) {
      console.error('Briefing error:', e)
      toast.error('Não foi possível carregar o briefing.')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [orgId])

  async function marcarRevisado(docs: RevisaoDoc[]) {
    const agora = new Date().toISOString()
    for (const tabela of ['certidoes', 'alvaras', 'licencas_sanitarias'] as const) {
      const idsTabela = docs.filter(d => d.tabela === tabela).map(d => d.id)
      if (idsTabela.length === 0) continue
      const { error } = await supabase.from(tabela).update({ briefing_revisado_em: agora }).in('id', idsTabela)
      if (error) { toast.error('Erro ao marcar como revisado: ' + error.message); return }
    }
    const feitos = new Set(docs.map(d => d.key))
    setRevisao(prev => prev.filter(d => !feitos.has(d.key)))
    toast.success(docs.length === 1 ? 'Documento marcado como revisado.' : `${docs.length} documentos marcados como revisados.`)
  }

  // ── Agrupamento por empresa ────────────────────────────────────────────────
  const grupos = useMemo(() => {
    const mapa = new Map<string, { key: string; empresaId: string; nome: string; pior: Tier; itens: Item[] }>()
    for (const i of itens) {
      const key = i.empresaId || i.empresaNome
      const g = mapa.get(key)
      if (!g) mapa.set(key, { key, empresaId: i.empresaId, nome: i.empresaNome, pior: i.tier, itens: [i] })
      else { g.itens.push(i); if (ORDEM[i.tier] < ORDEM[g.pior]) g.pior = i.tier }
    }
    const dias = (i: Item) => diasParaVencer(i.venc) ?? -9999
    const lista = Array.from(mapa.values())
    lista.forEach(g => g.itens.sort((a, b) => dias(a) - dias(b)))
    return lista.sort((a, b) => dias(a.itens[0]) - dias(b.itens[0]) || a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [itens])

  const q = busca.trim().toLowerCase()
  const visiveis = grupos.filter(g => !q || g.nome.toLowerCase().includes(q))
  const ativos = visiveis.filter(g => !adiadas.has(g.key))
  const gruposDaAba = (t: Tier) => ativos.filter(g => g.pior === t)
  const gruposAdiados = visiveis.filter(g => adiadas.has(g.key))

  // Resumo por prazo (só documentos com data)
  const comData = itens.filter(i => i.venc && i.tipo !== 'Certificado em processo' && i.tipo !== 'Retorno do cliente')
  const conta = (teste: (d: number) => boolean) => comData.filter(i => { const d = diasParaVencer(i.venc); return d !== null && teste(d) }).length
  const resumo = [
    { label: 'Vencidos',              n: conta(d => d < 0),            cor: 'bg-red-700' },
    { label: 'Vencem em até 5 dias',  n: conta(d => d >= 0 && d <= 5),  cor: 'bg-orange-600' },
    { label: 'Vencem em até 15 dias', n: conta(d => d > 5 && d <= 15),  cor: 'bg-amber-600' },
    { label: 'Vencem em até 30 dias', n: conta(d => d > 15 && d <= 30), cor: 'bg-slate-400' },
  ]

  const ABAS: Array<{ id: Aba; label: string; n: number }> = [
    { id: 'critico',         label: 'Críticos',          n: gruposDaAba('critico').length },
    { id: 'urgente',         label: 'Urgentes',          n: gruposDaAba('urgente').length },
    { id: 'atencao',         label: 'Atenção',           n: gruposDaAba('atencao').length },
    { id: 'nao_comunicados', label: 'Não comunicados',   n: naoComunicados.length },
    { id: 'revisao',         label: 'Revisão mensal',    n: revisao.length },
    { id: 'cadastro',        label: 'Cadastro pendente', n: semCertidao.length + semAlvara.length },
  ]

  // Modo foco: um item por vez, do mais urgente ao menos urgente
  const filaFoco = ativos.slice().sort((a, b) => ORDEM[a.pior] - ORDEM[b.pior]).flatMap(g => g.itens.map(i => ({ ...i, grupoKey: g.key })))
  useEffect(() => {
    if (foco === null) return
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFoco(null)
      if (e.key === 'ArrowRight') setFoco(i => (i === null ? null : i + 1))
      if (e.key === 'ArrowLeft') setFoco(i => (i === null ? null : Math.max(0, i - 1)))
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [foco])

  const hojeTxt = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const btnSec = 'inline-flex items-center h-10 px-4 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-900 hover:bg-slate-50 whitespace-nowrap'
  const linkAcao = 'inline-flex items-center h-10 px-3 rounded-lg text-sm font-semibold hover:bg-slate-100 whitespace-nowrap'

  function seloPrazo(i: Item) {
    return (
      <span className={`inline-block text-sm font-semibold px-2 py-0.5 rounded-md border ${
        i.vencido ? 'text-red-800 bg-red-50 border-red-200' : 'text-orange-800 bg-orange-50 border-orange-200'}`}>
        {i.prazo.charAt(0).toUpperCase() + i.prazo.slice(1)}
      </span>
    )
  }

  function blocoEmpresa(g: typeof grupos[number], adiado = false) {
    return (
      <div key={g.key}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 bg-slate-50 border-t border-slate-200 first:border-t-0">
          {g.empresaId && !g.empresaId.startsWith('avulsa-')
            ? <Link href={`/empresas/${g.empresaId}`} className="font-semibold text-slate-900 hover:underline">{g.nome}</Link>
            : <span className="font-semibold text-slate-900">{g.nome}</span>}
          <span className="text-sm text-slate-600">{g.itens.length} {g.itens.length === 1 ? 'pendência' : 'pendências'}</span>
          <button onClick={() => adiar(g.key, adiado)} className="ml-auto text-sm font-semibold text-slate-600 hover:text-slate-900 hover:underline">
            {adiado ? 'Voltar para a lista' : 'Adiar para amanhã'}
          </button>
        </div>
        {g.itens.map(i => (
          <div key={i.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-2.5 border-t border-slate-100">
            <span className="w-40 flex-shrink-0 text-sm text-slate-600">{i.tipo}</span>
            <span className="flex-[1_1_14rem] min-w-0 font-medium text-slate-900 break-words">{i.doc}</span>
            <span className="w-24 flex-shrink-0 text-sm text-slate-700">{i.venc ? dataBR(i.venc) : ''}</span>
            <span className="w-52 flex-shrink-0">{seloPrazo(i)}</span>
            <span className="flex items-center gap-1 ml-auto">
              <Link href={i.acao.href} className={btnSec}>{i.acao.label}</Link>
              {i.comunicar && <Link href={i.comunicar} className={`${linkAcao} text-blue-700`}>Comunicar</Link>}
            </span>
          </div>
        ))}
      </div>
    )
  }

  const vazioAba = (texto: string) => (
    <div className="bg-white border border-slate-200 rounded-xl px-6 py-12 text-center text-sm text-slate-600">{texto}</div>
  )

  return (
    <div className="p-4 md:p-6 xl:p-8 space-y-5">

      {/* Cabeçalho */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Briefing do dia</h1>
          <p className="text-sm text-slate-600 mt-1 first-letter:uppercase">{hojeTxt} · documentos que pedem ação</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 h-11 px-3 bg-white border border-slate-300 rounded-lg text-slate-500">
            <Search className="w-4 h-4" aria-hidden="true" />
            <input value={busca} onChange={e => setBusca(e.target.value)} aria-label="Buscar empresa" placeholder="Buscar empresa"
              className="w-48 bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-500" />
          </label>
          <button onClick={load} className={btnSec + ' h-11'}>Atualizar</button>
          <button data-atalho="foco" disabled={filaFoco.length === 0} onClick={() => setFoco(0)}
            className="h-11 px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap">
            Modo foco · {filaFoco.length} {filaFoco.length === 1 ? 'item' : 'itens'}
          </button>
        </div>
      </header>

      {/* Resumo */}
      {!loading && (
        <section aria-label="Resumo" className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {resumo.map(r => (
            <div key={r.label} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-sm text-slate-600"><span className={`w-2 h-2 rounded-full ${r.cor}`} />{r.label}</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{r.n}</div>
            </div>
          ))}
          <Link href="/societario/painel" className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300">
            <div className="text-sm text-slate-600">Processos parados há 7+ dias</div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold text-slate-900">{processosParados}</span>
              <span className="text-sm font-semibold text-blue-700">Ver processos →</span>
            </div>
          </Link>
        </section>
      )}

      {/* Abas */}
      <div role="tablist" aria-label="Briefing" className="flex flex-wrap gap-x-6 border-b border-slate-200">
        {ABAS.map(t => (
          <button key={t.id} role="tab" aria-selected={aba === t.id} onClick={() => setAba(t.id)}
            className={`h-11 -mb-px border-b-2 text-sm transition-colors ${aba === t.id ? 'border-slate-900 text-slate-900 font-semibold' : 'border-transparent text-slate-600 font-medium hover:text-slate-900'}`}>
            {t.label}<span className="ml-1.5 font-normal text-slate-500">{t.n}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, k) => <div key={k} className="h-16 bg-white rounded-xl border border-slate-200 animate-pulse" />)}</div>
      ) : (
        <>
          {(aba === 'critico' || aba === 'urgente' || aba === 'atencao') && (() => {
            const lista = gruposDaAba(aba)
            return (
              <div className="space-y-4">
                {lista.length === 0
                  ? vazioAba(q ? 'Nenhuma empresa encontrada.' : aba === 'critico' ? 'Nada vencido nem vencendo nos próximos 5 dias.' : aba === 'urgente' ? 'Nada vence entre 6 e 15 dias.' : 'Nada vence entre 16 e 30 dias.')
                  : <section aria-label="Pendências" className="bg-white border border-slate-200 rounded-xl overflow-hidden">{lista.map(g => blocoEmpresa(g))}</section>}

                {gruposAdiados.length > 0 && (
                  <section aria-label="Adiadas para amanhã" className="space-y-2">
                    <h2 className="text-sm font-semibold text-slate-600">Adiadas para amanhã · {gruposAdiados.length} {gruposAdiados.length === 1 ? 'empresa' : 'empresas'}</h2>
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden opacity-80">{gruposAdiados.map(g => blocoEmpresa(g, true))}</div>
                  </section>
                )}
              </div>
            )
          })()}

          {aba === 'nao_comunicados' && (
            naoComunicados.length === 0 ? vazioAba('Todos os clientes com certidão pendente já foram comunicados.') : (
              <section className="bg-white border border-slate-200 rounded-xl overflow-hidden" aria-label="Não comunicados">
                <p className="px-5 py-3 text-sm text-slate-600 border-b border-slate-100">Certidões que não puderam ser renovadas e o cliente ainda não foi avisado.</p>
                {naoComunicados.map(c => (
                  <div key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-2.5 border-t border-slate-100 first:border-t-0">
                    <Link href={`/empresas/${c.empresa_id}`} className="flex-[1_1_16rem] min-w-0 font-semibold text-slate-900 hover:underline break-words">{c.empresaNome}</Link>
                    <span className="flex-[1_1_12rem] text-sm text-slate-700">Certidão {c.tipo}{c.orgao_emissor ? ` · ${c.orgao_emissor}` : ''}</span>
                    <span className="w-28 text-sm text-slate-600">{c.data_vencimento ? `venc. ${dataBR(c.data_vencimento)}` : ''}</span>
                    <Link href={`/certidoes?empresa=${c.empresa_id}&comunicar=${c.id}`} className={btnSec + ' ml-auto'}>Comunicar cliente</Link>
                  </div>
                ))}
              </section>
            )
          )}

          {aba === 'revisao' && (
            revisao.length === 0 ? vazioAba('Nenhuma revisão pendente nas empresas prioritárias.') : (
              <section className="bg-white border border-slate-200 rounded-xl overflow-hidden" aria-label="Revisão mensal">
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-slate-100">
                  <p className="text-sm text-slate-600">Documentos de empresas prioritárias sem conferência nos últimos 30 dias.</p>
                  <button onClick={() => marcarRevisado(revisao)} className={btnSec}>Marcar todos como revisados</button>
                </div>
                {revisao.map(d => {
                  const dias = diasParaVencer(d.venc)
                  return (
                    <div key={d.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-2.5 border-t border-slate-100 first:border-t-0">
                      <Link href={`/empresas/${d.empresaId}`} className="flex-[1_1_16rem] min-w-0 font-semibold text-slate-900 hover:underline break-words">{d.empresaNome}</Link>
                      <span className="flex-[1_1_10rem] text-sm text-slate-700">{d.doc}</span>
                      <span className="w-56 text-sm text-slate-600">{d.venc ? `${dataBR(d.venc)} · ${prazoTexto(dias)}` : 'sem data'}</span>
                      <button onClick={() => marcarRevisado([d])} className={btnSec + ' ml-auto'}>Revisado</button>
                    </div>
                  )
                })}
              </section>
            )
          )}

          {aba === 'cadastro' && (
            semCertidao.length + semAlvara.length === 0 ? vazioAba('Todas as empresas ativas têm certidão e alvará cadastrados.') : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                {[
                  { titulo: 'Sem certidão cadastrada', lista: semCertidao, href: (id: string) => `/certidoes?empresa=${id}` },
                  { titulo: 'Sem alvará cadastrado', lista: semAlvara, href: (id: string) => `/alvaras?empresa=${id}` },
                ].map(b => (
                  <section key={b.titulo} className="bg-white border border-slate-200 rounded-xl overflow-hidden" aria-label={b.titulo}>
                    <h2 className="px-5 py-3 text-sm font-bold text-slate-900 border-b border-slate-100">{b.titulo} · {b.lista.length} {b.lista.length === 1 ? 'empresa' : 'empresas'}</h2>
                    {b.lista.length === 0 ? <p className="px-5 py-4 text-sm text-slate-600">Nenhuma.</p> : (
                      <div className="max-h-[28rem] overflow-y-auto">
                        {b.lista.map(e => (
                          <div key={e.id} className="flex items-center gap-3 px-5 py-2 border-t border-slate-100 first:border-t-0">
                            <Link href={`/empresas/${e.id}`} className="flex-1 min-w-0 text-sm text-slate-900 hover:underline break-words">{e.nome}</Link>
                            <Link href={b.href(e.id)} className="text-sm font-semibold text-blue-700 hover:underline whitespace-nowrap">Cadastrar</Link>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                ))}
              </div>
            )
          )}

          {updatedAt && (
            <p className="text-xs text-slate-500 text-right">
              Atualizado às {updatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </>
      )}

      {/* Modo foco */}
      {foco !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Modo foco">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setFoco(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            {foco >= filaFoco.length ? (
              <div className="text-center py-6">
                <p className="text-lg font-bold text-slate-900">Fila concluída</p>
                <p className="text-sm text-slate-600 mt-1">Você passou por todos os itens de hoje.</p>
                <button onClick={() => setFoco(null)} className="mt-5 h-10 px-5 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800">Fechar</button>
              </div>
            ) : (() => {
              const i = filaFoco[foco]
              return (
                <>
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold text-slate-600">Item {foco + 1} de {filaFoco.length}</p>
                    <button onClick={() => setFoco(null)} className="text-sm font-semibold text-slate-600 hover:text-slate-900">Fechar</button>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-2">
                    <div className="h-full bg-slate-900 rounded-full" style={{ width: `${Math.round((foco / filaFoco.length) * 100)}%` }} />
                  </div>
                  <p className="text-sm text-slate-600 mt-5">{i.tipo}</p>
                  <h2 className="text-xl font-bold text-slate-900 leading-snug">{i.empresaNome}</h2>
                  <p className="text-slate-700 mt-1">{i.doc}{i.venc ? ` · ${dataBR(i.venc)}` : ''}</p>
                  <div className="mt-3">{seloPrazo(i)}</div>
                  <div className="flex flex-wrap gap-2 mt-6">
                    <Link href={i.acao.href} className="inline-flex items-center h-10 px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800">{i.acao.label}</Link>
                    {i.comunicar && <Link href={i.comunicar} className={btnSec}>Comunicar</Link>}
                    <button onClick={() => adiar(i.grupoKey)} className={btnSec}>Adiar empresa</button>
                    <button onClick={() => setFoco(foco + 1)} className={btnSec + ' ml-auto'}>Próximo →</button>
                  </div>
                  <p className="text-xs text-slate-500 mt-4">Use as setas ← → para navegar e Esc para fechar.</p>
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
