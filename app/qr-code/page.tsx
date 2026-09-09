import QrPrint from "./QrPrint";
import { baseUrl } from "@/lib/config";

/**
 * Der QR-Code kodiert die konfigurierte öffentliche Basis-URL, nicht
 * window.location.origin. Sonst würde ein Ausdruck, der versehentlich auf
 * localhost erzeugt wurde, einen Code mit "http://localhost:3000" tragen —
 * für jeden Scanner draußen wertlos.
 *
 * Bewusst NICHT vorgerendert: die Adresse steht erst zur Laufzeit fest.
 * Würde diese Seite zur Bauzeit gerendert, schlüge jeder Build fehl, bei dem
 * die Umgebungsvariablen noch nicht gesetzt sind.
 */
export const dynamic = "force-dynamic";

export default function QRCodePage() {
  const url = baseUrl();

  return (
    <main
      className="qr-page"
      style={{
        flex: 1,
        display: "grid",
        placeItems: "center",
        padding: "clamp(40px, 8vw, 80px) clamp(18px, 4vw, 32px)",
        textAlign: "center",
      }}
    >
      <div>
        <h1 style={{ fontSize: "clamp(2rem, 5vw, 3rem)", marginBottom: 24 }}>
          Jetzt Mitglied werden
        </h1>

        <QrPrint url={url} />
      </div>

      {/* Auf Papier weiß mit schwarzer Schrift: der dunkle Hintergrund frisst
          Toner und macht den Code schlechter scanbar. */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; color: #000 !important; }
          .qr-page h1, .qr-page p { color: #000 !important; }
          header, footer { display: none !important; }
        }
      `}</style>
    </main>
  );
}
