/**
 * Der Lebenszyklus einer Mitgliedschaft — bewusst getrennt von der
 * Webhook-Route, damit der Demo-Modus exakt dieselbe Logik durchläuft
 * wie der Echtbetrieb. Eine Vorführung, die einen anderen Code ausführt
 * als die Produktion, beweist nichts.
 */

import type Stripe from "stripe";
import type { Store, Member } from "./store";
import {
  sendPaymentConfirmation,
  sendPaymentFailedNotice,
  sendPaymentRecovered,
  sendInternalPaymentFailedAlert,
} from "./email";

export async function handleLifecycleEvent(event: Stripe.Event, store: Store) {
  switch (event.type) {
    // --- Abschluss des Checkouts ----------------------------------------
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const memberId = session.metadata?.member_id || session.client_reference_id;
      if (!memberId) {
        console.warn(`checkout.session.completed ohne member_id (${session.id})`);
        return;
      }

      await store.linkStripeIds(memberId, {
        customerId: idOf(session.customer as string | { id: string } | null),
        subscriptionId: idOf(session.subscription as string | { id: string } | null),
      });

      // Bei SEPA und anderen verzögerten Zahlungsarten ist der Checkout
      // abgeschlossen, das Geld aber noch unterwegs. Dann NICHT auf active
      // setzen — das erledigt async_payment_succeeded bzw. invoice.payment_succeeded.
      if (session.payment_status === "unpaid") return;

      await setActive(store, memberId, event.id);
      return;
    }

    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      const memberId = session.metadata?.member_id || session.client_reference_id;
      if (!memberId) return;
      await store.linkStripeIds(memberId, {
        customerId: idOf(session.customer as string | { id: string } | null),
        subscriptionId: idOf(session.subscription as string | { id: string } | null),
      });
      await setActive(store, memberId, event.id);
      return;
    }

    case "checkout.session.async_payment_failed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const memberId = session.metadata?.member_id || session.client_reference_id;
      if (!memberId) return;
      const member = await store.getMemberById(memberId);
      if (member) await markPaymentFailed(store, member, event.id);
      return;
    }

    // --- Wiederkehrende Zahlung erfolgreich ------------------------------
    // Fehlte in der Ursprungsfassung komplett. Ohne diesen Zweig blieb jedes
    // Mitglied, dessen Abbuchung einmal scheiterte, für immer auf
    // payment_failed — auch nach längst repariertem Zahlungsmittel.
    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = subscriptionIdOf(invoice);
      if (!subscriptionId) return;

      const member = await store.getMemberBySubscription(subscriptionId);
      if (!member) return;

      const warFehlgeschlagen = member.status === "payment_failed";
      await store.updateMemberStatus(member.id, "active");
      await store.linkEventToMember(event.id, member.id);

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

      const member = await store.getMemberBySubscription(subscriptionId);
      if (!member) return;
      await markPaymentFailed(store, member, event.id);
      return;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const member = await store.getMemberBySubscription(subscription.id);
      if (!member) return;
      await store.updateMemberStatus(member.id, "canceled");
      await store.linkEventToMember(event.id, member.id);
      return;
    }

    default:
      // Andere Ereignisse bewusst ignorieren.
      return;
  }
}

async function setActive(store: Store, memberId: string, eventId: string) {
  await store.updateMemberStatus(memberId, "active");
  await store.linkEventToMember(eventId, memberId);

  const member = await store.getMemberById(memberId);
  if (member) await sendPaymentConfirmation(member.id, member.email, member.first_name);
}

async function markPaymentFailed(store: Store, member: Member, eventId: string) {
  await store.updateMemberStatus(member.id, "payment_failed");
  await store.linkEventToMember(eventId, member.id);

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
 * Die Subscription-ID einer Invoice. Stripe hat die Stelle mit neueren
 * API-Versionen von invoice.subscription nach
 * invoice.parent.subscription_details verschoben; beide Wege werden
 * abgedeckt, damit ein API-Wechsel nicht still dazu führt, dass keine
 * Zahlungsausfälle mehr erkannt werden.
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
