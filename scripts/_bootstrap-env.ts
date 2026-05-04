// CLI script env bootstrap.
//
// Tüm script'lerin başında ilk import olarak yer almalı:
//   import "./_bootstrap-env";
//
// Niye gerek: ESM `import` statements top-level execute edilir; ama
// `dotenv.config()` runtime'da çalışır. Yani script içinde:
//   import { config } from "dotenv"; config({ path: ".env.local" });
//   import { foo } from "@/...";  // ← env.ts parse edilirken process.env BOŞ
// pattern'ı bozuk: env.ts içindeki top-level `loadEnv()` `import` zinciri
// resolve edilirken çalışır, dotenv.config() henüz tetiklenmemiştir.
//
// Çözüm: bu modül izole + side-effect-only. İlk import edilen dosya bu
// olur, dotenv.config() çağırılır, SONRA diğer @/* import'ları env.ts'i
// parse ederken process.env doludur.
//
// Alternatif: `npx tsx --env-file=.env.local <script>` flag (Node 20.6+),
// ama bu pattern dökümante edilmemiş; bootstrap import daha açık.

import { config } from "dotenv";
import path from "node:path";

config({ path: path.resolve(process.cwd(), ".env.local") });
