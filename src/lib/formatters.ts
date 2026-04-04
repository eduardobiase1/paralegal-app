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

/** Formata valor monetário: 10000 → "R$ 10.000,00" */
export function formatarReais(valor: string | number): string {
  const str = String(valor).replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  const num = parseFloat(str)
  if (isNaN(num)) return String(valor)
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
