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
    </Card>
  );
}
