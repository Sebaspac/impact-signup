import { z } from "zod";
import { AGE_GROUPS, TERMS, PAYMENT_MODES } from "./pricing";

/**
 * Disziplinen wörtlich nach PRODUCT.md der Website:
 * "Sportarten: Boxen, Kickboxen, Muay Thai (Thaiboxen), BJJ."
 * MMA ist dort NICHT als Kursangebot gelistet (nur als Trainerqualifikation)
 * und wurde deshalb entfernt.
 */
export const DISCIPLINES = [
  "Boxen",
  "Kickboxen",
  "Muay Thai",
  "BJJ",
] as const;

export const EXPERIENCE_LEVELS = [
  "Anfänger",
  "Fortgeschritten",
  "Profi",
] as const;

export const signupSchema = z.object({
  firstName: z.string().trim().min(1, "Vorname fehlt").max(80),
  lastName: z.string().trim().min(1, "Nachname fehlt").max(80),
  email: z.string().trim().toLowerCase().email("Ungültige E-Mail-Adresse").max(200),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[+()/\d\s-]*$/, "Telefonnummer enthält ungültige Zeichen")
    .optional()
    .or(z.literal("")),

  discipline: z.enum(DISCIPLINES),
  experienceLevel: z.enum(EXPERIENCE_LEVELS),

  // Preisrelevant — siehe lib/pricing.ts
  ageGroup: z.enum(AGE_GROUPS),
  term: z.enum(TERMS),
  paymentMode: z.enum(PAYMENT_MODES),

  // DSGVO: ohne Einwilligung keine Verarbeitung.
  privacyAccepted: z.literal(true, {
    message: "Bitte stimme der Datenschutzerklärung zu",
  }),

  // Honeypot: echte Menschen füllen dieses versteckte Feld nie aus.
  // Bewusst großzügig validiert — die Auswertung passiert erst in der Route,
  // die dann einen Erfolg vortäuscht. Würde Zod das Feld hier abweisen,
  // bekäme der Bot eine Fehlermeldung, die ihm die Falle verrät.
  website: z.string().max(200).optional(),
});

export type SignupInput = z.infer<typeof signupSchema>;
