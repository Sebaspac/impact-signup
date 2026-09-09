import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (stripeInstance) return stripeInstance;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY fehlt (Vorlage: .env.example)");
  }

  stripeInstance = new Stripe(key, {
    apiVersion: "2026-06-24.dahlia",
  });

  return stripeInstance;
}

// Die Zuordnung Tarif -> Stripe Price ID liegt bewusst in lib/pricing.ts,
// zusammen mit den Sollbeträgen aus INHALT_PREISE.md. So steht die Wahrheit
// über Preise an genau einer Stelle.
