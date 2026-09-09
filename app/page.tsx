import SignupForm from "@/components/SignupForm";
import { SITE_LINKS } from "@/lib/config";
import { isDemoMode } from "@/lib/demo";

export const dynamic = "force-dynamic";

export default function SignupPage() {
  const demo = isDemoMode();

  return (
    <main style={{ flex: 1 }}>
      <div
        style={{
          maxWidth: 780,
          margin: "0 auto",
          padding: "clamp(40px, 7vw, 72px) clamp(18px, 4vw, 32px)",
        }}
      >
        {demo && (
          <div
            style={{
              background: "#f7d774",
              color: "#3a2c00",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: ".88rem",
              fontWeight: 600,
              marginBottom: 24,
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              alignItems: "center",
            }}
          >
            <span>
              DEMO-MODUS — es wird kein Geld bewegt und keine echte E-Mail verschickt.
            </span>
            <a href="/demo" style={{ marginLeft: "auto", color: "#3a2c00", fontWeight: 700 }}>
              Zur Demo-Übersicht →
            </a>
          </div>
        )}

        <header style={{ marginBottom: "clamp(32px, 5vw, 52px)" }}>
          <h1 style={{ fontSize: "clamp(2.4rem, 6vw, 3.6rem)" }}>Mitglied werden</h1>
          <p style={{ color: "var(--text-2)", fontSize: "1.13rem", maxWidth: "62ch" }}>
            Boxen, Kickboxen, Muay Thai und BJJ in München-Giesing — seit 2006.
            Melde dich hier online an, die Mitgliedschaft startet sofort nach der Zahlung.
          </p>

          {/* Klare Abgrenzung: das kostenlose Probetraining ist ein anderer Weg
              und bleibt kostenlos. Ohne diesen Hinweis würde die Bezahlseite
              Leute abschrecken, die erst einmal reinschnuppern wollen. */}
          <div
            className="ifa-card"
            style={{ marginTop: 24, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}
          >
            <p style={{ margin: 0, color: "var(--text-2)", flex: "1 1 260px" }}>
              Du willst erst einmal reinschnuppern? Die erste Probestunde ist kostenlos.
            </p>
            <a className="ifa-btn ifa-btn-line" href={SITE_LINKS.probetraining()}>
              Kostenloses Probetraining
            </a>
          </div>
        </header>

        <SignupForm datenschutzUrl={SITE_LINKS.datenschutz()} />
      </div>
    </main>
  );
}
