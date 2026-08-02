import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, subscribeNewsletterMock } = vi.hoisted(() => ({
  subscribeNewsletterMock: vi.fn().mockResolvedValue(undefined),
  dbMock: {
    user: {
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
    },
    marketingSubscriber: {
      upsert: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/email/index", () => ({ subscribeNewsletter: subscribeNewsletterMock }));

import { listMarketingEmails, recordMarketingOptIn, recordMarketingOptOut } from "@/lib/marketing";

beforeEach(() => {
  vi.clearAllMocks();
  subscribeNewsletterMock.mockResolvedValue(undefined);
  dbMock.marketingSubscriber.upsert.mockResolvedValue({});
  dbMock.user.update.mockResolvedValue({});
  dbMock.user.updateMany.mockResolvedValue({ count: 1 });
  dbMock.marketingSubscriber.updateMany.mockResolvedValue({ count: 1 });
});

describe("recordMarketingOptIn", () => {
  it("no-ops on a malformed email", async () => {
    await recordMarketingOptIn({ email: "not-an-email", source: "newsletter" });
    expect(dbMock.marketingSubscriber.upsert).not.toHaveBeenCalled();
  });

  it("upserts the subscriber and flips User.marketingOptIn when a userId is given", async () => {
    await recordMarketingOptIn({
      email: "Jane@Example.com",
      source: "checkout",
      name: "Jane",
      userId: "user_1",
    });

    expect(dbMock.marketingSubscriber.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "jane@example.com" } })
    );
    expect(dbMock.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { marketingOptIn: true },
    });
    expect(subscribeNewsletterMock).toHaveBeenCalledWith("jane@example.com", "checkout");
  });

  it("looks up the user by case-insensitive email when no userId is given", async () => {
    dbMock.user.findFirst.mockResolvedValue({ id: "user_2" });

    await recordMarketingOptIn({ email: "John.Doe@Gmail.com", source: "newsletter" });

    expect(dbMock.user.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: "john.doe@gmail.com", mode: "insensitive" } },
      select: { id: true },
    });
    expect(dbMock.user.update).toHaveBeenCalledWith({
      where: { id: "user_2" },
      data: { marketingOptIn: true },
    });
  });

  it("skips the User update entirely when no matching account exists", async () => {
    dbMock.user.findFirst.mockResolvedValue(null);

    await recordMarketingOptIn({ email: "noaccount@example.com", source: "newsletter" });

    expect(dbMock.user.update).not.toHaveBeenCalled();
    expect(dbMock.marketingSubscriber.upsert).toHaveBeenCalled();
  });

  it("skips the Klaviyo sync when syncKlaviyo is false", async () => {
    await recordMarketingOptIn({
      email: "user@example.com",
      source: "contact",
      userId: "user_1",
      syncKlaviyo: false,
    });
    expect(subscribeNewsletterMock).not.toHaveBeenCalled();
  });
});

describe("recordMarketingOptOut", () => {
  it("clears the subscriber and the User flag by id when a userId is given", async () => {
    await recordMarketingOptOut({ email: "Jane@Example.com", userId: "user_1" });

    expect(dbMock.marketingSubscriber.updateMany).toHaveBeenCalledWith({
      where: { email: "jane@example.com" },
      data: { active: false },
    });
    expect(dbMock.user.updateMany).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { marketingOptIn: false },
    });
  });

  it("falls back to a case-insensitive email match when no userId is given (unsubscribe links)", async () => {
    await recordMarketingOptOut({ email: "John.Doe@Gmail.com" });

    expect(dbMock.user.updateMany).toHaveBeenCalledWith({
      where: { email: { equals: "john.doe@gmail.com", mode: "insensitive" } },
      data: { marketingOptIn: false },
    });
  });
});

describe("listMarketingEmails", () => {
  it("returns the deduped, lowercased union of opted-in users and active subscribers", async () => {
    dbMock.user.findMany.mockResolvedValue([{ email: "Shared@Example.com" }, { email: "OnlyUser@Example.com" }]);
    dbMock.marketingSubscriber.findMany.mockResolvedValue([
      { email: "shared@example.com" },
      { email: "onlysub@example.com" },
    ]);

    const emails = await listMarketingEmails();

    expect(emails.sort()).toEqual(
      ["shared@example.com", "onlyuser@example.com", "onlysub@example.com"].sort()
    );
    expect(dbMock.user.findMany).toHaveBeenCalledWith({
      where: { role: "CUSTOMER", marketingOptIn: true },
      select: { email: true },
      take: 5000,
    });
  });
});
