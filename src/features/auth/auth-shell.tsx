"use client";

/**
 * AuthShell — T-29
 *
 * Login + Register tek sayfa, tab switch kabuğu (canvas SCREEN 4).
 * PageShell `variant="auth"` ile iki kolonlu split layout:
 *   - sol: brand panel (lockup + eyebrow + h1 + paragraf + version footer)
 *   - sağ: form panel (tab switch + login/register form + disabled CTA'lar)
 *
 * Backend (/api/auth/register) DOKUNULMADI — alan listesi
 * docs/design/implementation-notes/register-fields.md kararına UYUMLU
 * (email zorunlu, password zorunlu, name opsiyonel; şifre tekrarı yok,
 * davet kodu yok, terms checkbox yok).
 *
 * "Şifrenizi mi unuttunuz?" + "Google ile devam et" disabled (title="Yakında").
 * registrationEnabled=false ise register tab disabled, form yerine
 * "Kayıt şu an kapalı" mesajı.
 */

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { PageShell } from "@/components/ui/PageShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

export interface AuthShellProps {
  mode: "login" | "register";
  registrationEnabled: boolean;
}

export function AuthShell({ mode, registrationEnabled }: AuthShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // ?mode= override (paylaşılabilir link), ama route bazlı çalışsın.
  const queryMode = searchParams.get("mode");
  const effectiveMode: "login" | "register" =
    queryMode === "register" || queryMode === "login" ? queryMode : mode;

  function goToTab(target: "login" | "register") {
    if (target === effectiveMode) return;
    router.push(target === "login" ? "/login" : "/register");
  }

  return (
    <PageShell variant="auth" brand={<BrandPanel />}>
      <div role="tablist" aria-label="Giriş veya kayıt" className="flex gap-1 rounded-md bg-surface-2 p-1">
        <TabButton
          active={effectiveMode === "login"}
          onClick={() => goToTab("login")}
        >
          Giriş
        </TabButton>
        <TabButton
          active={effectiveMode === "register"}
          onClick={() => goToTab("register")}
          disabled={!registrationEnabled}
        >
          Kayıt
        </TabButton>
      </div>

      {effectiveMode === "login" ? (
        <LoginPanel />
      ) : registrationEnabled ? (
        <RegisterPanel />
      ) : (
        <RegistrationDisabledMessage />
      )}

      <SocialDivider />
      <DisabledGoogleButton />
    </PageShell>
  );
}

/* ─────────────────────────── Brand panel ─────────────────────────── */

function BrandPanel() {
  return (
    <div className="flex h-full flex-col gap-10">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="flex h-7 w-7 items-center justify-center rounded-sm bg-accent font-mono text-sm font-semibold text-accent-foreground"
        >
          E
        </span>
        <span className="text-md font-semibold text-text">EtsyHub</span>
      </div>

      <div className="mt-auto flex max-w-md flex-col gap-3">
        <div className="font-mono text-xs uppercase tracking-meta text-accent-text">
          Üretim kokpiti
        </div>
        <h1 className="text-3xl font-semibold leading-tight text-text">
          Tek tıkla binlerce Etsy ürün fikri
        </h1>
        <p className="text-sm leading-relaxed text-text-muted">
          Bookmark topla, referans havuzu kur, varyasyon ürettir, AI review'dan
          geçir, mockup hazırla, listing yaz. Tek akış, karmaşa yok.
        </p>
      </div>

      <div className="font-mono text-xs text-text-subtle">
        v0.1 · localhost
      </div>
    </div>
  );
}

/* ─────────────────────────── Tab button ─────────────────────────── */

function TabButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex-1 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors duration-fast ease-out",
        "disabled:cursor-not-allowed disabled:opacity-50",
        active
          ? "bg-surface text-text shadow-card"
          : "bg-transparent text-text-muted hover:text-text",
      )}
    >
      {children}
    </button>
  );
}

/* ─────────────────────────── Login panel ─────────────────────────── */

function LoginPanel() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await signIn("credentials", { email, password, redirect: false });
    setBusy(false);
    if (!res || (res as { error?: string | null }).error) {
      setError("E-posta veya parola hatalı.");
      return;
    }
    router.push("/dashboard");
    router.refresh?.();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      <div className="flex flex-col gap-1">
        <label htmlFor="auth-email" className="text-sm font-medium text-text">
          E-posta
        </label>
        <Input
          id="auth-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="sen@magazan.co"
        />
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label htmlFor="auth-password" className="text-sm font-medium text-text">
            Parola
          </label>
          <span
            aria-disabled="true"
            title="Yakında"
            onClick={(e) => e.preventDefault()}
            className="cursor-not-allowed text-xs text-text-subtle"
          >
            Şifrenizi mi unuttunuz?
          </span>
        </div>
        <Input
          id="auth-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full">
        {busy ? "Giriş yapılıyor…" : "Giriş yap"}
      </Button>
    </form>
  );
}

/* ─────────────────────────── Register panel ─────────────────────────── */

function RegisterPanel() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload: { email: string; password: string; name?: string } = {
      email,
      password,
    };
    if (name.trim()) payload.name = name.trim();

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);

    if (!res.ok) {
      setError(mapRegisterError(res.status));
      return;
    }
    router.push("/login");
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      <div className="flex flex-col gap-1">
        <label htmlFor="auth-name" className="text-sm font-medium text-text">
          Ad <span className="text-text-subtle">(opsiyonel)</span>
        </label>
        <Input
          id="auth-name"
          type="text"
          autoComplete="name"
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Görünen adın"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="auth-email" className="text-sm font-medium text-text">
          E-posta
        </label>
        <Input
          id="auth-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="sen@magazan.co"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="auth-password" className="text-sm font-medium text-text">
          Parola
        </label>
        <Input
          id="auth-password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="En az 8 karakter"
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full">
        {busy ? "Oluşturuluyor…" : "Hesap oluştur"}
      </Button>
    </form>
  );
}

function mapRegisterError(status: number): string {
  if (status === 409) return "Bu e-posta kullanımda.";
  if (status === 403) return "Kayıt şu an kapalı.";
  if (status === 400) return "Geçersiz istek. Lütfen alanları kontrol et.";
  return "Kayıt başarısız. Lütfen tekrar dene.";
}

/* ────────────────── Registration disabled message ────────────────── */

function RegistrationDisabledMessage() {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-2 p-4 text-center">
      <p className="text-sm font-medium text-text">Kayıt şu an kapalı</p>
      <p className="text-xs text-text-muted">
        Sistem yöneticisinin davet akışını beklemelisin.
      </p>
    </div>
  );
}

/* ─────────────────────────── Social divider ─────────────────────────── */

function SocialDivider() {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-border" />
      <span className="font-mono text-xs uppercase tracking-meta text-text-subtle">
        veya
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function DisabledGoogleButton() {
  return (
    <Button
      variant="secondary"
      size="lg"
      disabled
      aria-disabled="true"
      title="Yakında"
      className="w-full"
    >
      Google ile devam et
    </Button>
  );
}
