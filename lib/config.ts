/**
 * Basis-URLs zentral und aus der Umgebung — NICHT aus dem Request.
 *
 * Vorher wurde success_url/cancel_url der Stripe-Session aus dem
 * Origin-Header gebaut. Dieser Header ist vom Aufrufer frei setzbar
 * (ein simples curl genügt). Damit ließ sich die Weiterleitung nach der
 * Zahlung auf eine fremde Domain umbiegen — eine Phishing-Vorlage mit
 * dem Vertrauensbonus des echten Stripe-Checkouts.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} fehlt. In .env.local setzen (Vorlage: .env.example).`
    );
  }
  return value.replace(/\/+$/, "");
}

/** Eigene Basis-URL dieser Anwendung, z. B. https://anmeldung.impact-fightacademy.de */
export function baseUrl(): string {
  return required("NEXT_PUBLIC_BASE_URL");
}

/** Hauptwebsite — für Kopfzeile, Fußzeile, Impressum und Datenschutz. */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://impactacademyv1.netlify.app").replace(
    /\/+$/,
    ""
  );
}

export const SITE_LINKS = {
  home: () => siteUrl(),
  preise: () => `${siteUrl()}/preise`,
  training: () => `${siteUrl()}/training`,
  probetraining: () => `${siteUrl()}/probetraining`,
  kontakt: () => `${siteUrl()}/kontakt`,
  impressum: () => `${siteUrl()}/impressum`,
  datenschutz: () => `${siteUrl()}/datenschutz`,
};
