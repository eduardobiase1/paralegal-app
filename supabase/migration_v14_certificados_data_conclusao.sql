-- ============================================================
-- MIGRATION V14 — Data de conclusão dos certificados digitais
-- Execute no Supabase SQL Editor
-- Usada pelo relatório quinzenal: mostra o que foi concluído em cada quinzena.
-- ============================================================

ALTER TABLE public.certificados_digitais
  ADD COLUMN IF NOT EXISTS data_conclusao date;
