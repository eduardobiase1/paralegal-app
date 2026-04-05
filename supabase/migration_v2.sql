-- ============================================================
-- PARALEGAL PRO — Migration v2
-- Execute este SQL no Supabase SQL Editor
-- ============================================================

-- ── 1. EMPRESAS — Novos campos do Cartão CNPJ ────────────────────────────────

-- Torna CNPJ opcional (necessário para empresas em abertura)
ALTER TABLE public.empresas ALTER COLUMN cnpj DROP NOT NULL;

-- Remove constraint UNIQUE de CNPJ para evitar conflito com NULL
-- (NULLs não violam UNIQUE, mas dependendo da versão do PG pode ser necessário)
-- Se houver erro, ignore este passo:
-- ALTER TABLE public.empresas DROP CONSTRAINT IF EXISTS empresas_cnpj_key;

-- Dados do Cartão CNPJ
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS natureza_juridica    TEXT;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS data_abertura         DATE;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS cnae_principal        TEXT;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS cnaes_secundarios     TEXT[]  DEFAULT '{}';

-- Capital Social
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS capital_social        TEXT;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS capital_quotas        TEXT;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS valor_quota           TEXT;

-- Contatos
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS email                 TEXT;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS telefone              TEXT;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS telefone2             TEXT;

-- Campos adicionados em sessão anterior (caso ainda não existam)
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS nire                  TEXT;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS sessao_junta          TEXT;


-- ── 2. SIMULADOR DE TAXAS ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.taxas (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome         TEXT        NOT NULL,
  tipo         TEXT        NOT NULL DEFAULT 'Outro'
                           CHECK (tipo IN ('DARF','DARE','Junta Comercial','Prefeitura','Cartório','Outro')),
  servico      TEXT        NOT NULL DEFAULT 'constituicao'
                           CHECK (servico IN (
                             'constituicao','alteracao','encerramento',
                             'transferencia','transformacao','regularizacao'
                           )),
  uf           TEXT        NOT NULL,
  cidade       TEXT,
  valor        NUMERIC(12,2) NOT NULL DEFAULT 0,
  observacoes  TEXT,
  ativo        BOOLEAN     NOT NULL DEFAULT true,
  created_by   UUID        REFERENCES public.profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS para taxas
ALTER TABLE public.taxas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users manage taxas"
  ON public.taxas FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Índices
CREATE INDEX IF NOT EXISTS idx_taxas_servico ON public.taxas(servico);
CREATE INDEX IF NOT EXISTS idx_taxas_uf      ON public.taxas(uf);
CREATE INDEX IF NOT EXISTS idx_taxas_ativo   ON public.taxas(ativo);


-- ── 3. CHECKLIST DE DOCUMENTOS ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.checklist_documentos (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  processo_id UUID        NOT NULL REFERENCES public.processos_societarios(id) ON DELETE CASCADE,
  documento   TEXT        NOT NULL,
  obrigatorio BOOLEAN     NOT NULL DEFAULT true,
  recebido    BOOLEAN     NOT NULL DEFAULT false,
  observacao  TEXT        DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.checklist_documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users manage checklist_documentos"
  ON public.checklist_documentos FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Índices
CREATE INDEX IF NOT EXISTS idx_checklist_docs_processo ON public.checklist_documentos(processo_id);


-- ── 4. CLAUSULAS (caso não exista ainda) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.clausulas (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo     TEXT        NOT NULL,
  tipo       TEXT        NOT NULL DEFAULT 'Geral',
  conteudo   TEXT        NOT NULL,
  ativo      BOOLEAN     NOT NULL DEFAULT true,
  created_by UUID        REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.clausulas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users manage clausulas"
  ON public.clausulas FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');


-- ── 5. VERIFICAÇÃO FINAL ──────────────────────────────────────────────────────

-- Confirme as colunas adicionadas:
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'empresas'
  AND column_name IN (
    'natureza_juridica','data_abertura','cnae_principal','cnaes_secundarios',
    'capital_social','capital_quotas','valor_quota','email','telefone','telefone2',
    'nire','sessao_junta'
  )
ORDER BY column_name;
