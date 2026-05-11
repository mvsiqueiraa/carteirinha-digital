-- =============================================================
-- CADERNINHO DIGITAL - Schema v3
-- Multiusuario, RLS, UUID offline-friendly, soft delete e sync.
-- =============================================================

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  nome text not null,
  telefone text,
  endereco text,
  rua text,
  numero_end text,
  bairro text,
  local_trabalho text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint clientes_user_id_required check (user_id is not null)
);

create table if not exists contas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  descricao text not null,
  item_comprado text,
  valor_total numeric(12, 2) not null check (valor_total >= 0),
  parcelas integer not null default 1 check (parcelas between 1 and 24),
  data_criacao date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint contas_user_id_required check (user_id is not null)
);

create table if not exists transacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  conta_id uuid not null references contas(id) on delete cascade,
  valor_pago numeric(12, 2) not null check (valor_pago > 0),
  data_pagamento date not null,
  metodo text not null check (metodo in ('pix', 'dinheiro', 'cartao')),
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint transacoes_user_id_required check (user_id is not null)
);

create table if not exists lembretes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  conta_id uuid not null references contas(id) on delete cascade,
  data_agendada date not null,
  parcela_numero integer not null default 1 check (parcela_numero > 0),
  valor_previsto numeric(12, 2),
  status text not null check (status in ('pendente', 'alertado', 'resolvido')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint lembretes_user_id_required check (user_id is not null)
);

create table if not exists comprovantes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  transacao_id uuid not null references transacoes(id) on delete cascade,
  url_imagem text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint comprovantes_user_id_required check (user_id is not null)
);

alter table clientes add column if not exists endereco text;
alter table clientes add column if not exists rua text;
alter table clientes add column if not exists numero_end text;
alter table clientes add column if not exists bairro text;
alter table clientes add column if not exists local_trabalho text;
alter table clientes add column if not exists created_at timestamptz not null default now();
alter table clientes add column if not exists updated_at timestamptz not null default now();
alter table clientes add column if not exists deleted_at timestamptz;

alter table contas add column if not exists item_comprado text;
alter table contas add column if not exists parcelas integer not null default 1;
alter table contas add column if not exists created_at timestamptz not null default now();
alter table contas add column if not exists updated_at timestamptz not null default now();
alter table contas add column if not exists deleted_at timestamptz;

alter table transacoes add column if not exists created_at timestamptz not null default now();
alter table transacoes add column if not exists updated_at timestamptz not null default now();
alter table transacoes add column if not exists deleted_at timestamptz;

alter table lembretes add column if not exists parcela_numero integer not null default 1;
alter table lembretes add column if not exists valor_previsto numeric(12, 2);
alter table lembretes add column if not exists created_at timestamptz not null default now();
alter table lembretes add column if not exists updated_at timestamptz not null default now();
alter table lembretes add column if not exists deleted_at timestamptz;

alter table comprovantes add column if not exists created_at timestamptz not null default now();
alter table comprovantes add column if not exists updated_at timestamptz not null default now();
alter table comprovantes add column if not exists deleted_at timestamptz;

alter table clientes enable row level security;
alter table contas enable row level security;
alter table transacoes enable row level security;
alter table lembretes enable row level security;
alter table comprovantes enable row level security;

drop policy if exists "clientes_select_own" on clientes;
drop policy if exists "clientes_insert_own" on clientes;
drop policy if exists "clientes_update_own" on clientes;
drop policy if exists "clientes_delete_own" on clientes;
create policy "clientes_select_own" on clientes for select using (auth.uid() = user_id);
create policy "clientes_insert_own" on clientes for insert with check (auth.uid() = user_id);
create policy "clientes_update_own" on clientes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "clientes_delete_own" on clientes for delete using (auth.uid() = user_id);

drop policy if exists "contas_select_own" on contas;
drop policy if exists "contas_insert_own" on contas;
drop policy if exists "contas_update_own" on contas;
drop policy if exists "contas_delete_own" on contas;
create policy "contas_select_own" on contas for select using (auth.uid() = user_id);
create policy "contas_insert_own" on contas for insert with check (auth.uid() = user_id);
create policy "contas_update_own" on contas for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "contas_delete_own" on contas for delete using (auth.uid() = user_id);

drop policy if exists "transacoes_select_own" on transacoes;
drop policy if exists "transacoes_insert_own" on transacoes;
drop policy if exists "transacoes_update_own" on transacoes;
drop policy if exists "transacoes_delete_own" on transacoes;
create policy "transacoes_select_own" on transacoes for select using (auth.uid() = user_id);
create policy "transacoes_insert_own" on transacoes for insert with check (auth.uid() = user_id);
create policy "transacoes_update_own" on transacoes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "transacoes_delete_own" on transacoes for delete using (auth.uid() = user_id);

drop policy if exists "lembretes_select_own" on lembretes;
drop policy if exists "lembretes_insert_own" on lembretes;
drop policy if exists "lembretes_update_own" on lembretes;
drop policy if exists "lembretes_delete_own" on lembretes;
create policy "lembretes_select_own" on lembretes for select using (auth.uid() = user_id);
create policy "lembretes_insert_own" on lembretes for insert with check (auth.uid() = user_id);
create policy "lembretes_update_own" on lembretes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "lembretes_delete_own" on lembretes for delete using (auth.uid() = user_id);

drop policy if exists "comprovantes_select_own" on comprovantes;
drop policy if exists "comprovantes_insert_own" on comprovantes;
drop policy if exists "comprovantes_update_own" on comprovantes;
drop policy if exists "comprovantes_delete_own" on comprovantes;
create policy "comprovantes_select_own" on comprovantes for select using (auth.uid() = user_id);
create policy "comprovantes_insert_own" on comprovantes for insert with check (auth.uid() = user_id);
create policy "comprovantes_update_own" on comprovantes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "comprovantes_delete_own" on comprovantes for delete using (auth.uid() = user_id);

drop trigger if exists clientes_set_updated_at on clientes;
create trigger clientes_set_updated_at before update on clientes for each row execute function public.set_updated_at();

drop trigger if exists contas_set_updated_at on contas;
create trigger contas_set_updated_at before update on contas for each row execute function public.set_updated_at();

drop trigger if exists transacoes_set_updated_at on transacoes;
create trigger transacoes_set_updated_at before update on transacoes for each row execute function public.set_updated_at();

drop trigger if exists lembretes_set_updated_at on lembretes;
create trigger lembretes_set_updated_at before update on lembretes for each row execute function public.set_updated_at();

drop trigger if exists comprovantes_set_updated_at on comprovantes;
create trigger comprovantes_set_updated_at before update on comprovantes for each row execute function public.set_updated_at();

create index if not exists clientes_user_id_idx on clientes(user_id);
create index if not exists clientes_updated_at_idx on clientes(updated_at);
create index if not exists contas_user_id_idx on contas(user_id);
create index if not exists contas_cliente_id_idx on contas(cliente_id);
create index if not exists contas_updated_at_idx on contas(updated_at);
create index if not exists transacoes_user_id_idx on transacoes(user_id);
create index if not exists transacoes_conta_id_idx on transacoes(conta_id);
create index if not exists transacoes_updated_at_idx on transacoes(updated_at);
create index if not exists lembretes_user_id_idx on lembretes(user_id);
create index if not exists lembretes_data_agendada_idx on lembretes(data_agendada);
create index if not exists lembretes_parcela_numero_idx on lembretes(conta_id, parcela_numero);
create index if not exists lembretes_cliente_conta_idx on lembretes(cliente_id, conta_id);
create index if not exists lembretes_updated_at_idx on lembretes(updated_at);
create index if not exists comprovantes_user_id_idx on comprovantes(user_id);
create index if not exists comprovantes_transacao_id_idx on comprovantes(transacao_id);
create index if not exists comprovantes_updated_at_idx on comprovantes(updated_at);

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'clientes') then
    alter publication supabase_realtime add table clientes;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'contas') then
    alter publication supabase_realtime add table contas;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'transacoes') then
    alter publication supabase_realtime add table transacoes;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'lembretes') then
    alter publication supabase_realtime add table lembretes;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'comprovantes') then
    alter publication supabase_realtime add table comprovantes;
  end if;
end $$;
