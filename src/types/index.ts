export type Perfil = 'gestor' | 'operacional'

export interface Profile {
  id: string
  nome: string
  email: string
  perfil: Perfil
  ativo: boolean
  created_at: string
  updated_at: string
}

export type EmpresaStatus = 'ativa' | 'inativa' | 'em_abertura'

export interface Empresa {
  id: string
  codigo: number
  razao_social: string
  nome_fantasia?: string
  cnpj: string
  inscricao_estadual?: string
  inscricao_municipal?: string
  status: EmpresaStatus
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  uf?: string
  url_portal_alvara?: string
  url_certidao_municipal?: string
  url_portal_visa?: string
  responsavel_id?: string
  created_at: string
  updated_at: string
}

export type StatusCor = 'ok' | 'alerta' | 'atencao' | 'critico' | 'vencido' | 'sem_data'

export interface Certidao {
  id: string
  empresa_id: string
  tipo: string
  orgao_emissor: string
  data_emissao?: string
  data_vencimento?: string
  responsavel_id?: string
  observacoes?: string
  arquivo_url?: string
  arquivo_nome?: string
  created_by?: string
  created_at: string
  updated_at: string
  // from view
  razao_social?: string
  cnpj?: string
  uf?: string
  status_cor?: StatusCor
  dias_para_vencer?: number
}

export type TipoAlvara = 'fixo' | 'temporario' | 'provisorio'

export interface Alvara {
  id: string
  empresa_id: string
  tipo: TipoAlvara
  orgao_emissor: string
  numero?: string
  data_emissao?: string
  data_vencimento?: string
  responsavel_id?: string
  observacoes?: string
  arquivo_url?: string
  arquivo_nome?: string
  created_by?: string
  created_at: string
  updated_at: string
  // from view
  razao_social?: string
  cnpj?: string
  status_cor?: StatusCor
  dias_para_vencer?: number
}

export interface AlvaraHistorico {
  id: string
  alvara_id: string
  numero_anterior?: string
  data_vencimento_anterior?: string
  data_renovacao: string
  responsavel_id?: string
  observacoes?: string
  created_at: string
}

export type OrgaoLicenca = 'ANVISA' | 'VISA_MUNICIPAL'

export interface LicencaSanitaria {
  id: string
  empresa_id: string
  orgao: OrgaoLicenca
  numero_licenca?: string
  numero_processo_renovacao?: string
  atividade_sanitaria?: string
  data_emissao?: string
  data_vencimento?: string
  responsavel_id?: string
  observacoes?: string
  arquivo_url?: string
  arquivo_nome?: string
  created_by?: string
  created_at: string
  updated_at: string
  // from view
  razao_social?: string
  cnpj?: string
  status_cor?: StatusCor
  dias_para_vencer?: number
}

export type TipoCertificado = 'A1' | 'A3'
export type UsoCertificado = 'e-CNPJ' | 'e-CPF' | 'NF-e' | 'CT-e' | 'eSocial' | 'outro'

export interface CertificadoDigital {
  id: string
  empresa_id: string
  titular: string
  tipo: TipoCertificado
  uso: UsoCertificado
  autoridade_certificadora: string
  data_emissao?: string
  data_vencimento?: string
  localizacao_fisica?: string
  responsavel_custodia_id?: string
  observacoes?: string
  created_by?: string
  created_at: string
  updated_at: string
  // from view
  razao_social?: string
  cnpj?: string
  status_cor?: StatusCor
  dias_para_vencer?: number
}

export type TipoProcesso =
  | 'abertura'
  | 'alteracao_contratual'
  | 'encerramento'
  | 'transferencia_entrada'
  | 'transferencia_saida'

export type StatusProcesso = 'em_andamento' | 'concluido' | 'cancelado'
export type StatusEtapa = 'pendente' | 'em_andamento' | 'concluido' | 'aguardando_cliente'

export interface ProcessoSocietario {
  id: string
  empresa_id: string
  tipo: TipoProcesso
  titulo?: string
  status: StatusProcesso
  responsavel_id?: string
  data_abertura: string
  data_conclusao?: string
  observacoes?: string
  created_by?: string
  created_at: string
  updated_at: string
  // joined
  razao_social?: string
  etapas?: ProcessoEtapa[]
}

export interface ProcessoEtapa {
  id: string
  processo_id: string
  ordem: number
  nome: string
  status: StatusEtapa
  responsavel_id?: string
  data_conclusao?: string
  observacoes?: string
  updated_at: string
}

export interface ContractTemplate {
  id: string
  nome: string
  descricao?: string
  arquivo_url: string
  arquivo_nome: string
  variaveis?: Record<string, string>
  ativo: boolean
  created_by?: string
  created_at: string
  updated_at: string
}

export interface Contrato {
  id: string
  empresa_id: string
  template_nome: string
  dados_json: Record<string, unknown>
  arquivo_url?: string
  arquivo_nome?: string
  created_by?: string
  created_at: string
}

// SEFAZ URLs por UF
export const SEFAZ_URLS: Record<string, string> = {
  AC: 'https://www1.sefaznet.ac.gov.br',
  AL: 'https://www.sefaz.al.gov.br',
  AM: 'https://www.sefaz.am.gov.br',
  AP: 'https://www.sefaz.ap.gov.br',
  BA: 'https://www.sefaz.ba.gov.br',
  CE: 'https://cav.receita.fazenda.gov.br',
  DF: 'https://www.sefaz.df.gov.br',
  ES: 'https://internet.sefaz.es.gov.br',
  GO: 'https://www.sefaz.go.gov.br',
  MA: 'https://www.sefaz.ma.gov.br',
  MG: 'https://www.fazenda.mg.gov.br',
  MS: 'https://www.fazenda.ms.gov.br',
  MT: 'https://www.sefaz.mt.gov.br',
  PA: 'https://www.sefa.pa.gov.br',
  PB: 'https://www.sefaz.pb.gov.br',
  PE: 'https://www.sefaz.pe.gov.br',
  PI: 'https://www.sefaz.pi.gov.br',
  PR: 'https://www.fazenda.pr.gov.br',
  RJ: 'https://www.fazenda.rj.gov.br',
  RN: 'https://www.set.rn.gov.br',
  RO: 'https://www.sefin.ro.gov.br',
  RR: 'https://www.sefaz.rr.gov.br',
  RS: 'https://www.sefaz.rs.gov.br',
  SC: 'https://www.sef.sc.gov.br',
  SE: 'https://www.sefaz.se.gov.br',
  SP: 'https://www.fazenda.sp.gov.br',
  TO: 'https://www.sefaz.to.gov.br',
}

// Autoridades certificadoras e URLs
export const AC_URLS: Record<string, string> = {
  Serasa: 'https://www.serasacertificadodigital.com.br',
  Certisign: 'https://www.certisign.com.br',
  Valid: 'https://www.validcertificadora.com.br',
  Soluti: 'https://www.soluti.com.br',
  Safeweb: 'https://www.safeweb.com.br',
  VRSafe: 'https://www.vrsafe.com.br',
}

// Labels amigáveis
export const TIPO_PROCESSO_LABELS: Record<TipoProcesso, string> = {
  abertura: 'Abertura de Empresa',
  alteracao_contratual: 'Alteração Contratual',
  encerramento: 'Encerramento',
  transferencia_entrada: 'Transferência de Entrada',
  transferencia_saida: 'Transferência de Saída',
}

export const STATUS_PROCESSO_LABELS: Record<StatusProcesso, string> = {
  em_andamento: 'Em Andamento',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
}

export const STATUS_ETAPA_LABELS: Record<StatusEtapa, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em Andamento',
  concluido: 'Concluído',
  aguardando_cliente: 'Aguardando Cliente',
}
