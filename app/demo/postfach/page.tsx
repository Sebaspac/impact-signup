import { notFound } from "next/navigation";
import { isDemoMode, readDemoDb } from "@/lib/demo";
import { Banner } from "../page";

export const dynamic = "force-dynamic";

const TYP_TEXT: Record<string, string> = {
  signup_confirmation: "Anmeldebestätigung an das Mitglied",
  payment_confirmation: "Zahlungsbestätigung an das Mitglied",
  payment_failed_notice: "Zahlung fehlgeschlagen — an das Mitglied",
  payment_recovered: "Entwarnung — an das Mitglied",
  internal_new_signup: "Interne Meldung: neue Anmeldung",
  internal_payment_failed: "Interne Meldung: Zahlung fehlgeschlagen",
};

/**
 * Postfach der Vorführung. Im Demo-Modus geht keine Mail raus — sie landet
 * hier, vollständig gerendert. So lässt sich zeigen, was ein Mitglied
 * tatsächlich bekäme, ohne jemandem echte Post zu schicken.
 */
export default async function PostfachPage() {
  if (!isDemoMode()) notFound();

  const db = await readDemoDb();
  const emails = [...db.emails].reverse();

  return (
    <main style={{ flex: 1, padding: "clamp(28px, 5vw, 52px) clamp(18px, 4vw, 32px)" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <Banner />

        <div style={{ display: "flex", gap: 16, alignItems: "baseline", marginBottom: 24 }}>
          <h1 style={{ fontSize: "clamp(2rem, 4vw, 2.6rem)", margin: 0 }}>Postfach</h1>
          <a href="/demo" style={{ marginLeft: "auto", color: "var(--text-2)" }}>
            ← Zur Übersicht
          </a>
        </div>

        {emails.length === 0 ? (
          <p style={{ color: "var(--text-3)" }}>
            Noch keine E-Mails. Melde dich einmal an — dann erscheinen hier die
            Anmeldebestätigung und die interne Benachrichtigung.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 18 }}>
            {emails.map((m) => (
              <article key={m.id} className="ifa-card">
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 10,
                    alignItems: "baseline",
                    marginBottom: 4,
                  }}
                >
                  <strong style={{ fontSize: "1.05rem" }}>{m.subject}</strong>
                  <span style={{ marginLeft: "auto", color: "var(--text-3)", fontSize: ".85rem" }}>
                    {new Date(m.created_at).toLocaleString("de-DE")}
                  </span>
                </div>
                <p style={{ margin: "0 0 4px", color: "var(--text-2)", fontSize: ".9rem" }}>
                  An: {m.sent_to}
                </p>
                <p style={{ margin: "0 0 14px", color: "var(--text-3)", fontSize: ".85rem" }}>
                  {TYP_TEXT[m.email_type] ?? m.email_type}
                  {m.status !== "sent" && (
                    <span style={{ color: "#ef4444" }}> · Versand fehlgeschlagen</span>
                  )}
                </p>

                {/* Die Mail so, wie sie beim Empfänger ankäme. srcDoc statt
                    dangerouslySetInnerHTML: der Inhalt bleibt im iframe
                    gekapselt und kann das Postfach nicht überschreiben. */}
                <iframe
                  title={`Vorschau: ${m.subject}`}
                  srcDoc={m.html}
                  sandbox=""
                  style={{
                    width: "100%",
                    height: 300,
                    border: "1px solid var(--line-soft)",
                    borderRadius: 8,
                    background: "#fff",
                  }}
                />
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
