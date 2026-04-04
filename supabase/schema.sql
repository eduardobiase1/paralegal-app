-- ============================================================
-- PARALEGAL APP — Schema Supabase
-- Execute este SQL no Supabase SQL Editor (projeto > SQL Editor)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USUARIOS (gerenciado pelo Supabase Auth + perfis adicionais)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  perfil TEXT NOT NULL CHECK (perfil IN ('gestor', 'operacional')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- EMPRESAS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.empresas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo SERIAL UNIQUE,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT NOT NULL UNIQUE,
  inscricao_estadual TEXT,
  inscricao_municipal TEXT,
  status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'inativa', 'em_abertura')),
  -- Endereço
  cep TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,
  -- URLs personalizadas
  url_portal_alvara TEXT,
  url_certidao_municipal TEXT,
  url_portal_visa TEXT,
  -- Metadados
  responsavel_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CERTIDÕES NEGATIVAS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.certidoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  orgao_emissor TEXT NOT NULL,
  data_emissao DATE,
  data_vencimento DATE,
  responsavel_id UUID REFERENCES public.profiles(id),
  observacoes TEXT,
  arquivo_url TEXT,
  arquivo_nome TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ALVARÁS DE FUNCIONAMENTO
-- ============================================================
CREATE TABLE IF NOT EXISTS public.alvaras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('fixo', 'temporario', 'provisorio')),
  orgao_emissor TEXT NOT NULL,
  numero TEXT,
  data_emissao DATE,
  data_vencimento DATE,
  responsavel_id UUID REFERENCES public.profiles(id),
  observacoes TEXT,
  arquivo_url TEXT,
  arquivo_nome TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.alvaras_historico (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alvara_id UUID NOT NULL REFERENCES public.alvaras(id) ON DELETE CASCADE,
  numero_anterior TEXT,
  data_vencimento_anterior DATE,
  data_renovacao DATE NOT NULL,
  responsavel_id UUID REFERENCES public.profiles(id),
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- LICENÇAS SANITÁRIAS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.licencas_sanitarias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  orgao TEXT NOT NULL CHECK (orgao IN ('ANVISA', 'VISA_MUNICIPAL')),
  numero_licenca TEXT,
  numero_processo_renovacao TEXT,
  atividade_sanitaria TEXT,
  data_emissao DATE,
  data_vencimento DATE,
  responsavel_id UUID REFERENCES public.profiles(id),
  observacoes TEXT,
  arquivo_url TEXT,
  arquivo_nome TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CERTIFICADOS DIGITAIS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.certificados_digitais (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  titular TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('A1', 'A3')),
  uso TEXT NOT NULL CHECK (uso IN ('e-CNPJ', 'e-CPF', 'NF-e', 'CT-e', 'eSocial', 'outro')),
  autoridade_certificadora TEXT NOT NULL,
  data_emissao DATE,
  data_vencimento DATE,
  localizacao_fisica TEXT,
  responsavel_custodia_id UUID REFERENCES public.profiles(id),
  observacoes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- MÓDULO SOCIETÁRIO — PROCESSOS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.processos_societarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN (
    'abertura',
    'alteracao_contratual',
    'encerramento',
    'transferencia_entrada',
    'transferencia_saida'
  )),
  titulo TEXT,
  status TEXT NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento', 'concluido', 'cancelado')),
  responsavel_id UUID REFERENCES public.profiles(id),
  data_abertura DATE NOT NULL DEFAULT CURRENT_DATE,
  data_conclusao DATE,
  observacoes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.processo_etapas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  processo_id UUID NOT NULL REFERENCES public.processos_societarios(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL,
  nome TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluido', 'aguardando_cliente')),
  responsavel_id UUID REFERENCES public.profiles(id),
  data_conclusao DATE,
  observacoes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CONTRATOS (histórico de geração)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contratos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  template_nome TEXT NOT NULL,
  dados_json JSONB NOT NULL,
  arquivo_url TEXT,
  arquivo_nome TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.contract_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  descricao TEXT,
  arquivo_url TEXT NOT NULL,
  arquivo_nome TEXT NOT NULL,
  variaveis JSONB,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- HISTÓRICO DE ALTERAÇÕES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tabela TEXT NOT NULL,
  registro_id UUID NOT NULL,
  acao TEXT NOT NULL CHECK (acao IN ('INSERT', 'UPDATE', 'DELETE')),
  dados_anteriores JSONB,
  dados_novos JSONB,
  usuario_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- VIEWS ÚTEIS
-- ============================================================

-- View: status calculado de certidões
CREATE OR REPLACE VIEW public.v_certidoes_status AS
SELECT
  c.*,
  e.razao_social,
  e.cnpj,
  e.uf,
  CASE
    WHEN c.data_vencimento IS NULL THEN 'sem_data'
    WHEN c.data_vencimento < CURRENT_DATE THEN 'vencido'
    WHEN c.data_vencimento <= CURRENT_DATE + INTERVAL '30 days' THEN 'critico'
    WHEN c.data_vencimento <= CURRENT_DATE + INTERVAL '60 days' THEN 'atencao'
    ELSE 'ok'
  END AS status_cor,
  (c.data_vencimento - CURRENT_DATE) AS dias_para_vencer
FROM public.certidoes c
JOIN public.empresas e ON e.id = c.empresa_id;

-- View: status calculado de alvarás
CREATE OR REPLACE VIEW public.v_alvaras_status AS
SELECT
  a.*,
  e.razao_social,
  e.cnpj,
  CASE
    WHEN a.data_vencimento IS NULL THEN 'sem_data'
    WHEN a.data_vencimento < CURRENT_DATE THEN 'vencido'
    WHEN a.data_vencimento <= CURRENT_DATE + INTERVAL '30 days' THEN 'critico'
    WHEN a.data_vencimento <= CURRENT_DATE + INTERVAL '60 days' THEN 'atencao'
    ELSE 'ok'
  END AS status_cor,
  (a.data_vencimento - CURRENT_DATE) AS dias_para_vencer
FROM public.alvaras a
JOIN public.empresas e ON e.id = a.empresa_id;

-- View: status calculado de licenças sanitárias
CREATE OR REPLACE VIEW public.v_licencas_status AS
SELECT
  l.*,
  e.razao_social,
  e.cnpj,
  CASE
    WHEN l.data_vencimento IS NULL THEN 'sem_data'
    WHEN l.data_vencimento < CURRENT_DATE THEN 'vencido'
    WHEN l.data_vencimento <= CURRENT_DATE + INTERVAL '30 days' THEN 'critico'
    WHEN l.data_vencimento <= CURRENT_DATE + INTERVAL '60 days' THEN 'atencao'
    ELSE 'ok'
  END AS status_cor,
  (l.data_vencimento - CURRENT_DATE) AS dias_para_vencer
FROM public.licencas_sanitarias l
JOIN public.empresas e ON e.id = l.empresa_id;

-- View: status calculado de certificados digitais
CREATE OR REPLACE VIEW public.v_certificados_status AS
SELECT
  cd.*,
  e.razao_social,
  e.cnpj,
  CASE
    WHEN cd.data_vencimento IS NULL THEN 'sem_data'
    WHEN cd.data_vencimento < CURRENT_DATE THEN 'vencido'
    WHEN cd.data_vencimento <= CURRENT_DATE + INTERVAL '30 days' THEN 'critico'
    WHEN cd.data_vencimento <= CURRENT_DATE + INTERVAL '60 days' THEN 'atencao'
    WHEN cd.data_vencimento <= CURRENT_DATE + INTERVAL '90 days' THEN 'alerta'
    ELSE 'ok'
  END AS status_cor,
  (cd.data_vencimento - CURRENT_DATE) AS dias_para_vencer
FROM public.certificados_digitais cd
JOIN public.empresas e ON e.id = cd.empresa_id;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certidoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alvaras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alvaras_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licencas_sanitarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificados_digitais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processos_societarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processo_etapas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Políticas: usuários autenticados têm acesso total (controle por perfil no app)
CREATE POLICY "Authenticated users full access" ON public.profiles
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users full access" ON public.empresas
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users full access" ON public.certidoes
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users full access" ON public.alvaras
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users full access" ON public.alvaras_historico
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users full access" ON public.licencas_sanitarias
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users full access" ON public.certificados_digitais
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users full access" ON public.processos_societarios
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users full access" ON public.processo_etapas
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users full access" ON public.contratos
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users full access" ON public.contract_templates
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users full access" ON public.audit_log
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================
-- TRIGGER: updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.certidoes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.alvaras
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.licencas_sanitarias
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.certificados_digitais
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.processos_societarios
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.processo_etapas
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.contract_templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- TRIGGER: criar profile ao registrar usuário
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email, perfil)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'perfil', 'operacional')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- STORAGE BUCKETS (execute via Supabase Dashboard > Storage)
-- ============================================================
-- Crie os seguintes buckets públicos:
-- - certidoes-docs
-- - alvaras-docs
-- - licencas-docs
-- - contratos-templates
-- - contratos-gerados

-- ============================================================
-- ETAPAS PADRÃO POR TIPO DE PROCESSO (função helper)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_etapas_padrao(tipo_processo TEXT)
RETURNS TABLE(ordem INTEGER, nome TEXT) AS $$
BEGIN
  CASE tipo_processo
    WHEN 'abertura' THEN
      RETURN QUERY VALUES
        (1, 'Consulta de viabilidade'),
        (2, 'Elaboração do contrato social'),
        (3, 'Registro na Junta Comercial/Cartório'),
        (4, 'Obtenção do CNPJ'),
        (5, 'Inscrição Estadual'),
        (6, 'Inscrição Municipal / Alvará provisório'),
        (7, 'Abertura de conta bancária PJ'),
        (8, 'Certificado digital'),
        (9, 'Conclusão / Entrega ao cliente');
    WHEN 'alteracao_contratual' THEN
      RETURN QUERY VALUES
        (1, 'Levantamento das alterações'),
        (2, 'Elaboração da minuta'),
        (3, 'Assinatura dos sócios'),
        (4, 'Registro na Junta/Cartório'),
        (5, 'Atualização Receita Federal'),
        (6, 'Atualização SEFAZ'),
        (7, 'Atualização Prefeitura'),
        (8, 'Conclusão / Entrega');
    WHEN 'encerramento' THEN
      RETURN QUERY VALUES
        (1, 'Distrato / Ata de dissolução'),
        (2, 'Baixa na Junta/Cartório'),
        (3, 'Baixa CNPJ'),
        (4, 'Baixa SEFAZ'),
        (5, 'Baixa Prefeitura'),
        (6, 'Certidões de baixa'),
        (7, 'Conclusão / Entrega');
    WHEN 'transferencia_entrada' THEN
      RETURN QUERY VALUES
        (1, 'Solicitação de documentos'),
        (2, 'Carta de transferência para contabilidade anterior'),
        (3, 'Recebimento de arquivos contábeis/fiscais'),
        (4, 'Verificação de pendências'),
        (5, 'Análise do enquadramento tributário'),
        (6, 'Atualização cadastral Receita Federal'),
        (7, 'Atualização SEFAZ'),
        (8, 'Atualização Prefeitura'),
        (9, 'Solicitação de certificado digital'),
        (10, 'Cadastro no sistema'),
        (11, 'Reunião de onboarding'),
        (12, 'Conclusão');
    WHEN 'transferencia_saida' THEN
      RETURN QUERY VALUES
        (1, 'Recebimento da solicitação'),
        (2, 'Verificação de débitos'),
        (3, 'Regularização financeira'),
        (4, 'Organização e exportação de arquivos'),
        (5, 'Carta de transferência para nova contabilidade'),
        (6, 'Entrega de documentos originais'),
        (7, 'Revogação de procurações e acessos (Gov.br, e-CAC, SEFAZ)'),
        (8, 'Cancelamento de certificados digitais'),
        (9, 'Baixa nos sistemas internos'),
        (10, 'Arquivamento do histórico'),
        (11, 'Conclusão');
    ELSE
      RETURN;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_certidoes_empresa ON public.certidoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_certidoes_vencimento ON public.certidoes(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_alvaras_empresa ON public.alvaras(empresa_id);
CREATE INDEX IF NOT EXISTS idx_alvaras_vencimento ON public.alvaras(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_licencas_empresa ON public.licencas_sanitarias(empresa_id);
CREATE INDEX IF NOT EXISTS idx_licencas_vencimento ON public.licencas_sanitarias(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_certificados_empresa ON public.certificados_digitais(empresa_id);
CREATE INDEX IF NOT EXISTS idx_certificados_vencimento ON public.certificados_digitais(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_processos_empresa ON public.processos_societarios(empresa_id);
CREATE INDEX IF NOT EXISTS idx_etapas_processo ON public.processo_etapas(processo_id);
CREATE INDEX IF NOT EXISTS idx_empresas_cnpj ON public.empresas(cnpj);
CREATE INDEX IF NOT EXISTS idx_empresas_status ON public.empresas(status);
