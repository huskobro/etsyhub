// Provider id (registry-visible): "kie-gpt-image-1.5"
// File name kept short; id is the contract surface.
//
// Task 2 shell: HTTP entegrasyonu Task 3'te (createTask + recordInfo polling).
// Capability sözleşmesi: yalnız image-to-image (referenceUrls zorunlu — type
// seviyesinde optional ama runtime'da Task 3'te enforce edilecek).
import type {
  ImageGenerateInput,
  ImageGenerateOutput,
  ImagePollOutput,
  ImageProvider,
  ImageCapability,
} from "./types";

export class KieGptImageProvider implements ImageProvider {
  readonly id = "kie-gpt-image-1.5";
  readonly capabilities: ReadonlyArray<ImageCapability> = ["image-to-image"];

  async generate(_input: ImageGenerateInput): Promise<ImageGenerateOutput> {
    throw new Error(
      "kie-gpt-image-1.5: Task 2 shell — gerçek HTTP entegrasyonu Task 3'te (createTask + recordInfo polling).",
    );
  }

  async poll(_providerTaskId: string): Promise<ImagePollOutput> {
    throw new Error(
      "kie-gpt-image-1.5: Task 2 shell — gerçek HTTP entegrasyonu Task 3'te (createTask + recordInfo polling).",
    );
  }
}
