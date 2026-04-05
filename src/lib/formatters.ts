// ─── Data por Extenso ────────────────────────────────────────────────────────

const MESES = [
  'janeiro','fevereiro','março','abril','maio','junho',
  'julho','agosto','setembro','outubro','novembro','dezembro',
]

export function dataExtenso(date: Date = new Date()): string {
  const dia = date.getDate()
  const mes = MESES[date.getMonth()]
  const ano = date.getFullYear()
  return `${dia} de ${mes} de ${ano}`
}

export function dataExtensoCompleto(date: Date = new Date(), cidade = 'São Paulo'): string {
  return `${cidade}, ${dataExtenso(date)}`
}

// ─── Número por Extenso (PT-BR) ───────────────────────────────────────────────

const UNIDADES = [
  '', 'um', 'dois', 'três', 'quatro', 'cinco',
  'seis', 'sete', 'oito', 'nove', 'dez',
  'onze', 'doze', 'treze', 'quatorze', 'quinze',
  'dezesseis', 'dezessete', 'dezoito', 'dezenove',
]

const DEZENAS = [
  '', '', 'vinte', 'trinta', 'quarenta', 'cinquenta',
  'sessenta', 'setenta', 'oitenta', 'noventa',
]

const CENTENAS = [
  '', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos',
  'seiscentos', 'setecentos', 'oitocentos', 'novecentos',
]

function grupoCentena(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cem'

  const c = Math.floor(n / 100)
  const resto = n % 100
  const partes: string[] = []

  if (c > 0) partes.push(CENTENAS[c])

  if (resto > 0) {
    if (resto < 20) {
      partes.push(UNIDADES[resto])
    } else {
      const d = Math.floor(resto / 10)
      const u = resto % 10
      partes.push(DEZENAS[d])
      if (u > 0) partes.push(UNIDADES[u])
    }
  }

  return partes.join(' e ')
}

/** Converte um inteiro positivo para extenso em PT-BR */
export function inteiroExtenso(n: number): string {
  if (n === 0) return 'zero'
  if (n < 0) return 'menos ' + inteiroExtenso(-n)

  const bilhoes  = Math.floor(n / 1_000_000_000)
  const milhoes  = Math.floor((n % 1_000_000_000) / 1_000_000)
  const milhares = Math.floor((n % 1_000_000) / 1_000)
  const resto    = n % 1_000

  const partes: string[] = []

  if (bilhoes > 0)  partes.push(grupoCentena(bilhoes)  + (bilhoes  === 1 ? ' bilhão'  : ' bilhões'))
  if (milhoes > 0)  partes.push(grupoCentena(milhoes)  + (milhoes  === 1 ? ' milhão'  : ' milhões'))
  if (milhares > 0) partes.push(grupoCentena(milhares) + ' mil')
  if (resto > 0)    partes.push(grupoCentena(resto))

  return partes.join(' e ')
}

/**
 * Converte um valor monetário para extenso em PT-BR.
 * Aceita: "10.000,00" | "10000" | 10000 | 10000.50
 * Retorna: "dez mil reais" | "dez mil reais e cinquenta centavos"
 */
export function capitalExtenso(valor: string | number): string {
  const str = String(valor).replace(/\s/g, '')
  // Normaliza: remove pontos de milhar, troca vírgula decimal por ponto
  const normalizado = str.replace(/\./g, '').replace(',', '.')
  const num = parseFloat(normalizado)
  if (isNaN(num) || num < 0) return ''

  const inteiro    = Math.floor(num)
  const centavos   = Math.round((num - inteiro) * 100)

  const partes: string[] = []
  partes.push(inteiroExtenso(inteiro) + (inteiro === 1 ? ' real' : ' reais'))
  if (centavos > 0)
    partes.push(inteiroExtenso(centavos) + (centavos === 1 ? ' centavo' : ' centavos'))

  // Capitalizar primeira letra
  const resultado = partes.join(' e ')
  return resultado.charAt(0).toUpperCase() + resultado.slice(1)
}

// ─── Gênero Automático (PT-BR) ────────────────────────────────────────────────

const FEMININOS: Record<string, string> = {
  'solteiro':    'solteira',
  'casado':      'casada',
  'divorciado':  'divorciada',
  'viúvo':       'viúva',
  'brasileiro':  'brasileira',
  'empresário':  'empresária',
  'o sócio':     'a sócia',
  'portador':    'portadora',
  'domiciliado': 'domiciliada',
  'residente':   'residente',
}

/**
 * Aplica gênero a uma palavra ou frase.
 * Trata casos explícitos e faz fallback: 'o' final → 'a'
 */
export function aplicarGenero(texto: string, genero: 'masculino' | 'feminino'): string {
  if (genero === 'masculino' || !texto) return texto
  const lower = texto.toLowerCase()
  if (FEMININOS[lower]) return FEMININOS[lower]
  // Fallback genérico: termina em 'o' → troca por 'a'
  if (lower.endsWith('o')) return texto.slice(0, -1) + 'a'
  return texto
}

// ─── Motor de Cálculo de Capital Social ──────────────────────────────────────

interface ResultadoCapital {
  quantidade:      number
  quantidade_str:  string   // "1.000"
  quantidade_extenso: string // "Mil quotas"
  valor_quota_str: string   // "R$ 1,00"
  valor_quota_extenso: string // "Um Real"
}

/**
 * Calcula a quantidade de quotas e formata os extensos.
 * capitalStr: "10.000,00" | valorQuotaStr: "1,00"
 */
export function calcularCapitalSocial(capitalStr: string, valorQuotaStr: string): ResultadoCapital {
  const parseBR = (s: string) => parseFloat(s.replace(/\./g,'').replace(',','.')) || 0
  const capital    = parseBR(capitalStr)
  const valorQuota = parseBR(valorQuotaStr) || 1
  const quantidade = Math.round(capital / valorQuota)

  return {
    quantidade,
    quantidade_str:     quantidade.toLocaleString('pt-BR'),
    quantidade_extenso: inteiroExtenso(quantidade) + (quantidade === 1 ? ' quota' : ' quotas'),
    valor_quota_str:    valorQuota.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    valor_quota_extenso:capitalExtenso(valorQuotaStr),
  }
}

// ─── Formatador de Objeto Social (CNAEs) ─────────────────────────────────────

/**
 * Recebe lista de atividades e formata em texto jurídico corrido.
 * Ex: ['Consultoria', 'Comércio varejista'] →
 * "consultoria; comércio varejista. E demais atividades correlatas e complementares."
 */
export function formatarObjetoSocial(atividades: string[]): string {
  const validas = atividades.map(a => a.trim()).filter(Boolean)
  if (validas.length === 0) return ''

  // Normaliza: primeira letra minúscula (exceto siglas), remove ponto final interno
  const normalizadas = validas.map(a => {
    const s = a.replace(/\.$/, '').trim()
    return s.charAt(0).toLowerCase() + s.slice(1)
  })

  let texto: string
  if (normalizadas.length === 1) {
    texto = normalizadas[0]
  } else {
    const ultimas = normalizadas.pop()!
    texto = normalizadas.join('; ') + '; e ' + ultimas
  }

  return texto.charAt(0).toUpperCase() + texto.slice(1) + '.'
}

/** Formata valor monetário: 10000 → "R$ 10.000,00" */
export function formatarReais(valor: string | number): string {
  const str = String(valor).replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  const num = parseFloat(str)
  if (isNaN(num)) return String(valor)
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
