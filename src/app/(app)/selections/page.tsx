import { RolloutPlaceholder } from "@/features/app-shell/RolloutPlaceholder";

export const metadata = { title: "Selections · Kivasy" };

export default function SelectionsPage() {
  return (
    <RolloutPlaceholder
      title="Selections"
      rollout={4}
      blurb="Curated sets ready for mockup application. Edits (background remove, color edit, crop, upscale) live here. Lands in rollout 4. The legacy /selection routes still work via the existing (app)/selection surface until then."
    />
  );
}
