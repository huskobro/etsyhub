import { RolloutPlaceholder } from "@/features/app-shell/RolloutPlaceholder";

export const metadata = { title: "Products · Kivasy" };

export default function ProductsPage() {
  return (
    <RolloutPlaceholder
      title="Products"
      rollout={5}
      blurb="Mockuped + bundle-previewed + listing-drafted + Etsy-bound. Digital files only — ZIP / PNG / PDF / JPG / JPEG. Lands in rollout 5."
    />
  );
}
