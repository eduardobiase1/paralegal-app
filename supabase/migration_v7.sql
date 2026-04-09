-- ============================================================
-- MIGRATION V7 — empresa_id nullable em processos_societarios
-- Execute no Supabase SQL Editor
-- ============================================================

-- Permite criar processos sem empresa cadastrada
ALTER TABLE public.processos_societarios
  ALTER COLUMN empresa_id DROP NOT NULL;

-- Atualizar RLS das etapas para aceitar processos sem empresa_id
DROP POLICY IF EXISTS "org_isolation" ON public.processo_etapas;
CREATE POLICY "org_isolation" ON public.processo_etapas
  FOR ALL USING (
    processo_id IN (
      SELECT ps.id FROM public.processos_societarios ps
      WHERE
        ps.org_id IN (SELECT get_my_org_ids())
        OR (ps.empresa_id IS NOT NULL AND ps.empresa_id IN (
          SELECT id FROM public.empresas WHERE org_id IN (SELECT get_my_org_ids())
        ))
    )
  );
