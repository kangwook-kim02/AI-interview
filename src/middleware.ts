import { NextResponse, type NextRequest } from "next/server";
import { resolveAuthRedirect } from "@/features/auth/guard";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { response, isAuthenticated } = await updateSupabaseSession(request);

  const redirectTo = resolveAuthRedirect(request.nextUrl.pathname, isAuthenticated);
  if (redirectTo) {
    const url = request.nextUrl.clone();
    url.pathname = redirectTo;
    const redirectResponse = NextResponse.redirect(url);
    // 세션 갱신으로 세팅된 쿠키를 리다이렉트 응답에 옮겨 유실을 막는다.
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: [
    "/login",
    "/signup",
    "/dashboard/:path*",
    "/interview/:path*",
    "/api/interview/:path*",
  ],
};
