import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { loginSchema } from "@/lib/validations";
import { authConfig } from "@/lib/auth.config";

/**
 * FULL Auth.js config — Node runtime only.
 *
 * Extends the edge-safe base in ./auth.config with the pieces that need Node:
 * the Prisma adapter and bcrypt password verification. Never import this from
 * middleware; import ./auth.config there instead (see the note in that file).
 */
export const {
  handlers,
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  secret: env.AUTH_SECRET,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await db.user.findUnique({
          where: { email: parsed.data.email },
        });
        if (!user?.passwordHash) return null;

        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          image: user.image,
        };
      },
    }),
    ...(env.google.id && env.google.secret
      ? [Google({ clientId: env.google.id, clientSecret: env.google.secret })]
      : []),
  ],
});
