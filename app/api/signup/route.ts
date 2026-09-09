import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getStripe } from "@/lib/stripe";
import { sendSignupConfirmation, sendInternalNewSignupAlert } from "@/lib/email";
import { signupSchema } from "@/lib/validation";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { baseUrl } from "@/lib/config";
import {
  quote,
  stripePriceIdFor,
  joiningFeePriceId,
  expectedAmountCents,
  AGE_GROUP_LABELS,
  TERM_LABELS,
} from "@/lib/pricing";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // --- 1. Drosselung, bevor irgendetwas Teures passiert -------------------
  const ip = clientIp(req.headers);
  const perIp = rateLimit(`signup:ip:${ip}`, 5, 60 * 60 * 1000);
  if (!perIp.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anmeldeversuche. Bitte versuch es später noch einmal." },
      { status: 429, headers: { "Retry-After": String(perIp.retryAfterSeconds) } }
    );
  }

  // --- 2. Eingabe prüfen --------------------------------------------------
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ungültige Eingabe", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const data = parsed.data;

  // Honeypot: gefüllt = Bot. Bewusst 200 zurückgeben, damit der Bot nichts lernt.
  if (data.website) {
    return NextResponse.json({ checkoutUrl: null, ok: true });
  }

  // Zweite Drosselung pro E-Mail — verhindert, dass eine fremde Adresse über
  // wechselnde IPs mit Bestätigungsmails zugeschüttet wird.
  const perEmail = rateLimit(`signup:mail:${data.email}`, 3, 24 * 60 * 60 * 1000);
  if (!perEmail.allowed) {
    return NextResponse.json(
      { error: "Für diese E-Mail-Adresse liegt bereits eine Anmeldung vor. Melde dich bitte bei uns." },
      { status: 429 }
    );
  }

  // --- 3. Tarif auflösen, BEVOR ein Datensatz entsteht --------------------
  const priceId = stripePriceIdFor(data.ageGroup, data.term, data.paymentMode);
  if (!priceId) {
    console.error(
      `Kein Stripe-Preis konfiguriert für ${data.ageGroup}/${data.term}/${data.paymentMode}`
    );
    return NextResponse.json(
      { error: "Dieser Tarif ist momentan nicht buchbar. Bitte melde dich direkt bei uns." },
      { status: 503 }
    );
  }

  const feePriceId = data.paymentMode === "monatlich" ? joiningFeePriceId() : undefined;
  if (data.paymentMode === "monatlich" && !feePriceId) {
    console.error("STRIPE_PRICE_AUFNAHMEGEBUEHR fehlt — Aufnahmegebühr könnte nicht berechnet werden");
    return NextResponse.json(
      { error: "Dieser Tarif ist momentan nicht buchbar. Bitte melde dich direkt bei uns." },
      { status: 503 }
    );
  }

  const stripe = getStripe();

  // Sicherheitsnetz gegen Preisdrift: Was Stripe für diese Price ID hinterlegt
  // hat, muss dem Betrag aus INHALT_PREISE.md entsprechen. Lieber abbrechen als
  // einem Mitglied den falschen Betrag abbuchen.
  try {
    const stripePrice = await stripe.prices.retrieve(priceId);
    const soll = expectedAmountCents(data.ageGroup, data.term, data.paymentMode);
    if (stripePrice.unit_amount !== soll) {
      console.error(
        `PREISABWEICHUNG: Stripe ${priceId} = ${stripePrice.unit_amount} Cent, ` +
          `erwartet ${soll} Cent (${data.ageGroup}/${data.term}/${data.paymentMode})`
      );
      return NextResponse.json(
        { error: "Dieser Tarif ist momentan nicht buchbar. Bitte melde dich direkt bei uns." },
        { status: 503 }
      );
    }
  } catch (err) {
    console.error("Stripe-Preis konnte nicht geprüft werden:", err);
    return NextResponse.json(
      { error: "Die Zahlung kann gerade nicht gestartet werden. Bitte versuch es später erneut." },
      { status: 503 }
    );
  }

  const supabase = getSupabaseAdmin();

  // --- 4. Dublettenprüfung (wirkt instanzübergreifend) --------------------
  const { data: bestehend } = await supabase
    .from("members")
    .select("id, status")
    .eq("email", data.email)
    .in("status", ["active", "payment_failed"])
    .maybeSingle();

  if (bestehend) {
    return NextResponse.json(
      {
        error:
          "Zu dieser E-Mail-Adresse gibt es bereits eine Mitgliedschaft. Melde dich bitte direkt bei uns, dann klären wir das persönlich.",
      },
      { status: 409 }
    );
  }

  // --- 5. Datensatz anlegen ----------------------------------------------
  const angebot = quote(data.ageGroup, data.term, data.paymentMode);

  const { data: member, error: insertError } = await supabase
    .from("members")
    .insert({
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email,
      phone: data.phone || null,
      discipline: data.discipline,
      experience_level: data.experienceLevel,
      age_group: data.ageGroup,
      term: data.term,
      payment_mode: data.paymentMode,
      monthly_amount_cents: angebot.recurringCents || null,
      total_amount_cents: angebot.dueNowCents,
      privacy_accepted_at: new Date().toISOString(),
      status: "pending_payment",
    })
    .select("id")
    .single();

  if (insertError || !member) {
    console.error("Supabase insert error:", insertError);
    return NextResponse.json(
      { error: "Anmeldung konnte nicht gespeichert werden. Bitte versuch es später erneut." },
      { status: 500 }
    );
  }

  // --- 6. Stripe-Checkout ------------------------------------------------
  const origin = baseUrl(); // bewusst NICHT req.headers.get("origin")

  const lineItems: { price: string; quantity: number }[] = [{ price: priceId, quantity: 1 }];
  if (feePriceId) lineItems.push({ price: feePriceId, quantity: 1 });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: data.paymentMode === "monatlich" ? "subscription" : "payment",
      customer_email: data.email,
      line_items: lineItems,
      success_url: `${origin}/anmeldung/erfolg?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/anmeldung/abgebrochen`,
      client_reference_id: member.id,
      metadata: { member_id: member.id },
      ...(data.paymentMode === "monatlich"
        ? { subscription_data: { metadata: { member_id: member.id } } }
        : { payment_intent_data: { metadata: { member_id: member.id } } }),
    });

    // Mails erst NACH der Antwort — der Nutzer wartet nicht auf zwei
    // Netzwerkaufrufe zum Mailanbieter, bevor er zur Zahlung kommt.
    after(async () => {
      await sendSignupConfirmation(member.id, data.email, data.firstName, {
        tarif: `${AGE_GROUP_LABELS[data.ageGroup]} · ${TERM_LABELS[data.term]}`,
        zusammenfassung: angebot.summary,
      });
      const internalTo = process.env.INTERNAL_NOTIFY_EMAIL;
      if (internalTo) {
        await sendInternalNewSignupAlert(
          member.id,
          internalTo,
          `${data.firstName} ${data.lastName}`,
          data.discipline,
          angebot.summary
        );
      }
    });

    return NextResponse.json({ checkoutUrl: session.url });
  } catch (err) {
    // Ohne das hier bliebe ein verwaister Datensatz auf pending_payment stehen
    // und niemand wüsste, dass die Zahlung nie gestartet wurde.
    console.error("Stripe Checkout fehlgeschlagen:", err);
    await supabase
      .from("members")
      .update({ status: "checkout_failed" })
      .eq("id", member.id);

    return NextResponse.json(
      { error: "Die Zahlung konnte nicht gestartet werden. Bitte versuch es später erneut." },
      { status: 502 }
    );
  }
}
