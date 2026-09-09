import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getStore } from "@/lib/store";
import { handleLifecycleEvent } from "@/lib/lifecycle";
import type Stripe from "stripe";

// Stripe braucht den rohen Body für die Signaturprüfung.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const store = getStore();

  // --- Idempotenz -------------------------------------------------------
  // Der Eintrag entsteht VOR der Verarbeitung (damit ein paralleler
  // Zweitversuch abprallt), gilt aber erst nach erfolgreicher Verarbeitung
  // als erledigt. Vorher wurde nur "schon gesehen?" geprüft — brach die
  // Verarbeitung danach ab, meldete der Stripe-Retry "duplicate" und das
  // Ereignis war dauerhaft verloren.
  const claim = await store.claimEvent(event.id, event.type, event);

  if (claim === "already_processed") {
    return NextResponse.json({ received: true, duplicate: true });
  }
  if (claim === "error") {
    // 500 -> Stripe versucht es erneut. Besser als stillschweigender Verlust.
    return NextResponse.json({ error: "Speichern fehlgeschlagen" }, { status: 500 });
  }
  if (claim === "retry") {
    console.warn(`Event ${event.id} war unverarbeitet, wird erneut versucht`);
  }

  try {
    await handleLifecycleEvent(event, store);
  } catch (err) {
    console.error(`Verarbeitung von ${event.type} (${event.id}) fehlgeschlagen:`, err);
    // processed_at bleibt NULL -> der nächste Stripe-Retry nimmt es erneut auf.
    return NextResponse.json({ error: "Verarbeitung fehlgeschlagen" }, { status: 500 });
  }

  await store.markEventProcessed(event.id);
  return NextResponse.json({ received: true });
}
