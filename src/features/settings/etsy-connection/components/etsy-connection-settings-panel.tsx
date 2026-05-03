"use client";

// Phase 9 V1 — Etsy connection settings panel.
//
// Status-driven render (form değil — bağlantı OAuth flow ile kurulur):
//   - not_configured: ETSY_CLIENT_ID env yok → kullanıcıya yönetici uyarısı
//   - not_connected: "Etsy'ye bağlan" CTA
//   - connected: shopName + "Bağlantıyı kaldır" button
//   - expired: uyarı + "Yeniden bağlan" CTA
//
// "Bağlan" CTA: <a href="/api/etsy/oauth/start"> — browser server redirect
// alır, Etsy'ye gider, kullanıcı izin verince callback'e döner.
//
// URL query feedback: callback ?etsy=connected|state-mismatch|missing-code|...
// query'sini Settings sayfasına basar; panel bunu okuyup ilgili banner gösterir.

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { EtsyConnectionStatus } from "@/providers/etsy/connection.service";

const QUERY_KEY = ["settings", "etsy-connection"] as const;

const ETSY_QUERY_MESSAGES: Record<
  string,
  { tone: "success" | "error" | "info"; text: string }
> = {
  connected: { tone: "success", text: "Etsy bağlantısı kuruldu." },
  "state-mismatch": {
    tone: "error",
    text: "OAuth doğrulaması başarısız (state uyuşmadı). Tekrar dene.",
  },
  "missing-state": {
    tone: "error",
    text: "OAuth oturumu bulunamadı (cookie sona ermiş). Tekrar dene.",
  },
  "missing-code": {
    tone: "error",
    text: "Etsy yanıtı eksik. Tekrar dene.",
  },
};

function readEtsyQueryMessage(
  reason: string | null,
): { tone: "success" | "error" | "info"; text: string } | null {
  if (!reason) return null;
  if (reason in ETSY_QUERY_MESSAGES) return ETSY_QUERY_MESSAGES[reason]!;
  if (reason.startsWith("error-")) {
    const code = reason.slice("error-".length);
    return { tone: "error", text: `Etsy bağlantı hatası: ${code}` };
  }
  return { tone: "info", text: reason };
}

export function EtsyConnectionSettingsPanel() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<{ status: EtsyConnectionStatus }> => {
      const r = await fetch("/api/settings/etsy-connection");
      if (!r.ok) throw new Error("Bağlantı durumu alınamadı");
      return r.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/settings/etsy-connection", {
        method: "DELETE",
      });
      if (!r.ok) throw new Error("Bağlantı kaldırılamadı");
      return r.json() as Promise<{ status: EtsyConnectionStatus }>;
    },
    onSuccess: (res) => {
      qc.setQueryData(QUERY_KEY, res);
    },
  });

  // URL query message (callback'ten gelen feedback)
  const etsyReason = searchParams?.get("etsy") ?? null;
  const queryMessage = readEtsyQueryMessage(etsyReason);

  // Mesaj görüldükten sonra URL'i temizle (history kirletme)
  const [messageDismissed, setMessageDismissed] = useState(false);
  useEffect(() => {
    if (etsyReason && !messageDismissed) {
      // Query'i temizle (sayfa state'i koru)
      const params = new URLSearchParams(
        searchParams ? Array.from(searchParams.entries()) : [],
      );
      params.delete("etsy");
      const next = params.toString();
      router.replace(next ? `${pathname}?${next}` : pathname, {
        scroll: false,
      });
      setMessageDismissed(true);
      // Query'i invalidate et (callback sonrası status değişti)
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    }
  }, [etsyReason, messageDismissed, pathname, router, searchParams, qc]);

  if (query.isLoading) {
    return (
      <Card variant="stat" className="p-5">
        <h2 className="text-lg font-semibold text-text">Etsy bağlantısı</h2>
        <p className="mt-2 text-sm text-text-muted">Yükleniyor…</p>
      </Card>
    );
  }

  if (query.isError) {
    return (
      <Card variant="stat" className="p-5">
        <h2 className="text-lg font-semibold text-text">Etsy bağlantısı</h2>
        <p className="mt-2 text-sm text-danger">
          {(query.error as Error | null)?.message ?? "Bağlantı durumu alınamadı"}
        </p>
      </Card>
    );
  }

  const status = query.data!.status;

  return (
    <Card variant="stat" className="p-5">
      <h2 className="text-lg font-semibold text-text">Etsy bağlantısı</h2>
      <p className="mt-1 text-sm text-text-muted">
        Listing taslaklarını Etsy&apos;ye göndermek için mağazanızı bağlayın.
        Bağlantı kurulduktan sonra sadece taslak (draft) oluşturulur — yayına
        alma Etsy admin panelinden manuel yapılır.
      </p>

      {/* URL query feedback (callback sonrası) */}
      {queryMessage && (
        <p
          role={queryMessage.tone === "error" ? "alert" : "status"}
          className={
            queryMessage.tone === "success"
              ? "mt-3 text-sm text-success"
              : queryMessage.tone === "error"
                ? "mt-3 text-sm text-danger"
                : "mt-3 text-sm text-text-muted"
          }
        >
          {queryMessage.text}
        </p>
      )}

      <div className="mt-4">
        {status.state === "not_configured" && (
          <div className="rounded-md border border-border bg-surface p-3 text-sm text-text-muted">
            <p className="font-medium text-text">
              Etsy entegrasyonu yapılandırılmadı.
            </p>
            <p className="mt-1">
              Sistem yöneticisinin <code className="font-mono">.env</code>{" "}
              dosyasına <code className="font-mono">ETSY_CLIENT_ID</code>,{" "}
              <code className="font-mono">ETSY_CLIENT_SECRET</code> ve{" "}
              <code className="font-mono">ETSY_REDIRECT_URI</code> eklemesi
              gerek.
            </p>
            <p className="mt-2 text-xs">
              Credentials kaynağı:{" "}
              <span className="font-mono">developer.etsy.com</span>
            </p>
          </div>
        )}

        {status.state === "not_connected" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-text-muted">Etsy hesabınız bağlı değil.</p>
            <a
              href="/api/etsy/oauth/start"
              className="inline-flex h-control-md items-center justify-center self-start rounded-md border border-accent bg-accent px-4 text-sm font-medium text-accent-foreground transition-colors duration-fast ease-out hover:bg-accent-hover"
            >
              Etsy&apos;ye bağlan
            </a>
          </div>
        )}

        {status.state === "expired" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-warning">
              Bağlantı süresi doldu
              {status.shopName ? ` (${status.shopName})` : ""}. Yeniden bağlanmak
              gerek.
            </p>
            <a
              href="/api/etsy/oauth/start"
              className="inline-flex h-control-md items-center justify-center self-start rounded-md border border-accent bg-accent px-4 text-sm font-medium text-accent-foreground transition-colors duration-fast ease-out hover:bg-accent-hover"
            >
              Yeniden bağlan
            </a>
          </div>
        )}

        {status.state === "connected" && (
          <div className="flex flex-col gap-3">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-text-muted">Mağaza adı</dt>
              <dd className="text-text">{status.shopName ?? "(bilinmiyor)"}</dd>
              <dt className="text-text-muted">Mağaza ID</dt>
              <dd className="font-mono text-text">{status.shopId}</dd>
              <dt className="text-text-muted">Token süresi</dt>
              <dd className="text-text">
                {status.tokenExpires
                  ? new Date(status.tokenExpires).toLocaleString("tr")
                  : "—"}
              </dd>
              <dt className="text-text-muted">Yetkiler</dt>
              <dd className="font-mono text-xs text-text-muted">
                {status.scopes.join(", ")}
              </dd>
            </dl>

            {deleteMutation.isError && (
              <p role="alert" className="text-sm text-danger">
                {(deleteMutation.error as Error | null)?.message ??
                  "Bağlantı kaldırılamadı"}
              </p>
            )}

            <p className="text-xs text-text-muted">
              &quot;Bağlantıyı kaldır&quot; sadece bizim tarafta token&apos;ı
              siler. Etsy uygulama izinlerini iptal etmek için ayrıca{" "}
              <span className="font-mono">etsy.com/your/account/apps</span>{" "}
              üzerinden izinleri kaldırmalısınız.
            </p>

            <Button
              variant="secondary"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              loading={deleteMutation.isPending}
              className="self-start"
            >
              Bağlantıyı kaldır
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
