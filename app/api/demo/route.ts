import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { isDemoMode, resetDemoDb } from "@/lib/demo";
import { getStore } from "@/lib/store";
import { handleLifecycleEvent } from "@/lib/lifecycle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Steuerung der Vorführung. Erzeugt Ereignisse in derselben Form, in der
 * Stripe sie schicken würde, und schickt sie durch handleLifecycleEvent —
 * also durch exakt denselben Code wie im Echtbetrieb. Nur die Herkunft des
 * Ereignisses ist nachgebaut, nicht die Verarbeitung.
 */
export async function POST(req: NextRequest) {
  if (!isDemoMode()) {
    return NextResponse.json({ error: "Demo-Modus ist nicht aktiv" }, { status: 404 });
  }

  const { aktion, memberId } = (await req.json()) as {
    aktion: string;
    memberId?: string;
  };

  const store = getStore();

  if (aktion === "zuruecksetzen") {
    await resetDemoDb();
    return NextResponse.json({ ok: true });
  }

  if (!memberId) {
    return NextResponse.json({ error: "memberId fehlt" }, { status: 400 });
  }

  const member = await store.getMemberById(memberId);
  if (!member) {
    return NextResponse.json({ error: "Mitglied nicht gefunden" }, { status: 404 });
  }

  const subscriptionId = member.stripe_subscription_id ?? `sub_demo_${member.id.slice(0, 8)}`;
  const customerId = member.stripe_customer_id ?? `cus_demo_${member.id.slice(0, 8)}`;
  const eventId = `evt_demo_${aktion}_${member.id.slice(0, 8)}_${counter()}`;

  let event: Stripe.Event | null = null;

  switch (aktion) {
    case "zahlung_erfolgreich":
      event = fakeEvent(eventId, "checkout.session.completed", {
        id: `cs_demo_${member.id.slice(0, 8)}`,
        object: "checkout.session",
        payment_status: "paid",
        customer: customerId,
        subscription: member.payment_mode === "monatlich" ? subscriptionId : null,
        client_reference_id: member.id,
        metadata: { member_id: member.id },
      });
      break;

    case "zahlung_abgelehnt":
      event = fakeEvent(eventId, "checkout.session.async_payment_failed", {
        id: `cs_demo_${member.id.slice(0, 8)}`,
        object: "checkout.session",
        payment_status: "unpaid",
        customer: customerId,
        subscription: subscriptionId,
        client_reference_id: member.id,
        metadata: { member_id: member.id },
      });
      break;

    case "abbuchung_fehlgeschlagen":
      event = fakeEvent(eventId, "invoice.payment_failed", {
        id: `in_demo_${member.id.slice(0, 8)}`,
        object: "invoice",
        parent: { subscription_details: { subscription: subscriptionId } },
      });
      break;

    case "abbuchung_erfolgreich":
      event = fakeEvent(eventId, "invoice.payment_succeeded", {
        id: `in_demo_${member.id.slice(0, 8)}`,
        object: "invoice",
        parent: { subscription_details: { subscription: subscriptionId } },
      });
      break;

    case "gekuendigt":
      event = fakeEvent(eventId, "customer.subscription.deleted", {
        id: subscriptionId,
        object: "subscription",
      });
      break;

    default:
      return NextResponse.json({ error: `Unbekannte Aktion: ${aktion}` }, { status: 400 });
  }

  // Bei der ersten erfolgreichen Zahlung müssen die Stripe-IDs am Datensatz
  // hängen, sonst findet der spätere Rechnungslauf das Mitglied nicht — genau
  // wie im Echtbetrieb.
  const claim = await store.claimEvent(event.id, event.type, event);
  if (claim === "already_processed") {
    return NextResponse.json({ ok: true, hinweis: "Ereignis war bereits verarbeitet" });
  }

  await handleLifecycleEvent(event, store);
  await store.markEventProcessed(event.id);

  return NextResponse.json({ ok: true });
}

let n = 0;
function counter() {
  n += 1;
  return n;
}

function fakeEvent(id: string, type: string, object: unknown): Stripe.Event {
  return {
    id,
    object: "event",
    api_version: "2026-06-24.dahlia",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 0,
    request: null,
    type,
    data: { object },
  } as unknown as Stripe.Event;
}
