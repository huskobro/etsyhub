"use client";

// Phase 9 V1 Finalization — Etsy readiness diagnostics summary.
//
// Settings panelinde Etsy bağlantı paneli'nin ÜSTÜNDE küçük 3-state
// checklist gösterir. Admin/QA bakar bakmaz "submit live success için
// neye hazırım?" sorusuna cevap bulur (log açmadan).
//
// Live çağrı YOK; sadece env + DB + connection state okuma.
// 30s polling ile env hot-reload (admin .env'e taxonomy ekledikten sonra
// UI 30s içinde güncellenir; full restart gerek değil).

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { CheckCircle2, AlertCircle, Circle } from "lucide-react";
import type { EtsyReadinessSummary } from "@/app/api/settings/etsy-connection/readiness/route";

const QUERY_KEY = ["settings", "etsy-readiness"] as const;

type SignalState =
  | "ok"
  | "missing"
  | "invalid"
  | "not_configured"
  | "not_connected"
  | "expired"
  | "connected";

function SignalIcon({ state }: { state: SignalState }) {
  const ok = state === "ok" || state === "connected";
  const warn = state === "expired";
  if (ok) {
    return (
      <CheckCircle2
        className="h-4 w-4 shrink-0 text-success"
        aria-label="Hazır"
      />
    );
  }
  if (warn) {
    return (
      <AlertCircle
        className="h-4 w-4 shrink-0 text-warning"
        aria-label="Uyarı"
      />
    );
  }
  return (
    <Circle
      className="h-4 w-4 shrink-0 text-text-muted"
      aria-label="Hazır değil"
    />
  );
}

export function EtsyReadinessSummary() {
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<{ summary: EtsyReadinessSummary }> => {
      const r = await fetch("/api/settings/etsy-connection/readiness");
      if (!r.ok) throw new Error("Could not load readiness status");
      return r.json();
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  if (query.isLoading) {
    return (
      <Card variant="stat" className="p-4">
        <p className="text-xs text-text-muted">
          Etsy hazırlık durumu yükleniyor…
        </p>
      </Card>
    );
  }

  if (query.isError || !query.data) {
    return (
      <Card variant="stat" className="p-4">
        <p className="text-xs text-danger">
          Could not load Etsy readiness status:{" "}
          {(query.error as Error | null)?.message ?? "bilinmeyen hata"}
        </p>
      </Card>
    );
  }

  const { summary } = query.data;
  const { oauthCredentials, taxonomyMapping, connection, liveReady } = summary;

  return (
    <Card variant="stat" className="p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-text">
          Etsy live submit hazırlığı
        </h3>
        <span
          aria-label={liveReady ? "Tüm hazır" : "Eksik adımlar var"}
          className={
            liveReady
              ? "rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success"
              : "rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-text-muted"
          }
        >
          {liveReady ? "Hazır" : "Hazır değil"}
        </span>
      </div>
      <p className="mt-1 text-xs text-text-muted">
        Submit pipeline&apos;ın live başarı için 3 boyutu kontrol edilir.
        Eksik adımlar kullanıcı/admin tarafında çözülür.
      </p>

      <ul className="mt-3 space-y-2 text-xs">
        <li className="flex items-start gap-2">
          <SignalIcon state={oauthCredentials.state} />
          <div className="flex-1">
            <p className="font-medium text-text">
              OAuth credentials
              <span className="ml-2 font-mono text-text-muted">
                ({oauthCredentials.state})
              </span>
            </p>
            <p className="text-text-muted">{oauthCredentials.detail}</p>
          </div>
        </li>

        <li className="flex items-start gap-2">
          <SignalIcon state={taxonomyMapping.state} />
          <div className="flex-1">
            <p className="font-medium text-text">
              Taxonomy mapping
              <span className="ml-2 font-mono text-text-muted">
                ({taxonomyMapping.state})
              </span>
            </p>
            <p className="text-text-muted">{taxonomyMapping.detail}</p>
            {taxonomyMapping.sampleResolved !== null && (
              <p className="font-mono text-text-muted">
                Sample: {taxonomyMapping.sampleKey} →{" "}
                {taxonomyMapping.sampleResolved}
              </p>
            )}
          </div>
        </li>

        <li className="flex items-start gap-2">
          <SignalIcon state={connection.state} />
          <div className="flex-1">
            <p className="font-medium text-text">
              Bağlantı
              <span className="ml-2 font-mono text-text-muted">
                ({connection.state})
              </span>
            </p>
            <p className="text-text-muted">
              {connection.state === "connected" &&
                `Mağaza: ${connection.shopName ?? "(bilinmiyor)"}; token süresi ${connection.tokenExpires ? new Date(connection.tokenExpires).toLocaleString("tr") : "—"}.`}
              {connection.state === "expired" &&
                `Token süresi doldu (${connection.tokenExpires ? new Date(connection.tokenExpires).toLocaleString("tr") : "—"}). Submit pipeline otomatik refresh dener; başarısızsa aşağıdan yeniden bağlanın.`}
              {connection.state === "not_connected" &&
                "Etsy hesabınız bağlı değil. Aşağıdaki panelden bağlanın."}
              {connection.state === "not_configured" &&
                "Sistem yöneticisi env credentials'ı eklemeden bağlantı kurulamaz."}
            </p>
          </div>
        </li>
      </ul>
    </Card>
  );
}
