import { describe, expect, it } from "vitest";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { assertOwnsResource, requireRole } from "@/server/authorization";

describe("authorization", () => {
  it("sahibi değilse ForbiddenError fırlatır", () => {
    expect(() => assertOwnsResource("u1", { userId: "u2" })).toThrow(ForbiddenError);
  });

  it("sahibi ise izin verir", () => {
    expect(() => assertOwnsResource("u1", { userId: "u1" })).not.toThrow();
  });

  it("rol yetersizse ForbiddenError fırlatır", () => {
    expect(() => requireRole({ role: "USER" }, "ADMIN")).toThrow(ForbiddenError);
  });

  it("ADMIN her rol için yetkili sayılır", () => {
    expect(() => requireRole({ role: "ADMIN" }, "USER")).not.toThrow();
    expect(() => requireRole({ role: "ADMIN" }, "ADMIN")).not.toThrow();
  });

  it("session yoksa UnauthorizedError fırlatır", () => {
    expect(() => requireRole(null, "USER")).toThrow(UnauthorizedError);
  });
});
