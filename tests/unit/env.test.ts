import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";

describe("parseEnv", () => {
  it("AUTH_SECRET eksikse hata fırlatır", () => {
    expect(() => parseEnv({})).toThrow(/AUTH_SECRET/);
  });

  it("tam env ile başarılı parse eder", () => {
    const parsed = parseEnv({
      NODE_ENV: "test",
      APP_URL: "http://localhost:3000",
      AUTH_SECRET: "x".repeat(32),
      SECRETS_ENCRYPTION_KEY: "a".repeat(64),
      DATABASE_URL: "postgresql://x:y@localhost:5432/db",
      REDIS_URL: "redis://localhost:6379",
      STORAGE_PROVIDER: "minio",
      STORAGE_BUCKET: "etsyhub",
      STORAGE_ENDPOINT: "http://localhost:9000",
      STORAGE_ACCESS_KEY: "k",
      STORAGE_SECRET_KEY: "s",
    });
    expect(parsed.STORAGE_BUCKET).toBe("etsyhub");
  });
});
