import { Resend } from "resend";
import { getSupabaseAdmin } from "./supabase";
import { SITE_LINKS } from "./config";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY fehlt (Vorlage: .env.example)");
  return new Resend(key);
}

const FROM_ADDRESS =
  process.env.EMAIL_FROM || "Impact Fight Academy <onboarding@resend.dev>";

type SendResult = { ok: true } | { ok: false; error: string };

export type EmailType =
  | "signup_confirmation"
  | "payment_confirmation"
  | "payment_failed_notice"
  | "payment_recovered"
  | "internal_new_signup"
  | "internal_payment_failed";

/**
 * Zentraler Versand. Schreibt jeden Versuch in email_log — die Tabelle war
 * im Schema angelegt, wurde aber von keiner Zeile Code beschrieben. Ohne
 * dieses Protokoll lässt sich später nicht belegen, ob ein Mitglied die
 * Zahlungserinnerung überhaupt bekommen hat.
 */
async function send(
  memberId: string | null,
  emailType: EmailType,
  to: string,
  subject: string,
  html: string
): Promise<SendResult> {
  let result: SendResult;
  try {
    const resend = getResend();
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject,
      html: wrap(html),
    });
    result = error ? { ok: false, error: error.message } : { ok: true };
  } catch (err) {
    result = { ok: false, error: err instanceof Error ? err.message : "unbekannt" };
  }

  if (!result.ok) console.error(`Mailversand fehlgeschlagen (${emailType} an ${to}):`, result.error);

  try {
    await getSupabaseAdmin().from("email_log").insert({
      member_id: memberId,
      email_type: emailType,
      sent_to: to,
      status: result.ok ? "sent" : "failed",
      error_message: result.ok ? null : result.error,
    });
  } catch (err) {
    // Protokollfehler darf den Versand nie zum Scheitern bringen.
    console.error("email_log konnte nicht geschrieben werden:", err);
  }

  return result;
}

/** Einheitlicher Rahmen, damit die Mails wie die Website aussehen. */
function wrap(inner: string): string {
  return `<div style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f2430;max-width:560px">
    <div style="background:#171d2c;padding:20px 24px">
      <span style="font-family:'Barlow Condensed',Arial Narrow,Arial,sans-serif;font-size:22px;letter-spacing:.06em;text-transform:uppercase;color:#f5f6f8">
        Impact <span style="color:#dd3333">Fight Academy</span>
      </span>
    </div>
    <div style="padding:24px">${inner}</div>
    <div style="padding:16px 24px;border-top:1px solid #e3e5ea;font-size:12px;color:#6b7280">
      IMPACT Sport &amp; Fight Academy · Pfälzer-Wald-Str. 65 / Rückgebäude · 81539 München<br>
      <a href="${SITE_LINKS.home()}" style="color:#a32222">Website</a> ·
      <a href="${SITE_LINKS.impressum()}" style="color:#a32222">Impressum</a> ·
      <a href="${SITE_LINKS.datenschutz()}" style="color:#a32222">Datenschutz</a>
    </div>
  </div>`;
}

export async function sendSignupConfirmation(
  memberId: string,
  to: string,
  firstName: string,
  details: { tarif: string; zusammenfassung: string }
) {
  return send(
    memberId,
    "signup_confirmation",
    to,
    "Deine Anmeldung bei der Impact Fight Academy",
    `<p>Hi ${esc(firstName)},</p>
     <p>danke für deine Anmeldung! Wir haben deine Angaben erhalten.</p>
     <p><b>Dein Tarif:</b> ${esc(details.tarif)}<br>
        <b>Kosten:</b> ${esc(details.zusammenfassung)}</p>
     <p>Sobald deine Zahlung bei uns eingegangen ist, bekommst du eine
        separate Bestätigung und deine Mitgliedschaft ist aktiv.</p>
     <p>Sportliche Grüße<br>Dein Impact Team</p>`
  );
}

export async function sendPaymentConfirmation(memberId: string, to: string, firstName: string) {
  return send(
    memberId,
    "payment_confirmation",
    to,
    "Zahlung bestätigt — willkommen bei Impact!",
    `<p>Hi ${esc(firstName)},</p>
     <p>deine Zahlung ist eingegangen und deine Mitgliedschaft ist jetzt aktiv.
        Wir freuen uns auf dich im Training!</p>
     <p><a href="${SITE_LINKS.training()}">Zum Trainingsplan</a></p>
     <p>Sportliche Grüße<br>Dein Impact Team</p>`
  );
}

export async function sendPaymentFailedNotice(memberId: string, to: string, firstName: string) {
  return send(
    memberId,
    "payment_failed_notice",
    to,
    "Zahlung konnte nicht verarbeitet werden",
    `<p>Hi ${esc(firstName)},</p>
     <p>leider konnten wir deine letzte Zahlung nicht verarbeiten. Bitte prüfe
        deine Zahlungsdaten, damit deine Mitgliedschaft aktiv bleibt.</p>
     <p>Bei Fragen melde dich einfach bei uns —
        <a href="${SITE_LINKS.kontakt()}">hier geht's zum Kontakt</a>.</p>
     <p>Sportliche Grüße<br>Dein Impact Team</p>`
  );
}

/** Fehlte bisher komplett: Entwarnung, wenn die Zahlung doch noch klappt. */
export async function sendPaymentRecovered(memberId: string, to: string, firstName: string) {
  return send(
    memberId,
    "payment_recovered",
    to,
    "Alles wieder in Ordnung — deine Mitgliedschaft ist aktiv",
    `<p>Hi ${esc(firstName)},</p>
     <p>deine Zahlung ist jetzt bei uns eingegangen. Deine Mitgliedschaft ist
        wieder aktiv — du musst nichts weiter tun.</p>
     <p>Sportliche Grüße<br>Dein Impact Team</p>`
  );
}

export async function sendInternalNewSignupAlert(
  memberId: string,
  to: string,
  memberName: string,
  discipline: string,
  tarif: string
) {
  return send(
    memberId,
    "internal_new_signup",
    to,
    `Neue Anmeldung: ${memberName}`,
    `<p>Neue Mitgliedschafts-Anmeldung:</p>
     <p><b>${esc(memberName)}</b><br>
        Interesse: ${esc(discipline)}<br>
        Tarif: ${esc(tarif)}</p>
     <p>Status steht auf <code>pending_payment</code>, bis Stripe die Zahlung bestätigt.</p>`
  );
}

export async function sendInternalPaymentFailedAlert(
  memberId: string,
  to: string,
  memberName: string
) {
  return send(
    memberId,
    "internal_payment_failed",
    to,
    `Zahlung fehlgeschlagen: ${memberName}`,
    `<p>Bei <b>${esc(memberName)}</b> ist eine Zahlung fehlgeschlagen.</p>
     <p>Das Mitglied wurde automatisch benachrichtigt. Ob und wann ihr nachfasst
        oder sperrt, entscheidet ihr — das System tut das bewusst nicht von selbst.</p>`
  );
}

/** Namen kommen aus einem öffentlichen Formular und landen in HTML-Mails. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
