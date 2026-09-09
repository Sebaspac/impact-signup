/**
 * DEMO-MODUS — zum Testen und Vorführen ohne echte Konten.
 *
 * Ersetzt Supabase, Stripe und Resend durch lokale Attrappen:
 *   - Daten liegen in .demo-data/db.json (überleben einen Neustart)
 *   - statt Stripe Checkout kommt eine nachgebaute Kassenseite
 *   - E-Mails werden nicht verschickt, sondern in ein Postfach geschrieben
 *
 * SICHERHEIT: Der Demo-Modus ist NUR aktiv, wenn DEMO_MODE=true gesetzt ist
 * UND kein echter Stripe-Schlüssel vorliegt. Damit kann er niemals aus
 * Versehen im Echtbetrieb greifen und echte Zahlungen verschlucken.
 */

import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { Store, Member, NewMember, MemberStatus, ClaimResult } from "./store";

export function isDemoMode(): boolean {
  if (process.env.DEMO_MODE !== "true") return false;

  // Reissleine: sobald ein echter Live-Schlüssel gesetzt ist, ist die Demo aus.
  const stripeKey = process.env.STRIPE_SECRET_KEY || "";
  if (stripeKey.startsWith("sk_live_")) {
    console.error(
      "DEMO_MODE=true zusammen mit einem Live-Stripe-Schlüssel — Demo wird ignoriert."
    );
    return false;
  }
  return true;
}

// ---------------------------------------------------------------- Datei-Ablage

const DATA_DIR = path.join(process.cwd(), ".demo-data");
const DB_FILE = path.join(DATA_DIR, "db.json");

export type DemoEmail = {
  id: string;
  created_at: string;
  member_id: string | null;
  email_type: string;
  sent_to: string;
  subject: string;
  html: string;
  status: string;
  error_message: string | null;
};

export type DemoEvent = {
  id: string;
  created_at: string;
  member_id: string | null;
  stripe_event_id: string;
  event_type: string;
  processed_at: string | null;
};

type DemoDb = {
  members: Member[];
  events: DemoEvent[];
  emails: DemoEmail[];
};

const EMPTY: DemoDb = { members: [], events: [], emails: [] };

async function read(): Promise<DemoDb> {
  try {
    const raw = await fs.readFile(DB_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<DemoDb>;
    return {
      members: parsed.members ?? [],
      events: parsed.events ?? [],
      emails: parsed.emails ?? [],
    };
  } catch {
    return { ...EMPTY };
  }
}

async function write(db: DemoDb): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), "utf8");
}

/** Lesen, ändern, schreiben — für eine Demo auf einer Maschine ausreichend. */
async function mutate<T>(fn: (db: DemoDb) => T | Promise<T>): Promise<T> {
  const db = await read();
  const result = await fn(db);
  await write(db);
  return result;
}

export async function readDemoDb(): Promise<DemoDb> {
  return read();
}

export async function resetDemoDb(): Promise<void> {
  await write({ ...EMPTY, members: [], events: [], emails: [] });
}

// ---------------------------------------------------------------- Store

export function demoStore(): Store {
  return {
    async findBlockingMemberByEmail(email) {
      const db = await read();
      const hit = db.members.find(
        (m) => m.email === email && (m.status === "active" || m.status === "payment_failed")
      );
      return hit ? { id: hit.id, status: hit.status } : null;
    },

    async createMember(data: NewMember) {
      return mutate((db) => {
        const member: Member = {
          ...data,
          id: randomUUID(),
          created_at: new Date().toISOString(),
          stripe_customer_id: null,
          stripe_subscription_id: null,
        };
        db.members.push(member);
        return { id: member.id };
      });
    },

    async getMemberById(id) {
      const db = await read();
      return db.members.find((m) => m.id === id) ?? null;
    },

    async getMemberBySubscription(subscriptionId) {
      const db = await read();
      return db.members.find((m) => m.stripe_subscription_id === subscriptionId) ?? null;
    },

    async updateMemberStatus(id, status: MemberStatus) {
      await mutate((db) => {
        const m = db.members.find((x) => x.id === id);
        if (m) m.status = status;
      });
    },

    async linkStripeIds(id, ids) {
      await mutate((db) => {
        const m = db.members.find((x) => x.id === id);
        if (!m) return;
        m.stripe_customer_id = ids.customerId;
        m.stripe_subscription_id = ids.subscriptionId;
      });
    },

    async claimEvent(eventId, eventType): Promise<ClaimResult> {
      return mutate((db) => {
        const vorhanden = db.events.find((e) => e.stripe_event_id === eventId);
        if (vorhanden) return vorhanden.processed_at ? "already_processed" : "retry";
        db.events.push({
          id: randomUUID(),
          created_at: new Date().toISOString(),
          member_id: null,
          stripe_event_id: eventId,
          event_type: eventType,
          processed_at: null,
        });
        return "new";
      });
    },

    async markEventProcessed(eventId) {
      await mutate((db) => {
        const e = db.events.find((x) => x.stripe_event_id === eventId);
        if (e) e.processed_at = new Date().toISOString();
      });
    },

    async linkEventToMember(eventId, memberId) {
      await mutate((db) => {
        const e = db.events.find((x) => x.stripe_event_id === eventId);
        if (e) e.member_id = memberId;
      });
    },

    async logEmail(entry) {
      await mutate((db) => {
        db.emails.push({
          id: randomUUID(),
          created_at: new Date().toISOString(),
          member_id: entry.memberId,
          email_type: entry.emailType,
          sent_to: entry.sentTo,
          subject: entry.subject ?? "(ohne Betreff)",
          html: entry.html ?? "",
          status: entry.status,
          error_message: entry.errorMessage,
        });
      });
    },
  };
}
