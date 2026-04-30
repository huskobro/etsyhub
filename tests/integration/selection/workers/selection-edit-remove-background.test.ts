// Phase 7 Task 10 — selection-edit worker (REMOVE_BACKGROUND) integration tests.
//
// Test sözleşmesi (plan Task 10, design Section 5.1):
//
//   Worker (`handleSelectionEditRemoveBackground`):
//     - requireItemOwnership (cross-user → NotFoundError)
//     - assertSetMutable (read-only set → SetReadOnlyError)
//     - removeBackground edit-op çağrısı (mock'lanır — Task 9 fonksiyonu)
//     - Asset üreten edit invariant (Task 6 paterni):
//         * eski editedAssetId → lastUndoableAssetId
//         * yeni asset → editedAssetId
//         * editHistoryJson push: { op: "background-remove", at }
//     - Lock release (success): activeHeavyJobId = null
//     - Failure path:
//         * History'ye failure entry: { op, at, failed: true, reason }
//         * Lock release: activeHeavyJobId = null
//         * Error re-throw (BullMQ FAILED state'e düşürür)
//
//   applyEditAsync (Task 6 stub yerine real enqueue):
//     - Lock acquire (interactive transaction):
//         * Mevcut activeHeavyJobId !== null → ConcurrentEditError throw
//         * BullMQ enqueue + activeHeavyJobId = job.id
//     - Lock release worker handler tarafından (success/fail) yapılır.
//
// Mock stratejisi:
//   - `removeBackground` (Task 9) mock'lanır — model accuracy kapsam dışı.
//     Worker handler asıl test edilen; full DB integration.
//   - BullMQ Queue mock'lanır — Redis bağımlılığı testten çıkarılır
//     (queue.add çağrı invariant'ları + dönen jobId yeterli).

import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from "vitest";
import bcrypt from "bcryptjs";
import type { Job } from "bullmq";
import { UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";
import {
  ConcurrentEditError,
  NotFoundError,
  SetReadOnlyError,
} from "@/lib/errors";
import { addItems } from "@/server/services/selection/items.service";
import { createSet } from "@/server/services/selection/sets.service";

// ────────────────────────────────────────────────────────────
// Mocks (vi.mock hoist'lenir; importlar mock'tan SONRA)
// ────────────────────────────────────────────────────────────

vi.mock("@/server/services/selection/edit-ops/background-remove", () => ({
  removeBackground: vi.fn(),
}));

// BullMQ queue mock'u — applyEditAsync enqueue'da kullanılır.
// Worker handler'ı doğrudan handler fonksiyonunu çağırır; queue runtime gerekmez.
const queueAddMock = vi.fn();
vi.mock("@/server/queue", () => ({
  enqueue: (...args: unknown[]) => queueAddMock(...args),
  // Diğer alanlar import edilirse stub
  queues: {},
  connection: {},
  scheduleRepeatJob: vi.fn(),
  cancelRepeatJob: vi.fn(),
}));

import { applyEditAsync } from "@/server/services/selection/edit.service";
import { removeBackground } from "@/server/services/selection/edit-ops/background-remove";
import {
  handleSelectionEditRemoveBackground,
  type RemoveBackgroundJobPayload,
} from "@/server/workers/selection-edit.worker";

const PRODUCT_TYPE_KEY = "phase7-w10-pt";
const REFERENCE_ASSET_ID = "phase7-w10-ref-asset";
const REFERENCE_ID = "phase7-w10-ref";

let userAId: string;
let userBId: string;

// ────────────────────────────────────────────────────────────
// Fixture helpers (edit.service.test.ts paterni)
// ────────────────────────────────────────────────────────────

async function ensureUser(email: string) {
  return db.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash: await bcrypt.hash("password-test", 10),
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
    },
    update: {},
  });
}

async function ensureBase(userId: string) {
  const productType = await db.productType.upsert({
    where: { key: PRODUCT_TYPE_KEY },
    update: {},
    create: {
      key: PRODUCT_TYPE_KEY,
      displayName: "Phase7 W10 Wall Art",
      isSystem: false,
    },
  });

  const refAsset = await db.asset.upsert({
    where: { id: `${REFERENCE_ASSET_ID}-${userId}` },
    update: {},
    create: {
      id: `${REFERENCE_ASSET_ID}-${userId}`,
      userId,
      storageProvider: "local",
      storageKey: `phase7-w10/${userId}/ref.png`,
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: `phase7-w10-ref-hash-${userId}`,
    },
  });

  const reference = await db.reference.upsert({
    where: { id: `${REFERENCE_ID}-${userId}` },
    update: {},
    create: {
      id: `${REFERENCE_ID}-${userId}`,
      userId,
      assetId: refAsset.id,
      productTypeId: productType.id,
    },
  });

  return { productType, reference };
}

async function createDesign(args: {
  userId: string;
  productTypeId: string;
  referenceId: string;
  tag: string;
}) {
  const asset = await db.asset.create({
    data: {
      userId: args.userId,
      storageProvider: "local",
      storageKey: `phase7-w10/${args.userId}/${args.tag}.png`,
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: `phase7-w10-design-hash-${args.userId}-${args.tag}-${Math.random()}`,
    },
  });
  const design = await db.generatedDesign.create({
    data: {
      userId: args.userId,
      referenceId: args.referenceId,
      assetId: asset.id,
      productTypeId: args.productTypeId,
    },
  });
  return { asset, design };
}

async function createEditOutputAsset(userId: string, tag: string) {
  return db.asset.create({
    data: {
      userId,
      storageProvider: "local",
      storageKey: `phase7-w10/${userId}/edit-out-${tag}.png`,
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: `phase7-w10-out-${userId}-${tag}-${Math.random()}`,
    },
  });
}

function makeJob(
  payload: RemoveBackgroundJobPayload,
  jobId = "w10-job-1",
): Job<RemoveBackgroundJobPayload> {
  return { id: jobId, data: payload } as unknown as Job<RemoveBackgroundJobPayload>;
}

async function cleanupAll() {
  await db.selectionItem.deleteMany({
    where: { selectionSet: { userId: { in: [userAId, userBId] } } },
  });
  await db.selectionSet.deleteMany({
    where: { userId: { in: [userAId, userBId] } },
  });
  await db.generatedDesign.deleteMany({
    where: { userId: { in: [userAId, userBId] } },
  });
  await db.reference.deleteMany({
    where: { userId: { in: [userAId, userBId] } },
  });
  await db.asset.deleteMany({
    where: { userId: { in: [userAId, userBId] } },
  });
}

beforeAll(async () => {
  const a = await ensureUser("phase7-w10-a@etsyhub.local");
  const b = await ensureUser("phase7-w10-b@etsyhub.local");
  userAId = a.id;
  userBId = b.id;
});

beforeEach(async () => {
  await cleanupAll();
  vi.mocked(removeBackground).mockReset();
  queueAddMock.mockReset();
});

afterAll(async () => {
  await cleanupAll();
});

// ────────────────────────────────────────────────────────────
// Worker handler — happy path
// ────────────────────────────────────────────────────────────

describe("handleSelectionEditRemoveBackground — happy path", () => {
  it("sourceAssetId → editedAssetId, lastUndoableAssetId null kalır, history push, lock release", async () => {
    const { productType, reference } = await ensureBase(userAId);
    const set = await createSet({ userId: userAId, name: "BgRemHappy" });
    const d1 = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "h1",
    });
    const created = await addItems({
      userId: userAId,
      setId: set.id,
      items: [{ generatedDesignId: d1.design.id }],
    });
    const itemId = created[0]!.id;

    // Item'ı "lock acquired" durumuna getir (gerçekte applyEditAsync yapar).
    await db.selectionItem.update({
      where: { id: itemId },
      data: { activeHeavyJobId: "w10-job-1" },
    });

    const newAsset = await createEditOutputAsset(userAId, "h1-out");
    vi.mocked(removeBackground).mockResolvedValue({ assetId: newAsset.id });

    await handleSelectionEditRemoveBackground(
      makeJob({
        userId: userAId,
        setId: set.id,
        itemId,
        opType: "background-remove",
      }),
    );

    expect(removeBackground).toHaveBeenCalledTimes(1);
    expect(removeBackground).toHaveBeenCalledWith({
      inputAssetId: d1.asset.id,
    });

    const updated = await db.selectionItem.findUniqueOrThrow({
      where: { id: itemId },
    });
    expect(updated.sourceAssetId).toBe(d1.asset.id);
    expect(updated.editedAssetId).toBe(newAsset.id);
    expect(updated.lastUndoableAssetId).toBeNull();
    expect(updated.activeHeavyJobId).toBeNull();

    const history = updated.editHistoryJson as Array<{
      op: string;
      at: string;
      failed?: boolean;
    }>;
    expect(history).toHaveLength(1);
    expect(history[0]!.op).toBe("background-remove");
    expect(history[0]!.failed).toBeUndefined();
    expect(typeof history[0]!.at).toBe("string");
  });

  it("var olan editedAssetId → lastUndoableAssetId'ye düşer (chaining)", async () => {
    const { productType, reference } = await ensureBase(userAId);
    const set = await createSet({ userId: userAId, name: "BgRemChain" });
    const d1 = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "ch1",
    });
    const created = await addItems({
      userId: userAId,
      setId: set.id,
      items: [{ generatedDesignId: d1.design.id }],
    });
    const itemId = created[0]!.id;

    // Önceden bir crop yapılmış gibi state set et (editedAssetId mevcut).
    const prevEdit = await createEditOutputAsset(userAId, "ch1-prev");
    await db.selectionItem.update({
      where: { id: itemId },
      data: {
        editedAssetId: prevEdit.id,
        editHistoryJson: [
          { op: "crop", params: { ratio: "2:3" }, at: new Date().toISOString() },
        ],
        activeHeavyJobId: "w10-job-2",
      },
    });

    const bgOut = await createEditOutputAsset(userAId, "ch1-bg");
    vi.mocked(removeBackground).mockResolvedValue({ assetId: bgOut.id });

    await handleSelectionEditRemoveBackground(
      makeJob({
        userId: userAId,
        setId: set.id,
        itemId,
        opType: "background-remove",
      }),
    );

    // Input = prevEdit (editedAssetId), çünkü bg-remove input = edited ?? source.
    expect(removeBackground).toHaveBeenCalledWith({ inputAssetId: prevEdit.id });

    const updated = await db.selectionItem.findUniqueOrThrow({
      where: { id: itemId },
    });
    expect(updated.editedAssetId).toBe(bgOut.id);
    expect(updated.lastUndoableAssetId).toBe(prevEdit.id);
    expect(updated.activeHeavyJobId).toBeNull();

    const history = updated.editHistoryJson as Array<{ op: string }>;
    expect(history.map((h) => h.op)).toEqual(["crop", "background-remove"]);
  });
});

// ────────────────────────────────────────────────────────────
// Worker handler — guards
// ────────────────────────────────────────────────────────────

describe("handleSelectionEditRemoveBackground — guards", () => {
  it("cross-user payload (userId set sahibi değil) → NotFoundError, item dokunulmaz", async () => {
    const { productType, reference } = await ensureBase(userAId);
    const set = await createSet({ userId: userAId, name: "Cross" });
    const d1 = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "x1",
    });
    const created = await addItems({
      userId: userAId,
      setId: set.id,
      items: [{ generatedDesignId: d1.design.id }],
    });
    const itemId = created[0]!.id;

    await db.selectionItem.update({
      where: { id: itemId },
      data: { activeHeavyJobId: "w10-job-x" },
    });

    await expect(
      handleSelectionEditRemoveBackground(
        makeJob({
          userId: userBId,
          setId: set.id,
          itemId,
          opType: "background-remove",
        }),
      ),
    ).rejects.toThrow(NotFoundError);

    expect(removeBackground).not.toHaveBeenCalled();

    // Item state dokunulmadı (lock state aynen kaldı; B userId guard yetkisiz).
    const untouched = await db.selectionItem.findUniqueOrThrow({
      where: { id: itemId },
    });
    expect(untouched.editedAssetId).toBeNull();
    expect(untouched.activeHeavyJobId).toBe("w10-job-x");
  });

  it("ready set → SetReadOnlyError; item dokunulmaz", async () => {
    const { productType, reference } = await ensureBase(userAId);
    const set = await createSet({ userId: userAId, name: "RO" });
    const d1 = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "ro1",
    });
    const created = await addItems({
      userId: userAId,
      setId: set.id,
      items: [{ generatedDesignId: d1.design.id }],
    });
    const itemId = created[0]!.id;

    // Set ready'e çevrilir
    await db.selectionSet.update({
      where: { id: set.id },
      data: { status: "ready", finalizedAt: new Date() },
    });

    await expect(
      handleSelectionEditRemoveBackground(
        makeJob({
          userId: userAId,
          setId: set.id,
          itemId,
          opType: "background-remove",
        }),
      ),
    ).rejects.toThrow(SetReadOnlyError);

    expect(removeBackground).not.toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────────────────────
// Worker handler — failure path
// ────────────────────────────────────────────────────────────

describe("handleSelectionEditRemoveBackground — failure path", () => {
  it("removeBackground throw → history failure entry, lock release, error re-throw", async () => {
    const { productType, reference } = await ensureBase(userAId);
    const set = await createSet({ userId: userAId, name: "Fail" });
    const d1 = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "f1",
    });
    const created = await addItems({
      userId: userAId,
      setId: set.id,
      items: [{ generatedDesignId: d1.design.id }],
    });
    const itemId = created[0]!.id;

    await db.selectionItem.update({
      where: { id: itemId },
      data: { activeHeavyJobId: "w10-job-fail" },
    });

    vi.mocked(removeBackground).mockRejectedValue(
      new Error("imgly model yüklenemedi"),
    );

    await expect(
      handleSelectionEditRemoveBackground(
        makeJob({
          userId: userAId,
          setId: set.id,
          itemId,
          opType: "background-remove",
        }),
      ),
    ).rejects.toThrow(/imgly model yüklenemedi/);

    const updated = await db.selectionItem.findUniqueOrThrow({
      where: { id: itemId },
    });

    // Asset alanları DEĞİŞMEDİ
    expect(updated.editedAssetId).toBeNull();
    expect(updated.lastUndoableAssetId).toBeNull();

    // Lock RELEASE edildi (failure yolunda da)
    expect(updated.activeHeavyJobId).toBeNull();

    // History'ye failure audit entry
    const history = updated.editHistoryJson as Array<{
      op: string;
      at: string;
      failed?: boolean;
      reason?: string;
    }>;
    expect(history).toHaveLength(1);
    expect(history[0]!.op).toBe("background-remove");
    expect(history[0]!.failed).toBe(true);
    expect(history[0]!.reason).toContain("imgly model yüklenemedi");
  });
});

// ────────────────────────────────────────────────────────────
// applyEditAsync — gerçek enqueue + lock
// ────────────────────────────────────────────────────────────

describe("applyEditAsync — real enqueue + lock acquire", () => {
  it("ilk enqueue: BullMQ add çağırılır + activeHeavyJobId set edilir", async () => {
    const { productType, reference } = await ensureBase(userAId);
    const set = await createSet({ userId: userAId, name: "Enq1" });
    const d1 = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "e1",
    });
    const created = await addItems({
      userId: userAId,
      setId: set.id,
      items: [{ generatedDesignId: d1.design.id }],
    });
    const itemId = created[0]!.id;

    queueAddMock.mockResolvedValue({ id: "bullmq-job-id-123" });

    const result = await applyEditAsync({
      userId: userAId,
      setId: set.id,
      itemId,
      op: { op: "background-remove" },
    });

    expect(result.jobId).toBe("bullmq-job-id-123");
    expect(queueAddMock).toHaveBeenCalledTimes(1);
    // İlk argüman JobType.REMOVE_BACKGROUND, ikinci payload
    const [jobType, payload] = queueAddMock.mock.calls[0]!;
    expect(jobType).toBe("REMOVE_BACKGROUND");
    expect(payload).toMatchObject({
      userId: userAId,
      setId: set.id,
      itemId,
      opType: "background-remove",
    });

    const item = await db.selectionItem.findUniqueOrThrow({
      where: { id: itemId },
    });
    expect(item.activeHeavyJobId).toBe("bullmq-job-id-123");
  });

  it("ikinci enqueue (lock varken) → ConcurrentEditError; queue.add çağrılmaz", async () => {
    const { productType, reference } = await ensureBase(userAId);
    const set = await createSet({ userId: userAId, name: "Enq2" });
    const d1 = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "e2",
    });
    const created = await addItems({
      userId: userAId,
      setId: set.id,
      items: [{ generatedDesignId: d1.design.id }],
    });
    const itemId = created[0]!.id;

    // Lock zaten alınmış
    await db.selectionItem.update({
      where: { id: itemId },
      data: { activeHeavyJobId: "existing-job-id" },
    });

    await expect(
      applyEditAsync({
        userId: userAId,
        setId: set.id,
        itemId,
        op: { op: "background-remove" },
      }),
    ).rejects.toThrow(ConcurrentEditError);

    expect(queueAddMock).not.toHaveBeenCalled();

    // Mevcut lock değişmedi
    const item = await db.selectionItem.findUniqueOrThrow({
      where: { id: itemId },
    });
    expect(item.activeHeavyJobId).toBe("existing-job-id");
  });
});
