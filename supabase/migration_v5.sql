-- ============================================================
-- MIGRATION V5 — Módulo Financeiro: Honorários + Cobranças
-- Execute no Supabase SQL Editor
-- ============================================================

-- ── 1. Tabela de Honorários (contratos de serviço recorrentes) ─
CREATE TABLE IF NOT EXISTS public.honorarios (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id         UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  empresa_id     UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  cliente_nome   TEXT NOT NULL,
  cliente_cnpj   TEXT,
  descricao      TEXT,
  valor          NUMERIC(10,2) NOT NULL,
  tipo           TEXT NOT NULL DEFAULT 'mensal'
                   CHECK (tipo IN ('mensal', 'trimestral', 'semestral', 'anual', 'avulso')),
  dia_vencimento INTEGER CHECK (dia_vencimento BETWEEN 1 AND 31),
  data_inicio    DATE NOT NULL DEFAULT CURRENT_DATE,
  ativo          BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. Tabela de Cobranças (faturas individuais) ─────────────
CREATE TABLE IF NOT EXISTS public.cobrancas (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id           UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  honorario_id     UUID REFERENCES public.honorarios(id) ON DELETE SET NULL,
  empresa_id       UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  cliente_nome     TEXT NOT NULL,
  descricao        TEXT NOT NULL,
  valor            NUMERIC(10,2) NOT NULL,
  data_vencimento  DATE NOT NULL,
  data_pagamento   DATE,
  status           TEXT NOT NULL DEFAULT 'pendente'
                     CHECK (status IN ('pendente', 'pago', 'atrasado', 'cancelado')),
  forma_pagamento  TEXT CHECK (forma_pagamento IN ('pix','boleto','transferencia','dinheiro','cartao')),
  observacoes      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3. RLS ───────────────────────────────────────────────────
ALTER TABLE public.honorarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cobrancas  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON public.honorarios
  FOR ALL USING (org_id IN (SELECT get_my_org_ids()));

CREATE POLICY "org_isolation" ON public.cobrancas
  FOR ALL USING (org_id IN (SELECT get_my_org_ids()));

-- ── 4. Triggers updated_at ───────────────────────────────────
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.honorarios
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.cobrancas
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── 5. Índices ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_honorarios_org    ON public.honorarios(org_id);
CREATE INDEX IF NOT EXISTS idx_cobrancas_org     ON public.cobrancas(org_id);
CREATE INDEX IF NOT EXISTS idx_cobrancas_status  ON public.cobrancas(status);
CREATE INDEX IF NOT EXISTS idx_cobrancas_venc    ON public.cobrancas(data_vencimento);
