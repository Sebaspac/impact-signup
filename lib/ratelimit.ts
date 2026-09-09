/**
 * Einfache Drosselung für den öffentlichen Anmelde-Endpunkt.
 *
 * Ohne Drosselung kann jeder beliebig oft POSTen und damit
 *   - die Datenbank mit Müll-Datensätzen füllen,
 *   - Stripe-Sessions und damit Kosten erzeugen,
 *   - vor allem: Bestätigungsmails an FREMDE Adressen auslösen. Das ist ein
 *     Mail-Bombing-Werkzeug und kostet im Ernstfall die Zustellbarkeit der
 *     eigenen Absenderdomain.
 *
 * EINSCHRÄNKUNG, die man kennen muss: Dieser Zähler liegt im Arbeitsspeicher
 * der jeweiligen Instanz. In einer serverlosen Umgebung (Netlify/Vercel) hat
 * jede Instanz ihren eigenen Zähler, die Grenze wirkt also nur pro Instanz.
 * Das ist eine erste Hürde, kein Bollwerk. Für harten Schutz gehört ein
 * gemeinsamer Speicher davor (Upstash/Redis) oder die Drosselung an den Rand
 * (Netlify/Cloudflare Rate Limiting). Die zusätzliche Dublettenprüfung in der
 * Datenbank (siehe api/signup) wirkt dagegen instanzübergreifend.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Aufräumen, damit die Map nicht unbegrenzt wächst.
function sweep(now: number) {
  if (buckets.size < 500) return;
  for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key);
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  return {
    allowed: true,
    remaining: limit - existing.count,
    retryAfterSeconds: 0,
  };
}

/**
 * Client-IP aus den üblichen Proxy-Headern. Bewusst konservativ: nur der
 * erste Eintrag von x-forwarded-for, sonst der Fallback. Wird ausschließlich
 * zur Drosselung verwendet, nicht gespeichert.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") || headers.get("x-nf-client-connection-ip") || "unbekannt";
}
