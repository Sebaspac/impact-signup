import type { Metadata } from "next";
import "./globals.css";
import { SITE_LINKS } from "@/lib/config";

export const metadata: Metadata = {
  title: "Mitglied werden — Impact Fight Academy",
  description:
    "Online Mitglied werden bei der IMPACT Sport & Fight Academy in München-Giesing. Boxen, Kickboxen, Muay Thai und BJJ.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className="h-full">
      <body className="min-h-full flex flex-col">
        {/* Kopfzeile im Look der Website — das Logo führt zurück zur Hauptseite,
            damit erkennbar ist, dass beides zusammengehört. */}
        <header
          style={{
            borderBottom: "1px solid var(--line-soft)",
            background: "var(--bg)",
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <div
            style={{
              maxWidth: 1160,
              margin: "0 auto",
              padding: "10px clamp(18px, 4vw, 32px)",
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            <a href={SITE_LINKS.home()} aria-label="Zur Website der Impact Fight Academy">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/logo-impact-header.png"
                alt="Impact Fight Academy"
                width={161}
                height={120}
                style={{ height: 46, width: "auto", display: "block" }}
              />
            </a>
            <nav style={{ marginLeft: "auto", display: "flex", gap: 4, flexWrap: "wrap" }}>
              <HeadLink href={SITE_LINKS.training()}>Training</HeadLink>
              <HeadLink href={SITE_LINKS.preise()}>Preise</HeadLink>
              <HeadLink href={SITE_LINKS.kontakt()}>Kontakt</HeadLink>
            </nav>
          </div>
        </header>

        {children}

        {/* Fußzeile mit Impressum und Datenschutz. Beides ist für eine
            deutsche Zahlungsstrecke Pflicht und fehlte vorher komplett —
            die Seiten existieren auf der Website bereits. */}
        <footer
          style={{
            marginTop: "auto",
            borderTop: "1px solid var(--line-soft)",
            background: "var(--bg-raise)",
            padding: "28px clamp(18px, 4vw, 32px)",
          }}
        >
          <div
            style={{
              maxWidth: 1160,
              margin: "0 auto",
              display: "flex",
              flexWrap: "wrap",
              gap: "10px 22px",
              fontSize: ".9rem",
              color: "var(--text-3)",
            }}
          >
            <span>
              IMPACT Sport &amp; Fight Academy · Pfälzer-Wald-Str. 65 / Rückgebäude · 81539 München
            </span>
            <span style={{ marginLeft: "auto", display: "flex", gap: 18 }}>
              <FootLink href={SITE_LINKS.impressum()}>Impressum</FootLink>
              <FootLink href={SITE_LINKS.datenschutz()}>Datenschutzerklärung</FootLink>
              <FootLink href={SITE_LINKS.home()}>Zur Website</FootLink>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}

function HeadLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      style={{
        fontFamily: "var(--font-disp)",
        fontWeight: 600,
        fontSize: "1.02rem",
        letterSpacing: ".03em",
        textTransform: "uppercase",
        color: "var(--text-2)",
        padding: "9px 11px",
        borderRadius: 6,
        textDecoration: "none",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </a>
  );
}

function FootLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} style={{ color: "var(--text-2)", textDecoration: "none" }}>
      {children}
    </a>
  );
}
