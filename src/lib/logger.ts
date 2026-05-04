import pino from "pino";
import { env } from "@/lib/env";

// Next.js + Webpack RSC pino-pretty transport'u worker thread başlatamıyor
// (./.next/server/vendor-chunks/lib/worker.js MODULE_NOT_FOUND); worker exit
// olunca logger.error() throw atıyor ve errorResponse içinde 2. exception
// üretiyor, 500 path tamamen kırılıyor (kullanıcı "Sunucu hatası" görüyor).
//
// Çözüm: transport KULLANMA — pino default JSON formatında stdout'a yazsın.
// Dev'de log human-friendly görünmez ama API path stable kalır.
export const logger = pino({
  level: env.LOG_LEVEL,
});
