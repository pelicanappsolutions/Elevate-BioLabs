import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authConfig } from "@/lib/auth.config";

/**
 * Route guard. Auth.js v5 exposes `auth` as a middleware wrapper, but we keep an
 * explicit matcher so we can differentiate /admin (role=ADMIN) from /dashboard.
 *
 * Built from the edge-safe authConfig — importing @/lib/auth here would drag
 * bcryptjs and the Prisma adapter into the Edge bundle, which has no Node APIs.
 * Reading the JWT is all the guard needs.
 */
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const session = req.auth;
  const isLoggedIn = !!session?.user;
  const role = session?.user?.role;

  const isAdminRoute = nextUrl.pathname.startsWith("/admin");
  const isDashboardRoute = nextUrl.pathname.startsWith("/dashboard");
  // Checkout requires an account so every order attributes to a trackable
  // customer (no anonymous guest orders). Any authenticated role is fine.
  const isCheckoutRoute = nextUrl.pathname.startsWith("/checkout");

  if (isAdminRoute) {
    if (!isLoggedIn) return redirectToLogin(nextUrl);
    if (role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
    }
  }

  if ((isDashboardRoute || isCheckoutRoute) && !isLoggedIn) {
    return redirectToLogin(nextUrl);
  }

  return NextResponse.next();
});

function redirectToLogin(nextUrl: NextRequest["nextUrl"]) {
  const url = new URL("/login", nextUrl);
  url.searchParams.set("callbackUrl", nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Skip static assets and the NextAuth API itself.
  matcher: ["/admin/:path*", "/dashboard/:path*", "/checkout/:path*"],
};
