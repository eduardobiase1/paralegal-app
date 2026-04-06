-- ============================================================
-- MIGRATION V4 — Multi-tenancy: Organizations + RBAC
-- Execute no Supabase SQL Editor
-- ============================================================

-- ── 1. Tabela de organizações (escritórios) ─────────────────
CREATE TABLE IF NOT EXISTS public.organizations (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. Enum de papéis ───────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.org_role AS ENUM ('admin', 'operador', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 3. Membros da organização ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.organization_members (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.org_role NOT NULL DEFAULT 'operador',
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

-- ── 4. Adicionar org_id nas tabelas principais ──────────────
ALTER TABLE public.empresas            ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.contract_templates  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.audit_log           ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id);

-- Remover unicidade global de CNPJ (agora única por organização)
ALTER TABLE public.empresas DROP CONSTRAINT IF EXISTS empresas_cnpj_key;
CREATE UNIQUE INDEX IF NOT EXISTS empresas_cnpj_org_unique ON public.empresas(cnpj, org_id);

-- ── 5. Funções helper para RLS ──────────────────────────────

-- Retorna os org_ids do usuário atual
CREATE OR REPLACE FUNCTION public.get_my_org_ids()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT org_id FROM public.organization_members WHERE user_id = auth.uid();
$$;

-- Verifica se o usuário atual é admin da organização
CREATE OR REPLACE FUNCTION public.is_org_admin(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = p_org_id
      AND user_id = auth.uid()
      AND role = 'admin'
  );
$$;

-- ── 6. RLS nas novas tabelas ────────────────────────────────
ALTER TABLE public.organizations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Organizations
DROP POLICY IF EXISTS "users_see_own_orgs"    ON public.organizations;
DROP POLICY IF EXISTS "admins_update_org"      ON public.organizations;
CREATE POLICY "users_see_own_orgs"  ON public.organizations
  FOR SELECT USING (id IN (SELECT get_my_org_ids()));
CREATE POLICY "admins_update_org"   ON public.organizations
  FOR UPDATE USING (is_org_admin(id));

-- Organization members
DROP POLICY IF EXISTS "members_see_same_org"  ON public.organization_members;
DROP POLICY IF EXISTS "admins_manage_members" ON public.organization_members;
CREATE POLICY "members_see_same_org"  ON public.organization_members
  FOR SELECT USING (org_id IN (SELECT get_my_org_ids()));
CREATE POLICY "admins_manage_members" ON public.organization_members
  FOR ALL USING (is_org_admin(org_id));

-- ── 7. Atualizar RLS das tabelas de dados ───────────────────
-- Remover políticas permissivas antigas
DROP POLICY IF EXISTS "Authenticated users full access" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users full access" ON public.empresas;
DROP POLICY IF EXISTS "Authenticated users full access" ON public.certidoes;
DROP POLICY IF EXISTS "Authenticated users full access" ON public.alvaras;
DROP POLICY IF EXISTS "Authenticated users full access" ON public.alvaras_historico;
DROP POLICY IF EXISTS "Authenticated users full access" ON public.licencas_sanitarias;
DROP POLICY IF EXISTS "Authenticated users full access" ON public.certificados_digitais;
DROP POLICY IF EXISTS "Authenticated users full access" ON public.processos_societarios;
DROP POLICY IF EXISTS "Authenticated users full access" ON public.processo_etapas;
DROP POLICY IF EXISTS "Authenticated users full access" ON public.contratos;
DROP POLICY IF EXISTS "Authenticated users full access" ON public.contract_templates;
DROP POLICY IF EXISTS "Authenticated users full access" ON public.audit_log;

-- PROFILES: usuário vê o próprio perfil
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

-- HISTÓRICO DE ALVARÁS → herdam via alvara_id → empresa_id
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

-- ETAPAS DE PROCESSO → herdam via processo_id → empresa_id
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

-- ── 8. Trigger updated_at para organizations ────────────────
DROP TRIGGER IF EXISTS set_updated_at ON public.organizations;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── 9. Índices de performance ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org  ON public.organization_members(org_id);
CREATE INDEX IF NOT EXISTS idx_empresas_org     ON public.empresas(org_id);
CREATE INDEX IF NOT EXISTS idx_templates_org    ON public.contract_templates(org_id);
