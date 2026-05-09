/* eslint-disable no-restricted-syntax */
// RunRecipeModal — Kivasy v6 Recipes runner; v6 sabit boyutlar:
//  · Modal md (max-w-[720px]) + chain step row text-[12.5px] / [11px]
// Whitelisted in scripts/check-tokens.ts.
"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Loader2,
  PlayCircle,
} from "lucide-react";
import { Modal } from "@/features/library/components/Modal";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";

interface RecipeChainView {
  id: string;
  key: string;
  name: string;
  productTypeKey: string | null;
  productTypeDisplay: string | null;
  links: {
    promptTemplateId?: string | null;
    stylePresetKey?: string | null;
    mockupTemplateId?: string | null;
    productTypeKey?: string | null;
  };
  settings: {
    variationCount?: number;
    aspectRatio?: string;
    similarity?: string;
    notes?: string;
  };
}

interface RunResultView {
  destination:
    | {
        kind: "batch-run";
        promptTemplateId: string;
        productTypeKey: string | null;
      }
    | { kind: "selections-create"; productTypeKey: string | null }
    | { kind: "no-destination"; reason: string };
  audit: {
    recipeId: string;
    recipeKey: string;
    recipeName: string;
    chosenLinks: RecipeChainView["links"];
  };
}

interface Props {
  recipe: RecipeChainView;
  onClose: () => void;
}

export function RunRecipeModal({ recipe, onClose }: Props) {
  const router = useRouter();
  const [variationCount, setVariationCount] = useState<number>(
    recipe.settings.variationCount ?? 8,
  );

  const runMutation = useMutation<RunResultView, Error, void>({
    mutationFn: async () => {
      const r = await fetch(`/api/templates/recipes/${recipe.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overrides: { variationCount },
        }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${r.status}`);
      }
      return r.json();
    },
    onSuccess: (data) => {
      // Destination'a göre operatörü doğru sayfaya yönlendir
      if (data.destination.kind === "batch-run") {
        const sp = new URLSearchParams();
        sp.set("recipeId", recipe.id);
        sp.set("templateId", data.destination.promptTemplateId);
        if (data.destination.productTypeKey)
          sp.set("productTypeKey", data.destination.productTypeKey);
        sp.set("count", String(variationCount));
        router.push(`/admin/midjourney/batch-run?${sp.toString()}`);
        onClose();
      } else if (data.destination.kind === "selections-create") {
        const sp = new URLSearchParams();
        sp.set("recipeId", recipe.id);
        if (data.destination.productTypeKey)
          sp.set("productTypeKey", data.destination.productTypeKey);
        router.push(`/selections?${sp.toString()}`);
        onClose();
      }
    },
  });

  const chainSteps: Array<{
    label: string;
    target: string | null;
    status: "linked" | "missing";
  }> = [
    {
      label: "Prompt template",
      target: recipe.links.promptTemplateId
        ? recipe.links.promptTemplateId.slice(0, 8)
        : null,
      status: recipe.links.promptTemplateId ? "linked" : "missing",
    },
    {
      label: "Style preset",
      target: recipe.links.stylePresetKey ?? null,
      status: recipe.links.stylePresetKey ? "linked" : "missing",
    },
    {
      label: "Mockup template",
      target: recipe.links.mockupTemplateId
        ? recipe.links.mockupTemplateId.slice(0, 8)
        : null,
      status: recipe.links.mockupTemplateId ? "linked" : "missing",
    },
    {
      label: "Product intent",
      target:
        recipe.productTypeDisplay ??
        recipe.links.productTypeKey ??
        null,
      status: recipe.productTypeDisplay || recipe.links.productTypeKey
        ? "linked"
        : "missing",
    },
  ];

  const hasPrompt = !!recipe.links.promptTemplateId;
  const hasProduct =
    !!recipe.productTypeDisplay || !!recipe.links.productTypeKey;
  const canRun = hasPrompt || hasProduct;

  const destinationHint = hasPrompt
    ? "Run starts a Variation Batch (operator finalizes reference + count)."
    : hasProduct
      ? "Run opens Selections create flow with product intent pre-filled."
      : "Recipe has no prompt template or product type — link at least one to run.";

  return (
    <Modal
      title={`Run · ${recipe.name}`}
      onClose={onClose}
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 items-center rounded-md px-3 text-xs font-medium text-ink-2 hover:text-ink"
          >
            Cancel
          </button>
          <div className="ml-auto flex items-center gap-3">
            {runMutation.error ? (
              <span className="font-mono text-[11px] text-danger">
                <AlertTriangle className="mr-1 inline h-3 w-3" aria-hidden />
                {runMutation.error.message}
              </span>
            ) : null}
            <button
              type="button"
              data-size="sm"
              className="k-btn k-btn--primary"
              disabled={!canRun || runMutation.isPending}
              onClick={() => runMutation.mutate()}
              data-testid="recipe-run-confirm"
            >
              {runMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              ) : (
                <PlayCircle className="h-3 w-3" aria-hidden />
              )}
              Run recipe
            </button>
          </div>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <div className="mb-2 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
            Chain summary
          </div>
          <div className="overflow-hidden rounded-md border border-line bg-paper">
            {chainSteps.map((s, i) => (
              <div
                key={s.label}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5",
                  i < chainSteps.length - 1 && "border-b border-line-soft",
                )}
                data-testid="recipe-chain-step"
                data-status={s.status}
              >
                <span className="flex-1 text-[12.5px] text-ink">{s.label}</span>
                {s.status === "linked" ? (
                  <>
                    <span className="font-mono text-[11px] tabular-nums text-ink-2">
                      {s.target}
                    </span>
                    <Badge tone="success">LINKED</Badge>
                  </>
                ) : (
                  <Badge tone="warning">MISSING</Badge>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[12.5px] font-semibold text-ink">
            Variation count (run override)
          </label>
          <div className="flex">
            {[4, 6, 8, 12].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setVariationCount(n)}
                className={cn(
                  "-ml-px h-9 flex-1 border text-[13px] font-semibold transition-colors first:ml-0 first:rounded-l-md last:rounded-r-md",
                  n === variationCount
                    ? "z-10 border-k-orange bg-k-orange-soft text-k-orange-ink"
                    : "border-line bg-paper text-ink-2 hover:border-line-strong",
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-dashed border-line bg-k-bg-2/40 px-3 py-2">
          <p className="text-[12.5px] leading-snug text-ink-2">
            <ArrowRight className="mr-1 inline h-3 w-3" aria-hidden />
            {destinationHint}
          </p>
        </div>
      </div>
    </Modal>
  );
}
