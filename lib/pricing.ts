/**
 * Einzige Quelle der Wahrheit für Preise.
 *
 * Die Werte stammen wörtlich aus INHALT_PREISE.md der Website (vom Inhaber
 * geliefert). Sie dürfen hier NICHT frei geändert werden — wenn sich Preise
 * ändern, ändert sich zuerst INHALT_PREISE.md und preise.html, dann diese Datei.
 *
 * Wichtig zur Struktur: Die Preise staffeln sich nach ALTERSGRUPPE und LAUFZEIT,
 * nicht nach Sportart. Zusätzlich gibt es zwei Zahlweisen:
 *   - monatlich    -> wiederkehrende Abbuchung + einmalig 50 € Aufnahmegebühr
 *   - vorauszahlung-> eine Einmalzahlung, die Aufnahmegebühr entfällt
 *     ("Bei einer Vorauszahlung ist keine Aufnahmegebühr erforderlich!")
 */

export const AGE_GROUPS = ["erwachsener", "jugendlicher", "kind"] as const;
export const TERMS = ["6_monate", "12_monate"] as const;
export const PAYMENT_MODES = ["monatlich", "vorauszahlung"] as const;

export type AgeGroup = (typeof AGE_GROUPS)[number];
export type Term = (typeof TERMS)[number];
export type PaymentMode = (typeof PAYMENT_MODES)[number];

/** Aufnahmegebühr in Cent. Entfällt bei Vorauszahlung. */
export const JOINING_FEE_CENTS = 5000;

export const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
  erwachsener: "Erwachsener",
  jugendlicher: "Jugendlicher (13–18 Jahre)",
  kind: "Kind (bis 12 Jahre)",
};

export const TERM_LABELS: Record<Term, string> = {
  "6_monate": "6 Monate",
  "12_monate": "12 Monate",
};

type PriceRow = {
  /** Monatsbeitrag in Cent (Zahlweise monatlich) */
  monthlyCents: number;
  /** Vorauszahlung in Cent — regulär (durchgestrichen) und gültig */
  prepayRegularCents: number;
  prepayCents: number;
};

/** Preistabelle 1 aus INHALT_PREISE.md, Beträge in Cent. */
export const PRICES: Record<AgeGroup, Record<Term, PriceRow>> = {
  erwachsener: {
    "6_monate": { monthlyCents: 7900, prepayRegularCents: 50000, prepayCents: 45000 },
    "12_monate": { monthlyCents: 6900, prepayRegularCents: 87800, prepayCents: 78000 },
  },
  jugendlicher: {
    "6_monate": { monthlyCents: 7500, prepayRegularCents: 50000, prepayCents: 42000 },
    "12_monate": { monthlyCents: 6900, prepayRegularCents: 83000, prepayCents: 72000 },
  },
  kind: {
    "6_monate": { monthlyCents: 6900, prepayRegularCents: 46400, prepayCents: 39000 },
    "12_monate": { monthlyCents: 5900, prepayRegularCents: 75800, prepayCents: 66000 },
  },
};

export function formatEuro(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}

/**
 * Was der Kunde beim Abschluss tatsächlich zahlt — für die Anzeige im Formular
 * und zur Gegenprüfung der Beträge, die Stripe später abrechnet.
 */
export function quote(age: AgeGroup, term: Term, mode: PaymentMode) {
  const row = PRICES[age][term];
  const months = term === "6_monate" ? 6 : 12;

  if (mode === "vorauszahlung") {
    return {
      mode,
      months,
      dueNowCents: row.prepayCents,
      recurringCents: 0,
      joiningFeeCents: 0,
      regularCents: row.prepayRegularCents,
      summary: `${formatEuro(row.prepayCents)} einmalig für ${months} Monate — keine Aufnahmegebühr`,
    };
  }

  return {
    mode,
    months,
    dueNowCents: row.monthlyCents + JOINING_FEE_CENTS,
    recurringCents: row.monthlyCents,
    joiningFeeCents: JOINING_FEE_CENTS,
    regularCents: row.monthlyCents,
    summary: `${formatEuro(row.monthlyCents)} pro Monat + einmalig ${formatEuro(
      JOINING_FEE_CENTS
    )} Aufnahmegebühr`,
  };
}

/**
 * Zuordnung Tarif -> Stripe Price ID. Die IDs werden einmalig im Stripe-Dashboard
 * angelegt und über Umgebungsvariablen gesetzt (siehe .env.example).
 *
 * Es gibt bewusst keinen Fallback: fehlt eine ID, bricht die Anmeldung mit einer
 * klaren Meldung ab, statt still einen falschen Betrag abzubuchen.
 */
export function stripePriceIdFor(age: AgeGroup, term: Term, mode: PaymentMode): string | undefined {
  const key = [
    "STRIPE_PRICE",
    age.toUpperCase(),
    term === "6_monate" ? "6" : "12",
    mode === "vorauszahlung" ? "VORAUS" : "MONAT",
  ].join("_");
  return process.env[key];
}

export function joiningFeePriceId(): string | undefined {
  return process.env.STRIPE_PRICE_AUFNAHMEGEBUEHR;
}

/**
 * Sicherheitsnetz gegen Preisdrift: prüft, ob der Betrag, den Stripe für eine
 * Price ID hinterlegt hat, dem hier hinterlegten Sollbetrag entspricht.
 * Wird beim Anlegen der Checkout-Session aufgerufen — lieber abbrechen als
 * einem Mitglied den falschen Betrag abbuchen.
 */
export function expectedAmountCents(age: AgeGroup, term: Term, mode: PaymentMode): number {
  const row = PRICES[age][term];
  return mode === "vorauszahlung" ? row.prepayCents : row.monthlyCents;
}
