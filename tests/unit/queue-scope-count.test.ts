// IA-32 — Queue endpoint scope count invariant'larını sözleşmeye bağlar:
//
//   total = kept + rejected + undecided  (her durumda, ghost count YOK)
//
// Helper'ı doğrudan test ediyoruz: undecided = `reviewStatusSource != USER`
// olarak hesaplanır; pre-IA-29 SYSTEM-source snapshot'ları (NEEDS_REVIEW,
// AI-yazılmış APPROVED/REJECTED) da bu axis'e girer. Eski "PENDING-only"
// undecided davranışı invariant'ı bozuyordu (Local için 67 total ama
// 66 undecided + 0 kept + 0 rejected = 66 ghost).

import { describe, it, expect } from "vitest";

type Row = {
  reviewStatus: "PENDING" | "APPROVED" | "REJECTED" | "NEEDS_REVIEW";
  reviewStatusSource: "SYSTEM" | "USER";
};

// Helper: queue endpoint count semantiğinin saf-fonksiyonel modeli.
// Server tarafı Prisma `count + where` ile aynı kuralı uygular; burada
// invariant'ı domain logic seviyesinde test ederiz.
function bucketize(rows: ReadonlyArray<Row>) {
  const kept = rows.filter(
    (r) => r.reviewStatus === "APPROVED" && r.reviewStatusSource === "USER",
  ).length;
  const rejected = rows.filter(
    (r) => r.reviewStatus === "REJECTED" && r.reviewStatusSource === "USER",
  ).length;
  const undecided = rows.filter((r) => r.reviewStatusSource !== "USER").length;
  return { total: rows.length, kept, rejected, undecided };
}

describe("queue scope count invariant — IA-32", () => {
  it("salt USER kept/rejected — invariant: total = kept + rejected + undecided", () => {
    const rows: Row[] = [
      { reviewStatus: "APPROVED", reviewStatusSource: "USER" },
      { reviewStatus: "APPROVED", reviewStatusSource: "USER" },
      { reviewStatus: "REJECTED", reviewStatusSource: "USER" },
      { reviewStatus: "PENDING", reviewStatusSource: "SYSTEM" },
      { reviewStatus: "PENDING", reviewStatusSource: "SYSTEM" },
    ];
    const b = bucketize(rows);
    expect(b.total).toBe(5);
    expect(b.kept).toBe(2);
    expect(b.rejected).toBe(1);
    expect(b.undecided).toBe(2);
    expect(b.kept + b.rejected + b.undecided).toBe(b.total);
  });

  it("eski SYSTEM-source NEEDS_REVIEW snapshot'lar undecided'a girer", () => {
    // Pre-IA-29 dönemde worker reviewStatus'e NEEDS_REVIEW yazıyordu.
    // Operatör henüz karar vermedi — UI'da undecided olarak sayılmalı.
    const rows: Row[] = [
      { reviewStatus: "NEEDS_REVIEW", reviewStatusSource: "SYSTEM" },
      { reviewStatus: "NEEDS_REVIEW", reviewStatusSource: "SYSTEM" },
      { reviewStatus: "APPROVED", reviewStatusSource: "SYSTEM" }, // AI advisory
    ];
    const b = bucketize(rows);
    expect(b.undecided).toBe(3); // ghost count YOK
    expect(b.kept).toBe(0); // AI advisory kept sayılmaz
    expect(b.rejected).toBe(0);
    expect(b.kept + b.rejected + b.undecided).toBe(b.total);
  });

  it("AI advisory APPROVED (SYSTEM source) kept sayılmaz — operator-truth", () => {
    const rows: Row[] = [
      { reviewStatus: "APPROVED", reviewStatusSource: "SYSTEM" },
      { reviewStatus: "APPROVED", reviewStatusSource: "SYSTEM" },
    ];
    const b = bucketize(rows);
    expect(b.kept).toBe(0);
    expect(b.undecided).toBe(2);
    expect(b.kept + b.rejected + b.undecided).toBe(b.total);
  });

  it("operatör override sonrası kept doğru sayılır", () => {
    const rows: Row[] = [
      { reviewStatus: "APPROVED", reviewStatusSource: "USER" }, // operator keep
      { reviewStatus: "REJECTED", reviewStatusSource: "USER" }, // operator reject
      { reviewStatus: "PENDING", reviewStatusSource: "SYSTEM" }, // undecided
    ];
    const b = bucketize(rows);
    expect(b.kept).toBe(1);
    expect(b.rejected).toBe(1);
    expect(b.undecided).toBe(1);
    expect(b.kept + b.rejected + b.undecided).toBe(b.total);
  });

  it("boş scope: total = 0, bucket'lar = 0", () => {
    const b = bucketize([]);
    expect(b.total).toBe(0);
    expect(b.kept + b.rejected + b.undecided).toBe(0);
  });

  it("tek karışık örnek: invariant her zaman sıfır-ghost", () => {
    // Karışık DB durumu — gerçek production'da görülen şekil
    const rows: Row[] = [
      { reviewStatus: "PENDING", reviewStatusSource: "SYSTEM" },
      { reviewStatus: "PENDING", reviewStatusSource: "SYSTEM" },
      { reviewStatus: "PENDING", reviewStatusSource: "SYSTEM" },
      { reviewStatus: "NEEDS_REVIEW", reviewStatusSource: "SYSTEM" },
      { reviewStatus: "APPROVED", reviewStatusSource: "SYSTEM" }, // legacy AI
      { reviewStatus: "APPROVED", reviewStatusSource: "USER" }, // op keep
      { reviewStatus: "APPROVED", reviewStatusSource: "USER" },
      { reviewStatus: "REJECTED", reviewStatusSource: "USER" }, // op reject
    ];
    const b = bucketize(rows);
    expect(b.total).toBe(8);
    expect(b.kept).toBe(2);
    expect(b.rejected).toBe(1);
    expect(b.undecided).toBe(5); // 3 PENDING + 1 NEEDS_REVIEW + 1 SYSTEM-APPROVED
    expect(b.kept + b.rejected + b.undecided).toBe(b.total);
  });
});
