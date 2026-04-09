-- ============================================================
-- MIGRATION V8 — Corrigir org_id nas Empresas (raiz do problema)
-- Execute no Supabase SQL Editor
-- ============================================================

-- ── 1. Vincular empresas existentes ao org_id correto ───────────
-- Faz o match entre empresas.organizacao (texto) e organizations.name
UPDATE public.empresas e
SET org_id = o.id
FROM public.organizations o
WHERE e.org_id IS NULL
  AND LOWER(TRIM(o.name)) = LOWER(TRIM(e.organizacao));

-- ── 2. Adicionar coluna organizacao no profiles (se necessário) ──
-- Garante que o profiles tenha o campo para backward compat
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS organizacao TEXT;

-- ── 3. Verificar resultado ──────────────────────────────────────
-- (Opcional: rode para confirmar que as empresas foram vinculadas)
-- SELECT id, razao_social, organizacao, org_id FROM public.empresas ORDER BY razao_social;

-- ── 4. Garantir que a coluna org_id em empresas não fique nula ──
-- Para registros que não encontraram match por nome, associar ao primeiro org disponível
-- ATENÇÃO: só execute esta parte se souber que existe apenas 1 org por escritório
-- UPDATE public.empresas e
-- SET org_id = (SELECT id FROM public.organizations LIMIT 1)
-- WHERE e.org_id IS NULL;

-- ── 5. RLS INSERT para certidoes / alvaras / licencas / certificados ─
-- As tabelas herdam via empresa_id → empresas.org_id.
-- Adicionar uma política WITH CHECK explícita para INSERT (evita erros em Supabase)

-- Certidões: INSERT WITH CHECK via empresa_id
DROP POLICY IF EXISTS "org_isolation_insert" ON public.certidoes;
CREATE POLICY "org_isolation_insert" ON public.certidoes
  FOR INSERT WITH CHECK (
    empresa_id IN (
      SELECT id FROM public.empresas WHERE org_id IN (SELECT get_my_org_ids())
    )
  );

-- Alvarás: INSERT WITH CHECK via empresa_id
DROP POLICY IF EXISTS "org_isolation_insert" ON public.alvaras;
CREATE POLICY "org_isolation_insert" ON public.alvaras
  FOR INSERT WITH CHECK (
    empresa_id IN (
      SELECT id FROM public.empresas WHERE org_id IN (SELECT get_my_org_ids())
    )
  );

-- Licenças Sanitárias: INSERT WITH CHECK via empresa_id
DROP POLICY IF EXISTS "org_isolation_insert" ON public.licencas_sanitarias;
CREATE POLICY "org_isolation_insert" ON public.licencas_sanitarias
  FOR INSERT WITH CHECK (
    empresa_id IN (
      SELECT id FROM public.empresas WHERE org_id IN (SELECT get_my_org_ids())
    )
  );

-- Certificados Digitais: INSERT WITH CHECK via empresa_id
DROP POLICY IF EXISTS "org_isolation_insert" ON public.certificados_digitais;
CREATE POLICY "org_isolation_insert" ON public.certificados_digitais
  FOR INSERT WITH CHECK (
    empresa_id IN (
      SELECT id FROM public.empresas WHERE org_id IN (SELECT get_my_org_ids())
    )
  );

-- ── 6. Honorários: garantir campo ativo com default true ────────
ALTER TABLE public.honorarios
  ALTER COLUMN ativo SET DEFAULT true;

UPDATE public.honorarios SET ativo = true WHERE ativo IS NULL;
