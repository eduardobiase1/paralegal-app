// ─── Simples Nacional — Tabelas 2024 ─────────────────────────────────────────
// Fonte: Lei Complementar 123/2006, Resolução CGSN 140/2018

export interface FaixaSimples {
  de: number        // receita bruta anual mínima
  ate: number       // receita bruta anual máxima
  aliquota: number  // alíquota nominal (%)
  deducao: number   // parcela a deduzir (R$)
}

export type Anexo = 'I' | 'II' | 'III' | 'IV' | 'V'

export const TABELAS_SIMPLES: Record<Anexo, { nome: string; descricao: string; faixas: FaixaSimples[] }> = {
  I: {
    nome: 'Anexo I — Comércio',
    descricao: 'Comércio em geral (varejista e atacadista)',
    faixas: [
      { de: 0,         ate: 180000,   aliquota: 4.00,  deducao: 0        },
      { de: 180000.01, ate: 360000,   aliquota: 7.30,  deducao: 5940     },
      { de: 360000.01, ate: 720000,   aliquota: 9.50,  deducao: 13860    },
      { de: 720000.01, ate: 1800000,  aliquota: 10.70, deducao: 22500    },
      { de: 1800000.01,ate: 3600000,  aliquota: 14.30, deducao: 87300    },
      { de: 3600000.01,ate: 4800000,  aliquota: 19.00, deducao: 378000   },
    ],
  },
  II: {
    nome: 'Anexo II — Indústria',
    descricao: 'Indústria em geral (fabricação e transformação)',
    faixas: [
      { de: 0,         ate: 180000,   aliquota: 4.50,  deducao: 0        },
      { de: 180000.01, ate: 360000,   aliquota: 7.80,  deducao: 5940     },
      { de: 360000.01, ate: 720000,   aliquota: 10.00, deducao: 13860    },
      { de: 720000.01, ate: 1800000,  aliquota: 11.20, deducao: 22500    },
      { de: 1800000.01,ate: 3600000,  aliquota: 14.70, deducao: 85500    },
      { de: 3600000.01,ate: 4800000,  aliquota: 30.00, deducao: 720000   },
    ],
  },
  III: {
    nome: 'Anexo III — Serviços (com CPP)',
    descricao: 'Serviços com incidência de CPP — agências de viagem, TI, academias, contabilidade, etc.',
    faixas: [
      { de: 0,         ate: 180000,   aliquota: 6.00,  deducao: 0        },
      { de: 180000.01, ate: 360000,   aliquota: 11.20, deducao: 9360     },
      { de: 360000.01, ate: 720000,   aliquota: 13.50, deducao: 17640    },
      { de: 720000.01, ate: 1800000,  aliquota: 16.00, deducao: 35640    },
      { de: 1800000.01,ate: 3600000,  aliquota: 21.00, deducao: 125640   },
      { de: 3600000.01,ate: 4800000,  aliquota: 33.00, deducao: 648000   },
    ],
  },
  IV: {
    nome: 'Anexo IV — Serviços (sem CPP)',
    descricao: 'Construção civil, vigilância, limpeza, advocacia — recolhe INSS patronal separado',
    faixas: [
      { de: 0,         ate: 180000,   aliquota: 4.50,  deducao: 0        },
      { de: 180000.01, ate: 360000,   aliquota: 9.00,  deducao: 8100     },
      { de: 360000.01, ate: 720000,   aliquota: 10.20, deducao: 12420    },
      { de: 720000.01, ate: 1800000,  aliquota: 14.00, deducao: 39780    },
      { de: 1800000.01,ate: 3600000,  aliquota: 22.00, deducao: 183780   },
      { de: 3600000.01,ate: 4800000,  aliquota: 33.00, deducao: 828000   },
    ],
  },
  V: {
    nome: 'Anexo V — Serviços (alta especialização)',
    descricao: 'Auditoria, medicina, engenharia, advocacia societária, publicidade, etc.',
    faixas: [
      { de: 0,         ate: 180000,   aliquota: 15.50, deducao: 0        },
      { de: 180000.01, ate: 360000,   aliquota: 18.00, deducao: 4500     },
      { de: 360000.01, ate: 720000,   aliquota: 19.50, deducao: 9900     },
      { de: 720000.01, ate: 1800000,  aliquota: 20.50, deducao: 17100    },
      { de: 1800000.01,ate: 3600000,  aliquota: 23.00, deducao: 62100    },
      { de: 3600000.01,ate: 4800000,  aliquota: 30.50, deducao: 540000   },
    ],
  },
}

// ─── Cálculo de alíquota efetiva ──────────────────────────────────────────────

export function calcularAliquotaEfetiva(rbt12: number, anexo: Anexo): {
  faixa: FaixaSimples | null
  aliquotaNominal: number
  aliquotaEfetiva: number
  impostoMensal: number
  impostoAnual: number
} {
  if (rbt12 <= 0) return { faixa: null, aliquotaNominal: 0, aliquotaEfetiva: 0, impostoMensal: 0, impostoAnual: 0 }

  const tabela = TABELAS_SIMPLES[anexo]
  const faixa = tabela.faixas.find(f => rbt12 >= f.de && rbt12 <= f.ate) ?? tabela.faixas[tabela.faixas.length - 1]

  const aliquotaEfetiva = ((rbt12 * (faixa.aliquota / 100)) - faixa.deducao) / rbt12
  const impostoAnual = rbt12 * aliquotaEfetiva
  const impostoMensal = impostoAnual / 12

  return {
    faixa,
    aliquotaNominal: faixa.aliquota,
    aliquotaEfetiva: aliquotaEfetiva * 100,
    impostoMensal,
    impostoAnual,
  }
}

// ─── Fator R ──────────────────────────────────────────────────────────────────
// Fator R = Folha de Pagamento (12 meses) / Receita Bruta (12 meses)
// Se Fator R >= 28% → Anexo III (mais barato)
// Se Fator R < 28%  → Anexo V  (mais caro)

export function calcularFatorR(folha12: number, rbt12: number): {
  fatorR: number
  anexoAplicavel: 'III' | 'V'
  diferenca: number       // quanto falta ou sobra para atingir 28%
  folhaNecessaria: number // folha mínima para chegar no Anexo III
  economia: number        // economia anual se migrar para III
} {
  if (rbt12 <= 0) return { fatorR: 0, anexoAplicavel: 'V', diferenca: -0.28, folhaNecessaria: 0, economia: 0 }

  const fatorR = folha12 / rbt12
  const anexoAplicavel = fatorR >= 0.28 ? 'III' : 'V'
  const diferenca = fatorR - 0.28
  const folhaNecessaria = rbt12 * 0.28

  const iii = calcularAliquotaEfetiva(rbt12, 'III')
  const v   = calcularAliquotaEfetiva(rbt12, 'V')
  const economia = v.impostoAnual - iii.impostoAnual

  return { fatorR: fatorR * 100, anexoAplicavel, diferenca: diferenca * 100, folhaNecessaria, economia }
}

// ─── Lucro Presumido ──────────────────────────────────────────────────────────

export interface ResultadoLucroPresumido {
  irpj: number
  csll: number
  pis: number
  cofins: number
  iss: number
  cpp: number    // INSS patronal 20%
  total: number
  aliquotaEfetiva: number
}

export function calcularLucroPresumido(
  receitaMensal: number,
  tipoAtividade: 'comercio' | 'servico' | 'industria',
  aliquotaIss = 3
): ResultadoLucroPresumido {
  // Percentuais de presunção IRPJ
  const presuncaoIrpj = tipoAtividade === 'comercio' ? 0.08 : tipoAtividade === 'industria' ? 0.08 : 0.32
  // Percentuais de presunção CSLL
  const presuncaoCsll = tipoAtividade === 'servico' ? 0.32 : 0.12

  const irpj   = receitaMensal * presuncaoIrpj  * 0.15
  const csll   = receitaMensal * presuncaoCsll  * 0.09
  const pis    = receitaMensal * 0.0065
  const cofins = receitaMensal * 0.03
  const iss    = tipoAtividade === 'servico' ? receitaMensal * (aliquotaIss / 100) : 0
  const cpp    = tipoAtividade !== 'comercio' ? receitaMensal * 0.20 : receitaMensal * 0.20 // INSS patronal

  const total = irpj + csll + pis + cofins + iss + cpp
  const aliquotaEfetiva = (total / receitaMensal) * 100

  return { irpj, csll, pis, cofins, iss, cpp, total, aliquotaEfetiva }
}

// ─── Base de CNAEs ────────────────────────────────────────────────────────────

export type RiscoVigilancia = 'Baixo' | 'Médio' | 'Alto'
export type RiscoBombeiros  = 'Baixo' | 'Médio' | 'Alto'

export interface CnaeInfo {
  codigo: string
  descricao: string
  anexoSimples: Anexo | 'impedido'
  impedidoSimples: boolean
  motivoImpedimento?: string
  fatorRAplicavel: boolean     // true = pode migrar entre III e V
  tipoAtividade: 'comercio' | 'servico' | 'industria'
  riscoVigilancia: RiscoVigilancia
  riscoBombeiros: RiscoBombeiros
  conselhoClasse?: string      // CRM, CREA, CFC, OAB, etc.
  licencasObrigatorias: string[]
  observacoes?: string
}

export const CNAES_DB: CnaeInfo[] = [
  // ── Comércio ──
  { codigo: '4711-3/01', descricao: 'Comércio varejista de mercadorias em geral, com predominância de produtos alimentícios - hipermercados', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Médio', riscoBombeiros: 'Alto', licencasObrigatorias: ['Alvará de Funcionamento', 'Licença Sanitária', 'Auto de Vistoria Bombeiros (AVCB)'] },
  { codigo: '4712-1/00', descricao: 'Comércio varejista de mercadorias em geral, com predominância de produtos alimentícios - minimercados, mercearias e armazéns', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Médio', riscoBombeiros: 'Médio', licencasObrigatorias: ['Alvará de Funcionamento', 'Licença Sanitária'] },
  { codigo: '4761-0/01', descricao: 'Comércio varejista de livros', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Baixo', riscoBombeiros: 'Médio', licencasObrigatorias: ['Alvará de Funcionamento'] },
  { codigo: '4771-7/01', descricao: 'Comércio varejista de produtos farmacêuticos, sem manipulação de fórmulas', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Alto', riscoBombeiros: 'Médio', licencasObrigatorias: ['Alvará de Funcionamento', 'Licença Sanitária ANVISA/VISA', 'Responsável Técnico (Farmacêutico - CFF)'], observacoes: 'Exige farmacêutico RT — CFF obrigatório' },
  { codigo: '4781-4/00', descricao: 'Comércio varejista de artigos de vestuário e acessórios', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Baixo', riscoBombeiros: 'Médio', licencasObrigatorias: ['Alvará de Funcionamento'] },
  { codigo: '4520-0/01', descricao: 'Serviços de manutenção e reparação mecânica de veículos automotores', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Médio', riscoBombeiros: 'Alto', licencasObrigatorias: ['Alvará de Funcionamento', 'Licença Ambiental (CETESB/INEA)', 'Auto de Vistoria Bombeiros (AVCB)'], observacoes: 'Descarte de óleo e pneus exige licença ambiental' },

  // ── Alimentação ──
  { codigo: '5611-2/01', descricao: 'Restaurantes e similares', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Alto', riscoBombeiros: 'Alto', licencasObrigatorias: ['Alvará de Funcionamento', 'Licença Sanitária', 'Auto de Vistoria Bombeiros (AVCB)', 'Licença Ambiental (se houver emissão de fumaça)'] },
  { codigo: '5611-2/03', descricao: 'Lanchonetes, casas de chá, de sucos e similares', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Alto', riscoBombeiros: 'Médio', licencasObrigatorias: ['Alvará de Funcionamento', 'Licença Sanitária'] },

  // ── Indústria ──
  { codigo: '1091-1/01', descricao: 'Fabricação de produtos de panificação industrial', anexoSimples: 'II', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'industria', riscoVigilancia: 'Alto', riscoBombeiros: 'Alto', licencasObrigatorias: ['Alvará de Funcionamento', 'Licença Sanitária ANVISA', 'Auto de Vistoria Bombeiros (AVCB)', 'Licença Ambiental'] },
  { codigo: '2512-8/00', descricao: 'Fabricação de esquadrias de metal', anexoSimples: 'II', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'industria', riscoVigilancia: 'Baixo', riscoBombeiros: 'Alto', licencasObrigatorias: ['Alvará de Funcionamento', 'Auto de Vistoria Bombeiros (AVCB)', 'Licença Ambiental (CETESB)'] },

  // ── Serviços — Anexo III ──
  { codigo: '6201-5/01', descricao: 'Desenvolvimento de programas de computador sob encomenda', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: ['Alvará de Funcionamento'], observacoes: 'Fator R aplicável: folha ≥ 28% do faturamento migra do Anexo V para III' },
  { codigo: '6202-3/00', descricao: 'Desenvolvimento e licenciamento de programas de computador customizáveis', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: ['Alvará de Funcionamento'] },
  { codigo: '6911-7/01', descricao: 'Serviços advocatícios', anexoSimples: 'IV', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', conselhoClasse: 'OAB', licencasObrigatorias: ['Alvará de Funcionamento', 'Registro OAB'], observacoes: 'Sociedade de advogados recolhe INSS patronal separado (Anexo IV). Exige inscrição na OAB.' },
  { codigo: '6920-6/01', descricao: 'Atividades de contabilidade', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', conselhoClasse: 'CFC/CRC', licencasObrigatorias: ['Alvará de Funcionamento', 'Registro CRC'], observacoes: 'Exige contador RT registrado no CRC.' },
  { codigo: '7410-2/02', descricao: 'Design de interiores', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: ['Alvará de Funcionamento'] },
  { codigo: '7311-4/00', descricao: 'Agências de publicidade', anexoSimples: 'V', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: ['Alvará de Funcionamento'], observacoes: 'Fator R: se folha ≥ 28% do faturamento, tributa pelo Anexo III.' },
  { codigo: '8011-1/01', descricao: 'Atividades de vigilância e segurança privada', anexoSimples: 'IV', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: ['Alvará de Funcionamento', 'Autorização POLICIA FEDERAL (DPF)', 'Certificado de Segurança'], observacoes: 'Exige autorização da Polícia Federal. INSS patronal recolhido separado.' },

  // ── Saúde ──
  { codigo: '8630-5/01', descricao: 'Atividade médica ambulatorial com recursos para realização de procedimentos cirúrgicos', anexoSimples: 'V', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Alto', riscoBombeiros: 'Alto', conselhoClasse: 'CRM', licencasObrigatorias: ['Alvará de Funcionamento', 'Licença Sanitária (VISA/ANVISA)', 'Auto de Vistoria Bombeiros (AVCB)', 'Alvará Sanitário Municipal', 'Registro CRM'], observacoes: 'Exige responsável técnico médico (CRM). Alta exigência sanitária.' },
  { codigo: '8630-5/04', descricao: 'Atividade odontológica', anexoSimples: 'V', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Alto', riscoBombeiros: 'Médio', conselhoClasse: 'CFO/CRO', licencasObrigatorias: ['Alvará de Funcionamento', 'Licença Sanitária', 'Registro CRO', 'Alvará Sanitário Municipal'], observacoes: 'Exige RT com registro no CRO.' },
  { codigo: '8650-0/04', descricao: 'Atividades de fisioterapia', anexoSimples: 'V', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Médio', riscoBombeiros: 'Baixo', conselhoClasse: 'COFFITO/CREFITO', licencasObrigatorias: ['Alvará de Funcionamento', 'Licença Sanitária', 'Registro CREFITO'] },
  { codigo: '8630-5/07', descricao: 'Atividades de psicologia e psicanálise', anexoSimples: 'V', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', conselhoClasse: 'CFP/CRP', licencasObrigatorias: ['Alvará de Funcionamento', 'Registro CRP'] },

  // ── Engenharia / Construção ──
  { codigo: '7112-0/00', descricao: 'Atividades de engenharia', anexoSimples: 'V', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', conselhoClasse: 'CREA/CFE', licencasObrigatorias: ['Alvará de Funcionamento', 'Registro CREA'], observacoes: 'Exige RT com Anotação de Responsabilidade Técnica (ART) no CREA.' },
  { codigo: '4120-4/00', descricao: 'Construção de edifícios', anexoSimples: 'IV', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', conselhoClasse: 'CREA/CAU', licencasObrigatorias: ['Alvará de Funcionamento', 'Registro CREA ou CAU', 'Licença para construção (Prefeitura)'], observacoes: 'Recolhe INSS patronal separado (Anexo IV). Exige RT com CREA ou CAU.' },
  { codigo: '4321-5/00', descricao: 'Instalação e manutenção elétrica', anexoSimples: 'IV', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', conselhoClasse: 'CREA', licencasObrigatorias: ['Alvará de Funcionamento', 'Registro CREA'] },

  // ── Educação ──
  { codigo: '8511-2/00', descricao: 'Educação infantil - creches', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Médio', riscoBombeiros: 'Médio', licencasObrigatorias: ['Alvará de Funcionamento', 'Autorização Secretaria de Educação', 'Licença Sanitária'] },
  { codigo: '8599-6/04', descricao: 'Treinamento em desenvolvimento profissional e gerencial', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: ['Alvará de Funcionamento'] },

  // ── Finanças (impedidos) ──
  { codigo: '6422-1/00', descricao: 'Bancos múltiplos, com carteira comercial', anexoSimples: 'impedido', impedidoSimples: true, motivoImpedimento: 'Instituições financeiras são vedadas ao Simples Nacional (art. 17, XI, LC 123/2006)', fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: ['Autorização BACEN'] },
  { codigo: '6436-1/00', descricao: 'Sociedades de crédito, financiamento e investimento', anexoSimples: 'impedido', impedidoSimples: true, motivoImpedimento: 'Instituições financeiras vedadas ao Simples Nacional', fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: ['Autorização BACEN'] },

  // ── Beleza / Estética ──
  { codigo: '9602-5/01', descricao: 'Cabeleireiros, manicure e pedicure', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Médio', riscoBombeiros: 'Baixo', licencasObrigatorias: ['Alvará de Funcionamento', 'Licença Sanitária'] },
  { codigo: '9602-5/02', descricao: 'Atividades de estética e outros serviços de cuidados com a beleza', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Alto', riscoBombeiros: 'Baixo', licencasObrigatorias: ['Alvará de Funcionamento', 'Licença Sanitária (VISA)', 'Responsável Técnico (Biomédico ou Enfermeiro)'], observacoes: 'Procedimentos estéticos invasivos exigem RT habilitado.' },

  // ── Transporte ──
  { codigo: '4930-2/01', descricao: 'Transporte rodoviário de carga, exceto produtos perigosos e mudanças, municipal', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: ['Alvará de Funcionamento', 'Registro ANTT (RNTRC)'] },
  { codigo: '4921-3/01', descricao: 'Transporte rodoviário coletivo de passageiros, com itinerário fixo, municipal', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: ['Alvará de Funcionamento', 'Concessão ou Permissão Municipal/ANTT'] },

  // ── Imóveis ──
  { codigo: '6821-8/01', descricao: 'Corretagem na compra e venda e avaliação de imóveis', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', conselhoClasse: 'COFECI/CRECI', licencasObrigatorias: ['Alvará de Funcionamento', 'Registro CRECI'], observacoes: 'Corretor deve ter registro no CRECI.' },

  // ── Agronegócio ──
  { codigo: '0111-3/01', descricao: 'Cultivo de arroz', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: ['Inscrição Estadual Rural', 'CAR (Cadastro Ambiental Rural)'] },
]

// ─── Busca de CNAE ────────────────────────────────────────────────────────────

export function buscarCnae(query: string): CnaeInfo[] {
  const q = query.toLowerCase().trim()
  if (!q) return []
  return CNAES_DB.filter(c =>
    c.codigo.includes(q) ||
    c.descricao.toLowerCase().includes(q) ||
    (c.conselhoClasse ?? '').toLowerCase().includes(q)
  ).slice(0, 10)
}

// ─── Helpers de formatação ────────────────────────────────────────────────────

export function formatarMoeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatarPorcentagem(v: number, decimais = 2): string {
  return v.toFixed(decimais) + '%'
}
