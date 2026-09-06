-- Forma — notifiche push. Da incollare in: Supabase → SQL Editor → New query → Run.
--
-- Serve solo se vuoi gli avvisi anche a telefono chiuso. L'app funziona
-- benissimo senza: quello che cambia è che i promemoria smettono di dipendere
-- dall'avere l'app aperta.

-- Un dispositivo per riga. L'endpoint è l'indirizzo che Apple (o Google) dà al
-- telefono per ricevere le notifiche, ed è unico: se reinstalli l'app ne
-- arriva uno nuovo e il vecchio smette di rispondere.
create table if not exists public.forma_push (
  endpoint      text primary key,
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  p256dh        text not null,
  auth          text not null,
  -- la versione dell'app su QUESTO dispositivo: serve a capire chi è rimasto
  -- indietro e va avvisato di aggiornare
  versione      text not null default '',
  preavviso     int  not null default 15,
  fuso          text not null default 'Europe/Rome',
  -- le notifiche già mandate, per non ripetere lo stesso avviso ogni cinque
  -- minuti finché l'ora non passa
  inviati       jsonb not null default '[]'::jsonb,
  visto         timestamptz not null default now(),
  creato        timestamptz not null default now()
);

alter table public.forma_push enable row level security;

drop policy if exists "solo i propri dispositivi" on public.forma_push;
create policy "solo i propri dispositivi" on public.forma_push
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists forma_push_user on public.forma_push (user_id);

-- La funzione che manda gli avvisi gira con la chiave di servizio, che passa
-- sopra alle regole qui sopra: è l'unico modo perché possa leggere le agende
-- di tutti i dispositivi registrati.
