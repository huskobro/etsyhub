export type MockupInput = {
  designAssetKey: string;
  templateKey: string;
};

export type MockupOutput = {
  url?: string;
  buffer?: Buffer;
};

export interface MockupProvider {
  render(input: MockupInput): Promise<MockupOutput>;
}

export class NotImplementedMockup implements MockupProvider {
  render(): never {
    throw new Error("Mockup provider Phase 8'de aktifleşir");
  }
}

export function getMockup(): MockupProvider {
  return new NotImplementedMockup();
}
