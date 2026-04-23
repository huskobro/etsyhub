export type AIGenerateInput = {
  prompt: string;
  negativePrompt?: string;
  n: number;
  aspectRatio?: string;
};

export type AIGenerateOutput = {
  images: Array<{ url?: string; buffer?: Buffer }>;
  model: string;
  costCents: number;
};

export interface AIProvider {
  generate(input: AIGenerateInput): Promise<AIGenerateOutput>;
}

export class NotImplementedAI implements AIProvider {
  generate(): never {
    throw new Error("AI provider Phase 5'te aktifleşir");
  }
}

export function getAI(): AIProvider {
  return new NotImplementedAI();
}
