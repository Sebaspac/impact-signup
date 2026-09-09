import SignupForm from "@/components/SignupForm";
import { SITE_LINKS } from "@/lib/config";

export default function SignupPage() {
  return (
    <main style={{ flex: 1 }}>
      <div
        style={{
          maxWidth: 780,
          margin: "0 auto",
          padding: "clamp(40px, 7vw, 72px) clamp(18px, 4vw, 32px)",
        }}
      >
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
