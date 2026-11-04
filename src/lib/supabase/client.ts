"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "@/config/supabase";

export function createBrowserSupabaseClient() {
  const { url, publishableKey } = getSupabaseConfig();
  return createBrowserClient(url, publishableKey);
}
