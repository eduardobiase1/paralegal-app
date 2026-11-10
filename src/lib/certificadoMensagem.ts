// Mensagem enviada à certificadora para emitir o boleto do certificado digital,
// no formato usado pelo escritório. Usada no cadastro e na tela do certificado.

import { formatCNPJ, formatCEP } from '@/lib/utils'

export function ehPessoaFisica(uso?: string | null) {
  return uso === 'e-CPF'
}

// A1 = 1 ano · A3 = 2 anos e 6 meses
export function mesesValidade(tipo?: string | null) {
  return tipo === 'A3' ? 30 : 12
}

export function valorCertificado(tipo?: string | null, uso?: string | null) {
  if (tipo === 'A3') return '450,00'
  if (ehPessoaFisica(uso)) return '159,00'
  return '250,00'
}

export function saudacao(agora: Date = new Date()) {
  return agora.getHours() < 12 ? 'Bom dia' : 'Boa tarde'
}

export function enderecoEmpresa(e: any): string {
  if (!e) return ''
  const linha = [e.logradouro, e.numero].filter(Boolean).join(', ')
  const cidade = [e.cidade || e.municipio, e.uf].filter(Boolean).join('/')
  return [linha, e.complemento, e.bairro, cidade, e.cep ? `CEP ${formatCEP(e.cep)}` : ''].filter(Boolean).join(', ')
}

export function mensagemCertificadora(p: {
  tipo?: string | null
  uso?: string | null
  cnpj?: string | null
  razaoSocial?: string | null
  titular?: string | null
  endereco?: string | null
  email?: string | null
  telefone?: string | null
}): string {
  const pf = ehPessoaFisica(p.uso)
  const linhas = [
    saudacao(),
    '',
    'Por gentileza emitir o boleto:',
    ...(pf
      ? [`NOME: ${(p.titular || '').toUpperCase()}`]
      : [`CNPJ: ${p.cnpj ? formatCNPJ(p.cnpj) : ''}`, `RAZÃO SOCIAL: ${(p.razaoSocial || '').toUpperCase()}`]),
    `End: ${p.endereco || ''}`,
    `email: ${p.email || ''}`,
    `telefone: ${p.telefone || ''}`,
    '',
    `*VALOR ${valorCertificado(p.tipo, p.uso)}*`,
  ]
  return linhas.join('\n')
}
