-- Impact Fight Academy — Mitgliedschafts-Backend
-- Im Supabase SQL Editor ausführen (Projekt > SQL Editor > New query).
-- DANACH ZWINGEND 02_rls.sql ausführen — sonst stehen diese Tabellen
-- über den öffentlichen anon-Key für jeden offen.

create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Stammdaten
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,

  -- Kampfsport-Kontext (Disziplinen wörtlich nach PRODUCT.md der Website)
  discipline text not null,        -- 'Boxen' | 'Kickboxen' | 'Muay Thai' | 'BJJ'
  experience_level text,           -- 'Anfänger' | 'Fortgeschritten' | 'Profi'

  -- Mitgliedschaft. Die Preise staffeln sich nach ALTERSGRUPPE und LAUFZEIT
  -- (siehe INHALT_PREISE.md der Website), nicht nach Sportart.
  age_group text not null,         -- 'erwachsener' | 'jugendlicher' | 'kind'
  term text not null,              -- '6_monate' | '12_monate'
  payment_mode text not null,      -- 'monatlich' | 'vorauszahlung'

  -- Beträge in Cent, wie sie zum Zeitpunkt der Anmeldung galten. Bewusst
  -- mitgeschrieben: ändert sich später die Preisliste, bleibt nachvollziehbar,
  -- was mit diesem Mitglied tatsächlich vereinbart wurde.
  monthly_amount_cents integer,    -- NULL bei Vorauszahlung
  total_amount_cents integer not null,

  -- DSGVO-Nachweis der Einwilligung
  privacy_accepted_at timestamptz,

  -- Stripe-Referenzen
  stripe_customer_id text unique,
  stripe_subscription_id text unique,

  status text not null default 'pending_payment',

  constraint valid_status check (status in (
    'pending_payment',   -- angelegt, Zahlung noch nicht bestätigt
    'checkout_failed',   -- Stripe-Session ließ sich nicht erzeugen
    'active',
    'payment_failed',
    'canceled'
  )),
  constraint valid_age_group check (age_group in ('erwachsener', 'jugendlicher', 'kind')),
  constraint valid_term check (term in ('6_monate', '12_monate')),
  constraint valid_payment_mode check (payment_mode in ('monatlich', 'vorauszahlung'))
);

create index if not exists idx_members_email on members(email);
create index if not exists idx_members_status on members(status);
create index if not exists idx_members_stripe_customer on members(stripe_customer_id);

-- Zahlungsereignisse (Historie, Idempotenz, Grundlage für spätere Mahnstufen)
create table if not exists payment_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  member_id uuid references members(id) on delete cascade,
  stripe_event_id text unique not null,
  event_type text not null,
  raw_payload jsonb,

  -- NULL = angenommen, aber noch nicht fertig verarbeitet. Erst wenn hier ein
  -- Zeitstempel steht, gilt das Ereignis als erledigt. Ohne diese Spalte würde
  -- ein Stripe-Retry nach einem Absturz als "schon gesehen" abgewiesen und das
  -- Ereignis wäre dauerhaft verloren.
  processed_at timestamptz
);

create index if not exists idx_payment_events_member on payment_events(member_id);
create index if not exists idx_payment_events_unprocessed
  on payment_events(created_at) where processed_at is null;

-- E-Mail-Protokoll: welche automatisierte Mail ging wann an wen, und kam sie raus
create table if not exists email_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  member_id uuid references members(id) on delete cascade,
  email_type text not null,
  sent_to text not null,
  status text not null default 'sent',   -- 'sent' | 'failed'
  error_message text
);

create index if not exists idx_email_log_member on email_log(member_id);

-- updated_at automatisch pflegen
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_members_updated_at on members;
create trigger trg_members_updated_at
  before update on members
  for each row
  execute function set_updated_at();
