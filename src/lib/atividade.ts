// Produtividade automática — helpers compartilhados entre o contador de tempo
// (AtividadeTracker) e o registro de ações feito pelas telas (registrarAcao).

import { createClient } from '@/lib/supabase/client'

type Supabase = ReturnType<typeof createClient>

const MODULOS: Array<[string, string]> = [
  ['/briefing',          'Briefing Diário'],
  ['/societario/painel', 'Briefing Societário'],
  ['/societario',        'Societário'],
  ['/visao-geral',       'Visão Geral'],
  ['/dashboard',         'Dashboard'],
  ['/empresas',          'Empresas'],
  ['/financeiro',        'Financeiro'],
  ['/certidoes',         'Certidões'],
  ['/alvaras',           'Alvarás'],
  ['/licencas',          'Licenças Sanitárias'],
  ['/certificados',      'Certificados Digitais'],
  ['/taxas-licenca',     'Taxas de Licença'],
  ['/contratos',         'Contratos'],
  ['/simulador',         'Simulador de Taxas'],
  ['/tributario',        'Estrategista Tributário'],
  ['/relatorios',        'Relatórios'],
  ['/pdf-tools',         'PDF Expert'],
  ['/produtividade',     'Produtividade'],
  ['/usuarios',          'Usuários'],
]

export function moduloDoPath(pathname: string): string {
  return MODULOS.find(([p]) => pathname === p || pathname.startsWith(p + '/'))?.[1] ?? 'Outros'
}

// Data local yyyy-mm-dd (toISOString usaria UTC e viraria o dia às 21h no Brasil)
export function diaLocal(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Módulo + empresa em foco, lidos da URL atual (?empresa=ID ou /empresas/ID)
export function contextoAtual(): { modulo: string; empresaId: string | null; chave: string } {
  const { pathname, search } = window.location
  const modulo = moduloDoPath(pathname)
  let empresaId = new URLSearchParams(search).get('empresa')
  if (!empresaId) {
    const m = pathname.match(/^\/empresas\/([^/]+)/)
    if (m) empresaId = m[1]
  }
  if (empresaId && !UUID_RE.test(empresaId)) empresaId = null
  return { modulo, empresaId, chave: `${modulo}|${empresaId ?? ''}` }
}

// ── Caches ────────────────────────────────────────────────────
let usuarioCache: { id: string; nome: string } | null = null
const empresaCache: Record<string, string> = {}
// Vira true se as tabelas ainda não existem (migration_v13 não executada)
let desativado = false
// Organização ativa — definida pelo AtividadeTracker ao montar
let orgAtual = ''

export function definirOrgAtividade(orgId: string) { orgAtual = orgId }

export function atividadeDesativada() { return desativado }

export function marcarSeTabelaAusente(error: { code?: string } | null) {
  if (error && (error.code === '42P01' || error.code === 'PGRST205')) desativado = true
}

export async function usuarioAtual(supabase: Supabase) {
  if (usuarioCache) return usuarioCache
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null
  usuarioCache = { id: session.user.id, nome: (session.user.email || '').split('@')[0] }
  return usuarioCache
}

export async function nomeEmpresa(supabase: Supabase, id: string | null): Promise<string | null> {
  if (!id) return null
  if (empresaCache[id]) return empresaCache[id]
  const { data } = await supabase.from('empresas').select('razao_social').eq('id', id).maybeSingle()
  if (data?.razao_social) empresaCache[id] = data.razao_social
  return data?.razao_social ?? null
}

// ── Portal externo: último bloco fechado, para ligar ao resultado ──
const ULTIMO_PORTAL_KEY = 'atividade_ultimo_portal'
const JANELA_RESULTADO_MS = 15 * 60 * 1000

export function guardarUltimoPortal(id: string, empresaId: string | null) {
  try { localStorage.setItem(ULTIMO_PORTAL_KEY, JSON.stringify({ id, empresaId, em: Date.now() })) } catch {}
}

/**
 * Registra uma ação feita no sistema (renovou, comunicou, concluiu etapa...).
 * Nunca interrompe o fluxo da tela: qualquer erro é ignorado.
 */
export async function registrarAcao(
  acao: string,
  descricao: string,
  opts: { empresaId?: string | null; empresaNome?: string | null } = {},
) {
  const orgId = orgAtual
  if (desativado || !orgId) return
  try {
    const supabase = createClient()
    const eu = await usuarioAtual(supabase)
    if (!eu) return
    const ctx = contextoAtual()
    const empresaId = opts.empresaId ?? ctx.empresaId
    const empresaNome = opts.empresaNome ?? await nomeEmpresa(supabase, empresaId)

    const { error } = await supabase.from('atividade_eventos').insert([{
      org_id: orgId, usuario: eu.nome, dia: diaLocal(), acao, modulo: ctx.modulo,
      empresa_id: empresaId || null, empresa_nome: empresaNome, descricao,
    }])
    if (error) { marcarSeTabelaAusente(error); return }

    // Se acabou de voltar de um portal aberto pelo sistema, liga o resultado ao tempo gasto lá
    const raw = localStorage.getItem(ULTIMO_PORTAL_KEY)
    if (raw) {
      const p = JSON.parse(raw) as { id: string; empresaId: string | null; em: number }
      const mesmaEmpresa = !p.empresaId || !empresaId || p.empresaId === empresaId
      if (Date.now() - p.em < JANELA_RESULTADO_MS && mesmaEmpresa) {
        await supabase.from('atividade_blocos').update({ resultado: descricao }).eq('id', p.id)
      }
      localStorage.removeItem(ULTIMO_PORTAL_KEY)
    }
  } catch {
    // registro de produtividade não é crítico
  }
}
