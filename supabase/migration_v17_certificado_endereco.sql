-- ============================================================
-- MIGRATION V17 — Endereço usado na mensagem para a certificadora
-- Execute no Supabase SQL Editor
-- ============================================================

ALTER TABLE public.certificados_digitais
  ADD COLUMN IF NOT EXISTS endereco_boleto text;
