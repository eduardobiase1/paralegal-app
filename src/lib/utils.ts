import { StatusCor } from '@/types'

// ── Formatação ──────────────────────────────────────────────

export function formatCNPJ(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '')
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

export function formatCEP(cep: string): string {
  const digits = cep.replace(/\D/g, '')
  return digits.replace(/^(\d{5})(\d{3})$/, '$1-$2')
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—'
  const [year, month, day] = date.split('T')[0].split('-')
  return `${day}/${month}/${year}`
}

export function formatDateInput(date: string | null | undefined): string {
  if (!date) return ''
  return date.split('T')[0]
}

// ── Validação ──────────────────────────────────────────────

export function validateCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '')
  if (digits.length !== 14) return false
  if (/^(\d)\1+$/.test(digits)) return false

  const calcDigit = (digits: string, length: number) => {
    let sum = 0
    let pos = length - 7
    for (let i = length; i >= 1; i--) {
      sum += parseInt(digits.charAt(length - i)) * pos--
      if (pos < 2) pos = 9
    }
    const result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
    return result
  }

  const d1 = calcDigit(digits, 12)
  if (d1 !== parseInt(digits.charAt(12))) return false
  const d2 = calcDigit(digits, 13)
  if (d2 !== parseInt(digits.charAt(13))) return false
  return true
}

// ── Status / Cores ──────────────────────────────────────────

export function calcularStatus(dataVencimento: string | null | undefined): StatusCor {
  if (!dataVencimento) return 'sem_data'
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const venc = new Date(dataVencimento + 'T00:00:00')
  const diff = Math.floor((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))

  if (diff < 0) return 'vencido'
  if (diff <= 30) return 'critico'
  if (diff <= 60) return 'atencao'
  if (diff <= 90) return 'alerta'
  return 'ok'
}

export function statusCorClass(cor: StatusCor): string {
  switch (cor) {
    case 'ok':      return 'bg-green-100 text-green-800'
    case 'alerta':  return 'bg-blue-100 text-blue-800'
    case 'atencao': return 'bg-yellow-100 text-yellow-800'
    case 'critico': return 'bg-orange-100 text-orange-800'
    case 'vencido': return 'bg-red-100 text-red-800'
    default:        return 'bg-gray-100 text-gray-600'
  }
}

export function statusCorDot(cor: StatusCor): string {
  switch (cor) {
    case 'ok':      return 'bg-green-500'
    case 'alerta':  return 'bg-blue-500'
    case 'atencao': return 'bg-yellow-500'
    case 'critico': return 'bg-orange-500'
    case 'vencido': return 'bg-red-500'
    default:        return 'bg-gray-400'
  }
}

export function statusCorLabel(cor: StatusCor): string {
  switch (cor) {
    case 'ok':      return 'Em dia'
    case 'alerta':  return 'Atenção (90 dias)'
    case 'atencao': return 'Atenção (60 dias)'
    case 'critico': return 'Crítico (30 dias)'
    case 'vencido': return 'Vencido'
    default:        return 'Sem data'
  }
}

// ── ViaCEP ──────────────────────────────────────────────────

export interface ViaCEPResult {
  logradouro: string
  bairro: string
  localidade: string
  uf: string
  erro?: boolean
}

export async function buscarCEP(cep: string): Promise<ViaCEPResult | null> {
  const digits = cep.replace(/\D/g, '')
  if (digits.length !== 8) return null
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
    const data = await res.json()
    if (data.erro) return null
    return data
  } catch {
    return null
  }
}

// ── Misc ─────────────────────────────────────────────────────

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function diasParaVencer(dataVencimento: string | null | undefined): number | null {
  if (!dataVencimento) return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const venc = new Date(dataVencimento + 'T00:00:00')
  return Math.floor((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
}

export function endereco(empresa: {
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  uf?: string
  cep?: string
}): string {
  const parts = [
    empresa.logradouro,
    empresa.numero ? `nº ${empresa.numero}` : null,
    empresa.complemento,
    empresa.bairro,
    empresa.cidade && empresa.uf ? `${empresa.cidade}/${empresa.uf}` : empresa.cidade,
    empresa.cep ? formatCEP(empresa.cep) : null,
  ].filter(Boolean)
  return parts.join(', ')
}
