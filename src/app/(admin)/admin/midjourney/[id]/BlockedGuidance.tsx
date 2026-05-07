// Pass 53 — AWAITING_LOGIN / AWAITING_CHALLENGE durumları için
// operatör rehber banner'ı.
//
// Bu pure server component (action yok); state-text mapping +
// adım listesi. Action butonları JobActionBar'da (focus + cancel).

const GUIDANCE: Record<string, { title: string; steps: string[] }> = {
  AWAITING_LOGIN: {
    title: "Midjourney login gerekli",
    steps: [
      "MJ tarayıcı penceresine geç (sağ üstteki 🪟 butonu pencereyi öne getirir).",
      "Discord/Google ile login ol.",
      "Login tamam olunca bridge otomatik devam eder; bu sayfa kendiliğinden yenilenecek.",
    ],
  },
  AWAITING_CHALLENGE: {
    title: "Cloudflare/captcha doğrulaması bekleniyor",
    steps: [
      "MJ tarayıcı penceresine geç (sağ üstteki 🪟 butonu pencereyi öne getirir).",
      "Cloudflare 'verify you are human' kutusuna tıkla.",
      "Doğrulama bitince bridge otomatik devam eder; bu sayfa kendiliğinden yenilenecek.",
    ],
  },
};

export function BlockedGuidance({ state }: { state: string }) {
  const g = GUIDANCE[state];
  if (!g) return null;
  return (
    <section
      className="rounded-md border border-warning bg-warning-soft p-4 text-sm text-warning-text"
      data-testid="mj-blocked-guidance"
    >
      <div className="font-semibold">{g.title}</div>
      <ol className="mt-2 list-inside list-decimal space-y-1 text-xs">
        {g.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
    </section>
  );
}
