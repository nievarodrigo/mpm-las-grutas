-- Correr una sola vez en el SQL editor del proyecto de Supabase.
-- No se ejecuta automáticamente: es el DDL versionado de referencia.

create table leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  contact text not null,
  channel text not null check (channel in ('whatsapp', 'email')),
  guests smallint,
  date_estimated date,
  message text,
  status text not null default 'nuevo' check (status in ('nuevo', 'contactado')),
  email_sent boolean
);

alter table leads enable row level security;

-- El rol anónimo (usado por api/leads.js) solo puede insertar.
-- Ni select, ni update, ni delete: si la key se filtra, lo peor que puede
-- pasar es spam de filas, nunca lectura de datos de otros leads.
create policy "anon can insert leads"
  on leads
  for insert
  to anon
  with check (true);

-- Panel de administración: el rol `authenticated` (login con contraseña
-- compartida vía Supabase Auth) puede leer todas las filas y actualizar
-- únicamente la columna `status`. El grant de columna es la barrera real:
-- aunque haya un bug en el frontend del panel, Postgres rechaza cualquier
-- intento de modificar name/contact/message, no depende del JS.
--
-- El REVOKE es necesario: Supabase le otorga a `authenticated` privilegios
-- amplios (insert/update en todas las columnas) por default a nivel de
-- schema. Sin este REVOKE primero, el GRANT column-level de abajo queda
-- sin efecto — los grants son aditivos, no restringen uno más amplio ya
-- existente (verificado: sin el REVOKE, un PATCH a `name` desde el panel
-- pasaba igual pese al grant angosto).
revoke insert, update on leads from authenticated;
grant select on leads to authenticated;
grant update (status) on leads to authenticated;

create policy "authenticated can select leads"
  on leads
  for select
  to authenticated
  using (true);

create policy "authenticated can update lead status"
  on leads
  for update
  to authenticated
  using (true)
  with check (true);
