import type { NextAuthConfig } from "next-auth";

/**
 * EDGE-SAFE Auth.js config.
 *
 * Middleware runs on the Edge runtime, which has no Node APIs — so it must not
 * pull in bcryptjs (process.nextTick/setImmediate) or the Prisma adapter. This
 * file therefore carries only what middleware needs to read a JWT: session
 * strategy, pages, and the token/session callbacks. `providers` stays empty
 * because verifying an already-issued JWT never runs `authorize`.
 *
 * The full config (adapter + Credentials + OAuth) lives in ./auth and is only
 * imported from Node-runtime code.
 */
export const authConfig = {
  session: { strategy: "jwt" },
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = (user as { role?: string }).role ?? "CUSTOMER";
        token.id = user.id;
      }
      // In-app account edits (name/email/avatar) call session.update() on the
      // client; that fires this callback with trigger "update" and the new
      // values on `session`. Copy them onto the token so the live session
      // reflects the change without forcing a re-login. role/id are immutable
      // here — never let a client update() escalate role.
      if (trigger === "update" && session && typeof session === "object") {
        const s = session as { name?: string; email?: string; picture?: string | null };
        if (typeof s.name === "string") token.name = s.name;
        if (typeof s.email === "string") token.email = s.email;
        if (s.picture !== undefined) token.picture = s.picture;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "CUSTOMER" | "ADMIN";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

export default authConfig;
