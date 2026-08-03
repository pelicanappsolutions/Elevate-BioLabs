import { describe, expect, it } from "vitest";

import { canAccessCustomerOrder } from "@/lib/orders/access";

describe("canAccessCustomerOrder", () => {
  it("allows the order owner", () => {
    expect(canAccessCustomerOrder("user_1", "user_1")).toBe(true);
  });

  it("denies other signed-in users", () => {
    expect(canAccessCustomerOrder("user_2", "user_1")).toBe(false);
  });

  it("denies anonymous or orphan orders", () => {
    expect(canAccessCustomerOrder(undefined, "user_1")).toBe(false);
    expect(canAccessCustomerOrder("user_1", null)).toBe(false);
    expect(canAccessCustomerOrder(null, null)).toBe(false);
  });
});
