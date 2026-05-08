import { RolloutPlaceholder } from "@/features/app-shell/RolloutPlaceholder";

export const metadata = { title: "Overview · Kivasy" };

export default function OverviewPage() {
  return (
    <RolloutPlaceholder
      title="Overview"
      rollout={8}
      blurb="The morning landing — pipeline pulse, pending actions, active batches, recent activity. Final form lands in rollout 8 (after the production spine + system layer ship), so the data feeding it reflects the real product state."
    />
  );
}
