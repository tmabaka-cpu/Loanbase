-- Phase 0: foundation.
-- Blueprint section 13: tenant isolation in the database, append-only financial
-- tables, and an audit log of every change.

create schema if not exists app;
grant usage on schema app to fxchange_app;

-- ---------------------------------------------------------------------------
-- Request context
-- ---------------------------------------------------------------------------
-- Each request sets these for the duration of its database transaction:
--   app.tenant_id    the tenant the signed-in user belongs to
--   app.is_operator  'on' for Moneychaps operator console requests only
-- Row-level security policies read them through the two functions below.

create or replace function app.current_tenant_id() returns uuid
language sql stable
as $$
  select nullif(current_setting('app.tenant_id', true), '')::uuid
$$;

create or replace function app.is_operator() returns boolean
language sql stable
as $$
  select coalesce(current_setting('app.is_operator', true), '') = 'on'
$$;

-- ---------------------------------------------------------------------------
-- Append-only guard
-- ---------------------------------------------------------------------------
-- Attach to any table whose rows must never be changed or removed.
-- Corrections are made by adding a reversing row, never by editing history.

create or replace function app.forbid_change() returns trigger
language plpgsql
as $$
begin
  raise exception 'Table "%" is append-only: % is not allowed', tg_table_name, tg_op
    using errcode = 'P0001';
end;
$$;

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------

create table audit_log (
  id           bigint generated always as identity primary key,
  occurred_at  timestamptz not null default now(),
  tenant_id    uuid,                 -- null for platform-level operator actions
  actor_id     uuid,                 -- staff or operator id; null for system jobs
  actor_label  text not null,        -- name or email as it was at the time
  action       text not null,        -- e.g. create, update, approve, void, sign_in
  entity       text not null,        -- e.g. transaction, customer, tenant
  entity_id    text,
  old_values   jsonb,
  new_values   jsonb,
  reason       text,
  request_id   text
);

create index audit_log_tenant_time_idx on audit_log (tenant_id, occurred_at desc);
create index audit_log_entity_idx on audit_log (tenant_id, entity, entity_id);

create trigger audit_log_no_update before update on audit_log
  for each row execute function app.forbid_change();
create trigger audit_log_no_delete before delete on audit_log
  for each row execute function app.forbid_change();
create trigger audit_log_no_truncate before truncate on audit_log
  for each statement execute function app.forbid_change();

alter table audit_log enable row level security;
alter table audit_log force row level security;

-- A tenant sees only its own rows. The operator sees everything.
create policy audit_log_select on audit_log for select
  using (tenant_id = app.current_tenant_id() or app.is_operator());

-- A tenant request can only write rows for its own tenant.
-- Rows with no tenant can only be written by the operator.
create policy audit_log_insert on audit_log for insert
  with check (tenant_id = app.current_tenant_id() or app.is_operator());

-- The application may read and add audit rows, nothing else.
grant select, insert on audit_log to fxchange_app;
