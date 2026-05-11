// IA-35 — folder mapping path-based identity tests.
//
// Eski kontrat: `Record<folderName, productTypeKey>` aynı isimli ama
// farklı path'teki klasörleri çarpıştırıyordu. Yeni: anahtar canonical
// `folderPath`; legacy folderName fallback okumaya devam eder.

import { describe, it, expect } from "vitest";
import {
  resolveLocalFolder,
  resolveLocalProductTypeKey,
  IGNORE_FOLDER_SENTINEL,
} from "@/features/settings/local-library/folder-mapping";

describe("resolveLocalFolder — path-based identity (IA-35)", () => {
  it("aynı folderName farklı path → her biri kendi mapping'iyle resolve", () => {
    const folderMap = {
      "/root-a/clipart": "clipart",
      "/root-b/clipart": "wall_art", // operatör root-b altında "clipart" adını wall_art'a aliaslamış (örnek)
    };
    const a = resolveLocalFolder({
      folderName: "clipart",
      folderPath: "/root-a/clipart",
      folderMap,
    });
    const b = resolveLocalFolder({
      folderName: "clipart",
      folderPath: "/root-b/clipart",
      folderMap,
    });
    expect(a).toEqual({
      kind: "mapped",
      productTypeKey: "clipart",
      reason: "alias",
    });
    expect(b).toEqual({
      kind: "mapped",
      productTypeKey: "wall_art",
      reason: "alias",
    });
  });

  it("path mapping yoksa convention devreye girer (folder name = known PT)", () => {
    const folderMap = {};
    const r = resolveLocalFolder({
      folderName: "wall_art",
      folderPath: "/root/wall_art",
      folderMap,
    });
    expect(r).toEqual({
      kind: "mapped",
      productTypeKey: "wall_art",
      reason: "convention",
    });
  });

  it("path ignored sentinel → kind=ignored", () => {
    const folderMap = { "/root/temp": IGNORE_FOLDER_SENTINEL as string };
    const r = resolveLocalFolder({
      folderName: "temp",
      folderPath: "/root/temp",
      folderMap,
    });
    expect(r.kind).toBe("ignored");
  });

  it("legacy folderName mapping — path yoksa hâlâ okunur (geriye uyumluluk)", () => {
    // Eski mapping (folderName-keyed); yeni resolver path olmadan da
    // legacy entry'yi bulur.
    const folderMap = { "ekmek": "wall_art" };
    const r = resolveLocalFolder({
      folderName: "ekmek",
      folderPath: "/root/ekmek",
      folderMap,
    });
    expect(r).toEqual({
      kind: "mapped",
      productTypeKey: "wall_art",
      reason: "alias",
    });
  });

  it("path mapping legacy folderName mapping'i overshadow eder", () => {
    // Operatör hem eski folderName entry'sini hem yeni path entry'sini
    // taşıyorsa path baskındır.
    const folderMap = {
      "ekmek": "wall_art", // legacy
      "/root/ekmek": "clipart", // path-based (yeni)
    };
    const r = resolveLocalFolder({
      folderName: "ekmek",
      folderPath: "/root/ekmek",
      folderMap,
    });
    expect(r).toEqual({
      kind: "mapped",
      productTypeKey: "clipart",
      reason: "alias",
    });
  });

  it("bilinmeyen folder + mapping yok → kind=pending", () => {
    const r = resolveLocalFolder({
      folderName: "ekmek",
      folderPath: "/root/ekmek",
      folderMap: {},
    });
    expect(r).toEqual({ kind: "pending", folderName: "ekmek" });
  });

  it("resolveLocalProductTypeKey helper aynı semantiği yansıtır", () => {
    const folderMap = { "/root-x/sub": "sticker" };
    expect(
      resolveLocalProductTypeKey({
        folderName: "sub",
        folderPath: "/root-x/sub",
        folderMap,
      }),
    ).toBe("sticker");
    expect(
      resolveLocalProductTypeKey({
        folderName: "sub",
        folderPath: "/root-y/sub",
        folderMap,
      }),
    ).toBe(null); // farklı path, mapping yok, convention da değil
  });

  it("folderPath geçirilmezse path lookup atlanır (eski API çağrı)", () => {
    const folderMap = { "/root/x": "clipart" };
    const r = resolveLocalFolder({ folderName: "x", folderMap });
    // path yok → byPath lookup yapılmaz, folderName lookup → mapping yok,
    // convention da yok → pending.
    expect(r.kind).toBe("pending");
  });
});
