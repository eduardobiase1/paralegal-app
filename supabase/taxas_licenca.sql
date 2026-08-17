-- Tabela: taxas_licenca
-- Controle anual de envio de Taxa de Licença de Funcionamento

create table if not exists taxas_licenca (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  empresa_id   uuid not null references empresas(id) on delete cascade,
  ano          integer not null,
  enviado      boolean not null default false,
  data_envio   date,
  observacoes  text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),

  unique (org_id, empresa_id, ano)
);

-- RLS
alter table taxas_licenca enable row level security;

create policy "taxas_licenca: org members only"
  on taxas_licenca for all
  using (
    org_id in (
      select org_id from org_members where user_id = auth.uid()
    )
  );

-- Índices
create index if not exists idx_taxas_licenca_org_ano on taxas_licenca (org_id, ano);
