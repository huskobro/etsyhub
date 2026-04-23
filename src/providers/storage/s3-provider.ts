import { MinioStorage } from "./minio-provider";

/**
 * Phase 1+2'de AWS S3 ve MinIO aynı SDK + aynı interface. Fark yalnız
 * endpoint/forcePathStyle; bu zaten env'den geliyor. Gelecekte S3'e özel
 * davranış gerekirse burada override edilir.
 */
export class S3Storage extends MinioStorage {}
