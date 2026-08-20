-- Forma — struttura del database su Supabase.
-- Da incollare una volta sola in: Supabase → SQL Editor → New query → Run.
--
-- La tabella si chiama forma_items e non items: così puoi tenere questa app e
-- Archivio nello stesso progetto Supabase senza che i dati si mescolino.

-- Una riga per cosa: una voce del diario, una sessione, una misura, una scheda.
-- Il contenuto sta in "data" (JSON) invece che in tante colonne: aggiungere un
-- campo all'app in futuro non richiede toccare il database.
create table if not exists public.forma_items (
  id                text primary key,
  user_id           uuid not null default auth.uid() references auth.users on delete cascade,
  data              jsonb not null default '{}'::jsonb,
  deleted           boolean not null default false,
  client_updated_at bigint not null default 0,
  updated_at        timestamptz not null default now()
);

-- Sicurezza: ogni account vede e modifica soltanto le proprie righe.
-- Senza questa parte, chiunque conosca la chiave "anon" (che è pubblica per
-- natura, sta dentro l'app) potrebbe leggere i tuoi dati.
alter table public.forma_items enable row level security;

drop policy if exists "solo le proprie righe" on public.forma_items;
create policy "solo le proprie righe" on public.forma_items
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- L'orologio di iPhone, iPad e Mac non è mai identico. Il momento della modifica
-- lo decide il server, così il "scarica solo le novità" non salta mai una riga.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists forma_items_touch on public.forma_items;
create trigger forma_items_touch
  before insert or update on public.forma_items
  for each row execute function public.touch_updated_at();

-- Rende immediato il recupero delle sole novità.
create index if not exists forma_items_user_updated
  on public.forma_items (user_id, updated_at);
