-- ============================================================
-- MIGRATION V10 — Registro de comunicações em certidões
-- Execute no Supabase SQL Editor
-- ============================================================

ALTER TABLE public.certidoes ADD COLUMN IF NOT EXISTS comunicado_em   timestamptz;
ALTER TABLE public.certidoes ADD COLUMN IF NOT EXISTS comunicado_para text;
ALTER TABLE public.certidoes ADD COLUMN IF NOT EXISTS comunicado_canal text;
