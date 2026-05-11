// IA-34 — getSourcePendingCount semantik testleri.
//
// Helper saf-fonksiyonel olmadığı için DB-light unit pattern: bucket
// hesabını duplicate ediyoruz; gerçek Prisma sorgusu integration test
// kapsamında doğrulanır (route handler smoke test).

import { describe, it, expect } from "vitest";

type Row = {
  reviewStatusSource: "SYSTEM" | "USER";
  isUserDeleted?: boolean;
  deletedAt?: Date | null;
  folderPath?: string;
};

function sourcePendingCount(
  rows: ReadonlyArray<Row>,
  opts?: { activeRoot?: string },
): number {
  return rows.filter((r) => {
    if (r.reviewStatusSource === "USER") return false;
    if (r.isUserDeleted) return false;
    if (r.deletedAt) return false;
    if (opts?.activeRoot && r.folderPath && !r.folderPath.startsWith(opts.activeRoot)) {
      return false;
    }
    return true;
  }).length;
}

describe("getSourcePendingCount — IA-34 semantic", () => {
  it("AI design pending: operator damgası yok rows", () => {
    const rows: Row[] = [
      { reviewStatusSource: "SYSTEM" }, // PENDING
      { reviewStatusSource: "SYSTEM" }, // NEEDS_REVIEW (legacy)
      { reviewStatusSource: "SYSTEM" }, // SYSTEM APPROVED (legacy AI advisory)
      { reviewStatusSource: "USER" }, // operator KEPT — EXCLUDE
      { reviewStatusSource: "USER" }, // operator REJECTED — EXCLUDE
    ];
    expect(sourcePendingCount(rows)).toBe(3);
  });

  it("AI design pending: deletedAt EXCLUDE", () => {
    const rows: Row[] = [
      { reviewStatusSource: "SYSTEM" },
      { reviewStatusSource: "SYSTEM", deletedAt: new Date() },
    ];
    expect(sourcePendingCount(rows)).toBe(1);
  });

  it("Local pending: active root filter uygulanır (eski root EXCLUDE)", () => {
    const rows: Row[] = [
      { reviewStatusSource: "SYSTEM", folderPath: "/active-root/sub-a" },
      { reviewStatusSource: "SYSTEM", folderPath: "/active-root/sub-b" },
      { reviewStatusSource: "SYSTEM", folderPath: "/old-root/sub" },
      { reviewStatusSource: "USER", folderPath: "/active-root/sub-a" },
    ];
    expect(sourcePendingCount(rows, { activeRoot: "/active-root" })).toBe(2);
  });

  it("Local pending: isUserDeleted EXCLUDE", () => {
    const rows: Row[] = [
      { reviewStatusSource: "SYSTEM", folderPath: "/active/a", isUserDeleted: false },
      { reviewStatusSource: "SYSTEM", folderPath: "/active/b", isUserDeleted: true },
    ];
    expect(sourcePendingCount(rows, { activeRoot: "/active" })).toBe(1);
  });

  it("Boş source: 0", () => {
    expect(sourcePendingCount([])).toBe(0);
  });

  it("Tüm rows USER source: 0 pending", () => {
    const rows: Row[] = [
      { reviewStatusSource: "USER" },
      { reviewStatusSource: "USER" },
    ];
    expect(sourcePendingCount(rows)).toBe(0);
  });
});
