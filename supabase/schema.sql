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
