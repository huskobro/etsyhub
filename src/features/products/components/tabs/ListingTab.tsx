/* eslint-disable no-restricted-syntax */
// ListingTab — Kivasy v4 A5 listing form. v4 spec sabit ölçüler:
//  · max-w-[820px] form panel + grid-cols-[1fr_360px] split layout
//  · text-[12.5px] / text-[36px] / text-[24px] yarı-piksel typography
//  · k-display recipe + listing health gauge sabit boyutu
// Whitelisted in scripts/check-tokens.ts.
"use client";

import { useState, type FormEvent } from "react";
import { Loader2, Sparkles, Wand2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useUpdateListingDraft } from "@/features/listings/hooks/useUpdateListingDraft";
import { useGenerateListingMeta } from "@/features/listings/hooks/useGenerateListingMeta";
import { useSubmitListingDraft } from "@/features/listings/hooks/useSubmitListingDraft";
import type { ListingDraftView } from "@/features/listings/types";
import { listingHealthTone } from "@/features/products/state-helpers";

/**
 * ListingTab — A5 Listing builder.
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v4/screens-a5.jsx →
 * A5ProductDetail listing tab.
 *
 * Two-column split: form (left, max 820w) + listing health rail (right,
 * 360w). Mevcut Phase 9 V1 mutation hook'ları reuse — yeni service yok.
 *
 * Form alanları (A5 spec):
 *   - Title (140 chars max)
 *   - Description (textarea, markdown hint)
 *   - 13 tags (chips)
 *   - Etsy category + Price (USD) + Materials (3-col)
 *   - Digital file types checklist: ZIP / PNG / PDF / JPG / JPEG (R5
 *     anchor — dijital teslim invariant'ı görünür kılar). Phase 9 V1
 *     PATCH endpoint'i `materials` array'ında "ZIP, PNG, PDF" gibi
 *     işaretlemeleri tutmuyordu — R5 için listing.materials içinde
 *     "format:ZIP" prefix'li girişler kullanıyoruz (additive; ekisting
 *     materials [`digital download`, ...] korunur).
 *   - Instant download toggle (cosmetic V1; persist DRAFT/PUBLISHED state
 *     üzerinde manuel publish ile zaten karşılanır)
 *
 * Boundary discipline (CLAUDE.md):
 *   No shipping, no fulfillment, no production partner — A5 spec ile
 *   birebir uyumlu. Tüm UI metni "instant download" / "digital file"
 *   diline sadık.
 */

const FORMAT_PREFIX = "format:";
const ALL_FORMATS: ReadonlyArray<"ZIP" | "PNG" | "PDF" | "JPG" | "JPEG"> = [
  "ZIP",
  "PNG",
  "PDF",
  "JPG",
  "JPEG",
];

interface ListingTabProps {
  listing: ListingDraftView;
  health: number;
}

export function ListingTab({ listing, health }: ListingTabProps) {
  const updateMutation = useUpdateListingDraft(listing.id);
  const aiMutation = useGenerateListingMeta(listing.id);
  const submitMutation = useSubmitListingDraft(listing.id);

  // Form state — uncontrolled commit via "Save listing" CTA.
  const [title, setTitle] = useState(listing.title ?? "");
  const [description, setDescription] = useState(listing.description ?? "");
  const [tags, setTags] = useState<string[]>(listing.tags);
  const [tagInput, setTagInput] = useState("");
  const [category, setCategory] = useState(
    listing.category ?? "Art & Collectibles › Prints › Digital Prints",
  );
  const [priceDollars, setPriceDollars] = useState(
    listing.priceCents !== null
      ? (listing.priceCents / 100).toFixed(2)
      : "",
  );

  // Materials — kullanıcıya yönelik baseline materials array.
  const baselineMaterials = listing.materials.filter(
    (m) => !m.startsWith(FORMAT_PREFIX),
  );
  const [materialsText, setMaterialsText] = useState(
    baselineMaterials.length > 0
      ? baselineMaterials.join(", ")
      : "digital download, printable, instant download",
  );

  // Digital file types — Materials array'ında "format:ZIP" prefix'li
  // entries persist edilir. Persist'te baselineMaterials + selected
  // formats birleştirilir.
  const initialFormats = new Set<(typeof ALL_FORMATS)[number]>(
    listing.materials
      .filter((m) => m.startsWith(FORMAT_PREFIX))
      .map((m) => m.slice(FORMAT_PREFIX.length).toUpperCase())
      .filter((f): f is (typeof ALL_FORMATS)[number] =>
        (ALL_FORMATS as ReadonlyArray<string>).includes(f),
      ),
  );
  // Default açılış: hiç format seçili değilse mockup pipeline default'u
  // (PNG zaten her renderda var) + ZIP (bundle imkanı). Kullanıcı
  // toggle'lar.
  if (initialFormats.size === 0) {
    initialFormats.add("PNG");
    initialFormats.add("ZIP");
  }
  const [formats, setFormats] =
    useState<Set<(typeof ALL_FORMATS)[number]>>(initialFormats);

  function toggleFormat(f: (typeof ALL_FORMATS)[number]) {
    setFormats((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  }

  function addTag(e: FormEvent) {
    e.preventDefault();
    const t = tagInput.trim();
    if (!t) return;
    if (tags.includes(t)) return;
    if (tags.length >= 13) return;
    setTags([...tags, t]);
    setTagInput("");
  }

  function removeTag(t: string) {
    setTags(tags.filter((x) => x !== t));
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    const dollars = parseFloat(priceDollars);
    const priceCents = Number.isFinite(dollars) && dollars > 0
      ? Math.round(dollars * 100)
      : undefined;

    // Materials = baseline (formatsız) + format:XXX entries
    const formatEntries = Array.from(formats).map(
      (f) => `${FORMAT_PREFIX}${f}`,
    );
    const baselineParsed = materialsText
      .split(",")
      .map((m) => m.trim())
      .filter((m) => m.length > 0 && !m.startsWith(FORMAT_PREFIX));
    const mergedMaterials = [...baselineParsed, ...formatEntries];

    updateMutation.mutate({
      title: title.trim() || undefined,
      description: description.trim() || undefined,
      tags,
      category: category.trim() || undefined,
      priceCents,
      materials: mergedMaterials,
    });
  }

  function handleAi() {
    aiMutation.mutate(undefined, {
      onSuccess: (data) => {
        setTitle(data.output.title);
        setDescription(data.output.description);
        setTags(data.output.tags);
      },
    });
  }

  const titleLen = title.length;
  const titleHintTone =
    titleLen >= 70 && titleLen <= 140 ? "success" : "neutral";
  const tagsHintTone = tags.length === 13 ? "success" : "neutral";
  const healthTone = listingHealthTone(health);
  const healthGoodCount = listing.readiness.filter((r) => r.pass).length;
  const healthTotalCount = listing.readiness.length;

  const submitDisabled =
    listing.status !== "DRAFT" ||
    submitMutation.isPending ||
    !listing.mockupJobId ||
    !listing.coverRenderId;

  return (
    <div
      className="flex-1 overflow-y-auto bg-bg"
      data-testid="product-listing-tab"
    >
      <div className="grid min-h-full grid-cols-1 gap-0 lg:grid-cols-[1fr_360px]">
        {/* Form */}
        <form
          onSubmit={handleSave}
          className="max-w-[820px] space-y-7 px-8 py-8"
        >
          <Field
            label="Listing title"
            hint={
              titleLen > 0
                ? `${titleLen} chars · ${titleLen <= 140 ? "ok" : "too long"}`
                : "140 chars max"
            }
            hintTone={titleHintTone}
          >
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={140}
              placeholder="Listing title (70-140 chars recommended)"
              className="h-9 w-full rounded-md border border-line bg-paper px-3 text-sm text-ink placeholder:text-ink-3 focus:border-k-orange focus:outline-none focus:ring-2 focus:ring-k-orange-soft"
            />
          </Field>

          <Field label="Description" hint="Markdown supported">
            <textarea
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what's inside the digital download — formats, sizes, included files."
              className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-k-orange focus:outline-none focus:ring-2 focus:ring-k-orange-soft"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={handleAi}
                disabled={aiMutation.isPending}
                className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-paper px-2 text-xs font-medium text-ink-2 hover:border-line-strong hover:text-ink disabled:opacity-50"
                data-testid="listing-ai-fill"
              >
                {aiMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                ) : (
                  <Wand2 className="h-3 w-3" aria-hidden />
                )}
                AI fill
              </button>
            </div>
          </Field>

          <Field
            label="Tags"
            hint={`${tags.length} / 13 used`}
            hintTone={tagsHintTone}
          >
            <div className="flex min-h-[60px] flex-wrap gap-1.5 rounded-md border border-line bg-paper p-2.5">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex h-7 items-center gap-1.5 rounded-md bg-k-bg-2 px-2.5 text-[12.5px] text-ink"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => removeTag(t)}
                    aria-label={`Remove tag ${t}`}
                    className="text-ink-3 hover:text-ink"
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                </span>
              ))}
              {tags.length < 13 ? (
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addTag(e as unknown as FormEvent);
                    }
                  }}
                  placeholder={tags.length === 0 ? "Add a tag…" : "+ tag"}
                  className="h-7 flex-1 min-w-[120px] bg-transparent px-1 text-[12.5px] text-ink placeholder:text-ink-3 focus:outline-none"
                />
              ) : null}
            </div>
          </Field>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <Field label="Etsy category" hint="Digital Downloads">
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Art & Collectibles › Prints › Digital Prints"
                className="h-9 w-full rounded-md border border-line bg-paper px-3 text-sm text-ink placeholder:text-ink-3 focus:border-k-orange focus:outline-none focus:ring-2 focus:ring-k-orange-soft"
              />
            </Field>
            <Field label="Price (USD)">
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-ink-3">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={priceDollars}
                  onChange={(e) => setPriceDollars(e.target.value)}
                  placeholder="14.00"
                  className="h-9 w-full rounded-md border border-line bg-paper px-3 text-sm tabular-nums text-ink placeholder:text-ink-3 focus:border-k-orange focus:outline-none focus:ring-2 focus:ring-k-orange-soft"
                />
              </div>
            </Field>
            <Field label="Materials">
              <input
                type="text"
                value={materialsText}
                onChange={(e) => setMaterialsText(e.target.value)}
                placeholder="digital download, instant download"
                className="h-9 w-full rounded-md border border-line bg-paper px-3 text-sm text-ink placeholder:text-ink-3 focus:border-k-orange focus:outline-none focus:ring-2 focus:ring-k-orange-soft"
              />
            </Field>
          </div>

          {/* DIGITAL FILE TYPES — A5 spec required */}
          <Field
            label="Digital file types included"
            hint="Operator confirms what's inside the ZIP delivered to the buyer"
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {ALL_FORMATS.map((f) => {
                const checked = formats.has(f);
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => toggleFormat(f)}
                    data-testid={`listing-format-${f}`}
                    data-checked={checked ? "true" : undefined}
                    className={cn(
                      "flex h-12 items-center gap-2.5 rounded-md border px-3 transition-all",
                      checked
                        ? "border-k-orange bg-k-orange-soft"
                        : "border-line bg-paper hover:border-line-strong",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "inline-flex h-4 w-4 items-center justify-center rounded border",
                        checked
                          ? "border-k-orange bg-k-orange text-white"
                          : "border-line-strong bg-paper",
                      )}
                    >
                      {checked ? "✓" : null}
                    </span>
                    <span
                      className={cn(
                        "font-mono text-[11.5px] font-semibold tracking-[0.1em]",
                        checked ? "text-k-orange" : "text-ink-2",
                      )}
                    >
                      {f}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-2.5 text-[11.5px] text-ink-3">
              Per-file resolution &amp; dimensions are configured in the{" "}
              <button
                type="button"
                onClick={() => {
                  // Files tab'a yumuşak geçiş için yukarıdaki orchestrator
                  // tab state'ine erişim yok — anchor olarak sayfa kaydır.
                  document
                    .querySelector('[data-testid="product-detail-page"]')
                    ?.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="text-info underline-offset-2 hover:underline"
              >
                Files tab
              </button>
              .
            </div>
          </Field>

          {/* Save + Submit row */}
          <div className="flex items-center gap-3 border-t border-line pt-5">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              data-size="sm"
              className="k-btn k-btn--primary"
              data-testid="listing-save"
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              ) : null}
              Save listing
            </button>
            {updateMutation.isError ? (
              <span className="text-xs text-danger">
                {updateMutation.error?.message ?? "Save failed"}
              </span>
            ) : null}
            {updateMutation.isSuccess ? (
              <span className="text-xs text-success">Saved.</span>
            ) : null}
            <div className="ml-auto" />
            <button
              type="button"
              onClick={() => submitMutation.mutate()}
              disabled={submitDisabled}
              data-size="sm"
              className="k-btn k-btn--publish"
              data-testid="listing-submit"
            >
              {submitMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="h-3 w-3" aria-hidden />
              )}
              Send to Etsy as Draft
            </button>
          </div>

          {submitMutation.isError ? (
            <div
              role="alert"
              className="rounded-md border border-danger bg-danger-soft px-3 py-2 text-sm text-danger"
            >
              {submitMutation.error?.message ?? "Submit failed"}
            </div>
          ) : null}
          {submitMutation.isSuccess ? (
            <div
              role="status"
              className="rounded-md border border-success bg-success-soft px-3 py-2 text-sm text-success"
            >
              Listing submitted. Etsy draft id:{" "}
              <span className="font-mono">
                {submitMutation.data?.etsyListingId}
              </span>
              . Manual publish in Etsy admin.
            </div>
          ) : null}
        </form>

        {/* Right rail · listing health */}
        <aside
          className="border-l border-line bg-k-bg-2/50 px-6 py-6"
          aria-label="Listing health"
        >
          <div>
            <div className="font-mono text-[10px] uppercase tracking-meta text-ink-3">
              Listing health
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span
                className={cn(
                  "text-[36px] font-semibold leading-none tracking-tight",
                  healthTone === "green" && "text-k-green",
                  healthTone === "orange" && "text-k-orange",
                  healthTone === "amber" && "text-k-amber",
                  healthTone === "red" && "text-k-red",
                )}
              >
                {health}
              </span>
              <span className="text-[14px] text-ink-3">/100</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-k-bg-2">
              <div
                className={cn(
                  "h-full transition-all",
                  healthTone === "green" && "bg-k-green",
                  healthTone === "orange" && "bg-k-orange",
                  healthTone === "amber" && "bg-k-amber",
                  healthTone === "red" && "bg-k-red",
                )}
                style={{ width: `${health}%` }}
              />
            </div>
            <div className="mt-1 font-mono text-[10.5px] uppercase tracking-wider text-ink-3">
              {healthGoodCount} / {healthTotalCount} checks pass
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {listing.readiness.map((c) => (
              <div
                key={c.field}
                className="flex items-start gap-2 text-[12.5px]"
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full",
                    c.pass
                      ? "bg-k-green-soft text-k-green"
                      : "bg-k-amber-soft text-k-amber",
                  )}
                >
                  {c.pass ? "✓" : "·"}
                </span>
                <span className={c.pass ? "text-ink-2" : "text-ink"}>
                  {c.message}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-5 border-t border-line pt-5">
            <div className="font-mono text-[10px] uppercase tracking-meta text-ink-3">
              Etsy linked shop
            </div>
            <div className="mt-2 flex items-center gap-2 rounded-md border border-line bg-paper p-2.5">
              {listing.etsyShop ? (
                <>
                  <div
                    aria-hidden
                    className="flex h-6 w-6 items-center justify-center rounded bg-k-orange text-[10px] font-bold text-white"
                  >
                    E
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-medium text-ink">
                      {listing.etsyShop.shopName ?? "Etsy shop"}
                    </div>
                    <div className="font-mono text-[10px] text-ink-3">
                      Connected · digital downloads
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-xs text-text-muted">
                  No Etsy shop connected — connect a shop in Settings.
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  hintTone,
  children,
}: {
  label: string;
  hint?: string;
  hintTone?: "success" | "neutral";
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <label className="text-[12.5px] font-semibold text-ink">{label}</label>
        {hint ? (
          <span
            className={cn(
              "font-mono text-[10.5px] uppercase tracking-meta",
              hintTone === "success" ? "text-k-green" : "text-ink-3",
            )}
          >
            {hint}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}
