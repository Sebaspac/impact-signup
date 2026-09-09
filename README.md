# Impact Fight Academy — Online-Mitgliedschaft

Anmeldeformular → Stripe-Checkout → automatische E-Mails → Supabase-Backend.
Gegenstück zur Hauptwebsite: die Website wirbt und sammelt Anfragen, dieses
System macht daraus zahlende Mitglieder.

## Was das System macht

1. Interessent scannt einen QR-Code oder klickt auf der Website „Online Mitglied
   werden" (`/anmeldung`) → landet hier auf dem Anmeldeformular
2. Formular ausfüllen: Daten, Disziplin, **Altersgruppe, Laufzeit, Zahlweise**
3. Datensatz in Supabase mit Status `pending_payment`
4. Weiterleitung zu Stripe Checkout
5. Stripe meldet per Webhook zurück → Status `active`, Zahlungsbestätigung geht raus
6. Scheitert später eine Abbuchung → Status `payment_failed`, Mitglied und Team
   werden benachrichtigt
7. Wird die Zahlung später doch eingezogen → Status geht zurück auf `active`,
   das Mitglied bekommt eine Entwarnung

**Bewusst nicht automatisiert:** Sperrung oder Kündigung nach X fehlgeschlagenen
Versuchen. Das System erkennt und meldet Zahlungsausfälle zuverlässig — was danach
passiert, entscheidet ihr.

---

## ⚠️ Vor dem Livegang unbedingt lesen

**Die Preise dieses Systems müssen mit `INHALT_PREISE.md` der Website übereinstimmen.**
Eine frühere Fassung berechnete 225/175/150/125 € pro Monat für Laufzeiten von
1/6/12/24 Monaten — das war rund das Doppelte bis Dreifache der tatsächlichen
Beiträge und enthielt Laufzeiten, die es gar nicht gibt.

Die gültige Preisstruktur steht in `lib/pricing.ts` und staffelt sich nach
**Altersgruppe und Laufzeit**, nicht nach Sportart:

| | 6 Monate | 12 Monate | Vorauszahlung 6 Mon. | Vorauszahlung 12 Mon. |
|---|---|---|---|---|
| Erwachsener | 79 €/Monat | 69 €/Monat | 450 € | 780 € |
| Jugendlicher (13–18) | 75 €/Monat | 69 €/Monat | 420 € | 720 € |
| Kind (bis 12) | 69 €/Monat | 59 €/Monat | 390 € | 660 € |

Dazu einmalig **50 € Aufnahmegebühr** — die bei Vorauszahlung entfällt.

Ändern sich Preise, ändert sich zuerst `INHALT_PREISE.md` und `preise.html` auf
der Website, danach `lib/pricing.ts` und die Beträge im Stripe-Dashboard.

**Eingebautes Sicherheitsnetz:** Vor jeder Checkout-Session fragt das System den
Betrag zu der Stripe Price ID ab und vergleicht ihn mit dem Sollbetrag aus
`lib/pricing.ts`. Bei Abweichung bricht die Anmeldung ab, statt einen falschen
Betrag abzubuchen. Fehlt eine Price ID, ist der Tarif schlicht nicht buchbar.

---

## Was noch offen ist (braucht Entscheidungen von euch)

- **Stripe-Preise anlegen.** 12 wiederkehrende bzw. einmalige Preise plus die
  Aufnahmegebühr, siehe `.env.example`. Ohne diese IDs ist nichts buchbar.
- **Mindestlaufzeit.** Die 6- und 12-Monats-Tarife sind aktuell monatlich
  kündbare Abos zum jeweiligen Preis. Eine echte vertragliche Bindung erzwingt
  das System nicht. Wie soll das vertraglich laufen?
- **Rechtstexte im Checkout.** AGB und Widerrufsbelehrung fehlen. Impressum und
  Datenschutzerklärung sind aus Kopf- und Fußzeile heraus verlinkt und die
  Einwilligung wird beim Absenden erfasst (`members.privacy_accepted_at`) —
  AGB/Widerruf gehören aber noch dazu und sollten von einem Anwalt kommen.
- **Absenderdomain.** Für den echten Betrieb muss `impact-fightacademy.de` bei
  Resend verifiziert werden. Der Standardabsender `onboarding@resend.dev` ist
  nur für Tests.
- **Kinder unter 18.** Wer schließt den Vertrag ab, wer zahlt, braucht es eine
  Einverständniserklärung der Eltern? Das Formular bildet das aktuell nicht ab.

---

## Setup

### 1. Supabase

1. Projekt auf [supabase.com](https://supabase.com) anlegen
2. SQL Editor → `supabase/schema.sql` ausführen
3. **Danach zwingend `supabase/02_rls.sql` ausführen.** Ohne das stehen die
   Mitgliedertabellen über den öffentlichen anon-Key für jeden offen.
4. Projekt-Einstellungen > API → `Project URL` und `service_role`-Key kopieren

Kontrolle, dass die Absicherung greift:

```sql
select tablename, rowsecurity from pg_tables where schemaname = 'public';
-- muss für members, payment_events und email_log jeweils true zeigen
```

### 2. Stripe

Im **Testmodus** ein Produkt „Impact Mitgliedschaft" anlegen und die Preise aus
der Tabelle oben eintragen — je einen wiederkehrenden Preis (monatlich) und
einen Einmalpreis (Vorauszahlung) pro Altersgruppe und Laufzeit, plus einen
Einmalpreis für die Aufnahmegebühr. Die `price_...`-IDs in `.env.local` eintragen.

### 3. Resend

Account anlegen, API Key erzeugen, in `RESEND_API_KEY` eintragen.

### 4. Environment

```bash
cp .env.example .env.local
# alle Werte eintragen
```

### 5. Starten

```bash
npm install
npm run dev
```

- `http://localhost:3000` — Anmeldeformular
- `http://localhost:3000/qr-code` — druckbarer QR-Code

### 6. Webhook lokal testen

```bash
stripe listen --forward-to localhost:3000/api/stripe-webhook
```

Das ausgegebene `whsec_...` in `STRIPE_WEBHOOK_SECRET` eintragen. Das Terminal
muss dabei offen bleiben.

Testkarten: `4242 4242 4242 4242` (Erfolg), `4000 0000 0000 0002` (Ablehnung).

---

## Deployment und Andockung an die Website

Das System braucht einen Server (Stripe-Webhook, Secrets) und läuft deshalb als
**eigenes Deployment**, nicht im Repo der Website. Das ist kein Schönheitsgrund:
der Repo-Stamm der Website wird von Netlify öffentlich ausgeliefert — läge dieser
Code dort, wären `lib/supabase.ts`, die API-Routen und das SQL-Schema
herunterladbar.

Für Besucher soll es sich trotzdem wie ein Produkt anfühlen. Deshalb:

1. Dieses Projekt deployen (eigenes Netlify-Projekt oder Vercel), alle
   Environment-Variablen dort setzen
2. Webhook-Endpunkt im Stripe-Dashboard auf
   `https://DEINE-ADRESSE/api/stripe-webhook` zeigen lassen
3. Im Website-Repo in `_redirects` die Platzhalter-Adresse durch die echte
   ersetzen — dann funktioniert `/anmeldung` auf der Hauptdomain

Die Markenangleichung ist bereits erledigt: gleiche Farben, gleiche Schriften
(lokal, keine externen Schriftserver), Logo und Navigation zurück zur Website,
Impressum und Datenschutz in der Fußzeile.
