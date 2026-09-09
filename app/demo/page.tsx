import Link from "next/link";
import { notFound } from "next/navigation";
import { isDemoMode, readDemoDb } from "@/lib/demo";
import { formatEuro, AGE_GROUP_LABELS, TERM_LABELS } from "@/lib/pricing";
import type { AgeGroup, Term } from "@/lib/pricing";
import DemoAktion from "./DemoAktion";

export const dynamic = "force-dynamic";

const STATUS_TEXT: Record<string, { label: string; farbe: string }> = {
  pending_payment: { label: "Wartet auf Zahlung", farbe: "#f7d774" },
  checkout_failed: { label: "Kasse fehlgeschlagen", farbe: "#8f96a9" },
  active: { label: "Aktiv", farbe: "#5cc98c" },
  payment_failed: { label: "Zahlung fehlgeschlagen", farbe: "#ef4444" },
  canceled: { label: "Gekündigt", farbe: "#8f96a9" },
};

export default async function DemoPage() {
  if (!isDemoMode()) notFound();

  const db = await readDemoDb();
  const members = [...db.members].reverse();
  const events = [...db.events].reverse();
  const emails = [...db.emails].reverse();

  return (
    <main style={{ flex: 1, padding: "clamp(28px, 5vw, 52px) clamp(18px, 4vw, 32px)" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <Banner />

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            alignItems: "center",
            margin: "0 0 28px",
          }}
        >
          <div style={{ flex: "1 1 300px" }}>
            <h1 style={{ fontSize: "clamp(2rem, 4vw, 2.8rem)", marginBottom: ".2em" }}>
              Demo-Übersicht
            </h1>
            <p style={{ color: "var(--text-2)", margin: 0 }}>
              Hier siehst du in Echtzeit, was das System tut: wer sich anmeldet,
              welche Zahlungsereignisse ankommen und welche E-Mails rausgehen.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link className="ifa-btn ifa-btn-red" href="/">
              Neue Anmeldung
            </Link>
            <a className="ifa-btn ifa-btn-line" href="/demo/postfach">
              Postfach ({emails.length})
            </a>
            <DemoAktion aktion="zuruecksetzen">Alles zurücksetzen</DemoAktion>
          </div>
        </div>

        <Kennzahlen members={members} events={events} emails={emails} />

        {/* --- Mitglieder --- */}
        <h2 style={{ fontSize: "1.5rem", marginTop: 36 }}>Mitglieder ({members.length})</h2>
        {members.length === 0 ? (
          <p style={{ color: "var(--text-3)" }}>
            Noch niemand angemeldet. Klick oben auf „Neue Anmeldung“ und füll das
            Formular aus — der Eintrag erscheint dann hier.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {members.map((m) => {
              const st = STATUS_TEXT[m.status] ?? { label: m.status, farbe: "#8f96a9" };
              return (
                <div key={m.id} className="ifa-card">
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 12,
                      alignItems: "baseline",
                      marginBottom: 10,
                    }}
                  >
                    <strong style={{ fontFamily: "var(--font-disp)", fontSize: "1.3rem", letterSpacing: ".02em" }}>
                      {m.first_name} {m.last_name}
                    </strong>
                    <span
                      style={{
                        fontSize: ".8rem",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: ".06em",
                        color: st.farbe,
                        border: `1px solid ${st.farbe}`,
                        borderRadius: 20,
                        padding: "3px 10px",
                      }}
                    >
                      {st.label}
                    </span>
                    <span style={{ marginLeft: "auto", color: "var(--text-3)", fontSize: ".85rem" }}>
                      {new Date(m.created_at).toLocaleString("de-DE")}
                    </span>
                  </div>

                  <p style={{ margin: "0 0 12px", color: "var(--text-2)", fontSize: ".95rem" }}>
                    {m.email}
                    {m.phone ? ` · ${m.phone}` : ""} · {m.discipline} ({m.experience_level})
                    <br />
                    {AGE_GROUP_LABELS[m.age_group as AgeGroup]} ·{" "}
                    {TERM_LABELS[m.term as Term]} ·{" "}
                    {m.payment_mode === "monatlich"
                      ? `${formatEuro(m.monthly_amount_cents ?? 0)} monatlich`
                      : "Vorauszahlung"}{" "}
                    · gezahlt: {formatEuro(m.total_amount_cents)}
                  </p>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {m.status === "pending_payment" && (
                      <a className="ifa-btn ifa-btn-line" href={`/demo/kasse?member=${m.id}`}>
                        Zur Kasse
                      </a>
                    )}
                    {m.status === "active" && m.payment_mode === "monatlich" && (
                      <DemoAktion aktion="abbuchung_fehlgeschlagen" memberId={m.id}>
                        Abbuchung scheitern lassen
                      </DemoAktion>
                    )}
                    {m.status === "payment_failed" && (
                      <DemoAktion aktion="abbuchung_erfolgreich" memberId={m.id} variante="red">
                        Karte repariert — Abbuchung klappt
                      </DemoAktion>
                    )}
                    {(m.status === "active" || m.status === "payment_failed") && (
                      <DemoAktion aktion="gekuendigt" memberId={m.id}>
                        Kündigen
                      </DemoAktion>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* --- Ereignisse --- */}
        <h2 style={{ fontSize: "1.5rem", marginTop: 36 }}>
          Zahlungsereignisse ({events.length})
        </h2>
        {events.length === 0 ? (
          <p style={{ color: "var(--text-3)" }}>Noch keine Ereignisse.</p>
        ) : (
          <div className="ifa-card" style={{ padding: 0, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".9rem" }}>
              <thead>
                <tr>
                  <Th>Zeit</Th>
                  <Th>Ereignis</Th>
                  <Th>Mitglied verknüpft</Th>
                  <Th>Verarbeitet</Th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                    <Td>{new Date(e.created_at).toLocaleTimeString("de-DE")}</Td>
                    <Td>
                      <code style={{ color: "var(--text)" }}>{e.event_type}</code>
                    </Td>
                    <Td>{e.member_id ? "ja" : <span style={{ color: "var(--text-3)" }}>—</span>}</Td>
                    <Td>
                      {e.processed_at ? (
                        <span style={{ color: "#5cc98c" }}>ja</span>
                      ) : (
                        <span style={{ color: "#ef4444" }}>offen</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

function Kennzahlen({
  members,
  events,
  emails,
}: {
  members: { status: string }[];
  events: unknown[];
  emails: unknown[];
}) {
  const zaehle = (s: string) => members.filter((m) => m.status === s).length;
  const werte = [
    { label: "Anmeldungen", wert: members.length },
    { label: "Aktiv", wert: zaehle("active") },
    { label: "Zahlung offen", wert: zaehle("pending_payment") },
    { label: "Zahlung fehlgeschlagen", wert: zaehle("payment_failed") },
    { label: "Ereignisse", wert: events.length },
    { label: "E-Mails", wert: emails.length },
  ];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: 12,
      }}
    >
      {werte.map((w) => (
        <div key={w.label} className="ifa-card" style={{ padding: "16px 18px" }}>
          <div
            style={{
              fontFamily: "var(--font-disp)",
              fontWeight: 700,
              fontSize: "2rem",
              lineHeight: 1,
              color: "var(--red)",
            }}
          >
            {w.wert}
          </div>
          <div style={{ color: "var(--text-3)", fontSize: ".85rem", marginTop: 4 }}>{w.label}</div>
        </div>
      ))}
    </div>
  );
}

export function Banner() {
  return (
    <div
      style={{
        background: "#f7d774",
        color: "#3a2c00",
        borderRadius: 8,
        padding: "10px 14px",
        fontSize: ".88rem",
        fontWeight: 600,
        marginBottom: 22,
      }}
    >
      DEMO-MODUS — Attrappen statt echter Dienste. Keine echte Datenbank, keine
      echten Zahlungen, kein echter Mailversand. Daten liegen lokal in
      .demo-data/db.json.
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      style={{
        textAlign: "left",
        padding: "12px 16px",
        fontFamily: "var(--font-disp)",
        fontWeight: 600,
        letterSpacing: ".04em",
        textTransform: "uppercase",
        fontSize: ".85rem",
        color: "var(--text-2)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: "10px 16px", color: "var(--text-2)" }}>{children}</td>;
}
