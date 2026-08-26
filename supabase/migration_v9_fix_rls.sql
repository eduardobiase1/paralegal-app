-- ============================================================
-- MIGRATION V9 — Corrigir RLS: Isolamento por Organização
-- Execute no Supabase SQL Editor
-- IMPORTANTE: Esta migration reaplica as políticas de segurança
-- para garantir que dados de um cliente não vazem para outro.
-- ============================================================

-- ── Recriar função helper (idempotente) ─────────────────────
CREATE OR REPLACE FUNCTION public.get_my_org_ids()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT org_id FROM public.organization_members WHERE user_id = auth.uid();
$$;

-- ── Remover TODAS as políticas antigas (permissivas e isoladas) ──
-- Profiles
DROP POLICY IF EXISTS "Authenticated users full access" ON public.profiles;
DROP POLICY IF EXISTS "own_profile"                     ON public.profiles;

-- Empresas
DROP POLICY IF EXISTS "Authenticated users full access" ON public.empresas;
DROP POLICY IF EXISTS "org_isolation"                   ON public.empresas;

-- Certidões
DROP POLICY IF EXISTS "Authenticated users full access" ON public.certidoes;
DROP POLICY IF EXISTS "org_isolation"                   ON public.certidoes;

-- Alvarás
DROP POLICY IF EXISTS "Authenticated users full access" ON public.alvaras;
DROP POLICY IF EXISTS "org_isolation"                   ON public.alvaras;

-- Histórico de Alvarás
DROP POLICY IF EXISTS "Authenticated users full access" ON public.alvaras_historico;
DROP POLICY IF EXISTS "org_isolation"                   ON public.alvaras_historico;

-- Licenças Sanitárias
DROP POLICY IF EXISTS "Authenticated users full access" ON public.licencas_sanitarias;
DROP POLICY IF EXISTS "org_isolation"                   ON public.licencas_sanitarias;

-- Certificados Digitais
DROP POLICY IF EXISTS "Authenticated users full access" ON public.certificados_digitais;
DROP POLICY IF EXISTS "org_isolation"                   ON public.certificados_digitais;

-- Processos Societários
DROP POLICY IF EXISTS "Authenticated users full access" ON public.processos_societarios;
DROP POLICY IF EXISTS "org_isolation"                   ON public.processos_societarios;

-- Etapas de Processo
DROP POLICY IF EXISTS "Authenticated users full access" ON public.processo_etapas;
DROP POLICY IF EXISTS "org_isolation"                   ON public.processo_etapas;

-- Contratos
DROP POLICY IF EXISTS "Authenticated users full access" ON public.contratos;
DROP POLICY IF EXISTS "org_isolation"                   ON public.contratos;

-- Templates de Contrato
DROP POLICY IF EXISTS "Authenticated users full access" ON public.contract_templates;
DROP POLICY IF EXISTS "org_isolation"                   ON public.contract_templates;

-- Audit Log
DROP POLICY IF EXISTS "Authenticated users full access" ON public.audit_log;
DROP POLICY IF EXISTS "org_isolation"                   ON public.audit_log;

-- Taxas/Honorários (se existirem)
DROP POLICY IF EXISTS "org_isolation" ON public.honorarios;
DROP POLICY IF EXISTS "org_isolation" ON public.cobrancas;

-- ── Garantir RLS habilitado em todas as tabelas ─────────────
ALTER TABLE public.profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certidoes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alvaras               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alvaras_historico     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licencas_sanitarias   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificados_digitais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processos_societarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processo_etapas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contratos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_templates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log             ENABLE ROW LEVEL SECURITY;

-- ── Recriar políticas corretas ──────────────────────────────

-- PROFILES: usuário vê apenas o próprio perfil
CREATE POLICY "own_profile" ON public.profiles
  FOR ALL USING (id = auth.uid());

-- EMPRESAS: isoladas por org_id
CREATE POLICY "org_isolation" ON public.empresas
  FOR ALL USING (org_id IN (SELECT get_my_org_ids()));

-- CERTIDÕES → herdam via empresa_id
CREATE POLICY "org_isolation" ON public.certidoes
  FOR ALL USING (
    empresa_id IN (
      SELECT id FROM public.empresas WHERE org_id IN (SELECT get_my_org_ids())
    )
  );

-- ALVARÁS → herdam via empresa_id
CREATE POLICY "org_isolation" ON public.alvaras
  FOR ALL USING (
    empresa_id IN (
      SELECT id FROM public.empresas WHERE org_id IN (SELECT get_my_org_ids())
    )
  );

-- HISTÓRICO DE ALVARÁS → herdam via alvara_id
CREATE POLICY "org_isolation" ON public.alvaras_historico
  FOR ALL USING (
    alvara_id IN (
      SELECT a.id FROM public.alvaras a
      JOIN public.empresas e ON e.id = a.empresa_id
      WHERE e.org_id IN (SELECT get_my_org_ids())
    )
  );

-- LICENÇAS SANITÁRIAS → herdam via empresa_id
CREATE POLICY "org_isolation" ON public.licencas_sanitarias
  FOR ALL USING (
    empresa_id IN (
      SELECT id FROM public.empresas WHERE org_id IN (SELECT get_my_org_ids())
    )
  );

-- CERTIFICADOS DIGITAIS → herdam via empresa_id
CREATE POLICY "org_isolation" ON public.certificados_digitais
  FOR ALL USING (
    empresa_id IN (
      SELECT id FROM public.empresas WHERE org_id IN (SELECT get_my_org_ids())
    )
  );

-- PROCESSOS SOCIETÁRIOS → herdam via empresa_id
CREATE POLICY "org_isolation" ON public.processos_societarios
  FOR ALL USING (
    empresa_id IN (
      SELECT id FROM public.empresas WHERE org_id IN (SELECT get_my_org_ids())
    )
  );

-- ETAPAS DE PROCESSO → herdam via processo_id
CREATE POLICY "org_isolation" ON public.processo_etapas
  FOR ALL USING (
    processo_id IN (
      SELECT ps.id FROM public.processos_societarios ps
      JOIN public.empresas e ON e.id = ps.empresa_id
      WHERE e.org_id IN (SELECT get_my_org_ids())
    )
  );

-- CONTRATOS → herdam via empresa_id
CREATE POLICY "org_isolation" ON public.contratos
  FOR ALL USING (
    empresa_id IN (
      SELECT id FROM public.empresas WHERE org_id IN (SELECT get_my_org_ids())
    )
  );

-- TEMPLATES DE CONTRATO → por org_id direto
CREATE POLICY "org_isolation" ON public.contract_templates
  FOR ALL USING (org_id IN (SELECT get_my_org_ids()));

-- AUDIT LOG → por org_id direto
CREATE POLICY "org_isolation" ON public.audit_log
  FOR ALL USING (org_id IN (SELECT get_my_org_ids()));

-- Honorários / Cobranças (se existirem)
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='honorarios') THEN
    EXECUTE 'CREATE POLICY "org_isolation" ON public.honorarios FOR ALL USING (org_id IN (SELECT get_my_org_ids()))';
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='cobrancas') THEN
    EXECUTE 'CREATE POLICY "org_isolation" ON public.cobrancas FOR ALL USING (org_id IN (SELECT get_my_org_ids()))';
  END IF;
END $$;

-- ── Verificação final ───────────────────────────────────────
-- Execute isso para confirmar que as políticas estão ativas:
-- SELECT tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
