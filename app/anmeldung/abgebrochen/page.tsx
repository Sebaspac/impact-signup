import Link from "next/link";
import { SITE_LINKS } from "@/lib/config";

export default function CanceledPage() {
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
        <h1 style={{ fontSize: "clamp(2.2rem, 5vw, 3.2rem)" }}>Kein Problem</h1>
        <p style={{ color: "var(--text-2)", margin: "0 0 28px" }}>
          Deine Anmeldung wurde nicht abgeschlossen — es wurde nichts abgebucht.
          Du kannst es jederzeit erneut versuchen. Wenn du lieber erst einmal
          reinschauen möchtest: die erste Probestunde ist kostenlos.
        </p>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          <Link className="ifa-btn ifa-btn-red" href="/">
            Zurück zur Anmeldung
          </Link>
          <a className="ifa-btn ifa-btn-line" href={SITE_LINKS.probetraining()}>
            Kostenloses Probetraining
          </a>
        </div>
      </div>
    </main>
  );
}
