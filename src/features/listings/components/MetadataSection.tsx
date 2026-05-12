"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Wand2, Loader2 } from "lucide-react";
import { useUpdateListingDraft } from "../hooks/useUpdateListingDraft";
import { useGenerateListingMeta } from "../hooks/useGenerateListingMeta";
import type { ListingDraftView } from "../types";

/**
 * MetadataSection — Edit title, description, tags.
 *
 * Spec §9.2:
 * - Title (text input)
 * - Description (textarea)
 * - 13 tags (comma-separated input)
 * - Save button + AI Oluştur button (Phase 9 V1 Task 16 — AI binding)
 * - Inline error alert
 *
 * AI binding (Task 16):
 * - useGenerateListingMeta(listing.id) hook'u POST /generate-meta tetikler
 * - Success → form alanları doldurulur (auto-save YOK; kullanıcı "Kaydet" ile commit eder)
 * - Loading → "Üretiliyor…" + spinner + disabled
 * - Error → ayrı role="alert" (kaydetme hatasıyla karışmasın)
 *
 * @param listing ListingDraft
 */
export function MetadataSection({ listing }: { listing: ListingDraftView }) {
  const mutation = useUpdateListingDraft(listing.id);
  const aiMutation = useGenerateListingMeta(listing.id);

  const [title, setTitle] = useState(listing.title || "");
  const [description, setDescription] = useState(listing.description || "");
  const [tagsInput, setTagsInput] = useState(listing.tags.join(", "));

  const handleSave = () => {
    const newTags = tagsInput
      .split(",")
      .map((t: string) => t.trim())
      .filter((t: string) => t.length > 0);

    if (newTags.length > 13) {
      // Validation
      return;
    }

    mutation.mutate({
      title: title || undefined,
      description: description || undefined,
      tags: newTags,
    });
  };

  const handleGenerateAI = () => {
    aiMutation.mutate(undefined, {
      onSuccess: (data) => {
        setTitle(data.output.title);
        setDescription(data.output.description);
        setTagsInput(data.output.tags.join(", "));
      },
    });
  };

  const hasChanges =
    title !== listing.title ||
    description !== listing.description ||
    tagsInput !== listing.tags.join(", ");

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold mb-4">Title & Description</h2>

      <div className="space-y-4">
        {/* Title */}
        <div>
          <label htmlFor="listing-title" className="block text-sm font-medium mb-2">
            Title
          </label>
          <input
            id="listing-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter listing title"
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Main title shown on Etsy (up to 140 characters)
          </p>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="listing-desc" className="block text-sm font-medium mb-2">
            Description
          </label>
          <textarea
            id="listing-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter listing description"
            rows={6}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Product details and features
          </p>
        </div>

        {/* Tags */}
        <div>
          <label htmlFor="listing-tags" className="block text-sm font-medium mb-2">
            Tags (max 13)
          </label>
          <input
            id="listing-tags"
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="Comma-separated tags: tag1, tag2, tag3"
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Current: {tagsInput.split(",").filter((t: string) => t.trim()).length}/13 tags
          </p>
        </div>

        {/* AI Generation Status */}
        {aiMutation.isSuccess && (
          <p className="text-xs text-text-subtle" role="status">
            AI suggestion applied to the form. Review and click &quot;Save&quot; to commit.
          </p>
        )}

        {aiMutation.error && (
          <p role="alert" className="text-sm text-red-600">
            AI generation failed: {aiMutation.error.message}
          </p>
        )}

        {/* Save Mutation Error */}
        {mutation.error && (
          <p role="alert" className="text-sm text-red-600">
            Save failed: {mutation.error.message}
          </p>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            onClick={handleSave}
            disabled={mutation.isPending || !hasChanges}
          >
            {mutation.isPending ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleGenerateAI}
            disabled={aiMutation.isPending}
            className="inline-flex items-center gap-2"
          >
            {aiMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
            ) : (
              <Wand2 className="w-4 h-4" aria-hidden />
            )}
            {aiMutation.isPending ? "Generating…" : "Generate with AI"}
          </Button>
        </div>
      </div>
    </div>
  );
}
