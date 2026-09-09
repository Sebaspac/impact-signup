import { SITE_LINKS } from "@/lib/config";

export default function SuccessPage() {
  return (
    <main
      style={{
        flex: 1,
        display: "grid",
        placeItems: "center",
        padding: "clamp(48px, 9vw, 96px) clamp(18px, 4vw, 32px)",
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: 560 }}>
        <h1 style={{ fontSize: "clamp(2.2rem, 5vw, 3.2rem)" }}>Willkommen bei Impact</h1>
        {/* Bewusst vorsichtig formuliert: bei SEPA-Lastschrift ist der Checkout
            abgeschlossen, das Geld aber noch unterwegs. "Zahlung war erfolgreich"
            wäre in dem Fall schlicht falsch. */}
        <p style={{ color: "var(--text-2)", margin: "0 0 28px" }}>
          Danke für deine Anmeldung! Wir haben sie erhalten. Sobald deine Zahlung
          bei uns eingegangen ist, bekommst du eine Bestätigung per E-Mail und
          deine Mitgliedschaft ist aktiv. Je nach Zahlungsart kann das einen
          Moment dauern.
        </p>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          <a className="ifa-btn ifa-btn-red" href={SITE_LINKS.training()}>
            Zum Trainingsplan
          </a>
          <a className="ifa-btn ifa-btn-line" href={SITE_LINKS.home()}>
            Zur Website
          </a>
        </div>
      </div>
    </main>
  );
}
