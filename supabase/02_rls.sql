-- Impact Fight Academy — Absicherung der Mitgliedertabellen
-- NACH schema.sql im Supabase SQL Editor ausführen.
--
-- WARUM DAS NÖTIG IST
-- Supabase stellt jede Tabelle im Schema "public" automatisch über PostgREST bereit.
-- Der anon-Key ist öffentlich (er ist dafür gemacht, im Browser zu stehen). Ohne Row
-- Level Security kann jeder, der Projekt-URL und anon-Key kennt, die komplette
-- Mitgliederliste lesen, ändern und löschen — Namen, E-Mail, Telefon, Stripe-IDs.
--
-- Dieses Setup schreibt und liest ausschließlich über die Server-API-Routes mit dem
-- service_role-Key. Der umgeht RLS bewusst und ist davon nicht betroffen.
-- Es gibt also keinen legitimen Zugriff über anon/authenticated — genau das wird hier
-- festgeschrieben: RLS an, KEINE Policy. Ergebnis: von außen null Zugriff.

alter table members       enable row level security;
alter table payment_events enable row level security;
alter table email_log      enable row level security;

-- Erzwingt RLS auch für den Tabelleneigentümer. Schützt davor, dass ein späterer
-- Zugriff unter der Eigentümerrolle die Sperre unbemerkt umgeht.
alter table members       force row level security;
alter table payment_events force row level security;
alter table email_log      force row level security;

-- Zusätzlich die Rechte entziehen (Gürtel und Hosenträger): selbst wenn jemand später
-- versehentlich eine zu weite Policy anlegt, fehlt den öffentlichen Rollen das GRANT.
revoke all on members        from anon, authenticated;
revoke all on payment_events from anon, authenticated;
revoke all on email_log      from anon, authenticated;

-- Kontrolle: muss für alle drei Tabellen rowsecurity = true liefern.
-- select tablename, rowsecurity from pg_tables where schemaname = 'public';
