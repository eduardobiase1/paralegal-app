-- ============================================================
-- MIGRATION V13 — Produtividade automática
-- Execute no Supabase SQL Editor (substitui a antiga migration_v12)
--
-- Cria três tabelas:
--   atividade_blocos        → tempo contado sozinho (por módulo / empresa / portal externo)
--   atividade_eventos       → ações feitas no sistema (renovou, comunicou, concluiu etapa...)
--   produtividade_entradas  → registro manual do que acontece fora do sistema
--
-- Visibilidade: cada pessoa vê os próprios registros; o admin da organização vê os de todos.
-- ============================================================

-- ── Helper: organizações em que o usuário é admin ────────────
CREATE OR REPLACE FUNCTION public.get_my_admin_org_ids()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT org_id FROM public.organization_members WHERE user_id = auth.uid() AND role = 'admin';
$$;

-- ── 1. Blocos de tempo ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.atividade_blocos (
  id            uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id        uuid         NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id       uuid         NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  usuario       text,
  dia           date         NOT NULL,
  inicio        timestamptz  NOT NULL,
  fim           timestamptz  NOT NULL,
  segundos      integer      NOT NULL DEFAULT 0,
  tipo          text         NOT NULL DEFAULT 'sistema' CHECK (tipo IN ('sistema', 'portal')),
  modulo        text         NOT NULL,
  empresa_id    uuid         REFERENCES public.empresas(id) ON DELETE SET NULL,
  empresa_nome  text,
  descricao     text,        -- portal: nome do link aberto
  resultado     text,        -- portal: ação registrada ao voltar (ex.: "Certidão Federal renovada")
  estimado      boolean      NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS atividade_blocos_org_dia_idx  ON public.atividade_blocos(org_id, dia DESC);
CREATE INDEX IF NOT EXISTS atividade_blocos_user_dia_idx ON public.atividade_blocos(user_id, dia DESC);

-- ── 2. Ações ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.atividade_eventos (
  id            uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id        uuid         NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id       uuid         NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  usuario       text,
  dia           date         NOT NULL,
  criado_em     timestamptz  NOT NULL DEFAULT now(),
  acao          text         NOT NULL,
  modulo        text         NOT NULL,
  empresa_id    uuid         REFERENCES public.empresas(id) ON DELETE SET NULL,
  empresa_nome  text,
  descricao     text         NOT NULL
);

CREATE INDEX IF NOT EXISTS atividade_eventos_org_dia_idx  ON public.atividade_eventos(org_id, dia DESC);
CREATE INDEX IF NOT EXISTS atividade_eventos_user_dia_idx ON public.atividade_eventos(user_id, dia DESC);

-- ── 3. Registro manual (fora do sistema) ─────────────────────
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

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.atividade_blocos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atividade_eventos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtividade_entradas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own or admin select blocos" ON public.atividade_blocos;
DROP POLICY IF EXISTS "own insert blocos"          ON public.atividade_blocos;
DROP POLICY IF EXISTS "own update blocos"          ON public.atividade_blocos;
DROP POLICY IF EXISTS "own delete blocos"          ON public.atividade_blocos;

CREATE POLICY "own or admin select blocos" ON public.atividade_blocos FOR SELECT
  USING (user_id = auth.uid() OR org_id IN (SELECT get_my_admin_org_ids()));
CREATE POLICY "own insert blocos" ON public.atividade_blocos FOR INSERT
  WITH CHECK (org_id IN (SELECT get_my_org_ids()) AND user_id = auth.uid());
CREATE POLICY "own update blocos" ON public.atividade_blocos FOR UPDATE
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own delete blocos" ON public.atividade_blocos FOR DELETE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "own or admin select eventos" ON public.atividade_eventos;
DROP POLICY IF EXISTS "own insert eventos"          ON public.atividade_eventos;

CREATE POLICY "own or admin select eventos" ON public.atividade_eventos FOR SELECT
  USING (user_id = auth.uid() OR org_id IN (SELECT get_my_admin_org_ids()));
CREATE POLICY "own insert eventos" ON public.atividade_eventos FOR INSERT
  WITH CHECK (org_id IN (SELECT get_my_org_ids()) AND user_id = auth.uid());

DROP POLICY IF EXISTS "org members select produtividade"  ON public.produtividade_entradas;
DROP POLICY IF EXISTS "own or admin select produtividade" ON public.produtividade_entradas;
DROP POLICY IF EXISTS "own insert produtividade"          ON public.produtividade_entradas;
DROP POLICY IF EXISTS "own delete produtividade"          ON public.produtividade_entradas;

CREATE POLICY "own or admin select produtividade" ON public.produtividade_entradas FOR SELECT
  USING (user_id = auth.uid() OR org_id IN (SELECT get_my_admin_org_ids()));
CREATE POLICY "own insert produtividade" ON public.produtividade_entradas FOR INSERT
  WITH CHECK (org_id IN (SELECT get_my_org_ids()) AND user_id = auth.uid());
CREATE POLICY "own delete produtividade" ON public.produtividade_entradas FOR DELETE
  USING (user_id = auth.uid());
