// Etapas do certificado digital, da venda à emissão. Compartilhado entre a tela de
// Certificados e o Briefing (que mostra os avisos de atraso).

import { diasParaVencer as diasAte } from '@/lib/prazo'

// ── Etapas do processo (da venda à emissão) ──────────────────────────────────
export const ETAPAS = [
  { nome: 'Cliente pagou',                  acao: 'Confirmar pagamento', parado: 'Confirmar pagamento' },
  { nome: 'Dados enviados à certificadora', acao: 'Copiar mensagem',     parado: 'Enviar dados' },
  { nome: 'Boleto recebido',                acao: 'Registrar boleto',    parado: 'Aguardando boleto' },
  { nome: 'Boleto pago',                    acao: 'Marcar boleto pago',  parado: 'Pagar boleto' },
  { nome: 'Voucher emitido',                acao: 'Informar voucher',    parado: 'Emitir voucher' },
  { nome: 'Atendimento agendado',           acao: 'Agendar',             parado: 'Agendar atendimento' },
  { nome: 'Certificado emitido',            acao: 'Marcar emitido',      parado: 'Aguardando atendimento' },
]

export function etapasFeitas(c: any): boolean[] {
  return [
    !!(c.cliente_pagou_em || c.pagamento_confirmado),
    !!c.dados_enviados_em,
    !!c.boleto_recebido_em,
    !!c.boleto_pago_em,
    !!(c.voucher_emitido_em || c.voucher_numero),
    !!c.data_agendamento,
    !!c.certificado_finalizado,
  ]
}
export function etapaAtual(c: any): number {
  const i = etapasFeitas(c).indexOf(false)
  return i === -1 ? 6 : i
}

// Avisos de atraso, em laranja
export function alertaEtapa(c: any, i: number): string {
  const desde = (d?: string | null) => { const x = diasAte(d); return x === null ? null : -x }
  if (i === 1) { const n = desde(c.cliente_pagou_em); if (n !== null && n >= 2) return `Cliente pagou há ${n} dias e os dados ainda não foram enviados` }
  if (i === 3) {
    const n = diasAte(c.boleto_vencimento)
    if (n !== null && n < 0) return `Boleto vencido há ${-n} dia${n === -1 ? '' : 's'}`
    if (n === 0) return 'Boleto vence hoje'
    if (n === 1) return 'Boleto vence amanhã'
    if (n === 2) return 'Boleto vence depois de amanhã'
  }
  if (i === 4) { const n = desde(c.boleto_pago_em); if (n !== null && n >= 2) return `Boleto pago há ${n} dias, voucher ainda não emitido` }
  if (i === 5) { const n = desde(c.voucher_emitido_em); if (n !== null && n >= 3) return `Voucher emitido há ${n} dias sem agendamento` }
  if (i === 6 && c.data_agendamento && new Date(c.data_agendamento).getTime() < Date.now()) return 'O atendimento já passou: o certificado foi emitido?'
  return ''
}
