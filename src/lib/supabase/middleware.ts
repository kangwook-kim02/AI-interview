import "server-only";

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/config/supabase";
import type { Database } from "@/types/database";
import { isUnauthenticatedError } from "./errors";

export async function updateSupabaseSession(request: NextRequest) {
  const { url, publishableKey } = getSupabaseConfig();
  let response = NextResponse.next({ request });
  const cacheHeaders = new Headers();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));

        // 여러 번 갱신되어도 이전 쿠키와 캐시 방지 헤더를 유지한다.
        const previousCookies = response.cookies.getAll();
        response = NextResponse.next({ request });
        previousCookies.forEach((cookie) => response.cookies.set(cookie));
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([name, value]) => {
          cacheHeaders.set(name, value);
        });
        cacheHeaders.forEach((value, name) => response.headers.set(name, value));
      },
    },
  });

  const { error } = await supabase.auth.getClaims();
  if (error && !isUnauthenticatedError(error)) throw error;

  return response;
}
