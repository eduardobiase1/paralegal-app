// Regras de prazo compartilhadas pelas telas de vencimento (Briefing, Certidões,
// Alvarás, Licenças, Visão Geral). Faixas: vencido · até 5 · até 15 · até 30 dias.

export const MESES_ABREV = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']

export function diasParaVencer(data?: string | null): number | null {
  if (!data) return null
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  return Math.round((new Date(data.slice(0, 10) + 'T00:00:00').getTime() - hoje.getTime()) / 86400000)
}

export function prazoTexto(d: number | null): string {
  if (d === null) return 'sem data de vencimento'
  if (d < 0) return `venceu há ${-d} dia${d === -1 ? '' : 's'}`
  if (d === 0) return 'vence hoje'
  return `vence em ${d} dia${d === 1 ? '' : 's'}`
}

export function dataBR(d?: string | null): string {
  if (!d) return '—'
  const [y, m, dia] = d.slice(0, 10).split('-')
  return `${dia}/${m}/${y}`
}

export type TomPrazo = 'red' | 'orange' | 'slate' | 'green'

// Grupos da agenda, do mais urgente ao mais distante
export const GRUPOS_AGENDA: Array<{ id: string; titulo: string; tom: TomPrazo; teste: (d: number | null) => boolean }> = [
  { id: 'vencidos', titulo: 'Vencidos',               tom: 'red',    teste: d => d !== null && d < 0 },
  { id: 'ate5',     titulo: 'Vencem em até 5 dias',   tom: 'orange', teste: d => d !== null && d >= 0 && d <= 5 },
  { id: 'ate15',    titulo: 'Vencem em 6 a 15 dias',  tom: 'slate',  teste: d => d !== null && d > 5 && d <= 15 },
  { id: 'ate30',    titulo: 'Vencem em 16 a 30 dias', tom: 'slate',  teste: d => d !== null && d > 15 && d <= 30 },
  { id: 'semdata',  titulo: 'Sem data de vencimento', tom: 'slate',  teste: d => d === null },
]

export const TOM_DATA: Record<TomPrazo, string> = {
  red:    'bg-red-50 text-red-800',
  orange: 'bg-orange-50 text-orange-800',
  slate:  'bg-slate-100 text-slate-700',
  green:  'bg-green-50 text-green-800',
}

/**
 * Mantém só o registro vigente de cada documento. Usado nos alvarás, onde cada
 * renovação cria um registro novo e o antigo fica guardado como histórico.
 */
export function apenasVigentes<T extends { data_vencimento?: string | null }>(lista: T[], chave: (i: T) => string): T[] {
  const melhor = new Map<string, T>()
  for (const item of lista) {
    const k = chave(item)
    const atual = melhor.get(k)
    if (!atual || (item.data_vencimento || '') > (atual.data_vencimento || '')) melhor.set(k, item)
  }
  return Array.from(melhor.values())
}

export const chaveAlvara = (a: { empresa_id?: string | null; orgao_emissor?: string | null; tipo?: string | null }) =>
  `${a.empresa_id}|${(a.orgao_emissor || '').trim().toLowerCase()}|${a.tipo || ''}`
