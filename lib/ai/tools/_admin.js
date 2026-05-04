/**
 * Cliente admin compartido por las tools (no usa next/headers).
 */

import { createClient } from "@supabase/supabase-js";

let _client = null;

export function admin() {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return _client;
}
