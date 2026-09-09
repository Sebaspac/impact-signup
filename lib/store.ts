/**
 * Datenzugriff hinter einer schmalen Schnittstelle.
 *
 * Zwei Implementierungen:
 *   - Supabase (Echtbetrieb)
 *   - Demo (lokale JSON-Datei, kein Konto nötig)
 *
 * Vorher sprachen die API-Routen direkt mit dem Supabase-Querybuilder. Damit
 * war weder ein Demo-Betrieb noch ein Test ohne echtes Projekt möglich.
 */

import { getSupabaseAdmin } from "./supabase";
import { isDemoMode, demoStore } from "./demo";

export type MemberStatus =
  | "pending_payment"
  | "checkout_failed"
  | "active"
  | "payment_failed"
  | "canceled";

export type NewMember = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  discipline: string;
  experience_level: string;
  age_group: string;
  term: string;
  payment_mode: string;
  monthly_amount_cents: number | null;
  total_amount_cents: number;
  privacy_accepted_at: string;
  status: MemberStatus;
};

export type Member = NewMember & {
  id: string;
  created_at: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

export type ClaimResult = "new" | "already_processed" | "retry" | "error";

export interface Store {
  findBlockingMemberByEmail(email: string): Promise<{ id: string; status: string } | null>;
  createMember(data: NewMember): Promise<{ id: string } | null>;
  getMemberById(id: string): Promise<Member | null>;
  getMemberBySubscription(subscriptionId: string): Promise<Member | null>;
  updateMemberStatus(id: string, status: MemberStatus): Promise<void>;
  linkStripeIds(
    id: string,
    ids: { customerId: string | null; subscriptionId: string | null }
  ): Promise<void>;

  claimEvent(eventId: string, eventType: string, payload: unknown): Promise<ClaimResult>;
  markEventProcessed(eventId: string): Promise<void>;
  linkEventToMember(eventId: string, memberId: string): Promise<void>;

  logEmail(entry: {
    memberId: string | null;
    emailType: string;
    sentTo: string;
    status: "sent" | "failed";
    errorMessage: string | null;
    subject?: string;
    html?: string;
  }): Promise<void>;
}

export function getStore(): Store {
  return isDemoMode() ? demoStore() : supabaseStore();
}

function supabaseStore(): Store {
  const db = getSupabaseAdmin();

  return {
    async findBlockingMemberByEmail(email) {
      const { data } = await db
        .from("members")
        .select("id, status")
        .eq("email", email)
        .in("status", ["active", "payment_failed"])
        .maybeSingle();
      return data ?? null;
    },

    async createMember(data) {
      const { data: row, error } = await db
        .from("members")
        .insert(data)
        .select("id")
        .single();
      if (error) {
        console.error("createMember:", error);
        return null;
      }
      return row;
    },

    async getMemberById(id) {
      const { data } = await db.from("members").select("*").eq("id", id).maybeSingle();
      return (data as Member) ?? null;
    },

    async getMemberBySubscription(subscriptionId) {
      const { data } = await db
        .from("members")
        .select("*")
        .eq("stripe_subscription_id", subscriptionId)
        .maybeSingle();
      return (data as Member) ?? null;
    },

    async updateMemberStatus(id, status) {
      await db.from("members").update({ status }).eq("id", id);
    },

    async linkStripeIds(id, ids) {
      await db
        .from("members")
        .update({
          stripe_customer_id: ids.customerId,
          stripe_subscription_id: ids.subscriptionId,
        })
        .eq("id", id);
    },

    async claimEvent(eventId, eventType, payload) {
      const { error } = await db.from("payment_events").insert({
        stripe_event_id: eventId,
        event_type: eventType,
        raw_payload: payload as Record<string, unknown>,
      });
      if (!error) return "new";
      if (error.code === "23505") {
        const { data } = await db
          .from("payment_events")
          .select("processed_at")
          .eq("stripe_event_id", eventId)
          .single();
        return data?.processed_at ? "already_processed" : "retry";
      }
      console.error("claimEvent:", error);
      return "error";
    },

    async markEventProcessed(eventId) {
      await db
        .from("payment_events")
        .update({ processed_at: new Date().toISOString() })
        .eq("stripe_event_id", eventId);
    },

    async linkEventToMember(eventId, memberId) {
      await db
        .from("payment_events")
        .update({ member_id: memberId })
        .eq("stripe_event_id", eventId);
    },

    async logEmail(entry) {
      await db.from("email_log").insert({
        member_id: entry.memberId,
        email_type: entry.emailType,
        sent_to: entry.sentTo,
        status: entry.status,
        error_message: entry.errorMessage,
      });
    },
  };
}
