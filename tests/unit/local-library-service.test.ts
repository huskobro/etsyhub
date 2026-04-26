import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import {
  discoverFolders,
  listAssetFilesInFolder,
} from "@/features/variation-generation/services/local-library.service";

let root: string;

async function mkPng(path: string, w: number, h: number) {
  const buf = await sharp({
    create: { width: w, height: h, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .png()
    .toBuffer();
  writeFileSync(path, buf);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "etsyhub-local-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("discoverFolders (Q2: root + first-level only)", () => {
  it("returns root + first-level child folders, ignores deeper", async () => {
    mkdirSync(join(root, "horse Q10"));
    mkdirSync(join(root, "bird Q15"));
    mkdirSync(join(root, "horse Q10", "deeper")); // ignored
    await mkPng(join(root, "a.png"), 100, 100);
    await mkPng(join(root, "horse Q10", "h1.png"), 100, 100);

    const folders = await discoverFolders(root);
    const names = folders.map((f) => f.name).sort();
    expect(names).toEqual(["bird Q15", "horse Q10", "root"]);
    expect(folders.find((f) => f.name === "horse Q10")?.fileCount).toBe(1);
  });

  it("ignores non-image files", async () => {
    writeFileSync(join(root, "readme.txt"), "x");
    await mkPng(join(root, "ok.jpg"), 100, 100);
    const folders = await discoverFolders(root);
    const rootFolder = folders.find((f) => f.name === "root");
    expect(rootFolder?.fileCount).toBe(1);
  });
});

describe("listAssetFilesInFolder", () => {
  it("returns JPG/JPEG/PNG only", async () => {
    await mkPng(join(root, "a.png"), 100, 100);
    await mkPng(join(root, "b.jpg"), 100, 100);
    writeFileSync(join(root, "c.txt"), "x");
    const files = await listAssetFilesInFolder(root);
    expect(files.map((f) => f.fileName).sort()).toEqual(["a.png", "b.jpg"]);
  });
});

describe("Q2 derinlik guard", () => {
  it("Q2: ikinci-derece alt klasörü asla folder olarak döndürmez", async () => {
    mkdirSync(join(root, "horse Q10"));
    mkdirSync(join(root, "horse Q10", "deeper"));
    await mkPng(join(root, "horse Q10", "deeper", "x.png"), 100, 100);
    const folders = await discoverFolders(root);
    const names = folders.map((f) => f.name);
    expect(names).not.toContain("deeper");
  });
});
