"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "@/config/supabase";
import type { Database } from "@/types/database";

export function createBrowserSupabaseClient() {
  const { url, publishableKey } = getSupabaseConfig();
  return createBrowserClient<Database>(url, publishableKey);
}
