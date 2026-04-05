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
  /** true = dados fiscais completos vindos do banco; false = apenas descrição IBGE */
  temFiscal?: boolean
}

const L = (licencas: string[]) => licencas
const C: (c: CnaeInfo) => CnaeInfo = c => c

export const CNAES_DB: CnaeInfo[] = [
  // ════════════════════════════════════════════════════════════
  // COMÉRCIO — Anexo I
  // ════════════════════════════════════════════════════════════
  C({ codigo: '4711-3/01', descricao: 'Comércio varejista de mercadorias em geral, com predominância de produtos alimentícios - hipermercados', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Médio', riscoBombeiros: 'Alto', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária', 'Auto de Vistoria Bombeiros (AVCB)']) }),
  C({ codigo: '4712-1/00', descricao: 'Comércio varejista de mercadorias em geral - minimercados, mercearias e armazéns', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Médio', riscoBombeiros: 'Médio', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária']) }),
  C({ codigo: '4721-1/02', descricao: 'Padaria e confeitaria com predominância de revenda', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Alto', riscoBombeiros: 'Médio', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária']) }),
  C({ codigo: '4729-6/99', descricao: 'Comércio varejista de produtos alimentícios em geral', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Médio', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária']) }),
  C({ codigo: '4741-5/00', descricao: 'Comércio varejista de tintas e materiais para pintura', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Médio', riscoBombeiros: 'Alto', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Ambiental']) }),
  C({ codigo: '4742-3/00', descricao: 'Comércio varejista de material elétrico', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Baixo', riscoBombeiros: 'Médio', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '4744-0/01', descricao: 'Comércio varejista de ferragens e ferramentas', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Baixo', riscoBombeiros: 'Médio', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '4744-0/02', descricao: 'Comércio varejista de madeira e artefatos', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Baixo', riscoBombeiros: 'Alto', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Ambiental']) }),
  C({ codigo: '4744-0/05', descricao: 'Comércio varejista de materiais de construção não especificados anteriormente', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Baixo', riscoBombeiros: 'Médio', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '4751-2/01', descricao: 'Comércio varejista especializado de equipamentos e suprimentos de informática', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '4752-1/00', descricao: 'Comércio varejista especializado de equipamentos de telefonia e comunicação', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '4753-9/00', descricao: 'Comércio varejista especializado de eletrodomésticos e equipamentos de áudio e vídeo', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '4754-7/01', descricao: 'Comércio varejista de móveis', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Baixo', riscoBombeiros: 'Médio', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '4757-1/00', descricao: 'Comércio varejista especializado de peças e acessórios para aparelhos eletroeletrônicos', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '4761-0/01', descricao: 'Comércio varejista de livros', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Baixo', riscoBombeiros: 'Médio', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '4762-8/00', descricao: 'Comércio varejista de discos, CDs, DVDs e fitas', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '4763-6/01', descricao: 'Comércio varejista de brinquedos e artigos recreativos', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '4771-7/01', descricao: 'Comércio varejista de produtos farmacêuticos, sem manipulação de fórmulas', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Alto', riscoBombeiros: 'Médio', conselhoClasse: 'CFF/CRF', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária ANVISA/VISA', 'Responsável Técnico (Farmacêutico - CFF)']), observacoes: 'Exige farmacêutico RT — CFF obrigatório' }),
  C({ codigo: '4771-7/02', descricao: 'Comércio varejista de produtos farmacêuticos, com manipulação de fórmulas', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Alto', riscoBombeiros: 'Médio', conselhoClasse: 'CFF/CRF', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária ANVISA/VISA', 'AFE (Autorização de Funcionamento)', 'Responsável Técnico Farmacêutico']), observacoes: 'Farmácia de manipulação exige AFE da ANVISA e RT farmacêutico.' }),
  C({ codigo: '4772-5/00', descricao: 'Comércio varejista de cosméticos, produtos de perfumaria e de higiene pessoal', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Médio', riscoBombeiros: 'Médio', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária (VISA)']) }),
  C({ codigo: '4773-3/00', descricao: 'Comércio varejista de artigos médicos e ortopédicos', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Médio', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária (VISA/ANVISA)']) }),
  C({ codigo: '4774-1/00', descricao: 'Comércio varejista de artigos de óptica', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Médio', riscoBombeiros: 'Baixo', conselhoClasse: 'CBO', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária', 'Responsável Técnico (Optometrista ou Óptico)']) }),
  C({ codigo: '4781-4/00', descricao: 'Comércio varejista de artigos de vestuário e acessórios', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Baixo', riscoBombeiros: 'Médio', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '4782-2/01', descricao: 'Comércio varejista de calçados', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Baixo', riscoBombeiros: 'Médio', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '4789-0/01', descricao: 'Comércio varejista de suvenires, bijuterias e artesanatos', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '4789-0/99', descricao: 'Comércio varejista de outros produtos não especificados anteriormente', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '4512-9/01', descricao: 'Representantes comerciais e agentes do comércio de veículos automotores', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Baixo', riscoBombeiros: 'Médio', licencasObrigatorias: L(['Alvará de Funcionamento', 'Registro DETRAN/RENAVAM']) }),
  C({ codigo: '4520-0/01', descricao: 'Serviços de manutenção e reparação mecânica de veículos automotores', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Médio', riscoBombeiros: 'Alto', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Ambiental (CETESB/INEA)', 'Auto de Vistoria Bombeiros (AVCB)']), observacoes: 'Descarte de óleo e pneus exige licença ambiental' }),
  C({ codigo: '4530-7/01', descricao: 'Comércio por atacado de peças e acessórios novos para veículos automotores', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Baixo', riscoBombeiros: 'Médio', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '4530-7/03', descricao: 'Comércio a varejo de peças e acessórios novos para veículos automotores', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Baixo', riscoBombeiros: 'Médio', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '4541-2/01', descricao: 'Comércio por atacado de motocicletas e motonetas', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Baixo', riscoBombeiros: 'Médio', licencasObrigatorias: L(['Alvará de Funcionamento', 'Registro DETRAN']) }),

  // ════════════════════════════════════════════════════════════
  // ALIMENTAÇÃO — Anexo I
  // ════════════════════════════════════════════════════════════
  C({ codigo: '5611-2/01', descricao: 'Restaurantes e similares', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Alto', riscoBombeiros: 'Alto', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária', 'Auto de Vistoria Bombeiros (AVCB)']) }),
  C({ codigo: '5611-2/03', descricao: 'Lanchonetes, casas de chá, de sucos e similares', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Alto', riscoBombeiros: 'Médio', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária']) }),
  C({ codigo: '5612-1/00', descricao: 'Serviços ambulantes de alimentação', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Alto', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária', 'Licença para ambulante (Prefeitura)']) }),
  C({ codigo: '5620-1/01', descricao: 'Fornecimento de alimentos preparados preponderantemente para empresas (catering)', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Alto', riscoBombeiros: 'Médio', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária']) }),
  C({ codigo: '5620-1/02', descricao: 'Serviços de alimentação para eventos e recepções - bufê', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Alto', riscoBombeiros: 'Médio', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária']) }),

  // ════════════════════════════════════════════════════════════
  // INDÚSTRIA — Anexo II
  // ════════════════════════════════════════════════════════════
  C({ codigo: '1091-1/01', descricao: 'Fabricação de produtos de panificação industrial', anexoSimples: 'II', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'industria', riscoVigilancia: 'Alto', riscoBombeiros: 'Alto', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária ANVISA', 'Auto de Vistoria Bombeiros (AVCB)', 'Licença Ambiental']) }),
  C({ codigo: '1099-6/01', descricao: 'Fabricação de vinagres', anexoSimples: 'II', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'industria', riscoVigilancia: 'Médio', riscoBombeiros: 'Médio', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária', 'Registro MAPA']) }),
  C({ codigo: '1412-6/01', descricao: 'Confecção de peças do vestuário, exceto roupas íntimas e as confeccionadas sob medida', anexoSimples: 'II', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'industria', riscoVigilancia: 'Baixo', riscoBombeiros: 'Médio', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Ambiental (efluentes)']) }),
  C({ codigo: '2512-8/00', descricao: 'Fabricação de esquadrias de metal', anexoSimples: 'II', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'industria', riscoVigilancia: 'Baixo', riscoBombeiros: 'Alto', licencasObrigatorias: L(['Alvará de Funcionamento', 'Auto de Vistoria Bombeiros (AVCB)', 'Licença Ambiental (CETESB)']) }),
  C({ codigo: '3101-2/00', descricao: 'Fabricação de móveis com predominância de madeira', anexoSimples: 'II', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'industria', riscoVigilancia: 'Baixo', riscoBombeiros: 'Alto', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Ambiental', 'Auto de Vistoria Bombeiros (AVCB)']) }),

  // ════════════════════════════════════════════════════════════
  // SERVIÇOS ADMINISTRATIVOS E DE APOIO — Anexo III
  // ════════════════════════════════════════════════════════════
  C({ codigo: '8211-3/00', descricao: 'Serviços combinados de escritório e apoio administrativo', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']), observacoes: 'BPO administrativo, secretariado, recepção, gestão de documentos etc.' }),
  C({ codigo: '8219-9/01', descricao: 'Fotocópias', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '8219-9/99', descricao: 'Preparação de documentos e serviços especializados de apoio administrativo', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '8220-2/00', descricao: 'Atividades de teleatendimento (call center)', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento', 'Registro Anatel (se houver telecomunicação)']) }),
  C({ codigo: '8230-0/01', descricao: 'Serviços de organização de feiras, congressos, exposições e festas', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Médio', licencasObrigatorias: L(['Alvará de Funcionamento', 'Autorização por evento (Prefeitura)']) }),
  C({ codigo: '8291-1/00', descricao: 'Atividades de cobranças e informações cadastrais', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento', 'Registro BACEN (se crédito)']) }),
  C({ codigo: '8292-0/00', descricao: 'Envasamento e empacotamento sob contrato', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Médio', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '8299-7/07', descricao: 'Salas de acesso à internet', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '8299-7/99', descricao: 'Outras atividades de serviços prestados principalmente às empresas', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),

  // ════════════════════════════════════════════════════════════
  // TECNOLOGIA DA INFORMAÇÃO — Anexo III / V (Fator R)
  // ════════════════════════════════════════════════════════════
  C({ codigo: '6201-5/01', descricao: 'Desenvolvimento de programas de computador sob encomenda', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']), observacoes: 'Fator R: folha ≥ 28% do faturamento → Anexo III; abaixo → Anexo V' }),
  C({ codigo: '6201-5/02', descricao: 'Web design', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '6202-3/00', descricao: 'Desenvolvimento e licenciamento de programas de computador customizáveis', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '6203-1/00', descricao: 'Desenvolvimento e licenciamento de programas de computador não customizáveis', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '6204-0/00', descricao: 'Consultoria em tecnologia da informação', anexoSimples: 'V', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']), observacoes: 'Fator R aplicável — folha ≥ 28% migra para Anexo III.' }),
  C({ codigo: '6209-1/00', descricao: 'Suporte técnico, manutenção e outros serviços em tecnologia da informação', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '6311-9/00', descricao: 'Tratamento de dados, provedores de serviços de aplicação e serviços de hospedagem na internet', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '6319-4/00', descricao: 'Portais, provedores de conteúdo e outros serviços de informação na internet', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),

  // ════════════════════════════════════════════════════════════
  // CONTABILIDADE E JURÍDICO
  // ════════════════════════════════════════════════════════════
  C({ codigo: '6911-7/01', descricao: 'Serviços advocatícios', anexoSimples: 'IV', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', conselhoClasse: 'OAB', licencasObrigatorias: L(['Alvará de Funcionamento', 'Registro OAB']), observacoes: 'Sociedade de advogados recolhe INSS patronal separado (Anexo IV).' }),
  C({ codigo: '6911-7/02', descricao: 'Atividades auxiliares da justiça', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '6912-5/00', descricao: 'Cartórios', anexoSimples: 'impedido', impedidoSimples: true, motivoImpedimento: 'Serviços notariais e de registro são delegados pelo poder público — vedados ao Simples Nacional', fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Delegação pelo Poder Judiciário']) }),
  C({ codigo: '6920-6/01', descricao: 'Atividades de contabilidade', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', conselhoClasse: 'CFC/CRC', licencasObrigatorias: L(['Alvará de Funcionamento', 'Registro CRC']), observacoes: 'Exige contador RT registrado no CRC.' }),
  C({ codigo: '6920-6/02', descricao: 'Atividades de consultoria e auditoria contábil e tributária', anexoSimples: 'V', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', conselhoClasse: 'CFC/CRC', licencasObrigatorias: L(['Alvará de Funcionamento', 'Registro CRC']), observacoes: 'Auditoria enquadrada no Anexo V. Fator R aplicável.' }),

  // ════════════════════════════════════════════════════════════
  // CONSULTORIA E GESTÃO — Anexo V (Fator R)
  // ════════════════════════════════════════════════════════════
  C({ codigo: '7020-4/00', descricao: 'Atividades de consultoria em gestão empresarial, exceto consultoria técnica específica', anexoSimples: 'V', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']), observacoes: 'Fator R: folha ≥ 28% migra para Anexo III.' }),
  C({ codigo: '7111-1/00', descricao: 'Serviços de arquitetura', anexoSimples: 'V', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', conselhoClasse: 'CAU', licencasObrigatorias: L(['Alvará de Funcionamento', 'Registro CAU']), observacoes: 'Exige RT com registro no CAU e RRT (Registro de Responsabilidade Técnica).' }),
  C({ codigo: '7112-0/00', descricao: 'Atividades de engenharia', anexoSimples: 'V', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', conselhoClasse: 'CREA', licencasObrigatorias: L(['Alvará de Funcionamento', 'Registro CREA']), observacoes: 'Exige RT com ART no CREA.' }),
  C({ codigo: '7119-7/01', descricao: 'Serviços de cartografia, topografia e geodésia', anexoSimples: 'V', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', conselhoClasse: 'CREA', licencasObrigatorias: L(['Alvará de Funcionamento', 'Registro CREA']) }),
  C({ codigo: '7119-7/03', descricao: 'Serviços de desenho técnico relacionados à arquitetura e engenharia', anexoSimples: 'V', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '7119-7/99', descricao: 'Atividades técnicas relacionadas à engenharia e arquitetura não especificadas', anexoSimples: 'V', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),

  // ════════════════════════════════════════════════════════════
  // PUBLICIDADE E MARKETING
  // ════════════════════════════════════════════════════════════
  C({ codigo: '7311-4/00', descricao: 'Agências de publicidade', anexoSimples: 'V', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']), observacoes: 'Fator R: folha ≥ 28% do faturamento → Anexo III.' }),
  C({ codigo: '7312-2/00', descricao: 'Agenciamento de espaços para publicidade, exceto em veículos de comunicação', anexoSimples: 'V', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '7319-0/02', descricao: 'Promoção de vendas', anexoSimples: 'V', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '7319-0/04', descricao: 'Criação de estandes para feiras e exposições', anexoSimples: 'V', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '7319-0/99', descricao: 'Outras atividades de publicidade não especificadas', anexoSimples: 'V', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '7340-4/99', descricao: 'Outros serviços de preparação e impressão de material gráfico', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Médio', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Ambiental (solventes)']) }),
  C({ codigo: '7410-2/01', descricao: 'Design', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '7410-2/02', descricao: 'Design de interiores', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '7420-0/01', descricao: 'Atividades de produção de fotografias, exceto aérea e submarina', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),

  // ════════════════════════════════════════════════════════════
  // SAÚDE
  // ════════════════════════════════════════════════════════════
  C({ codigo: '8610-1/01', descricao: 'Atividades de atendimento hospitalar, exceto pronto-socorro e unidades para atendimento a urgências', anexoSimples: 'V', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Alto', riscoBombeiros: 'Alto', conselhoClasse: 'CRM', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária (ANVISA/VISA)', 'Auto de Vistoria Bombeiros (AVCB)', 'Registro no CNES (Ministério da Saúde)']), observacoes: 'Alta complexidade regulatória. Exige RT médico, CNES e múltiplas licenças sanitárias.' }),
  C({ codigo: '8630-5/01', descricao: 'Atividade médica ambulatorial com recursos para realização de procedimentos cirúrgicos', anexoSimples: 'V', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Alto', riscoBombeiros: 'Alto', conselhoClasse: 'CRM', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária (VISA/ANVISA)', 'Auto de Vistoria Bombeiros (AVCB)', 'Registro CNES', 'Registro CRM']), observacoes: 'Exige RT médico (CRM). Alta exigência sanitária.' }),
  C({ codigo: '8630-5/02', descricao: 'Atividade médica ambulatorial sem recursos para realização de procedimentos cirúrgicos', anexoSimples: 'V', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Médio', riscoBombeiros: 'Baixo', conselhoClasse: 'CRM', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária', 'Registro CNES', 'Registro CRM']) }),
  C({ codigo: '8630-5/03', descricao: 'Atividade médica ambulatorial restrita a consultas', anexoSimples: 'V', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', conselhoClasse: 'CRM', licencasObrigatorias: L(['Alvará de Funcionamento', 'Registro CRM']) }),
  C({ codigo: '8630-5/04', descricao: 'Atividade odontológica', anexoSimples: 'V', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Alto', riscoBombeiros: 'Médio', conselhoClasse: 'CFO/CRO', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária', 'Registro CRO', 'Alvará Sanitário Municipal']), observacoes: 'Exige RT com registro no CRO.' }),
  C({ codigo: '8630-5/06', descricao: 'Serviços de vacinação e imunização humana', anexoSimples: 'V', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Alto', riscoBombeiros: 'Baixo', conselhoClasse: 'CRM/CRF', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária (VISA)', 'Autorização ANVISA']) }),
  C({ codigo: '8630-5/07', descricao: 'Atividades de psicologia e psicanálise', anexoSimples: 'V', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', conselhoClasse: 'CFP/CRP', licencasObrigatorias: L(['Alvará de Funcionamento', 'Registro CRP']) }),
  C({ codigo: '8640-2/01', descricao: 'Laboratórios de anatomia patológica e citológica', anexoSimples: 'V', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Alto', riscoBombeiros: 'Médio', conselhoClasse: 'CRM', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária ANVISA', 'Registro CNES']) }),
  C({ codigo: '8640-2/02', descricao: 'Laboratórios clínicos', anexoSimples: 'V', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Alto', riscoBombeiros: 'Médio', conselhoClasse: 'CRF/CRM', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária ANVISA/VISA', 'Registro CNES', 'RT Farmacêutico ou Médico']) }),
  C({ codigo: '8640-2/03', descricao: 'Serviços de diálise e nefrologia', anexoSimples: 'V', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Alto', riscoBombeiros: 'Alto', conselhoClasse: 'CRM', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária ANVISA', 'Auto de Vistoria Bombeiros (AVCB)', 'Registro CNES']) }),
  C({ codigo: '8650-0/01', descricao: 'Atividades de enfermagem', anexoSimples: 'V', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Médio', riscoBombeiros: 'Baixo', conselhoClasse: 'COFEN/COREN', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária', 'Registro COREN']) }),
  C({ codigo: '8650-0/02', descricao: 'Atividades de profissionais da nutrição', anexoSimples: 'V', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', conselhoClasse: 'CFN/CRN', licencasObrigatorias: L(['Alvará de Funcionamento', 'Registro CRN']) }),
  C({ codigo: '8650-0/03', descricao: 'Atividades de psicomotricidade', anexoSimples: 'V', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '8650-0/04', descricao: 'Atividades de fisioterapia', anexoSimples: 'V', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Médio', riscoBombeiros: 'Baixo', conselhoClasse: 'COFFITO/CREFITO', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária', 'Registro CREFITO']) }),
  C({ codigo: '8650-0/05', descricao: 'Atividades de terapia ocupacional', anexoSimples: 'V', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', conselhoClasse: 'COFFITO/CREFITO', licencasObrigatorias: L(['Alvará de Funcionamento', 'Registro CREFITO']) }),
  C({ codigo: '8650-0/06', descricao: 'Atividades de fonoaudiologia', anexoSimples: 'V', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', conselhoClasse: 'CFFA/CRFA', licencasObrigatorias: L(['Alvará de Funcionamento', 'Registro CRFA']) }),
  C({ codigo: '8660-7/00', descricao: 'Atividades de apoio à gestão de saúde', anexoSimples: 'V', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),

  // ════════════════════════════════════════════════════════════
  // CONSTRUÇÃO CIVIL — Anexo IV
  // ════════════════════════════════════════════════════════════
  C({ codigo: '4110-7/00', descricao: 'Incorporação de empreendimentos imobiliários', anexoSimples: 'IV', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', conselhoClasse: 'CREA/CAU', licencasObrigatorias: L(['Registro no CRECI', 'Registro de Incorporação (Cartório)', 'Licença Prefeitura']) }),
  C({ codigo: '4120-4/00', descricao: 'Construção de edifícios', anexoSimples: 'IV', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', conselhoClasse: 'CREA/CAU', licencasObrigatorias: L(['Alvará de Funcionamento', 'Registro CREA ou CAU', 'Licença para construção (Prefeitura)']), observacoes: 'Recolhe INSS patronal separado (Anexo IV). Exige RT com CREA ou CAU.' }),
  C({ codigo: '4211-1/01', descricao: 'Construção de rodovias e ferrovias', anexoSimples: 'IV', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', conselhoClasse: 'CREA', licencasObrigatorias: L(['Alvará de Funcionamento', 'Registro CREA', 'Licença Ambiental']) }),
  C({ codigo: '4291-0/00', descricao: 'Obras portuárias, marítimas e fluviais', anexoSimples: 'IV', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', conselhoClasse: 'CREA', licencasObrigatorias: L(['Alvará de Funcionamento', 'Registro CREA', 'Licença Ambiental', 'Autorização ANTAQ']) }),
  C({ codigo: '4311-8/01', descricao: 'Demolição de edifícios e outras estruturas', anexoSimples: 'IV', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Médio', conselhoClasse: 'CREA', licencasObrigatorias: L(['Alvará de Funcionamento', 'Registro CREA', 'ART (CREA)']) }),
  C({ codigo: '4313-4/00', descricao: 'Obras de terraplanagem', anexoSimples: 'IV', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', conselhoClasse: 'CREA', licencasObrigatorias: L(['Alvará de Funcionamento', 'Registro CREA', 'Licença Ambiental (se alteração do solo)']) }),
  C({ codigo: '4321-5/00', descricao: 'Instalação e manutenção elétrica', anexoSimples: 'IV', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', conselhoClasse: 'CREA', licencasObrigatorias: L(['Alvará de Funcionamento', 'Registro CREA']) }),
  C({ codigo: '4322-3/01', descricao: 'Instalações hidráulicas, sanitárias e de gás', anexoSimples: 'IV', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', conselhoClasse: 'CREA', licencasObrigatorias: L(['Alvará de Funcionamento', 'Registro CREA']) }),
  C({ codigo: '4330-4/02', descricao: 'Instalação de portas, janelas, tetos, divisórias e armários embutidos de qualquer material', anexoSimples: 'IV', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '4330-4/03', descricao: 'Obras de acabamento em gessaria e estuque', anexoSimples: 'IV', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '4391-6/00', descricao: 'Obras de fundações', anexoSimples: 'IV', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', conselhoClasse: 'CREA', licencasObrigatorias: L(['Alvará de Funcionamento', 'Registro CREA']) }),
  C({ codigo: '4399-1/03', descricao: 'Obras de alvenaria', anexoSimples: 'IV', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),

  // ════════════════════════════════════════════════════════════
  // EDUCAÇÃO — Anexo III
  // ════════════════════════════════════════════════════════════
  C({ codigo: '8511-2/00', descricao: 'Educação infantil - creches', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Médio', riscoBombeiros: 'Médio', licencasObrigatorias: L(['Alvará de Funcionamento', 'Autorização Secretaria de Educação', 'Licença Sanitária']) }),
  C({ codigo: '8512-1/00', descricao: 'Educação infantil - pré-escolas', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Médio', riscoBombeiros: 'Médio', licencasObrigatorias: L(['Alvará de Funcionamento', 'Autorização Secretaria de Educação']) }),
  C({ codigo: '8513-9/00', descricao: 'Ensino fundamental', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Médio', licencasObrigatorias: L(['Alvará de Funcionamento', 'Autorização Secretaria de Educação', 'Auto de Vistoria Bombeiros (AVCB)']) }),
  C({ codigo: '8520-1/00', descricao: 'Ensino médio', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Médio', licencasObrigatorias: L(['Alvará de Funcionamento', 'Autorização Secretaria de Educação', 'Auto de Vistoria Bombeiros (AVCB)']) }),
  C({ codigo: '8531-7/00', descricao: 'Educação superior - graduação', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Médio', licencasObrigatorias: L(['Autorização MEC', 'Auto de Vistoria Bombeiros (AVCB)']) }),
  C({ codigo: '8541-4/00', descricao: 'Educação profissional de nível técnico', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Médio', licencasObrigatorias: L(['Alvará de Funcionamento', 'Autorização Secretaria de Educação']) }),
  C({ codigo: '8542-2/00', descricao: 'Educação profissional de nível tecnológico', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Médio', licencasObrigatorias: L(['Alvará de Funcionamento', 'Autorização MEC']) }),
  C({ codigo: '8591-1/00', descricao: 'Ensino de esportes', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '8592-9/01', descricao: 'Ensino de dança', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '8592-9/02', descricao: 'Ensino de artes cênicas, exceto dança', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '8592-9/03', descricao: 'Ensino de música', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '8593-7/00', descricao: 'Ensino de idiomas', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '8599-6/01', descricao: 'Formação de condutores', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento', 'Autorização DETRAN (CFC)']) }),
  C({ codigo: '8599-6/04', descricao: 'Treinamento em desenvolvimento profissional e gerencial', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '8599-6/99', descricao: 'Outras atividades de ensino não especificadas', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),

  // ════════════════════════════════════════════════════════════
  // BELEZA E ESTÉTICA
  // ════════════════════════════════════════════════════════════
  C({ codigo: '9602-5/01', descricao: 'Cabeleireiros, manicure e pedicure', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Médio', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária']) }),
  C({ codigo: '9602-5/02', descricao: 'Atividades de estética e outros serviços de cuidados com a beleza', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Alto', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária (VISA)', 'Responsável Técnico (Biomédico ou Enfermeiro)']), observacoes: 'Procedimentos estéticos invasivos exigem RT habilitado.' }),
  C({ codigo: '9609-2/03', descricao: 'Aluguel de fantasias e figurinos', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),

  // ════════════════════════════════════════════════════════════
  // TRANSPORTE
  // ════════════════════════════════════════════════════════════
  C({ codigo: '4921-3/01', descricao: 'Transporte rodoviário coletivo de passageiros, com itinerário fixo, municipal', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento', 'Concessão ou Permissão Municipal/ANTT']) }),
  C({ codigo: '4923-0/01', descricao: 'Serviço de táxi', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Municipal (Prefeitura)', 'TACOGRAFO (se aplicável)']) }),
  C({ codigo: '4929-9/02', descricao: 'Serviços de transporte particular por fretamento', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento', 'Autorização ANTT']) }),
  C({ codigo: '4930-2/01', descricao: 'Transporte rodoviário de carga, exceto produtos perigosos e mudanças, municipal', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento', 'Registro ANTT (RNTRC)']) }),
  C({ codigo: '4930-2/02', descricao: 'Transporte rodoviário de carga, exceto produtos perigosos e mudanças, intermunicipal, interestadual e internacional', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento', 'Registro ANTT (RNTRC)']) }),
  C({ codigo: '5310-5/01', descricao: 'Atividades do Correio Nacional', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Autorização ANATEL/CORREIOS']) }),
  C({ codigo: '5320-2/01', descricao: 'Serviços de malote não realizados pelo Correio Nacional', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '5320-2/02', descricao: 'Serviços de entrega rápida', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),

  // ════════════════════════════════════════════════════════════
  // IMÓVEIS E CORRETAGEM
  // ════════════════════════════════════════════════════════════
  C({ codigo: '6810-2/01', descricao: 'Compra e venda de imóveis próprios', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '6821-8/01', descricao: 'Corretagem na compra e venda e avaliação de imóveis', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', conselhoClasse: 'COFECI/CRECI', licencasObrigatorias: L(['Alvará de Funcionamento', 'Registro CRECI']), observacoes: 'Corretor deve ter registro no CRECI.' }),
  C({ codigo: '6821-8/02', descricao: 'Corretagem no aluguel de imóveis', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', conselhoClasse: 'COFECI/CRECI', licencasObrigatorias: L(['Alvará de Funcionamento', 'Registro CRECI']) }),
  C({ codigo: '6822-6/00', descricao: 'Gestão e administração da propriedade imobiliária', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),

  // ════════════════════════════════════════════════════════════
  // SEGURANÇA — Anexo IV
  // ════════════════════════════════════════════════════════════
  C({ codigo: '8011-1/01', descricao: 'Atividades de vigilância e segurança privada', anexoSimples: 'IV', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento', 'Autorização Polícia Federal (DPF)', 'Certificado de Segurança']), observacoes: 'Exige autorização da Polícia Federal. INSS patronal recolhido separado.' }),
  C({ codigo: '8012-9/00', descricao: 'Atividades de transporte de valores', anexoSimples: 'IV', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Autorização Polícia Federal (DPF)', 'Autorização BACEN (se houver processamento de valores)']) }),
  C({ codigo: '8020-0/00', descricao: 'Atividades de monitoramento de sistemas de segurança eletrônica', anexoSimples: 'IV', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento', 'Autorização Polícia Federal (se vigilância)']) }),

  // ════════════════════════════════════════════════════════════
  // FINANÇAS E SEGUROS (impedidos / especiais)
  // ════════════════════════════════════════════════════════════
  C({ codigo: '6422-1/00', descricao: 'Bancos múltiplos, com carteira comercial', anexoSimples: 'impedido', impedidoSimples: true, motivoImpedimento: 'Instituições financeiras são vedadas ao Simples Nacional (art. 17, XI, LC 123/2006)', fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Autorização BACEN']) }),
  C({ codigo: '6436-1/00', descricao: 'Sociedades de crédito, financiamento e investimento (financeiras)', anexoSimples: 'impedido', impedidoSimples: true, motivoImpedimento: 'Instituições financeiras vedadas ao Simples Nacional', fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Autorização BACEN']) }),
  C({ codigo: '6450-6/00', descricao: 'Sociedades de capitalização', anexoSimples: 'impedido', impedidoSimples: true, motivoImpedimento: 'Vedado ao Simples Nacional (art. 17 LC 123/2006)', fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Autorização SUSEP']) }),
  C({ codigo: '6511-1/01', descricao: 'Seguros de vida', anexoSimples: 'impedido', impedidoSimples: true, motivoImpedimento: 'Seguradoras são vedadas ao Simples Nacional', fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Autorização SUSEP']) }),
  C({ codigo: '6621-5/01', descricao: 'Peritos e avaliadores de seguros', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento', 'Registro SUSEP (corretor)']) }),
  C({ codigo: '6622-3/00', descricao: 'Corretores e agentes de seguros, de planos de previdência complementar e de saúde', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento', 'Habilitação SUSEP']) }),

  // ════════════════════════════════════════════════════════════
  // OUTROS SERVIÇOS
  // ════════════════════════════════════════════════════════════
  C({ codigo: '7490-1/04', descricao: 'Atividades de intermediação e agenciamento de serviços e negócios em geral', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '7490-1/05', descricao: 'Agenciamento de profissionais para atividades esportivas, culturais e artísticas', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '7500-1/00', descricao: 'Atividades veterinárias', anexoSimples: 'V', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Médio', riscoBombeiros: 'Baixo', conselhoClasse: 'CFMV/CRMV', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária', 'Registro CRMV']), observacoes: 'Exige médico veterinário RT inscrito no CRMV.' }),
  C({ codigo: '9001-9/01', descricao: 'Produção teatral', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Médio', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença por evento']) }),
  C({ codigo: '9200-3/01', descricao: 'Casas de bingo', anexoSimples: 'impedido', impedidoSimples: true, motivoImpedimento: 'Jogos de azar são vedados ao Simples Nacional (art. 17 LC 123/2006)', fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Alto', licencasObrigatorias: L(['Autorização SEAE/MF']) }),
  C({ codigo: '9311-5/00', descricao: 'Gestão de instalações de esportes', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Médio', licencasObrigatorias: L(['Alvará de Funcionamento', 'Auto de Vistoria Bombeiros (AVCB, se lotação > 50 pessoas)']) }),
  C({ codigo: '9313-1/00', descricao: 'Atividades de condicionamento físico (academias)', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Médio', licencasObrigatorias: L(['Alvará de Funcionamento', 'Auto de Vistoria Bombeiros (AVCB)']) }),
  C({ codigo: '9601-7/01', descricao: 'Lavanderias', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Médio', riscoBombeiros: 'Médio', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Ambiental (efluentes)']) }),
  C({ codigo: '9609-2/99', descricao: 'Outras atividades de serviços pessoais não especificadas', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '9700-5/00', descricao: 'Serviços domésticos', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),

  // ════════════════════════════════════════════════════════════
  // ALIMENTAÇÃO — VAREJO COMPLEMENTAR
  // ════════════════════════════════════════════════════════════
  C({ codigo: '4721-1/04', descricao: 'Sorveteiros e gelaterias', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Alto', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária']) }),
  C({ codigo: '4722-9/01', descricao: 'Comércio varejista de carnes - açougues', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Alto', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária (VISA/SIF)', 'Registro SIF/SIE/SIM (Inspeção Sanitária)']), observacoes: 'Exige Serviço de Inspeção (federal SIF, estadual SIE ou municipal SIM).' }),
  C({ codigo: '4722-9/02', descricao: 'Peixaria', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Alto', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária', 'Registro MAPA/SIF']) }),
  C({ codigo: '4724-5/00', descricao: 'Comércio varejista de hortifrutigranjeiros', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Médio', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária']) }),
  C({ codigo: '4725-3/00', descricao: 'Comércio varejista de bebidas', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Médio', riscoBombeiros: 'Alto', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária', 'Auto de Vistoria Bombeiros (AVCB)']), observacoes: 'Bebidas alcoólicas exigem registro no MAPA.' }),
  C({ codigo: '4729-6/01', descricao: 'Tabacaria', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento', 'Registro ANVISA (fumo)']) }),
  C({ codigo: '4731-8/00', descricao: 'Comércio varejista de combustíveis para veículos automotores', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Alto', riscoBombeiros: 'Alto', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Ambiental (IBAMA/CETESB)', 'Auto de Vistoria Bombeiros (AVCB)', 'Autorização ANP', 'Licença de Instalação e Operação']), observacoes: 'Posto de gasolina: alta regulação ANP, ambiental e de bombeiros.' }),
  C({ codigo: '4732-6/00', descricao: 'Comércio varejista de lubrificantes', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Médio', riscoBombeiros: 'Alto', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Ambiental', 'Auto de Vistoria Bombeiros (AVCB)']) }),
  C({ codigo: '4637-1/07', descricao: 'Comércio atacadista de chocolates, balas, bombons e semelhantes', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Médio', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária']) }),

  // ════════════════════════════════════════════════════════════
  // PET SHOP E VETERINÁRIO
  // ════════════════════════════════════════════════════════════
  C({ codigo: '4789-0/04', descricao: 'Comércio varejista de animais vivos e de artigos e alimentos para animais de estimação', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Médio', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária', 'Registro MAPA (se venda de medicamentos veterinários)']), observacoes: 'Pet shop com banho/tosa: verificar licença adicional junto à VISA municipal.' }),

  // ════════════════════════════════════════════════════════════
  // HOSPEDAGEM
  // ════════════════════════════════════════════════════════════
  C({ codigo: '5510-8/01', descricao: 'Hotéis', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Médio', riscoBombeiros: 'Alto', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária', 'Auto de Vistoria Bombeiros (AVCB)', 'Cadastro Ministério do Turismo (Cadastur)']), observacoes: 'Cadastur obrigatório para hotéis.' }),
  C({ codigo: '5510-8/02', descricao: 'Apart-hotéis', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Médio', riscoBombeiros: 'Alto', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária', 'Auto de Vistoria Bombeiros (AVCB)', 'Cadastur']) }),
  C({ codigo: '5590-6/01', descricao: 'Albergues, exceto assistenciais (pousadas, hostel)', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Médio', licencasObrigatorias: L(['Alvará de Funcionamento', 'Auto de Vistoria Bombeiros (AVCB)', 'Cadastur']), observacoes: 'Inclui pousadas e hostels. Cadastur obrigatório.' }),
  C({ codigo: '5590-6/02', descricao: 'Campings', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Ambiental', 'Cadastur']) }),

  // ════════════════════════════════════════════════════════════
  // LIMPEZA, CONSERVAÇÃO E PAISAGISMO
  // ════════════════════════════════════════════════════════════
  C({ codigo: '8121-4/00', descricao: 'Limpeza em prédios e em domicílios', anexoSimples: 'IV', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']), observacoes: 'Serviços de limpeza: INSS patronal recolhido separado (Anexo IV).' }),
  C({ codigo: '8122-2/00', descricao: 'Imunização e controle de pragas urbanas (dedetização)', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Alto', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária (VISA)', 'Registro ANVISA', 'Responsável Técnico habilitado']), observacoes: 'Exige RT habilitado e registro na ANVISA/VISA.' }),
  C({ codigo: '8129-0/00', descricao: 'Atividades de limpeza não especificadas anteriormente', anexoSimples: 'IV', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '8130-3/00', descricao: 'Atividades paisagísticas (jardinagem)', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']), observacoes: 'Uso de agrotóxicos pode exigir licença ambiental.' }),

  // ════════════════════════════════════════════════════════════
  // TURISMO E VIAGENS
  // ════════════════════════════════════════════════════════════
  C({ codigo: '7911-2/00', descricao: 'Agências de viagens', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento', 'Cadastur (Ministério do Turismo)', 'Registro MTUR']), observacoes: 'Cadastur obrigatório para agências de viagem.' }),
  C({ codigo: '7912-1/00', descricao: 'Operadores turísticos', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento', 'Cadastur', 'Registro MTUR']) }),
  C({ codigo: '7990-2/00', descricao: 'Serviços de reservas e outros serviços de turismo', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento', 'Cadastur']) }),

  // ════════════════════════════════════════════════════════════
  // REPRESENTAÇÃO COMERCIAL E ATACADO
  // ════════════════════════════════════════════════════════════
  C({ codigo: '4612-5/00', descricao: 'Representantes comerciais e agentes do comércio de insumos agropecuários, químicos e farmacêuticos', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento', 'Registro CORE (Conselho de Representantes Comerciais)']), observacoes: 'Representante comercial: registro obrigatório no CORE.' }),
  C({ codigo: '4619-2/00', descricao: 'Representantes comerciais e agentes do comércio de mercadorias em geral', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', conselhoClasse: 'CORE', licencasObrigatorias: L(['Alvará de Funcionamento', 'Registro CORE']), observacoes: 'Registro no CORE obrigatório pela Lei 4.886/65.' }),
  C({ codigo: '4635-4/99', descricao: 'Comércio atacadista de bebidas não especificadas anteriormente', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Médio', riscoBombeiros: 'Médio', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária', 'Registro MAPA (se bebidas alcoólicas)']) }),
  C({ codigo: '4691-5/00', descricao: 'Comércio atacadista de mercadorias em geral, com predominância de produtos alimentícios', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Médio', riscoBombeiros: 'Médio', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária']) }),

  // ════════════════════════════════════════════════════════════
  // MANUTENÇÃO E REPARAÇÃO
  // ════════════════════════════════════════════════════════════
  C({ codigo: '9511-8/00', descricao: 'Reparação e manutenção de computadores e de equipamentos periféricos', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '9512-6/00', descricao: 'Reparação e manutenção de equipamentos de comunicação (celulares)', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '9521-5/00', descricao: 'Reparação e manutenção de equipamentos eletroeletrônicos de uso pessoal e doméstico', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '9529-1/01', descricao: 'Reparação de calçados, bolsas e artigos de couro (sapateiro)', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '9529-1/02', descricao: 'Chaveiros', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '9529-1/05', descricao: 'Reparação de artigos do mobiliário', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '9529-1/99', descricao: 'Reparação e manutenção de outros objetos e equipamentos pessoais e domésticos', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),

  // ════════════════════════════════════════════════════════════
  // VEÍCULOS — ESTACIONAMENTO, LOCAÇÃO E BORRACHARIA
  // ════════════════════════════════════════════════════════════
  C({ codigo: '4520-0/07', descricao: 'Serviços de borracharia para veículos automotores', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Médio', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Ambiental (descarte de pneus — RECICLANIP)']) }),
  C({ codigo: '5223-1/00', descricao: 'Estacionamento de veículos', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Médio', licencasObrigatorias: L(['Alvará de Funcionamento', 'Auto de Vistoria Bombeiros (AVCB)']) }),
  C({ codigo: '7711-0/00', descricao: 'Locação de automóveis sem condutor', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento', 'Autorização DETRAN/DENATRAN']) }),
  C({ codigo: '7719-5/99', descricao: 'Locação de outros meios de transporte não especificados anteriormente', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),

  // ════════════════════════════════════════════════════════════
  // GRÁFICA E IMPRESSÃO
  // ════════════════════════════════════════════════════════════
  C({ codigo: '1813-0/01', descricao: 'Impressão de material para uso publicitário', anexoSimples: 'II', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'industria', riscoVigilancia: 'Baixo', riscoBombeiros: 'Médio', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Ambiental (solventes/tintas)']), observacoes: 'Gráfica industrial — Anexo II. Descarte de resíduos químicos exige licença ambiental.' }),
  C({ codigo: '1821-1/00', descricao: 'Serviços de pré-impressão', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '1822-9/01', descricao: 'Serviços de encadernação e plastificação', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),

  // ════════════════════════════════════════════════════════════
  // SAÚDE — RESIDÊNCIAS E CUIDADOS ESPECIAIS
  // ════════════════════════════════════════════════════════════
  C({ codigo: '8621-6/01', descricao: 'UTI móvel', anexoSimples: 'V', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Alto', riscoBombeiros: 'Baixo', conselhoClasse: 'CRM/COFEN', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária ANVISA', 'Habilitação SAMU/SESA', 'Registro CNES']) }),
  C({ codigo: '8711-5/01', descricao: 'Clínicas e residências geriátricas (casa de repouso)', anexoSimples: 'V', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Alto', riscoBombeiros: 'Alto', conselhoClasse: 'CRM/COREN', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária (VISA)', 'Auto de Vistoria Bombeiros (AVCB)', 'Registro CNES', 'Registro no Ministério da Saúde']), observacoes: 'Alta exigência sanitária e de bombeiros. Exige RT médico ou enfermeiro.' }),
  C({ codigo: '8711-5/02', descricao: 'Instituições de longa permanência para idosos (ILPI)', anexoSimples: 'V', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Alto', riscoBombeiros: 'Alto', conselhoClasse: 'CRM/COREN', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária', 'Auto de Vistoria Bombeiros (AVCB)', 'Registro CNES', 'Alvará da Vigilância Sanitária']) }),
  C({ codigo: '8720-4/01', descricao: 'Atividades de centros de assistência psicossocial (CAPS)', anexoSimples: 'V', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Médio', riscoBombeiros: 'Médio', conselhoClasse: 'CRM/CFP', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária', 'Registro CNES']) }),
  C({ codigo: '8720-4/99', descricao: 'Atividades de assistência psicossocial e à saúde a portadores de distúrbios psíquicos, deficiência mental e dependência química não especificadas', anexoSimples: 'V', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Médio', riscoBombeiros: 'Médio', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária', 'Registro CNES']), observacoes: 'Inclui clínicas de recuperação de dependentes químicos.' }),

  // ════════════════════════════════════════════════════════════
  // SERVIÇOS PESSOAIS ADICIONAIS
  // ════════════════════════════════════════════════════════════
  C({ codigo: '9609-2/02', descricao: 'Tatuagem e colocação de piercing', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Alto', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária (VISA)']), observacoes: 'Vigilância Sanitária classifica como risco alto. Exige esterilização e biossegurança.' }),
  C({ codigo: '9603-3/01', descricao: 'Gestão e manutenção de cemitérios', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Médio', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Ambiental', 'Autorização Prefeitura']) }),
  C({ codigo: '9603-3/02', descricao: 'Serviços de cremação', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Médio', riscoBombeiros: 'Alto', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Ambiental', 'Autorização Vigilância Sanitária', 'Auto de Vistoria Bombeiros (AVCB)']) }),
  C({ codigo: '9603-3/04', descricao: 'Serviços de funerárias', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Alto', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária (VISA)', 'Autorização SUSEP (se plano funeral)']), observacoes: 'Tanatopraxia exige autorização específica da Vigilância Sanitária.' }),
  C({ codigo: '9609-2/06', descricao: 'Serviços de sauna e banhos', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Médio', riscoBombeiros: 'Médio', licencasObrigatorias: L(['Alvará de Funcionamento', 'Licença Sanitária']) }),

  // ════════════════════════════════════════════════════════════
  // PLANOS DE SAÚDE E FINANCEIRO (impedidos)
  // ════════════════════════════════════════════════════════════
  C({ codigo: '6530-8/00', descricao: 'Planos de saúde (operadoras)', anexoSimples: 'impedido', impedidoSimples: true, motivoImpedimento: 'Operadoras de planos de saúde são vedadas ao Simples Nacional (art. 17, XI, LC 123/2006)', fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Autorização ANS (Agência Nacional de Saúde Suplementar)']) }),
  C({ codigo: '6499-3/01', descricao: 'Clubes de investimento', anexoSimples: 'impedido', impedidoSimples: true, motivoImpedimento: 'Atividades financeiras de gestão de recursos de terceiros são vedadas ao Simples Nacional', fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Autorização CVM']) }),
  C({ codigo: '6640-1/00', descricao: 'Planos de saúde — resseguro', anexoSimples: 'impedido', impedidoSimples: true, motivoImpedimento: 'Resseguradoras vedadas ao Simples Nacional', fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Autorização SUSEP']) }),

  // ════════════════════════════════════════════════════════════
  // CONSTRUÇÃO CIVIL — COMPLEMENTARES
  // ════════════════════════════════════════════════════════════
  C({ codigo: '4330-4/01', descricao: 'Impermeabilização em obras de engenharia civil', anexoSimples: 'IV', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento', 'Registro CREA']) }),
  C({ codigo: '4330-4/04', descricao: 'Serviços de pintura de edifícios em geral', anexoSimples: 'IV', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '4330-4/05', descricao: 'Aplicação de revestimentos e de resinas em interiores e exteriores', anexoSimples: 'IV', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '4399-1/01', descricao: 'Administração de obras', anexoSimples: 'IV', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', conselhoClasse: 'CREA/CAU', licencasObrigatorias: L(['Alvará de Funcionamento', 'Registro CREA ou CAU']) }),
  C({ codigo: '4399-1/99', descricao: 'Serviços especializados para construção não especificados anteriormente', anexoSimples: 'IV', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),

  // ════════════════════════════════════════════════════════════
  // AGRONEGÓCIO E PRODUÇÃO RURAL
  // ════════════════════════════════════════════════════════════
  C({ codigo: '0111-3/01', descricao: 'Cultivo de arroz', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Inscrição Estadual Rural', 'Licença Ambiental (se irrigação)']), observacoes: 'Produtor rural pode optar pelo Simples Nacional como PJ.' }),
  C({ codigo: '0151-2/02', descricao: 'Criação de bovinos para corte', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Inscrição Estadual Rural', 'Licença Ambiental (IBAMA/SEMA)', 'Registro MAPA']) }),
  C({ codigo: '0155-5/01', descricao: 'Criação de frangos para corte', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Médio', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Inscrição Estadual Rural', 'Licença Ambiental', 'Registro MAPA']) }),
  C({ codigo: '0220-9/06', descricao: 'Conservação de florestas nativas', anexoSimples: 'I', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'comercio', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Licença IBAMA/ICMBio', 'Inscrição CAR (Cadastro Ambiental Rural)']) }),

  // ════════════════════════════════════════════════════════════
  // COMUNICAÇÃO E MÍDIA
  // ════════════════════════════════════════════════════════════
  C({ codigo: '6010-1/00', descricao: 'Atividades de rádio', anexoSimples: 'III', impedidoSimples: false, fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Concessão ANATEL (Ministério das Comunicações)']), observacoes: 'Rádio exige outorga do governo federal.' }),
  C({ codigo: '6021-7/00', descricao: 'Atividades de televisão aberta', anexoSimples: 'impedido', impedidoSimples: true, motivoImpedimento: 'Emissoras de TV aberta com concessão pública são vedadas ao Simples Nacional', fatorRAplicavel: false, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Concessão ANATEL']) }),
  C({ codigo: '7319-0/03', descricao: 'Marketing direto', anexoSimples: 'V', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']) }),
  C({ codigo: '7490-1/99', descricao: 'Outras atividades profissionais, científicas e técnicas não especificadas anteriormente (despachante, tradutor, etc.)', anexoSimples: 'V', impedidoSimples: false, fatorRAplicavel: true, tipoAtividade: 'servico', riscoVigilancia: 'Baixo', riscoBombeiros: 'Baixo', licencasObrigatorias: L(['Alvará de Funcionamento']), observacoes: 'Inclui despachantes, tradutores juramentados e similares.' }),
]

// ─── Busca de CNAE ────────────────────────────────────────────────────────────

export function buscarCnae(query: string): CnaeInfo[] {
  const q = query.toLowerCase().trim()
  if (!q) return []
  // Normaliza o código buscado: remove traços, barras e pontos para comparação
  // Ex: "82113", "8211-3", "8211-3/00" → "821130"
  const qNorm = q.replace(/[-/.]/g, '')
  return CNAES_DB.filter(c => {
    const codigoNorm = c.codigo.replace(/[-/.]/g, '').toLowerCase()
    return (
      codigoNorm.includes(qNorm) ||
      c.codigo.toLowerCase().includes(q) ||
      c.descricao.toLowerCase().includes(q) ||
      (c.conselhoClasse ?? '').toLowerCase().includes(q)
    )
  }).slice(0, 15)
}

// ─── Busca assíncrona via Supabase (1.300+ CNAEs do IBGE) ────────────────────
// Chama a função RPC `search_cnaes` que faz JOIN com cnae_fiscal.
// Fallback automático para buscarCnae() (local) se o banco não estiver disponível.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function buscarCnaeDB(query: string, supabase: any): Promise<CnaeInfo[]> {
  if (!query || query.trim().length < 2) return []

  try {
    const { data, error } = await supabase.rpc('search_cnaes', {
      p_query: query.trim(),
      p_limit: 15,
    })

    if (error || !data || (data as unknown[]).length === 0) {
      // Fallback para base local
      return buscarCnae(query)
    }

    return (data as Array<{
      codigo: string
      descricao: string
      anexo_simples: string | null
      impedido_simples: boolean
      motivo_impedimento: string | null
      fator_r_aplicavel: boolean
      tipo_atividade: string | null
      risco_vigilancia: string | null
      risco_bombeiros: string | null
      conselho_classe: string | null
      licencas: string[] | null
      observacoes: string | null
      tem_fiscal: boolean
    }>).map(row => ({
      codigo:               row.codigo,
      descricao:            row.descricao,
      anexoSimples:         (row.anexo_simples ?? 'III') as Anexo | 'impedido',
      impedidoSimples:      row.impedido_simples ?? false,
      motivoImpedimento:    row.motivo_impedimento ?? undefined,
      fatorRAplicavel:      row.fator_r_aplicavel ?? false,
      tipoAtividade:        (row.tipo_atividade ?? 'servico') as 'comercio' | 'servico' | 'industria',
      riscoVigilancia:      (row.risco_vigilancia ?? 'Baixo') as RiscoVigilancia,
      riscoBombeiros:       (row.risco_bombeiros  ?? 'Baixo') as RiscoBombeiros,
      conselhoClasse:       row.conselho_classe ?? undefined,
      licencasObrigatorias: row.licencas ?? [],
      observacoes:          row.observacoes ?? undefined,
      temFiscal:            row.tem_fiscal ?? false,
    }))
  } catch {
    // Se houver qualquer erro de rede/RPC, usa a base local como fallback
    return buscarCnae(query)
  }
}

// ─── Helpers de formatação ────────────────────────────────────────────────────

export function formatarMoeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatarPorcentagem(v: number, decimais = 2): string {
  return v.toFixed(decimais) + '%'
}
