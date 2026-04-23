"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name: name || undefined }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Kayıt başarısız.");
      return;
    }
    router.push("/login");
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <h1 className="text-2xl font-semibold">Hesap oluştur</h1>
      <input
        type="text"
        placeholder="Ad (opsiyonel)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-10 rounded-md border border-border bg-surface px-3 text-text"
        autoComplete="name"
      />
      <input
        type="email"
        placeholder="E-posta"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="h-10 rounded-md border border-border bg-surface px-3 text-text"
        autoComplete="email"
        required
      />
      <input
        type="password"
        placeholder="Parola (en az 8 karakter)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="h-10 rounded-md border border-border bg-surface px-3 text-text"
        autoComplete="new-password"
        minLength={8}
        required
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="h-10 rounded-md bg-accent font-medium text-accent-foreground disabled:opacity-50"
      >
        {busy ? "Oluşturuluyor…" : "Hesabı Oluştur"}
      </button>
    </form>
  );
}
