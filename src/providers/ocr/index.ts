export type OcrResult = {
  text: string;
  detectedLanguage?: string;
  gibberish: boolean;
};

export interface OcrProvider {
  recognize(buffer: Buffer): Promise<OcrResult>;
}

export class NotImplementedOcr implements OcrProvider {
  recognize(): never {
    throw new Error("OCR provider Phase 6'da aktifleşir");
  }
}

export function getOcr(): OcrProvider {
  return new NotImplementedOcr();
}
