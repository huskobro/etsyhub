/**
 * auth-shell.test.tsx — T-29 (+ T-28+T-29 review fix)
 *
 * AuthShell, Login + Register tek sayfa segmented control kabuğunu doğrular.
 * Backend (/api/auth/register) DOKUNULMADI — burada sadece istemci sözleşmesi.
 *
 * Senaryolar:
 *   1. mode='login' → email/password input render, "Giriş" link aria-current="page"
 *   2. mode='register' → email/password/name input render, "Kayıt" link aria-current="page"
 *   3. Tab linkleri doğru href'leri gösterir (route navigation, Next.js Link)
 *   4. Login submit → signIn("credentials", { email, password, redirect:false })
 *   5. Register submit → fetch POST /api/auth/register {email, password, name?}
 *   6. Register 409 → Türkçe "Bu e-posta kullanımda"
 *   7. Register 400 → Türkçe "Geçersiz istek"
 *   8. registrationEnabled=false + mode='register' → "Kayıt şu an kapalı"
 *   9. "Google ile devam et" disabled (title="Yakında")
 *  10. "Şifrenizi mi unuttunuz?" button disabled (a11y fix)
 *  11. Login network throw → "Bağlantı hatası" + busy=false (review fix)
 *  12. Register network throw → "Bağlantı hatası" + busy=false (review fix)
 *  13. Error → input aria-invalid + aria-describedby bağlantısı (review fix)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { AuthShell } from "@/features/auth/auth-shell";

// --- next/navigation mock ---
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// --- next-auth/react mock ---
const signInMock = vi.fn().mockResolvedValue({ ok: true, error: null });
vi.mock("next-auth/react", () => ({
  signIn: (...args: unknown[]) => signInMock(...args),
}));

beforeEach(() => {
  pushMock.mockClear();
  signInMock.mockClear();
  signInMock.mockResolvedValue({ ok: true, error: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AuthShell — mode rendering", () => {
  it("mode='login' → email + password input, 'Giriş' link aria-current=page", () => {
    render(<AuthShell mode="login" registrationEnabled={true} />);

    const emailInput = screen.getByLabelText(/e-posta/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(/parola/i) as HTMLInputElement;
    expect(emailInput).toBeInTheDocument();
    expect(emailInput.type).toBe("email");
    expect(passwordInput).toBeInTheDocument();
    expect(passwordInput.type).toBe("password");

    // Name alanı login modunda olmamalı
    expect(screen.queryByLabelText(/^ad/i)).toBeNull();

    const loginLink = screen.getByRole("link", { name: /giriş/i });
    expect(loginLink).toHaveAttribute("aria-current", "page");
  });

  it("mode='register' → email + password + name input, 'Kayıt' link aria-current=page", () => {
    render(<AuthShell mode="register" registrationEnabled={true} />);

    expect(screen.getByLabelText(/e-posta/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/parola/i)).toBeInTheDocument();
    const nameInput = screen.getByLabelText(/^ad/i) as HTMLInputElement;
    expect(nameInput).toBeInTheDocument();
    expect(nameInput.required).toBe(false);

    const registerLink = screen.getByRole("link", { name: /kayıt/i });
    expect(registerLink).toHaveAttribute("aria-current", "page");
  });
});

describe("AuthShell — segment navigation (route)", () => {
  it("Kayıt link href='/register'", () => {
    render(<AuthShell mode="login" registrationEnabled={true} />);
    const registerLink = screen.getByRole("link", { name: /kayıt/i });
    expect(registerLink).toHaveAttribute("href", "/register");
    // aktif değil
    expect(registerLink).not.toHaveAttribute("aria-current");
  });

  it("Giriş link href='/login'", () => {
    render(<AuthShell mode="register" registrationEnabled={true} />);
    const loginLink = screen.getByRole("link", { name: /giriş/i });
    expect(loginLink).toHaveAttribute("href", "/login");
    expect(loginLink).not.toHaveAttribute("aria-current");
  });
});

describe("AuthShell — login submit", () => {
  it("login submit → signIn credentials çağrılır {email, password, redirect:false}", async () => {
    render(<AuthShell mode="login" registrationEnabled={true} />);
    const email = screen.getByLabelText(/e-posta/i);
    const password = screen.getByLabelText(/parola/i);
    fireEvent.change(email, { target: { value: "user@test.com" } });
    fireEvent.change(password, { target: { value: "pw12345678" } });

    const form = email.closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(signInMock).toHaveBeenCalledWith("credentials", {
      email: "user@test.com",
      password: "pw12345678",
      redirect: false,
    });
  });

  it("login network throw → 'Bağlantı hatası' + busy=false (review fix)", async () => {
    signInMock.mockRejectedValueOnce(new Error("network down"));
    render(<AuthShell mode="login" registrationEnabled={true} />);
    fireEvent.change(screen.getByLabelText(/e-posta/i), {
      target: { value: "user@test.com" },
    });
    fireEvent.change(screen.getByLabelText(/parola/i), {
      target: { value: "pw12345678" },
    });
    const form = screen.getByLabelText(/e-posta/i).closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(screen.getByRole("alert").textContent).toMatch(/bağlantı hatası/i);

    // Submit butonu tekrar tıklanabilir hale gelmeli (busy=false)
    const submitBtn = screen.getByRole("button", { name: /giriş yap$/i });
    expect(submitBtn).not.toBeDisabled();
  });
});

describe("AuthShell — register submit", () => {
  it("register submit → fetch POST /api/auth/register {email, password, name?}", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AuthShell mode="register" registrationEnabled={true} />);
    fireEvent.change(screen.getByLabelText(/e-posta/i), {
      target: { value: "new@test.com" },
    });
    fireEvent.change(screen.getByLabelText(/parola/i), {
      target: { value: "longenoughpw" },
    });
    fireEvent.change(screen.getByLabelText(/^ad/i), {
      target: { value: "Yeni" },
    });

    const form = screen
      .getByLabelText(/e-posta/i)
      .closest("form")! as HTMLFormElement;
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0]!;
    const url = call[0] as string;
    const init = call[1] as RequestInit;
    expect(url).toBe("/api/auth/register");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      email: "new@test.com",
      password: "longenoughpw",
      name: "Yeni",
    });
  });

  it("register 409 → Türkçe hata 'Bu e-posta kullanımda'", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: "EMAIL_TAKEN" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AuthShell mode="register" registrationEnabled={true} />);
    fireEvent.change(screen.getByLabelText(/e-posta/i), {
      target: { value: "dup@test.com" },
    });
    fireEvent.change(screen.getByLabelText(/parola/i), {
      target: { value: "pw12345678" },
    });

    const form = screen
      .getByLabelText(/e-posta/i)
      .closest("form")! as HTMLFormElement;
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(screen.getByRole("alert").textContent).toMatch(
      /bu e-posta kullanımda/i,
    );
  });

  it("register 400 → Türkçe hata 'Geçersiz istek'", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "INVALID" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AuthShell mode="register" registrationEnabled={true} />);
    fireEvent.change(screen.getByLabelText(/e-posta/i), {
      target: { value: "x@test.com" },
    });
    fireEvent.change(screen.getByLabelText(/parola/i), {
      target: { value: "short" },
    });

    const form = screen
      .getByLabelText(/e-posta/i)
      .closest("form")! as HTMLFormElement;
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(screen.getByRole("alert").textContent).toMatch(/geçersiz istek/i);
  });

  it("register network throw → 'Bağlantı hatası' + busy=false (review fix)", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    render(<AuthShell mode="register" registrationEnabled={true} />);
    fireEvent.change(screen.getByLabelText(/e-posta/i), {
      target: { value: "x@test.com" },
    });
    fireEvent.change(screen.getByLabelText(/parola/i), {
      target: { value: "longenoughpw" },
    });

    const form = screen
      .getByLabelText(/e-posta/i)
      .closest("form")! as HTMLFormElement;
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(screen.getByRole("alert").textContent).toMatch(/bağlantı hatası/i);

    const submitBtn = screen.getByRole("button", { name: /hesap oluştur$/i });
    expect(submitBtn).not.toBeDisabled();
  });
});

describe("AuthShell — registration disabled / disabled CTAs", () => {
  it("registrationEnabled=false + mode='register' → 'Kayıt şu an kapalı' mesajı", () => {
    render(<AuthShell mode="register" registrationEnabled={false} />);
    expect(screen.getByText(/kayıt şu an kapalı/i)).toBeInTheDocument();
    // Form input'ları render olmamalı
    expect(screen.queryByLabelText(/^ad/i)).toBeNull();
  });

  it("registrationEnabled=false → Kayıt link aria-disabled + tabIndex=-1", () => {
    render(<AuthShell mode="login" registrationEnabled={false} />);
    const registerLink = screen.getByRole("link", { name: /kayıt/i });
    expect(registerLink).toHaveAttribute("aria-disabled", "true");
    expect(registerLink).toHaveAttribute("tabIndex", "-1");
  });

  it("'Google ile devam et' disabled + title='Yakında' + aria-disabled", () => {
    render(<AuthShell mode="login" registrationEnabled={true} />);
    const googleBtn = screen.getByRole("button", { name: /google ile devam et/i });
    expect(googleBtn).toBeDisabled();
    expect(googleBtn).toHaveAttribute("title", "Yakında");
    expect(googleBtn).toHaveAttribute("aria-disabled", "true");
  });

  it("'Şifrenizi mi unuttunuz?' button disabled (a11y fix)", () => {
    render(<AuthShell mode="login" registrationEnabled={true} />);
    const forgot = screen.getByRole("button", { name: /şifrenizi mi unuttunuz/i });
    expect(forgot).toBeDisabled();
    expect(forgot).toHaveAttribute("aria-disabled", "true");
    expect(forgot).toHaveAttribute("title", "Yakında");
  });
});

describe("AuthShell — error→input a11y bağlantısı (review fix)", () => {
  it("login error olduğunda input aria-invalid + aria-describedby=auth-error-login", async () => {
    signInMock.mockResolvedValueOnce({ error: "CredentialsSignin" });
    render(<AuthShell mode="login" registrationEnabled={true} />);
    fireEvent.change(screen.getByLabelText(/e-posta/i), {
      target: { value: "x@test.com" },
    });
    fireEvent.change(screen.getByLabelText(/parola/i), {
      target: { value: "wrongpw" },
    });
    const form = screen.getByLabelText(/e-posta/i).closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("id", "auth-error-login");

    const emailInput = screen.getByLabelText(/e-posta/i);
    const passwordInput = screen.getByLabelText(/parola/i);
    expect(emailInput).toHaveAttribute("aria-invalid", "true");
    expect(emailInput).toHaveAttribute("aria-describedby", "auth-error-login");
    expect(passwordInput).toHaveAttribute("aria-invalid", "true");
    expect(passwordInput).toHaveAttribute("aria-describedby", "auth-error-login");
  });

  it("login error yokken aria-describedby render edilmez", () => {
    render(<AuthShell mode="login" registrationEnabled={true} />);
    const emailInput = screen.getByLabelText(/e-posta/i);
    expect(emailInput).not.toHaveAttribute("aria-describedby");
    expect(emailInput).toHaveAttribute("aria-invalid", "false");
  });
});
