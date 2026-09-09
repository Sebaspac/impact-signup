import { notFound } from "next/navigation";
import { isDemoMode } from "@/lib/demo";
import { getStore } from "@/lib/store";
import { formatEuro, AGE_GROUP_LABELS, TERM_LABELS } from "@/lib/pricing";
import type { AgeGroup, Term } from "@/lib/pricing";
import DemoAktion from "../DemoAktion";

export const dynamic = "force-dynamic";

/**
 * Nachgebaute Kassenseite. Sie sieht aus wie eine Zahlungsseite, nimmt aber
 * bewusst KEINE Kartendaten entgegen — es gibt nichts einzutippen, nur zwei
 * Knöpfe für den Ausgang. So kann niemand versehentlich echte Daten eingeben.
 */
export default async function DemoKassePage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string }>;
}) {
  if (!isDemoMode()) notFound();

  const { member: memberId } = await searchParams;
  if (!memberId) notFound();

  const member = await getStore().getMemberById(memberId);
  if (!member) notFound();

  const monatlich = member.payment_mode === "monatlich";

  return (
    <main
      style={{
        flex: 1,
        display: "grid",
        placeItems: "center",
        padding: "clamp(32px, 6vw, 64px) clamp(18px, 4vw, 32px)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 520 }}>
        <div
          style={{
            background: "#f7d774",
            color: "#3a2c00",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: ".88rem",
            fontWeight: 600,
            marginBottom: 20,
            textAlign: "center",
          }}
        >
          DEMO — nachgebaute Kasse. Es wird kein Geld bewegt, es werden keine
          Kartendaten abgefragt.
        </div>

        <div className="ifa-card">
          <h1 style={{ fontSize: "1.6rem" }}>Zahlung</h1>

          <dl style={{ margin: "0 0 20px" }}>
            <Zeile label="Name" wert={`${member.first_name} ${member.last_name}`} />
            <Zeile label="E-Mail" wert={member.email} />
            <Zeile
              label="Tarif"
              wert={`${AGE_GROUP_LABELS[member.age_group as AgeGroup]} · ${
                TERM_LABELS[member.term as Term]
              }`}
            />
            <Zeile label="Disziplin" wert={member.discipline} />
          </dl>

          <div
            style={{
              borderTop: "1px solid var(--line-soft)",
              paddingTop: 16,
              marginBottom: 22,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ color: "var(--text-2)" }}>Heute fällig</span>
              <strong style={{ fontSize: "1.5rem", fontFamily: "var(--font-disp)" }}>
                {formatEuro(member.total_amount_cents)}
              </strong>
            </div>
            {monatlich && member.monthly_amount_cents && (
              <p style={{ margin: "6px 0 0", color: "var(--text-3)", fontSize: ".88rem" }}>
                Enthält 50 € Aufnahmegebühr. Danach{" "}
                {formatEuro(member.monthly_amount_cents)} monatlich.
              </p>
            )}
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <DemoAktion
              aktion="zahlung_erfolgreich"
              memberId={member.id}
              variante="red"
              breit
              weiterNach="/anmeldung/erfolg"
            >
              Zahlung erfolgreich
            </DemoAktion>
            <DemoAktion
              aktion="zahlung_abgelehnt"
              memberId={member.id}
              breit
              weiterNach="/demo"
            >
              Zahlung ablehnen
            </DemoAktion>
            <a className="ifa-btn ifa-btn-line" href="/anmeldung/abgebrochen" style={{ width: "100%" }}>
              Abbrechen
            </a>
          </div>
        </div>

        <p style={{ textAlign: "center", marginTop: 18 }}>
          <a href="/demo" style={{ color: "var(--text-3)", fontSize: ".88rem" }}>
            Zur Demo-Übersicht
          </a>
        </p>
      </div>
    </main>
  );
}

function Zeile({ label, wert }: { label: string; wert: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "5px 0" }}>
      <dt style={{ color: "var(--text-3)" }}>{label}</dt>
      <dd style={{ margin: 0, textAlign: "right" }}>{wert}</dd>
    </div>
  );
}
