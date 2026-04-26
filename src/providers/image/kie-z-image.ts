// Provider id (registry-visible): "kie-z-image"
// File name kept short; id is the contract surface.
//
// Kalıcı shell: bu provider Phase 5'te aktifleşmiyor — carry-forward:
// kie-z-image-integration. Capability sözleşmesi (text-to-image) korunur ki
// registry pattern'i (R17.3) ileride aktivasyon sırasında kırılmasın.
import type {
  ImageGenerateInput,
  ImageGenerateOutput,
  ImagePollOutput,
  ImageProvider,
  ImageCapability,
} from "./types";

export class KieZImageProvider implements ImageProvider {
  readonly id = "kie-z-image";
  readonly capabilities: ReadonlyArray<ImageCapability> = ["text-to-image"];

  async generate(_input: ImageGenerateInput): Promise<ImageGenerateOutput> {
    throw new Error(
      "kie-z-image: kalıcı shell. Bu provider Phase 5'te aktifleşmiyor — carry-forward: kie-z-image-integration. Capability sözleşmesi (text-to-image) korunur.",
    );
  }

  async poll(_providerTaskId: string): Promise<ImagePollOutput> {
    throw new Error(
      "kie-z-image: kalıcı shell. Bu provider Phase 5'te aktifleşmiyor — carry-forward: kie-z-image-integration. Capability sözleşmesi (text-to-image) korunur.",
    );
  }
}
