import {
  isAuthApiError,
  isAuthSessionMissingError,
  type AuthError,
} from "@supabase/supabase-js";

export function isUnauthenticatedError(error: AuthError) {
  return (
    isAuthSessionMissingError(error) ||
    (isAuthApiError(error) &&
      (error.status === 400 || error.status === 401 || error.status === 403))
  );
}
