-- ═══════════════════════════════════════════════════════════════════════════
-- Migration v3 — Base CNAE Completa (IBGE) + Dados Fiscais
-- Paralegal Pro — 2026
-- ═══════════════════════════════════════════════════════════════════════════

-- Extensão para busca sem acentos (habilitada por padrão no Supabase)
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ─── 1. Tabela cnaes — todos os ~1.300 CNAEs do IBGE ─────────────────────────

CREATE TABLE IF NOT EXISTS public.cnaes (
  codigo       TEXT PRIMARY KEY,   -- Ex: "8211-3/00"
  codigo_norm  TEXT NOT NULL,      -- Ex: "821130"  — apenas dígitos, para busca
  descricao    TEXT NOT NULL,
  secao        TEXT,               -- Seção CNAE (letra: A, B, C ... U)
  divisao      TEXT,               -- Divisão (2 dígitos)
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para busca por código normalizado (ex: "82113" → "8211-3/00")
CREATE INDEX IF NOT EXISTS idx_cnaes_codigo_norm
  ON public.cnaes (codigo_norm text_pattern_ops);

-- Índice full-text em português com remoção de acentos
CREATE INDEX IF NOT EXISTS idx_cnaes_descricao_fts
  ON public.cnaes
  USING gin (to_tsvector('portuguese', unaccent(descricao)));

-- Índice LIKE para fallback
CREATE INDEX IF NOT EXISTS idx_cnaes_descricao_like
  ON public.cnaes (lower(descricao) text_pattern_ops);

-- ─── 2. Tabela cnae_fiscal — enriquecimento tributário e de licenciamento ─────

CREATE TABLE IF NOT EXISTS public.cnae_fiscal (
  codigo               TEXT PRIMARY KEY REFERENCES public.cnaes(codigo) ON DELETE CASCADE,
  anexo_simples        TEXT CHECK (anexo_simples IN ('I','II','III','IV','V','impedido')),
  impedido_simples     BOOLEAN NOT NULL DEFAULT false,
  motivo_impedimento   TEXT,
  fator_r_aplicavel    BOOLEAN NOT NULL DEFAULT false,
  tipo_atividade       TEXT CHECK (tipo_atividade IN ('comercio','industria','servico')),
  risco_vigilancia     TEXT CHECK (risco_vigilancia IN ('Baixo','Médio','Alto')),
  risco_bombeiros      TEXT CHECK (risco_bombeiros IN ('Baixo','Médio','Alto')),
  conselho_classe      TEXT,
  licencas             TEXT[],
  observacoes          TEXT,
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cnae_fiscal_codigo ON public.cnae_fiscal(codigo);

-- ─── 3. RLS — Row Level Security ─────────────────────────────────────────────

ALTER TABLE public.cnaes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cnae_fiscal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cnaes_select" ON public.cnaes;
CREATE POLICY "cnaes_select"
  ON public.cnaes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "cnae_fiscal_select" ON public.cnae_fiscal;
CREATE POLICY "cnae_fiscal_select"
  ON public.cnae_fiscal FOR SELECT TO authenticated USING (true);

-- ─── 4. Função RPC: search_cnaes ─────────────────────────────────────────────
-- Busca unificada por código (normalizado) OU texto na descrição.
-- Prioridade: código exato → prefixo de código → tem dados fiscais → demais.
-- Retorna até p_limit resultados com dados fiscais incorporados (LEFT JOIN).

CREATE OR REPLACE FUNCTION public.search_cnaes(
  p_query  TEXT,
  p_limit  INT DEFAULT 15
)
RETURNS TABLE (
  codigo             TEXT,
  descricao          TEXT,
  anexo_simples      TEXT,
  impedido_simples   BOOLEAN,
  motivo_impedimento TEXT,
  fator_r_aplicavel  BOOLEAN,
  tipo_atividade     TEXT,
  risco_vigilancia   TEXT,
  risco_bombeiros    TEXT,
  conselho_classe    TEXT,
  licencas           TEXT[],
  observacoes        TEXT,
  tem_fiscal         BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  q_norm  TEXT;
  q_clean TEXT;
BEGIN
  -- Remove tudo que não for dígito para comparar códigos
  q_norm  := regexp_replace(p_query, '[^0-9]', '', 'g');
  q_clean := trim(p_query);

  RETURN QUERY
  SELECT
    c.codigo,
    c.descricao,
    f.anexo_simples,
    COALESCE(f.impedido_simples, false),
    f.motivo_impedimento,
    COALESCE(f.fator_r_aplicavel, false),
    f.tipo_atividade,
    COALESCE(f.risco_vigilancia, 'Baixo'),
    COALESCE(f.risco_bombeiros,  'Baixo'),
    f.conselho_classe,
    f.licencas,
    f.observacoes,
    (f.codigo IS NOT NULL) AS tem_fiscal
  FROM public.cnaes c
  LEFT JOIN public.cnae_fiscal f ON f.codigo = c.codigo
  WHERE
    -- a) Busca por código numérico (ex: "82113" encontra "8211-3/00")
    (length(q_norm) >= 3
      AND c.codigo_norm ILIKE '%' || q_norm || '%')
    -- b) Busca full-text em português (suporta singular/plural e acentos)
    OR (length(q_clean) >= 3
      AND to_tsvector('portuguese', unaccent(c.descricao))
          @@ plainto_tsquery('portuguese', unaccent(q_clean)))
    -- c) ILIKE com unaccent como fallback (captura palavras curtas)
    OR (length(q_clean) >= 3
      AND unaccent(lower(c.descricao)) ILIKE '%' || unaccent(lower(q_clean)) || '%')
  ORDER BY
    -- Prioridade de relevância
    CASE
      WHEN c.codigo_norm = q_norm                    THEN 0  -- código exato
      WHEN c.codigo_norm ILIKE q_norm || '%'         THEN 1  -- prefixo de código
      WHEN f.codigo IS NOT NULL                      THEN 2  -- tem dados fiscais
      ELSE                                                3
    END,
    length(c.descricao),  -- descrição mais curta primeiro (mais específica)
    c.codigo
  LIMIT p_limit;
END;
$$;

-- Permissão de execução para usuários autenticados
GRANT EXECUTE ON FUNCTION public.search_cnaes TO authenticated;

-- ─── Verificação ──────────────────────────────────────────────────────────────
-- Após rodar a migration, execute o seed via:
--   GET /api/admin/seed-cnaes?secret=<SEED_SECRET>
-- (configure SEED_SECRET nas variáveis de ambiente do Vercel)
