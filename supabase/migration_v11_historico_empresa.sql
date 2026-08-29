-- ============================================================
-- MIGRATION V11 — Histórico & Caixa Postal por empresa
-- Execute no Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.historico_empresa (
  id          uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id      uuid         NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  empresa_id  uuid         NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo        text         NOT NULL,
  descricao   text         NOT NULL,
  canal       text,
  criado_em   timestamptz  DEFAULT now() NOT NULL,
  criado_por  text
);

CREATE INDEX IF NOT EXISTS historico_empresa_empresa_idx ON public.historico_empresa(empresa_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS historico_empresa_org_idx    ON public.historico_empresa(org_id);

ALTER TABLE public.historico_empresa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members select historico"
  ON public.historico_empresa FOR SELECT
  USING (org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "org members insert historico"
  ON public.historico_empresa FOR INSERT
  WITH CHECK (org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "org members delete historico"
  ON public.historico_empresa FOR DELETE
  USING (org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid()));
