import { describe, expect, it } from "vitest";

import { resetPasswordSchema } from "@/lib/validations";

describe("resetPasswordSchema", () => {
  it("rejects passwords that would pass min-length but fail register strength", () => {
    const parsed = resetPasswordSchema.safeParse({
      token: "abc",
      password: "password",
      confirmPassword: "password",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts the same strength rule as registration", () => {
    const parsed = resetPasswordSchema.safeParse({
      token: "abc",
      password: "Password1",
      confirmPassword: "Password1",
    });
    expect(parsed.success).toBe(true);
  });
});
