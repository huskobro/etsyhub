import { describe, expect, it } from "vitest";
import { encryptSecret, decryptSecret } from "@/lib/secrets";

describe("secrets", () => {
  it("encrypt + decrypt round-trip", () => {
    const plain = "apify_api_token_very_secret_abc123";
    const cipher = encryptSecret(plain);
    expect(cipher).not.toContain(plain);
    expect(cipher.split(":")).toHaveLength(3); // iv:tag:ciphertext
    expect(decryptSecret(cipher)).toBe(plain);
  });

  it("bozuk cipher text Error fırlatır", () => {
    expect(() => decryptSecret("invalid:format")).toThrow();
  });

  it("iki farklı encrypt çağrısı farklı cipher üretir (IV random)", () => {
    const plain = "same-input";
    expect(encryptSecret(plain)).not.toBe(encryptSecret(plain));
  });
});
