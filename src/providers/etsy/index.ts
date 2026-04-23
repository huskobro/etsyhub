export type EtsyDraftInput = {
  title: string;
  description: string;
  tags: string[];
  priceCents: number;
};

export type EtsyDraftOutput = {
  etsyDraftId: string;
};

export interface EtsyProvider {
  pushDraft(input: EtsyDraftInput): Promise<EtsyDraftOutput>;
}

export class NotImplementedEtsy implements EtsyProvider {
  pushDraft(): never {
    throw new Error("Etsy provider Phase 9'da aktifleşir");
  }
}

export function getEtsy(): EtsyProvider {
  return new NotImplementedEtsy();
}
