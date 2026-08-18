-- ── Empresas Prioritárias ──────────────────────────────────────────────────
-- Campo para marcar empresa como prioritária no Briefing Diário
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS prioritaria boolean NOT NULL DEFAULT false;

-- ── Controle de revisão nos documentos ────────────────────────────────────
-- Guarda quando o documento foi "renovado" (nova data de vencimento salva).
-- O item some do briefing por 30 dias após a renovação.
ALTER TABLE certidoes
  ADD COLUMN IF NOT EXISTS briefing_revisado_em timestamptz;

ALTER TABLE alvaras
  ADD COLUMN IF NOT EXISTS briefing_revisado_em timestamptz;

ALTER TABLE licencas_sanitarias
  ADD COLUMN IF NOT EXISTS briefing_revisado_em timestamptz;

-- ── Trigger: marca revisão ao atualizar data_vencimento ───────────────────
CREATE OR REPLACE FUNCTION fn_set_briefing_revisado()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.data_vencimento IS DISTINCT FROM OLD.data_vencimento THEN
    NEW.briefing_revisado_em := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar nas 3 tabelas
DROP TRIGGER IF EXISTS trig_certidoes_briefing     ON certidoes;
DROP TRIGGER IF EXISTS trig_alvaras_briefing        ON alvaras;
DROP TRIGGER IF EXISTS trig_licencas_briefing       ON licencas_sanitarias;

CREATE TRIGGER trig_certidoes_briefing
  BEFORE UPDATE ON certidoes
  FOR EACH ROW EXECUTE FUNCTION fn_set_briefing_revisado();

CREATE TRIGGER trig_alvaras_briefing
  BEFORE UPDATE ON alvaras
  FOR EACH ROW EXECUTE FUNCTION fn_set_briefing_revisado();

CREATE TRIGGER trig_licencas_briefing
  BEFORE UPDATE ON licencas_sanitarias
  FOR EACH ROW EXECUTE FUNCTION fn_set_briefing_revisado();
