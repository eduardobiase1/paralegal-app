-- ============================================================
-- MIGRATION V12 — Registro de Atividades (Produtividade) no banco
-- Execute no Supabase SQL Editor
-- Antes desta migration os registros ficavam só no navegador
-- (localStorage). Ao abrir a tela depois de rodar este SQL, os
-- registros locais são enviados para o banco automaticamente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.produtividade_entradas (
  id          uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id      uuid         NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id     uuid         NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  usuario     text,
  data        date         NOT NULL,
  tipo        text         NOT NULL,
  empresa     text,
  descricao   text         NOT NULL,
  duracao     integer      NOT NULL DEFAULT 0,
  criado_em   timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS produtividade_entradas_org_idx ON public.produtividade_entradas(org_id, data DESC);

ALTER TABLE public.produtividade_entradas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members select produtividade" ON public.produtividade_entradas;
DROP POLICY IF EXISTS "own insert produtividade"         ON public.produtividade_entradas;
DROP POLICY IF EXISTS "own delete produtividade"         ON public.produtividade_entradas;

-- Todos da organização enxergam os registros da equipe
CREATE POLICY "org members select produtividade"
  ON public.produtividade_entradas FOR SELECT
  USING (org_id IN (SELECT get_my_org_ids()));

-- Cada um só registra em seu próprio nome
CREATE POLICY "own insert produtividade"
  ON public.produtividade_entradas FOR INSERT
  WITH CHECK (org_id IN (SELECT get_my_org_ids()) AND user_id = auth.uid());

-- Cada um só remove os próprios registros
CREATE POLICY "own delete produtividade"
  ON public.produtividade_entradas FOR DELETE
  USING (user_id = auth.uid());
