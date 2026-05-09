import { RolloutPlaceholder } from "@/features/app-shell/RolloutPlaceholder";

export const metadata = { title: "Overview · Kivasy" };

export default function OverviewPage() {
  return (
    <RolloutPlaceholder
      title="Overview"
      rollout={8}
      blurb="The morning landing — pipeline pulse, pending actions, active batches, recent activity. The four-block C3 view lands in post-MVP enrichment; for now jump straight into Library, Batches, Selections, or Products from the sidebar."
    />
  );
}
