'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
import Link from 'next/link'

// ── Helpers ───────────────────────────────────────────────────────────────────
const DIAS_PT  = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado']
const MESES_PT = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']

function daysRemaining(d: string) {
  const a = new Date(d); a.setHours(0,0,0,0)
  const b = new Date();  b.setHours(0,0,0,0)
  return Math.round((a.getTime() - b.getTime()) / 86_400_000)
}
function daysSinceMs(ms: number) {
  return Math.round((Date.now() - ms) / 86_400_000)
}
function vencTxt(dias: number, fem = false) {
  if (dias < 0)  return `${fem ? 'vencida' : 'vencido'} há ${Math.abs(dias)}d`
  if (dias === 0) return 'vence hoje'
  return `vence em ${dias}d`
}

// ── Tipos ─────────────────────────────────────────────────────────────────────
type Tier = 'critico' | 'urgente' | 'atencao' | 'controle'

interface PriorityDoc {
  key: string
  tipo: 'certidao' | 'alvara' | 'licenca'
  empresaNome: string
  empresaId: string
  docId: string
  descricao: string
  dataVencimento: string | null
  diasRestantes: number | null
  href: string
}

interface WorkItem {
  key:          string
  tier:         Tier
  icon:         React.ReactNode
  badge:        string
  empresaNome:  string
  href:         string
  descricao:    string
  detalhe:      string
  detalheColor: 'red' | 'orange' | 'amber' | 'blue' | 'gray'
  score:        number
  subList?:     string[]
}

// ── Configuração dos níveis ────────────────────────────────────────────────────
const T: Record<Tier, {
  label: string; sub: string
  headerBg: string; headerBorder: string
  dot: string; text: string
  badge: string; border: string; dc: string
}> = {
  critico: {
    label: 'Crítico', sub: 'vencido ou vence em ≤ 5 dias · processos parados > 30 dias',
    headerBg: 'bg-red-50', headerBorder: 'border-red-200',
    dot: 'bg-red-500', text: 'text-red-700',
    badge: 'bg-red-50 text-red-700 ring-1 ring-red-200',
    border: 'border-l-red-500', dc: 'bg-red-100 text-red-700',
  },
  urgente: {
    label: 'Urgente', sub: 'vence em 6–15 dias · processos parados 15–30 dias',
    headerBg: 'bg-orange-50', headerBorder: 'border-orange-200',
    dot: 'bg-orange-500', text: 'text-orange-700',
    badge: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
    border: 'border-l-orange-400', dc: 'bg-orange-100 text-orange-700',
  },
  atencao: {
    label: 'Atenção', sub: 'vence em 16–30 dias · processos parados 7–15 dias',
    headerBg: 'bg-amber-50', headerBorder: 'border-amber-200',
    dot: 'bg-amber-400', text: 'text-amber-700',
    badge: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    border: 'border-l-amber-400', dc: 'bg-amber-100 text-amber-700',
  },
  controle: {
    label: 'Controle', sub: 'cadastros incompletos — complete para 100%',
    headerBg: 'bg-blue-50', headerBorder: 'border-blue-200',
    dot: 'bg-blue-400', text: 'text-blue-700',
    badge: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
    border: 'border-l-blue-400', dc: 'bg-blue-50 text-blue-600',
  },
}

// ── Ícones ────────────────────────────────────────────────────────────────────
const IcoProcesso  = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
const IcoCertidao  = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
const IcoAlvara    = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138z" /></svg>
const IcoLicenca   = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
const IcoCertDig   = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
const IcoWarning   = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>

// ── Componente principal ──────────────────────────────────────────────────────
export default function BriefingPage() {
  const { orgId } = useOrg()
  const [groups,        setGroups]        = useState<Record<Tier, WorkItem[]>>({ critico: [], urgente: [], atencao: [], controle: [] })
  const [priorityDocs,  setPriorityDocs]  = useState<PriorityDoc[]>([])
  const [loading,       setLoading]       = useState(true)
  const [updatedAt,     setUpdatedAt]     = useState<Date | null>(null)
  const [expanded,      setExpanded]      = useState<Record<string, boolean>>({})
  const [supabase]                        = useState(createClient)

  const hoje      = new Date()
  const diaLabel  = DIAS_PT[hoje.getDay()]
  const dateLabel = `${hoje.getDate()} de ${MESES_PT[hoje.getMonth()]} de ${hoje.getFullYear()}`

  useEffect(() => { load() }, [])

  // ── Classifica o item no nível correto ─────────────────────────────────────
  function tierForDias(dias: number): Tier | null {
    if (dias < 0 || dias <= 5) return 'critico'
    if (dias <= 15)            return 'urgente'
    if (dias <= 30)            return 'atencao'
    return null
  }

  function tierForProcDias(dias: number): Tier | null {
    if (dias > 30)  return 'critico'
    if (dias > 15)  return 'urgente'
    if (dias >= 7)  return 'atencao'
    return null
  }

  // ── Carga e varredura ──────────────────────────────────────────────────────
  async function load() {
    setLoading(true)
    try {
      const [
        { data: processos },
        { data: certidoes },
        { data: alvaras },
        { data: licencas },
        { data: certificados },
        { data: empresasAtivas },
        { data: empComCert },
        { data: empComAlvara },
      ] = await Promise.all([
        supabase.from('processos_societarios')
          .select('id, titulo, tipo, updated_at, empresa_id, empresa:empresas(razao_social), etapas:processo_etapas(id, updated_at)')
          .eq('status', 'em_andamento'),
        supabase.from('certidoes')
          .select('id, tipo, data_vencimento, updated_at, empresa_id, empresa:empresas(razao_social)')
          .not('data_vencimento', 'is', null),
        supabase.from('alvaras')
          .select('id, tipo, data_vencimento, empresa_id, empresa:empresas(razao_social)')
          .not('data_vencimento', 'is', null),
        supabase.from('licencas_sanitarias')
          .select('id, data_vencimento, empresa_id, empresa:empresas(razao_social)')
          .not('data_vencimento', 'is', null),
        supabase.from('certificados_digitais')
          .select('id, tipo, uso, data_vencimento, empresa_id, empresa:empresas(razao_social)')
          .not('data_vencimento', 'is', null),
        supabase.from('empresas').select('id, razao_social').eq('situacao', 'ATIVA'),
        supabase.from('certidoes').select('empresa_id').not('empresa_id', 'is', null),
        supabase.from('alvaras').select('empresa_id').not('empresa_id', 'is', null),
      ])

      const result: Record<Tier, WorkItem[]> = { critico: [], urgente: [], atencao: [], controle: [] }

      // ── Processos societários parados ────────────────────────────────────
      for (const p of processos || []) {
        const etapas = (p as any).etapas || []
        const lastMs = etapas.length
          ? Math.max(new Date(p.updated_at).getTime(), ...etapas.map((e: any) => new Date(e.updated_at).getTime()))
          : new Date(p.updated_at).getTime()
        const dias = daysSinceMs(lastMs)
        const tier = tierForProcDias(dias)
        if (!tier) continue

        result[tier].push({
          key:          `proc-${p.id}`,
          tier,
          icon:         <IcoProcesso />,
          badge:        'Processo Societário',
          empresaNome:  (p as any).empresa?.razao_social || '—',
          href:         `/societario/${p.id}`,
          descricao:    (p as any).titulo || (p as any).tipo || 'Processo societário',
          detalhe:      `${dias}d parado`,
          detalheColor: tier === 'critico' ? 'red' : tier === 'urgente' ? 'orange' : 'amber',
          score:        tier === 'critico' ? dias * 6 : tier === 'urgente' ? dias * 4 : dias * 2,
        })
      }

      // ── Certidões negativas ──────────────────────────────────────────────
      // Carência pós-renovação: se atualizada há < 7 dias e vence em > 5 dias, suprimir
      for (const c of certidoes || []) {
        const dias = daysRemaining(c.data_vencimento)
        const tier = tierForDias(dias)
        if (!tier) continue

        // Regra de carência pós-renovação (7 dias)
        if (c.updated_at && dias > 5) {
          const daysSinceUpdate = daysSinceMs(new Date(c.updated_at).getTime())
          if (daysSinceUpdate < 7) continue  // voltará automaticamente em breve
        }

        result[tier].push({
          key:          `cert-${c.id}`,
          tier,
          icon:         <IcoCertidao />,
          badge:        'Certidão Negativa',
          empresaNome:  (c as any).empresa?.razao_social || '—',
          href:         `/certidoes?empresa=${c.empresa_id}`,
          descricao:    c.tipo || 'Certidão',
          detalhe:      vencTxt(dias, true),
          detalheColor: dias < 0 ? 'red' : tier === 'urgente' ? 'orange' : 'amber',
          score:        dias < 0 ? 200 + Math.abs(dias) * 3 : tier === 'critico' ? 150 - dias * 10 : tier === 'urgente' ? 80 - dias * 2 : 50 - dias,
        })
      }

      // ── Alvarás ──────────────────────────────────────────────────────────
      for (const a of alvaras || []) {
        const dias = daysRemaining(a.data_vencimento)
        const tier = tierForDias(dias)
        if (!tier) continue

        result[tier].push({
          key:          `alv-${a.id}`,
          tier,
          icon:         <IcoAlvara />,
          badge:        'Alvará',
          empresaNome:  (a as any).empresa?.razao_social || '—',
          href:         `/alvaras?empresa=${a.empresa_id}`,
          descricao:    `Alvará ${(a as any).tipo || ''}`.trim(),
          detalhe:      vencTxt(dias),
          detalheColor: dias < 0 ? 'red' : tier === 'urgente' ? 'orange' : 'amber',
          score:        dias < 0 ? 195 + Math.abs(dias) * 3 : tier === 'critico' ? 145 - dias * 10 : tier === 'urgente' ? 78 - dias * 2 : 48 - dias,
        })
      }

      // ── Licenças Sanitárias ──────────────────────────────────────────────
      for (const l of licencas || []) {
        const dias = daysRemaining(l.data_vencimento)
        const tier = tierForDias(dias)
        if (!tier) continue

        result[tier].push({
          key:          `lic-${l.id}`,
          tier,
          icon:         <IcoLicenca />,
          badge:        'Licença Sanitária',
          empresaNome:  (l as any).empresa?.razao_social || '—',
          href:         `/licencas?empresa=${l.empresa_id}`,
          descricao:    'Licença Sanitária',
          detalhe:      vencTxt(dias, true),
          detalheColor: dias < 0 ? 'red' : tier === 'urgente' ? 'orange' : 'amber',
          score:        dias < 0 ? 190 + Math.abs(dias) * 3 : tier === 'critico' ? 140 - dias * 10 : tier === 'urgente' ? 76 - dias * 2 : 46 - dias,
        })
      }

      // ── Certificados Digitais ────────────────────────────────────────────
      for (const cd of certificados || []) {
        const dias = daysRemaining(cd.data_vencimento)
        const tier = tierForDias(dias)
        if (!tier) continue

        result[tier].push({
          key:          `certdig-${cd.id}`,
          tier,
          icon:         <IcoCertDig />,
          badge:        'Certificado Digital',
          empresaNome:  (cd as any).empresa?.razao_social || '—',
          href:         `/certificados?empresa=${cd.empresa_id}`,
          descricao:    [(cd as any).tipo, (cd as any).uso].filter(Boolean).join(' ') || 'Certificado Digital',
          detalhe:      vencTxt(dias),
          detalheColor: dias < 0 ? 'red' : tier === 'urgente' ? 'orange' : 'amber',
          score:        dias < 0 ? 185 + Math.abs(dias) * 3 : tier === 'critico' ? 135 - dias * 10 : tier === 'urgente' ? 74 - dias * 2 : 44 - dias,
        })
      }

      // ── Controle: cadastros incompletos ──────────────────────────────────
      const comCertIds   = new Set((empComCert   || []).map((r: any) => r.empresa_id))
      const comAlvaraIds = new Set((empComAlvara || []).map((r: any) => r.empresa_id))
      const semCertNomes:   string[] = []
      const semAlvaraNomes: string[] = []

      for (const e of empresasAtivas || []) {
        if (!comCertIds.has(e.id))   semCertNomes.push(e.razao_social)
        if (!comAlvaraIds.has(e.id)) semAlvaraNomes.push(e.razao_social)
      }

      if (semCertNomes.length > 0) {
        result.controle.push({
          key:          'gap-cert',
          tier:         'controle',
          icon:         <IcoWarning />,
          badge:        'Cadastro Pendente',
          empresaNome:  'Certidões Negativas',
          href:         '/certidoes',
          descricao:    `${semCertNomes.length} empresa${semCertNomes.length !== 1 ? 's' : ''} ativa${semCertNomes.length !== 1 ? 's' : ''} sem certidão cadastrada`,
          detalhe:      `${semCertNomes.length} empresa${semCertNomes.length !== 1 ? 's' : ''}`,
          detalheColor: 'blue',
          score:        semCertNomes.length * 5,
          subList:      semCertNomes.sort(),
        })
      }

      if (semAlvaraNomes.length > 0) {
        result.controle.push({
          key:          'gap-alv',
          tier:         'controle',
          icon:         <IcoWarning />,
          badge:        'Cadastro Pendente',
          empresaNome:  'Alvarás de Funcionamento',
          href:         '/alvaras',
          descricao:    `${semAlvaraNomes.length} empresa${semAlvaraNomes.length !== 1 ? 's' : ''} ativa${semAlvaraNomes.length !== 1 ? 's' : ''} sem alvará cadastrado`,
          detalhe:      `${semAlvaraNomes.length} empresa${semAlvaraNomes.length !== 1 ? 's' : ''}`,
          detalheColor: 'blue',
          score:        semAlvaraNomes.length * 4,
          subList:      semAlvaraNomes.sort(),
        })
      }

      // ── Ordena cada nível por score ──────────────────────────────────────
      for (const tier of Object.keys(result) as Tier[]) {
        result[tier].sort((a, b) => b.score - a.score)
      }

      setGroups(result)

      // ── Empresas Prioritárias — revisão a cada 30 dias ───────────────────
      const trintaDiasAtras = new Date(Date.now() - 30 * 86_400_000).toISOString()

      const { data: empPriori } = await supabase
        .from('empresas')
        .select('id, razao_social')
        .eq('prioritaria', true)

      if (empPriori && empPriori.length > 0) {
        const ids = empPriori.map((e: any) => e.id)
        const nomeMap: Record<string, string> = {}
        for (const e of empPriori) nomeMap[(e as any).id] = (e as any).razao_social

        const [
          { data: certPriori },
          { data: alvPriori },
          { data: licPriori },
        ] = await Promise.all([
          supabase.from('certidoes')
            .select('id, tipo, data_vencimento, briefing_revisado_em, empresa_id')
            .in('empresa_id', ids)
            .or(`briefing_revisado_em.is.null,briefing_revisado_em.lt.${trintaDiasAtras}`),
          supabase.from('alvaras')
            .select('id, tipo, data_vencimento, briefing_revisado_em, empresa_id')
            .in('empresa_id', ids)
            .or(`briefing_revisado_em.is.null,briefing_revisado_em.lt.${trintaDiasAtras}`),
          supabase.from('licencas_sanitarias')
            .select('id, data_vencimento, briefing_revisado_em, empresa_id')
            .in('empresa_id', ids)
            .or(`briefing_revisado_em.is.null,briefing_revisado_em.lt.${trintaDiasAtras}`),
        ])

        const docs: PriorityDoc[] = []

        for (const c of certPriori || []) {
          const dias = c.data_vencimento ? daysRemaining(c.data_vencimento) : null
          docs.push({
            key:             `priori-cert-${c.id}`,
            tipo:            'certidao',
            empresaNome:     nomeMap[c.empresa_id] || '—',
            empresaId:       c.empresa_id,
            docId:           c.id,
            descricao:       c.tipo || 'Certidão Negativa',
            dataVencimento:  c.data_vencimento,
            diasRestantes:   dias,
            href:            `/certidoes?empresa=${c.empresa_id}`,
          })
        }

        for (const a of alvPriori || []) {
          const dias = a.data_vencimento ? daysRemaining(a.data_vencimento) : null
          docs.push({
            key:             `priori-alv-${a.id}`,
            tipo:            'alvara',
            empresaNome:     nomeMap[a.empresa_id] || '—',
            empresaId:       a.empresa_id,
            docId:           a.id,
            descricao:       `Alvará ${(a as any).tipo || ''}`.trim(),
            dataVencimento:  a.data_vencimento,
            diasRestantes:   dias,
            href:            `/alvaras?empresa=${a.empresa_id}`,
          })
        }

        for (const l of licPriori || []) {
          const dias = l.data_vencimento ? daysRemaining(l.data_vencimento) : null
          docs.push({
            key:             `priori-lic-${l.id}`,
            tipo:            'licenca',
            empresaNome:     nomeMap[l.empresa_id] || '—',
            empresaId:       l.empresa_id,
            docId:           l.id,
            descricao:       'Licença Sanitária',
            dataVencimento:  l.data_vencimento,
            diasRestantes:   dias,
            href:            `/licencas?empresa=${l.empresa_id}`,
          })
        }

        // Ordena por empresa, depois por tipo
        docs.sort((a, b) => a.empresaNome.localeCompare(b.empresaNome) || a.tipo.localeCompare(b.tipo))
        setPriorityDocs(docs)
      } else {
        setPriorityDocs([])
      }

      setUpdatedAt(new Date())
    } catch (e) {
      console.error('Briefing error:', e)
    }
    setLoading(false)
  }

  // ── Totais ────────────────────────────────────────────────────────────────
  const totalCritico  = groups.critico.length
  const totalUrgente  = groups.urgente.length
  const totalAtencao  = groups.atencao.length
  const totalControle = groups.controle.length
  const totalGeral    = totalCritico + totalUrgente + totalAtencao + totalControle
  const tudoEmDia     = !loading && totalGeral === 0

  // ── Seção Empresas Prioritárias ───────────────────────────────────────────
  function PrioritySection() {
    if (priorityDocs.length === 0) return null

    const tipoIcon = {
      certidao: <IcoCertidao />,
      alvara:   <IcoAlvara />,
      licenca:  <IcoLicenca />,
    }
    const tipoLabel = {
      certidao: 'Certidão Negativa',
      alvara:   'Alvará',
      licenca:  'Licença Sanitária',
    }

    return (
      <div className="mb-6">
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl border mb-3 bg-violet-50 border-violet-200">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-500 flex-shrink-0" />
            <span className="text-sm font-bold text-violet-700">⭐ Revisão Mensal</span>
            <span className="text-xs text-violet-600 opacity-70">— empresas prioritárias · ciclo de 30 dias</span>
          </div>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 ring-1 ring-violet-200">
            {priorityDocs.length} {priorityDocs.length === 1 ? 'item' : 'itens'}
          </span>
        </div>

        <div className="space-y-2">
          {priorityDocs.map(doc => {
            const diasColor = doc.diasRestantes === null
              ? 'bg-gray-100 text-gray-500'
              : doc.diasRestantes < 0
                ? 'bg-red-100 text-red-700'
                : doc.diasRestantes <= 15
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-violet-50 text-violet-700'

            const diasTxt = doc.diasRestantes === null
              ? 'sem data'
              : doc.diasRestantes < 0
                ? `vencida há ${Math.abs(doc.diasRestantes)}d`
                : doc.diasRestantes === 0
                  ? 'vence hoje'
                  : `vence em ${doc.diasRestantes}d`

            return (
              <Link key={doc.key} href={doc.href}
                className="flex items-center gap-3 px-4 py-3.5 bg-white rounded-xl border border-gray-100 border-l-[4px] border-l-violet-400 shadow-sm hover:shadow-md transition-all group">
                <div className="flex-shrink-0 text-violet-500">{tipoIcon[doc.tipo]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide bg-violet-50 text-violet-700 ring-1 ring-violet-200">
                      {tipoLabel[doc.tipo]}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-gray-900 truncate group-hover:text-violet-700 transition-colors leading-tight">
                    {doc.empresaNome}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{doc.descricao}</p>
                </div>
                {doc.dataVencimento && (
                  <span className={`flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${diasColor}`}>
                    {diasTxt}
                  </span>
                )}
                <svg className="w-4 h-4 text-gray-300 group-hover:text-violet-400 flex-shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            )
          })}
        </div>

        <p className="text-[10px] text-violet-400 mt-2 px-1">
          Itens desaparecem por 30 dias ao renovar o documento com nova data de vencimento.
        </p>
      </div>
    )
  }

  // ── Card de item ──────────────────────────────────────────────────────────
  function ItemCard({ item }: { item: WorkItem }) {
    const t = T[item.tier]
    const isExpanded = expanded[item.key]
    const hasSubList = item.subList && item.subList.length > 0

    const dcColor = {
      red:    'bg-red-100 text-red-700',
      orange: 'bg-orange-100 text-orange-700',
      amber:  'bg-amber-100 text-amber-700',
      blue:   'bg-blue-50 text-blue-700',
      gray:   'bg-gray-100 text-gray-600',
    }[item.detalheColor]

    return (
      <div className={`bg-white rounded-xl border border-gray-100 border-l-[4px] ${t.border} shadow-sm hover:shadow-md transition-all`}>
        <Link href={item.href} className="flex items-center gap-3 px-4 py-3.5 group">
          <div className={`flex-shrink-0 ${t.text}`}>{item.icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${t.badge}`}>
                {item.badge}
              </span>
            </div>
            <p className="text-sm font-bold text-gray-900 truncate group-hover:text-blue-700 transition-colors leading-tight">
              {item.empresaNome}
            </p>
            <p className="text-xs text-gray-500 truncate">{item.descricao}</p>
          </div>
          {item.detalhe && (
            <span className={`flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${dcColor}`}>
              {item.detalhe}
            </span>
          )}
          {hasSubList ? (
            <button
              onClick={e => { e.preventDefault(); setExpanded(p => ({ ...p, [item.key]: !p[item.key] })) }}
              className={`flex-shrink-0 flex items-center gap-1 text-xs font-semibold transition-colors px-1 ${t.text}`}
            >
              {isExpanded ? 'ocultar' : 'ver lista'}
              <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          ) : (
            <svg className="w-4 h-4 text-gray-300 group-hover:text-blue-400 flex-shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </Link>

        {hasSubList && isExpanded && (
          <div className="px-4 pb-4 border-t border-gray-50">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mt-3 mb-2">Empresas</p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {item.subList!.map((nome, i) => (
                <p key={i} className="text-xs text-gray-700 flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-gray-400 flex-shrink-0" />
                  {nome}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Seção de nível ────────────────────────────────────────────────────────
  function TierSection({ tier }: { tier: Tier }) {
    const t    = T[tier]
    const list = groups[tier]

    return (
      <div className="mb-6">
        {/* Header da seção */}
        <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border mb-3 ${t.headerBg} ${t.headerBorder}`}>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${t.dot}`} />
            <span className={`text-sm font-bold ${t.text}`}>{t.label}</span>
            <span className={`text-xs ${t.text} opacity-70`}>— {t.sub}</span>
          </div>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${t.badge}`}>
            {list.length} {list.length === 1 ? 'item' : 'itens'}
          </span>
        </div>

        {list.length === 0 ? (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 border-dashed">
            <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm text-gray-500">Tudo em dia neste nível</span>
          </div>
        ) : (
          <div className="space-y-2">
            {list.map(item => <ItemCard key={item.key} item={item} />)}
          </div>
        )}
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-3xl mx-auto">

      {/* Cabeçalho */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-2xl shadow-sm border border-amber-100">
              ☀️
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Briefing Diário</h1>
              <p className="text-sm text-gray-500">{diaLabel} · {dateLabel}</p>
            </div>
          </div>
          <button onClick={load}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors font-medium mt-1 flex-shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Atualizar
          </button>
        </div>

        {/* Scorecard dos 4 níveis */}
        {!loading && (
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {([
              { tier: 'critico' as Tier,  count: totalCritico,  label: 'Crítico' },
              { tier: 'urgente' as Tier,  count: totalUrgente,  label: 'Urgente' },
              { tier: 'atencao' as Tier,  count: totalAtencao,  label: 'Atenção' },
              { tier: 'controle' as Tier, count: totalControle, label: 'Controle' },
            ]).map(({ tier, count, label }) => {
              const t = T[tier]
              return (
                <div key={tier} className={`px-4 py-3 rounded-xl border ${t.headerBg} ${t.headerBorder}`}>
                  <p className={`text-2xl font-black ${t.text}`}>{count}</p>
                  <p className={`text-[10px] font-bold uppercase tracking-wide ${t.text} opacity-70`}>{label}</p>
                </div>
              )
            })}
          </div>
        )}

        {!loading && updatedAt && (
          <p className="text-[10px] text-gray-400 mt-3">
            Varredura concluída às {updatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {totalGeral} {totalGeral === 1 ? 'trabalho encontrado' : 'trabalhos encontrados'}
          </p>
        )}
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse border border-gray-100" />
          ))}
        </div>
      ) : tudoEmDia ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-5xl mb-4">🎉</p>
          <p className="text-lg font-bold text-gray-900">100% sob controle!</p>
          <p className="text-sm text-gray-500 mt-1">Nenhuma pendência encontrada. Continue assim!</p>
        </div>
      ) : (
        <>
          <PrioritySection />
          <TierSection tier="critico" />
          <TierSection tier="urgente" />
          <TierSection tier="atencao" />
          <TierSection tier="controle" />
        </>
      )}

      {/* Rodapé */}
      {!loading && !tudoEmDia && (
        <p className="text-xs text-gray-400 text-center mt-4">
          Certidões renovadas nos últimos 7 dias entram automaticamente no próximo ciclo.
        </p>
      )}
    </div>
  )
}
