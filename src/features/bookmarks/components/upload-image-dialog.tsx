"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";

export function UploadImageDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated?: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Dosya seçilmedi");
      const fd = new FormData();
      fd.set("file", file);
      const uploadRes = await fetch("/api/assets/upload", {
        method: "POST",
        body: fd,
      });
      if (!uploadRes.ok) {
        throw new Error((await uploadRes.json()).error ?? "Yükleme başarısız");
      }
      const { id: assetId } = (await uploadRes.json()) as { id: string };
      const bmRes = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assetId,
          title: title.trim() || undefined,
          sourcePlatform: "UPLOAD",
        }),
      });
      if (!bmRes.ok) {
        throw new Error(
          (await bmRes.json()).error ?? "Bookmark oluşturulamadı",
        );
      }
      return bmRes.json();
    },
    onSuccess: () => {
      setMessage("Bookmark oluşturuldu.");
      onCreated?.();
      setTimeout(() => onClose(), 800);
    },
    onError: (err) => setError((err as Error).message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4">
      <div className="w-full max-w-md rounded-md border border-border bg-surface p-5 shadow-popover">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Görsel yükle</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-text-muted hover:text-text"
          >
            Kapat
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              setError(null);
              setFile(e.target.files?.[0] ?? null);
            }}
            className="text-sm text-text"
          />
          <input
            type="text"
            placeholder="Başlık (opsiyonel)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-text"
          />
          {error ? <p className="text-xs text-danger">{error}</p> : null}
          {message ? (
            <p className="text-xs text-success">{message}</p>
          ) : null}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            disabled={submit.isPending || !file}
            onClick={() => submit.mutate()}
            className="rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground disabled:opacity-50"
          >
            {submit.isPending ? "Yükleniyor…" : "Yükle ve Bookmark Yap"}
          </button>
        </div>
      </div>
    </div>
  );
}
