"use client";

// Phase 5 Task 15 — Local Library settings panel.
// rootFolderPath (absolute), targetResolution, targetDpi ve qualityThresholds.
// Hardcoded renk yok; tüm tonlar token üzerinden.

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type LocalLibrarySettings = {
  rootFolderPath: string | null;
  targetResolution: { width: number; height: number };
  targetDpi: number;
  qualityThresholds: { ok: number; warn: number };
};

type FormState = {
  rootFolderPath: string;
  width: string;
  height: string;
  targetDpi: string;
  qualityOk: string;
  qualityWarn: string;
};

function toForm(s: LocalLibrarySettings): FormState {
  return {
    rootFolderPath: s.rootFolderPath ?? "",
    width: String(s.targetResolution.width),
    height: String(s.targetResolution.height),
    targetDpi: String(s.targetDpi),
    qualityOk: String(s.qualityThresholds.ok),
    qualityWarn: String(s.qualityThresholds.warn),
  };
}

function parseForm(f: FormState): {
  ok: true;
  data: LocalLibrarySettings;
} | { ok: false; error: string } {
  const path = f.rootFolderPath.trim();
  if (path.length > 0 && !path.startsWith("/")) {
    return { ok: false, error: "Mutlak yol gerekli (/ ile başlamalı)" };
  }
  const width = Number(f.width);
  const height = Number(f.height);
  const dpi = Number(f.targetDpi);
  const okT = Number(f.qualityOk);
  const warnT = Number(f.qualityWarn);
  if (!Number.isInteger(width) || width <= 0) {
    return { ok: false, error: "Genişlik pozitif tam sayı olmalı" };
  }
  if (!Number.isInteger(height) || height <= 0) {
    return { ok: false, error: "Yükseklik pozitif tam sayı olmalı" };
  }
  if (!Number.isInteger(dpi) || dpi <= 0) {
    return { ok: false, error: "DPI pozitif tam sayı olmalı" };
  }
  if (!Number.isInteger(okT) || okT < 0 || okT > 100) {
    return { ok: false, error: "Ok eşiği 0-100 arası tam sayı olmalı" };
  }
  if (!Number.isInteger(warnT) || warnT < 0 || warnT > 100) {
    return { ok: false, error: "Warn eşiği 0-100 arası tam sayı olmalı" };
  }
  if (warnT >= okT) {
    return { ok: false, error: "Warn eşiği Ok eşiğinden küçük olmalı" };
  }
  return {
    ok: true,
    data: {
      rootFolderPath: path.length > 0 ? path : null,
      targetResolution: { width, height },
      targetDpi: dpi,
      qualityThresholds: { ok: okT, warn: warnT },
    },
  };
}

const QUERY_KEY = ["settings", "local-library"] as const;

export function LocalLibrarySettingsPanel() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<{ settings: LocalLibrarySettings }> => {
      const r = await fetch("/api/settings/local-library");
      if (!r.ok) throw new Error("Ayarlar yüklenemedi");
      return r.json();
    },
  });

  const initialForm = useMemo<FormState | null>(
    () => (query.data ? toForm(query.data.settings) : null),
    [query.data],
  );
  const [form, setForm] = useState<FormState | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);

  useEffect(() => {
    if (initialForm && form === null) setForm(initialForm);
  }, [initialForm, form]);

  const mutation = useMutation({
    mutationFn: async (data: LocalLibrarySettings) => {
      const r = await fetch("/api/settings/local-library", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? "Kaydedilemedi");
      }
      return r.json() as Promise<{ settings: LocalLibrarySettings }>;
    },
    onSuccess: (res) => {
      qc.setQueryData(QUERY_KEY, res);
      setClientError(null);
    },
  });

  if (query.isLoading || !form) {
    return (
      <Card variant="stat" className="p-5">
        <h2 className="text-lg font-semibold text-text">Yerel kütüphane</h2>
        <p className="mt-2 text-sm text-text-muted">Yükleniyor…</p>
      </Card>
    );
  }

  if (query.isError) {
    return (
      <Card variant="stat" className="p-5">
        <h2 className="text-lg font-semibold text-text">Yerel kütüphane</h2>
        <p className="mt-2 text-sm text-danger">
          {(query.error as Error | null)?.message ?? "Ayarlar yüklenemedi"}
        </p>
      </Card>
    );
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseForm(form);
    if (!parsed.ok) {
      setClientError(parsed.error);
      return;
    }
    setClientError(null);
    mutation.mutate(parsed.data);
  };

  const update = (k: keyof FormState, v: string) =>
    setForm((cur) => (cur ? { ...cur, [k]: v } : cur));

  return (
    <Card variant="stat" className="p-5">
      <h2 className="text-lg font-semibold text-text">Yerel kütüphane</h2>
      <p className="mt-1 text-sm text-text-muted">
        Lokal görsel kütüphanesi için kök klasör, hedef çözünürlük ve kalite
        eşikleri.
      </p>
      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-4">
        <FormField
          label="Kök klasör (mutlak yol)"
          description="Boş bırakılırsa tarama yapılamaz. Örn: /Users/sen/Resimler"
        >
          <Input
            type="text"
            value={form.rootFolderPath}
            onChange={(e) => update("rootFolderPath", e.target.value)}
            placeholder="/Users/sen/Resimler"
          />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Hedef genişlik (px)">
            <Input
              type="number"
              min={1}
              value={form.width}
              onChange={(e) => update("width", e.target.value)}
            />
          </FormField>
          <FormField label="Hedef yükseklik (px)">
            <Input
              type="number"
              min={1}
              value={form.height}
              onChange={(e) => update("height", e.target.value)}
            />
          </FormField>
        </div>

        <FormField label="Hedef DPI" description="Print readiness için (varsayılan 300)">
          <Input
            type="number"
            min={1}
            value={form.targetDpi}
            onChange={(e) => update("targetDpi", e.target.value)}
          />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="Kalite eşiği — Ok (0-100)"
            description="Bu skor ve üstü iyi (yeşil)"
          >
            <Input
              type="number"
              min={0}
              max={100}
              value={form.qualityOk}
              onChange={(e) => update("qualityOk", e.target.value)}
            />
          </FormField>
          <FormField
            label="Kalite eşiği — Warn (0-100)"
            description="Bu skor ve üstü uyarı (sarı). Ok'tan küçük olmalı."
          >
            <Input
              type="number"
              min={0}
              max={100}
              value={form.qualityWarn}
              onChange={(e) => update("qualityWarn", e.target.value)}
            />
          </FormField>
        </div>

        {clientError ? (
          <p className="text-sm text-danger" role="alert">
            {clientError}
          </p>
        ) : null}
        {mutation.isError ? (
          <p className="text-sm text-danger" role="alert">
            {(mutation.error as Error | null)?.message ?? "Kaydedilemedi"}
          </p>
        ) : null}
        {mutation.isSuccess ? (
          <p className="text-sm text-success">Kaydedildi.</p>
        ) : null}

        <div className="flex justify-end">
          <Button
            type="submit"
            variant="primary"
            loading={mutation.isPending}
            disabled={mutation.isPending}
          >
            Kaydet
          </Button>
        </div>
      </form>

      {/* Pass 18 — kütüphaneyi tara + son tarama özeti.
          Mevcut /api/local-library/scan POST endpoint'ini settings ekranından
          tetiklemek için. Önceden sadece variation generation flow içinden
          çağrılabiliyordu; settings'te scan trigger + son tarama özeti yoktu,
          kullanıcı path girer Kaydet'e basar ama görseller indekslenmezdi
          ("neden görünmüyor?" UX gap). */}
      {form.rootFolderPath ? (
        <ScanSection rootFolderPath={form.rootFolderPath} />
      ) : null}
    </Card>
  );
}

// ── Scan trigger + summary ────────────────────────────────────────────────

type FolderSummary = { name: string; path: string; fileCount: number };
type ScanSummary = {
  folderCount: number;
  assetCount: number;
};

async function fetchScanSummary(): Promise<ScanSummary> {
  const [foldersRes, assetsRes] = await Promise.all([
    fetch("/api/local-library/folders"),
    fetch("/api/local-library/assets"),
  ]);
  if (!foldersRes.ok || !assetsRes.ok) {
    throw new Error("Kütüphane özeti yüklenemedi");
  }
  const f = (await foldersRes.json()) as { folders: FolderSummary[] };
  const a = (await assetsRes.json()) as { assets: unknown[] };
  return {
    folderCount: f.folders.length,
    assetCount: a.assets.length,
  };
}

function ScanSection({ rootFolderPath }: { rootFolderPath: string }) {
  const qc = useQueryClient();
  const summary = useQuery({
    queryKey: ["settings", "local-library", "scan-summary"],
    queryFn: fetchScanSummary,
  });
  const scan = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/local-library/scan", { method: "POST" });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? "Tarama başlatılamadı");
      }
      return r.json() as Promise<{ jobId: string }>;
    },
    onSuccess: () => {
      // Scan worker arka planda çalışır; özet birkaç saniye sonra güncellenir.
      // Kullanıcıya açık geri bildirim için 3s sonra yeniden fetch.
      setTimeout(() => {
        qc.invalidateQueries({
          queryKey: ["settings", "local-library", "scan-summary"],
        });
      }, 3000);
    },
  });

  return (
    <div className="mt-6 flex flex-col gap-3 rounded-md border border-border bg-bg p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-text">Kütüphane taraması</span>
          <span className="text-xs text-text-muted">
            Klasör: <span className="font-mono">{rootFolderPath}</span>
          </span>
        </div>
        <Button
          type="button"
          variant="secondary"
          loading={scan.isPending}
          disabled={scan.isPending}
          onClick={() => scan.mutate()}
        >
          {scan.isPending ? "Tarama başlatılıyor…" : "Şimdi tara"}
        </Button>
      </div>

      {scan.isError ? (
        <p className="text-sm text-danger" role="alert">
          {(scan.error as Error).message}
        </p>
      ) : null}
      {scan.isSuccess ? (
        <p className="text-xs text-text-muted">
          Tarama kuyruğa eklendi. Tamamlandığında özet aşağıda güncellenecek
          (worker `npm run worker` çalışıyor olmalı).
        </p>
      ) : null}

      <div className="flex flex-col gap-1 border-t border-border pt-3 text-xs text-text-muted">
        <span className="font-medium text-text">Mevcut indeks</span>
        {summary.isLoading ? (
          <span>Yükleniyor…</span>
        ) : summary.isError ? (
          <span className="text-danger">
            {(summary.error as Error).message}
          </span>
        ) : summary.data ? (
          summary.data.folderCount === 0 ? (
            <span>
              Henüz indekslenmiş klasör yok. Yukarıdaki kök yolu kontrol edin
              ve &quot;Şimdi tara&quot;ya basın. Görseller alt klasörlerin
              içindeyse: scanner kök + 1 seviye alt klasör tarar (daha derin
              yapılar henüz desteklenmiyor).
            </span>
          ) : (
            <span>
              {summary.data.folderCount} klasör · {summary.data.assetCount}{" "}
              görsel indekslendi. Görselleri görmek için bir Reference&apos;a
              gidip &quot;Lokal kütüphaneden ekle&quot; akışını kullanın
              (Üret/Phase 5 akışı).
            </span>
          )
        ) : null}
        <span className="text-xs text-text-muted">
          Desteklenen formatlar: .jpg, .jpeg, .png. (.webp şu an desteklenmiyor.)
        </span>
      </div>
    </div>
  );
}
