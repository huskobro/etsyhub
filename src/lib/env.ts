import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  APP_URL: z.string().url(),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error"]).default("info"),

  AUTH_SECRET: z.string().min(32),
  AUTH_TRUST_HOST: z.coerce.boolean().default(true),
  REGISTRATION_ENABLED: z.coerce.boolean().default(false),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),

  SECRETS_ENCRYPTION_KEY: z.string().length(64), // 32-byte hex; generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

  DATABASE_URL: z.string().url(),
  DATABASE_URL_TEST: z.string().url().optional(),

  REDIS_URL: z.string().url(),

  STORAGE_PROVIDER: z.enum(["minio", "s3"]).default("minio"),
  STORAGE_BUCKET: z.string().min(1),
  STORAGE_ENDPOINT: z.string().url(),
  STORAGE_REGION: z.string().default("us-east-1"),
  STORAGE_ACCESS_KEY: z.string().min(1),
  STORAGE_SECRET_KEY: z.string().min(1),
  STORAGE_FORCE_PATH_STYLE: z.coerce.boolean().default(true),
  STORAGE_PUBLIC_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof schema>;

export function parseEnv(src: NodeJS.ProcessEnv | Record<string, unknown>): Env {
  const result = schema.safeParse(src);
  if (!result.success) {
    const message = result.error.errors
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join("\n");
    throw new Error(`Invalid environment:\n${message}`);
  }
  return result.data;
}

function loadEnv(): Env {
  if (typeof process === "undefined") {
    throw new Error("env can only be loaded in Node runtime");
  }
  return parseEnv(process.env);
}

export const env: Env = (() => {
  try {
    return loadEnv();
  } catch (err) {
    // Vitest unit testlerinde env gerekmeyebilir. Integration testlerinde
    // setup-integration.ts dotenv'i yükler ve parse başarılı olur.
    if (process.env.VITEST === "true" || process.env.NODE_ENV === "test") {
      return new Proxy({} as Env, {
        get(_target, prop: string) {
          throw new Error(
            `env.${prop} test modunda talep edildi ama .env.local yüklenmemiş. ` +
              `vitest.config.ts setupFiles'a tests/setup-integration.ts ekle.`,
          );
        },
      });
    }
    throw err;
  }
})();
