import "server-only";

import { isUnauthenticatedError } from "./errors";
import { createServerSupabaseClient } from "./server";

export async function getCurrentUser() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    if (isUnauthenticatedError(error)) return null;
    throw error;
  }

  return data.user;
}
