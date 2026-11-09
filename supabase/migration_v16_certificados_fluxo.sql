-- ============================================================
-- MIGRATION V16 — Novo fluxo dos certificados digitais
-- Execute no Supabase SQL Editor
-- Etapas: cliente pagou → dados enviados → boleto recebido → boleto pago
--         → voucher emitido → atendimento agendado → certificado emitido
-- ============================================================

ALTER TABLE public.certificados_digitais
  ADD COLUMN IF NOT EXISTS cliente_pagou_em       date,
  ADD COLUMN IF NOT EXISTS dados_enviados_em      date,
  ADD COLUMN IF NOT EXISTS boleto_recebido_em     date,
  ADD COLUMN IF NOT EXISTS boleto_valor           numeric(10,2),
  ADD COLUMN IF NOT EXISTS boleto_vencimento      date,
  ADD COLUMN IF NOT EXISTS boleto_pago_em         date,
  ADD COLUMN IF NOT EXISTS voucher_numero         text,
  ADD COLUMN IF NOT EXISTS voucher_emitido_em     date,
  ADD COLUMN IF NOT EXISTS agendamento_modalidade text,
  ADD COLUMN IF NOT EXISTS oferta_renovacao_em    date,
  ADD COLUMN IF NOT EXISTS renovacao_de           uuid REFERENCES public.certificados_digitais(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS titular_cpf            text,
  ADD COLUMN IF NOT EXISTS titular_email          text,
  ADD COLUMN IF NOT EXISTS titular_telefone       text,
  ADD COLUMN IF NOT EXISTS data_conclusao         date;   -- já criada na v14; repetida por segurança

-- Modelo da mensagem de oferta de renovação (um por escritório)
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS modelo_oferta_certificado text;
