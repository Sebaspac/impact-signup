import { createClient } from "@supabase/supabase-js";

// Service-Role-Client: nur in API-Routes (Server) verwenden, NIE im Browser.
// Umgeht Row Level Security bewusst — die API-Routes sind der einzige Schreibpfad.
export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlt in .env.local"
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}
