import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  sendPaymentConfirmation,
  sendPaymentFailedNotice,
  sendPaymentRecovered,
  sendInternalPaymentFailedAlert,
} from "@/lib/email";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";

// Stripe braucht den rohen Body für die Signaturprüfung.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Member = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  status: string;
};

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET fehlt");
    return NextResponse.json({ error: "Server-Konfigurationsfehler" }, { status: 500 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    if (!signature) throw new Error("Kein stripe-signature Header vorhanden");
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook-Signaturprüfung fehlgeschlagen:", err);
    return NextResponse.json({ error: "Ungültige Signatur" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // --- Idempotenz -------------------------------------------------------
  // WICHTIG: Der Eintrag wird angelegt, BEVOR verarbeitet wird (damit ein
  // paralleler Zweitversuch abprallt), aber mit processed_at = NULL. Erst nach
  // erfolgreicher Verarbeitung wird processed_at gesetzt.
  //
  // Vorher wurde nur "schon gesehen?" geprüft. Brach die Verarbeitung danach ab
  // (Supabase weg, Resend weg), meldete der Stripe-Retry "duplicate" und das
  // Ereignis war dauerhaft verloren — eine bezahlte Mitgliedschaft wäre für
  // immer auf pending_payment stehen geblieben.
  const { error: claimError } = await supabase.from("payment_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
    raw_payload: event as unknown as Record<string, unknown>,
  });

  if (claimError) {
    if (claimError.code === "23505") {
      const { data: vorhanden } = await supabase
        .from("payment_events")
        .select("processed_at")
        .eq("stripe_event_id", event.id)
        .single();

      if (vorhanden?.processed_at) {
        return NextResponse.json({ received: true, duplicate: true });
      }
      // Bekannt, aber nie fertig verarbeitet -> erneut versuchen.
      console.warn(`Event ${event.id} war unverarbeitet, wird erneut versucht`);
    } else {
      console.error("payment_events konnte nicht geschrieben werden:", claimError);
      // 500 -> Stripe versucht es erneut. Besser als ein stillschweigender Verlust.
      return NextResponse.json({ error: "Speichern fehlgeschlagen" }, { status: 500 });
    }
  }

  try {
    await handleEvent(event, supabase);
  } catch (err) {
    console.error(`Verarbeitung von ${event.type} (${event.id}) fehlgeschlagen:`, err);
    // processed_at bleibt NULL -> der nächste Stripe-Retry nimmt es erneut auf.
    return NextResponse.json({ error: "Verarbeitung fehlgeschlagen" }, { status: 500 });
  }

  await supabase
    .from("payment_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("stripe_event_id", event.id);

  return NextResponse.json({ received: true });
}

async function handleEvent(event: Stripe.Event, supabase: SupabaseClient) {
  switch (event.type) {
    // --- Abschluss des Checkouts ----------------------------------------
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const memberId = session.metadata?.member_id || session.client_reference_id;
      if (!memberId) {
        console.warn(`checkout.session.completed ohne member_id (${session.id})`);
        return;
      }

      // Bei SEPA und anderen verzögerten Zahlungsarten ist der Checkout
      // abgeschlossen, das Geld aber noch unterwegs. Dann NICHT auf active
      // setzen — das erledigt später checkout.session.async_payment_succeeded
      // bzw. invoice.payment_succeeded.
      if (session.payment_status === "unpaid") {
        await linkStripeIds(supabase, memberId, session);
        return;
      }

      await linkStripeIds(supabase, memberId, session);
      await setActive(supabase, memberId, event.id);
      return;
    }

    // Verzögerte Zahlung (SEPA-Lastschrift) ist doch noch eingegangen.
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      const memberId = session.metadata?.member_id || session.client_reference_id;
      if (!memberId) return;
      await linkStripeIds(supabase, memberId, session);
      await setActive(supabase, memberId, event.id);
      return;
    }

    case "checkout.session.async_payment_failed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const memberId = session.metadata?.member_id || session.client_reference_id;
      if (!memberId) return;
      const member = await memberById(supabase, memberId);
      if (member) await markPaymentFailed(supabase, member, event.id);
      return;
    }

    // --- Wiederkehrende Zahlung erfolgreich ------------------------------
    // Fehlte vorher komplett. Ohne diesen Zweig blieb jedes Mitglied, dessen
    // Abbuchung einmal scheiterte, für immer auf payment_failed stehen — auch
    // nachdem es die Karte längst repariert hatte. Das Team hätte Leuten
    // hinterhertelefoniert, die längst bezahlt haben.
    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = subscriptionIdOf(invoice);
      if (!subscriptionId) return;

      const member = await memberBySubscription(supabase, subscriptionId);
      if (!member) return;

      const warFehlgeschlagen = member.status === "payment_failed";
      await supabase
        .from("members")
        .update({ status: "active" })
        .eq("id", member.id);
      await linkEvent(supabase, event.id, member.id);

      if (warFehlgeschlagen) {
        await sendPaymentRecovered(member.id, member.email, member.first_name);
      }
      return;
    }

    // --- Wiederkehrende Zahlung fehlgeschlagen ---------------------------
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = subscriptionIdOf(invoice);
      if (!subscriptionId) return;

      const member = await memberBySubscription(supabase, subscriptionId);
      if (!member) return;
      await markPaymentFailed(supabase, member, event.id);
      return;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const member = await memberBySubscription(supabase, subscription.id);
      if (!member) return;
      await supabase.from("members").update({ status: "canceled" }).eq("id", member.id);
      await linkEvent(supabase, event.id, member.id);
      return;
    }

    default:
      // Andere Ereignisse bewusst ignorieren.
      return;
  }
}

/**
 * Die Subscription-ID einer Invoice. Stripe hat die Stelle mit den neueren
 * API-Versionen von invoice.subscription nach invoice.parent.subscription_details
 * verschoben; beide Wege werden abgedeckt, damit ein API-Wechsel nicht still
 * dazu führt, dass keine Zahlungsausfälle mehr erkannt werden.
 */
function subscriptionIdOf(invoice: Stripe.Invoice): string | undefined {
  const neu = invoice.parent?.subscription_details?.subscription;
  if (typeof neu === "string") return neu;
  if (neu && typeof neu === "object" && "id" in neu) return (neu as { id: string }).id;

  const alt = (invoice as unknown as { subscription?: string | { id: string } }).subscription;
  if (typeof alt === "string") return alt;
  if (alt && typeof alt === "object" && "id" in alt) return alt.id;

  return undefined;
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

async function linkStripeIds(
  supabase: SupabaseClient,
  memberId: string,
  session: Stripe.Checkout.Session
) {
  await supabase
    .from("members")
    .update({
      stripe_customer_id: idOf(session.customer as string | { id: string } | null),
      stripe_subscription_id: idOf(session.subscription as string | { id: string } | null),
    })
    .eq("id", memberId);
}

async function setActive(supabase: SupabaseClient, memberId: string, eventId: string) {
  await supabase.from("members").update({ status: "active" }).eq("id", memberId);
  await linkEvent(supabase, eventId, memberId);

  const member = await memberById(supabase, memberId);
  if (member) await sendPaymentConfirmation(member.id, member.email, member.first_name);
}

async function markPaymentFailed(
  supabase: SupabaseClient,
  member: Member,
  eventId: string
) {
  await supabase.from("members").update({ status: "payment_failed" }).eq("id", member.id);
  await linkEvent(supabase, eventId, member.id);

  await sendPaymentFailedNotice(member.id, member.email, member.first_name);

  const internalTo = process.env.INTERNAL_NOTIFY_EMAIL;
  if (internalTo) {
    await sendInternalPaymentFailedAlert(
      member.id,
      internalTo,
      `${member.first_name} ${member.last_name}`
    );
  }
}

/**
 * payment_events.member_id wurde vorher nie gefüllt und war immer NULL — die
 * Zahlungshistorie hatte also keinen Bezug zum Mitglied und war damit für
 * jede spätere Mahnstufen-Logik wertlos.
 */
async function linkEvent(supabase: SupabaseClient, eventId: string, memberId: string) {
  await supabase
    .from("payment_events")
    .update({ member_id: memberId })
    .eq("stripe_event_id", eventId);
}

async function memberById(supabase: SupabaseClient, id: string): Promise<Member | null> {
  const { data } = await supabase
    .from("members")
    .select("id, email, first_name, last_name, status")
    .eq("id", id)
    .maybeSingle();
  return (data as Member) ?? null;
}

async function memberBySubscription(
  supabase: SupabaseClient,
  subscriptionId: string
): Promise<Member | null> {
  const { data } = await supabase
    .from("members")
    .select("id, email, first_name, last_name, status")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();
  return (data as Member) ?? null;
}
