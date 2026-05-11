// R11 — NotificationsInbox schema validation testleri.
//
// Pure schema testleri (DB yok). NotificationItem zod parse, kind enum
// validity, defaults.

import { describe, it, expect } from "vitest";
import {
  NotificationItemSchema,
  NotificationKindEnum,
} from "@/server/services/settings/notifications-inbox.service";

describe("NotificationItemSchema", () => {
  it("parses minimal valid payload with defaults", () => {
    const parsed = NotificationItemSchema.parse({
      id: "abc123",
      kind: "batchCompleted",
      title: "Batch done",
      createdAt: "2026-05-09T12:00:00.000Z",
    });
    expect(parsed.body).toBeNull();
    expect(parsed.href).toBeNull();
    expect(parsed.read).toBe(false);
  });

  it("rejects unknown kind", () => {
    const result = NotificationItemSchema.safeParse({
      id: "abc",
      kind: "totallyNew",
      title: "x",
      createdAt: "2026-05-09T12:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all R8 + R9 kinds", () => {
    const validKinds = [
      "batchCompleted",
      "batchFailed",
      "reviewDecision",
      "listingSubmitted",
      "magicEraser",
      "recipeRun",
      "mockupActivated",
    ];
    for (const k of validKinds) {
      expect(() => NotificationKindEnum.parse(k)).not.toThrow();
    }
  });

  it("preserves explicit body/href when provided", () => {
    const parsed = NotificationItemSchema.parse({
      id: "x",
      kind: "recipeRun",
      title: "Recipe ran",
      body: "Continue at /admin/midjourney/batch-run",
      href: "/admin/midjourney/batch-run?recipeId=123",
      read: true,
      createdAt: "2026-05-09T12:00:00.000Z",
    });
    expect(parsed.body).toBe("Continue at /admin/midjourney/batch-run");
    expect(parsed.href).toContain("recipeId=123");
    expect(parsed.read).toBe(true);
  });
});
