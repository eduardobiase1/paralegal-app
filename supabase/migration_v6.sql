-- ============================================================
-- MIGRATION V6 — Correções de Isolamento e Processos sem Empresa
-- Execute no Supabase SQL Editor
-- ============================================================

-- ── 1. Adicionar org_id e cliente_nome em processos_societarios ─
-- Permite criar processos sem empresa vinculada
ALTER TABLE public.processos_societarios
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.processos_societarios
  ADD COLUMN IF NOT EXISTS cliente_nome TEXT;

-- ── 2. Criar índice de performance ──────────────────────────────
CREATE INDEX IF NOT EXISTS idx_processos_org ON public.processos_societarios(org_id);

-- ── 3. Atualizar RLS de processos_societarios ───────────────────
-- Agora aceita isolamento via org_id direto OU via empresa_id chain
DROP POLICY IF EXISTS "org_isolation" ON public.processos_societarios;
DROP POLICY IF EXISTS "Authenticated users full access" ON public.processos_societarios;

CREATE POLICY "org_isolation" ON public.processos_societarios
  FOR ALL USING (
    (org_id IN (SELECT get_my_org_ids()))
    OR
    (empresa_id IN (
      SELECT id FROM public.empresas WHERE org_id IN (SELECT get_my_org_ids())
    ))
  );

-- INSERT precisa de WITH CHECK
DROP POLICY IF EXISTS "org_isolation_insert" ON public.processos_societarios;
CREATE POLICY "org_isolation_insert" ON public.processos_societarios
  FOR INSERT WITH CHECK (
    (org_id IN (SELECT get_my_org_ids()))
    OR
    (empresa_id IN (
      SELECT id FROM public.empresas WHERE org_id IN (SELECT get_my_org_ids())
    ))
  );

-- ── 4. RLS para checklist_documentos (estava sem política) ──────
ALTER TABLE public.checklist_documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_isolation" ON public.checklist_documentos;
DROP POLICY IF EXISTS "Authenticated users full access" ON public.checklist_documentos;

CREATE POLICY "org_isolation" ON public.checklist_documentos
  FOR ALL USING (
    processo_id IN (
      SELECT ps.id FROM public.processos_societarios ps
      WHERE
        ps.org_id IN (SELECT get_my_org_ids())
        OR ps.empresa_id IN (
          SELECT id FROM public.empresas WHERE org_id IN (SELECT get_my_org_ids())
        )
    )
  );

-- ── 5. Garantir INSERT policy para organization_members ─────────
DROP POLICY IF EXISTS "self_insert_member" ON public.organization_members;
CREATE POLICY "self_insert_member" ON public.organization_members
  FOR INSERT WITH CHECK (user_id = auth.uid() OR is_org_admin(org_id));

-- ── 6. INSERT policy para organizations ─────────────────────────
DROP POLICY IF EXISTS "auth_insert_org" ON public.organizations;
CREATE POLICY "auth_insert_org" ON public.organizations
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ── 7. Empresas INSERT policy ────────────────────────────────────
DROP POLICY IF EXISTS "org_isolation_insert" ON public.empresas;
CREATE POLICY "org_isolation_insert" ON public.empresas
  FOR INSERT WITH CHECK (org_id IN (SELECT get_my_org_ids()));
