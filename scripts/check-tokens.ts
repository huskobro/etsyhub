import { execSync } from "node:child_process";

type Pattern = { label: string; regex: string };

const patterns: Pattern[] = [
  { label: "Raw hex renk", regex: "#[0-9a-fA-F]{3,8}\\b" },
  {
    label: "Tailwind arbitrary value",
    regex: "\\b(bg|text|border|w|h|p|m|gap|rounded|shadow|aspect|min-h|scale)-\\[[^\\]]+\\]",
  },
  { label: "Inline style attribute", regex: "style=\\{\\{" },
  { label: "hsl/rgb sabit", regex: "\\b(hsl|rgb)a?\\(" },
];

const whitelist = [
  "src/features/theme/design-tokens.ts",
  "src/app/globals.css",
  "src/features/tags/color-map.ts",
  "tailwind.config.ts",
  // T-26: RolloutBar dinamik genişliği için kasıtlı inline style escape hatch
  // (Tailwind arbitrary value `w-[X%]` yasak olduğu için). 2. tüketici
  // sprintinde terfi edilen `src/components/ui/progress-bar.tsx` path'ine
  // taşınır. Bkz. docs/plans/admin-feature-flags-data-model.md.
  "src/features/admin/feature-flags/_shared/rollout-bar.tsx",
  // Pass 31: MaskCanvas brush preview circle — cursor pozisyonu ve fırça
  // çapı CSS pixel olarak runtime'da hesaplanır (canvas DOM rect'e bağlı).
  // Tailwind class ile ifade edilemez; inline style escape hatch'i.
  "src/features/selection/components/MaskCanvas.tsx",
  // Pass 89: Batch Review Studio progress bar — RolloutBar pattern'inin
  // 2. tüketicisi (Tailwind arbitrary `w-[X%]` yasak). 3. tüketici geldiğinde
  // `src/components/ui/progress-bar.tsx`'e terfi edilir.
  "src/app/(admin)/admin/midjourney/batches/[batchId]/review/page.tsx",
  // Rollout-1 — Kivasy app-shell. v4 spec'in yarı-piksel mono caption
  // hierarchy'si (text-[10px] / text-[10.5px]) Tailwind text-xs (11px) ile
  // karşılanmıyor. Active Tasks panel keskin 340w boyutu da v4 spec sabiti
  // (k-tasks recipe). Sidebar admin badge'i v4 base.jsx ile eşit.
  "src/features/app-shell/Sidebar.tsx",
  "src/features/app-shell/ActiveTasksPanel.tsx",
  "src/features/app-shell/RolloutPlaceholder.tsx",
  // Rollout-1 — Kivasy brand mark / wordmark canonical SVG geometry. The
  // `rgba()` strokes and inline `style` props are part of the byte-canonical
  // mark (matches docs/design-system/kivasy/ui_kits/kivasy/v4/base.jsx
  // KivasyMark / KivasyWord).
  "src/components/ui/KivasyMark.tsx",
  // Rollout-2 — Library primitives. v4 spec sabit ölçüler:
  //  · DetailPanel  → w-[460px], max-w-[90vw] (panel width canonical)
  //  · Checkbox     → border-[1.5px] (k-checkbox recipe)
  //  · FloatingBulkBar → comment'de canonical dark surface hex (#16130F)
  "src/components/ui/DetailPanel.tsx",
  "src/components/ui/FloatingBulkBar.tsx",
  "src/features/library/components/Checkbox.tsx",
  // Rollout-3 — Batches/Review/Modal primitives.
  //  · ProgressBar  → style.width % escape hatch (RolloutBar pattern, 3rd
  //    consumer threshold; dynamic percent cannot be a Tailwind class).
  //  · Modal        → v4 modal-sm/md/lg sabit max-width sözleşmesi
  //    (420 / 720 / 1100), dark variant'ın canonical #1F1C18 / #16130F
  //    surface'leri. Bunlar token sistemine alınmadı çünkü modal canonical
  //    boyutları ve dark workspace tek-tip.
  //  · BatchReviewWorkspace → A4 dark workspace. v4 #1A1815 (canvas) /
  //    #16130F (workspace bar) / #1F1C18 (info rail) sabitleri sadece bu
  //    surface'te kullanılır; light theme yok. Filmstrip + KBD chip
  //    boyutları (min-w-[22px], min-w-[28px], text-[8px]/[9px]) v4 spec.
  //  · BatchesIndexClient → text-[13.5px] yarı-piksel (Kivasy v4 row
  //    typography sabitlerinden), Tailwind text-sm 13px / text-base 14px
  //    arasında token tier yok.
  "src/components/ui/ProgressBar.tsx",
  "src/features/library/components/Modal.tsx",
  "src/features/batches/components/BatchReviewWorkspace.tsx",
  "src/features/batches/components/BatchesIndexClient.tsx",
  // Rollout-4 — Selections (B2/B3) recipes.
  //  · SelectionCard → `.k-card--hero` v5 hero card; `aspect-square` + 3-up
  //    thumb composite v5 design layer'ında tanımlı.
  //  · SelectionsIndexClient → toolbar `max-w-[420px]` + search input
  //    `rounded-md` Library/Batches ile birebir patern.
  //  · DesignsTab → 4-col grid + drag handle + bulk-bar; v5 spec sabit
  //    `text-[10.5px]` mono caption (Library/Batches ile tutarlı).
  //  · EditsTab → before/after `!w-12 !aspect-square` thumb pairing +
  //    `bg-k-purple` v2 badge (purple = edit stage canonical).
  "src/features/selections/components/SelectionCard.tsx",
  "src/features/selections/components/SelectionsIndexClient.tsx",
  "src/features/selections/components/tabs/DesignsTab.tsx",
  "src/features/selections/components/tabs/EditsTab.tsx",
  // Rollout-5 — Products (B4 / A5) recipes.
  //  · ProductsIndexClient → B4 table sabit ölçüler: text-[13.5px] /
  //    text-[12.5px] / text-[11px] / text-[10.5px] / text-[9.5px] /
  //    text-[10px] yarı-piksel mono caption hierarchy + 4-up thumb cell
  //    rounded-[3px] / w-12 grid sabitleri (Batches table paterni).
  //    Listing health bar inline `style={{width:health+%}}` — RolloutBar
  //    pattern (Tailwind arbitrary `w-[X%]` yasak, dinamik percent).
  //  · ListingTab → A5 form layout sabitleri: max-w-[820px] form panel +
  //    grid-cols-[1fr_360px] split rail + text-[12.5px] / text-[11.5px] /
  //    text-[10.5px] / text-[36px] / text-[24px] / text-[14px] yarı-piksel
  //    typography (Kivasy v4 listing form canon). min-h-[60px] tag chip
  //    container + h-12 format toggle button.
  //  · FilesTab → A5 stat tile sabit boyutu (text-[24px]) + table cell
  //    text-[10.5px] / text-[12px] / text-[12.5px] / text-[13px] yarı-
  //    piksel typography (A5 file table canon).
  "src/features/products/components/ProductsIndexClient.tsx",
  "src/features/products/components/tabs/ListingTab.tsx",
  "src/features/products/components/tabs/FilesTab.tsx",
  //  · MockupsTab → A5 mockup grid kart başlığı text-[15px] semibold +
  //    mono caption text-[10.5px] (Selections Mockups read-only ile aynı
  //    spec; v4 base.jsx section header canon).
  //  · HistoryTab → A5 timeline mono ts text-[11px] yarı-piksel.
  "src/features/products/components/tabs/MockupsTab.tsx",
  "src/features/products/components/tabs/HistoryTab.tsx",
  // Rollout-6 — Templates (C1) + Settings (C2/D1) recipes.
  //  · TemplatesIndexClient → v6 sub-tab segment + table cell typography
  //    (text-[13.5px] / text-[10.5px] yarı-piksel) + max-w-sm search +
  //    hero recipe card text-[14.5px].
  //  · SettingsShell → v6 detail-list grid-cols-[260px_1fr] + left-rail
  //    text-[13px] / text-[10px] / text-[9.5px] mono group label canon.
  //  · PaneGeneral / PaneEtsy / PaneAIProviders → v6/v7 max-w-[680px] +
  //    max-w-[920px] pane container + text-[26px] k-display title +
  //    text-[13.5px] / text-[12px] / text-[11.5px] / text-[10.5px] /
  //    text-[10px] / text-[9.5px] yarı-piksel typography (Settings canon).
  //  · PaneAIProviders → ProviderCard mono badge canonical hex'leri
  //    (#E89B5B/#8E3A12 warm, #5B9BD5/#1E4F7B blue, #4A4640/#16130F ink,
  //    #8A60C9/#4A2E7A purple) — D1 spec'in mono kimliği.
  "src/features/templates/components/TemplatesIndexClient.tsx",
  "src/features/settings/shell/SettingsShell.tsx",
  "src/features/settings/shell/panes/PaneGeneral.tsx",
  "src/features/settings/shell/panes/PaneEtsy.tsx",
  "src/features/settings/shell/panes/PaneAIProviders.tsx",
  "src/features/settings/shell/panes/PaneDeferred.tsx",
  // Rollout-7 — Templates CRUD + Settings persist + remaining panes.
  //  · PromptTemplateEditorModal → Modal lg + ModalSplit (340/1fr) +
  //    text-[12.5px] / text-[11.5px] / text-[10.5px] / text-[11px]
  //    yarı-piksel form labels + max-h-[88vh] viewport limit (Modal canon).
  //  · StylePresetsSubview → text-[14px] preset card title + text-[10px] /
  //    text-[10.5px] / text-[11px] yarı-piksel mono labels (v6 C1 canon).
  //  · PaneWorkspace → max-w-[680px] container + text-[26px] k-display
  //    title + text-[12.5px] / text-[11.5px] / text-[10.5px] yarı-piksel
  //    typography (Settings canon).
  //  · PaneNotifications → text-[13px] / text-[11.5px] / text-[10.5px] /
  //    text-[9.5px] yarı-piksel + h-5/w-9 toggle (v6 ToggleRow pattern).
  //  · PaneStorage → text-[26px] k-display title + text-[20px] / text-[15px]
  //    / text-[13px] / text-[12px] / text-[11px] / text-[10.5px] / text-[10px]
  //    yarı-piksel typography (Settings canon).
  "src/features/templates/components/PromptTemplateEditorModal.tsx",
  "src/features/templates/components/StylePresetsSubview.tsx",
  "src/features/settings/shell/panes/PaneWorkspace.tsx",
  "src/features/settings/shell/panes/PaneNotifications.tsx",
  "src/features/settings/shell/panes/PaneStorage.tsx",
  // Rollout-8 — Recipe runner + Mockup upload + remaining panes.
  //  · RunRecipeModal → Modal md (max-w-[720px]) + chain step
  //    text-[12.5px] / text-[11px] / text-[10.5px] yarı-piksel.
  //  · UploadMockupTemplateModal → Modal md + drop zone border-dashed
  //    + text-[10.5px] / text-[12px] / text-[12.5px] / text-[13px]
  //    yarı-piksel labels.
  //  · PaneEditor → text-[12.5px] / text-[12px] / text-[11.5px] /
  //    text-[10.5px] / text-[13px] / text-[13.5px] yarı-piksel
  //    typography (Settings canon).
  //  · PaneScrapers → admin scope text-[12.5px] / text-[10.5px] /
  //    text-[11px] / text-[12px] yarı-piksel typography.
  "src/features/templates/components/RunRecipeModal.tsx",
  "src/features/templates/components/UploadMockupTemplateModal.tsx",
  "src/features/settings/shell/panes/PaneEditor.tsx",
  "src/features/settings/shell/panes/PaneScrapers.tsx",
  // R11.14 — Overview C3 4-block view (Pipeline pulse / Pending actions /
  //   Active batches / Recent activity). v6 spec'in yarı-piksel mono caption
  //   hierarchy'si (text-[9.5px] / text-[10px] / text-[10.5px] / text-[11px]
  //   / text-[12.5px] / text-[13.5px] / text-[26px] k-display) Tailwind
  //   token tier'ında yok. Inline style: ProgressBar yüzdesi (RolloutBar
  //   emsali) + Recent activity grid-template-columns (5-column ızgara
  //   sabitleri canonical: 60px / 1fr / 1fr / 90px / 24px).
  "src/features/overview/components/OverviewClient.tsx",
  // R11.14 — References B1 sibling-tab shell. v5 spec'in text-[12.5px] tab
  //   label + text-[10.5px] mono count chip yarı-piksel hierarchy.
  "src/features/references/components/ReferencesShellTabs.tsx",
  // R11.14.4 — ReferencesPage v5 B1.SubPool full implementation.
  //   v5 SubPool kart başlığı text-[13px] + meta caption text-[10.5px] mono
  //   (screens-b1.jsx lines 124-150). Library/Selections/Products kartlarıyla
  //   tutarlı yarı-piksel hierarchy; Tailwind tier'da text-sm (14px) ve
  //   text-xs (12px) arası geçiş yok. Eski reference-card.tsx kaldırıldı.
  "src/features/references/components/references-page.tsx",
  // R11.14.4 — LibraryAssetCard v4 A1 recipe parity (k-card + k-thumb +
  //   k-checkbox + k-iconbtn). Title text-[13px] + meta mono text-[10.5px]
  //   yarı-piksel hierarchy v5 SubPool ile birebir.
  "src/features/library/components/LibraryAssetCard.tsx",
  // R11.14.5 — References page topbar v5 spec (h1 text-[24px] k-display,
  //   subtitle text-[10.5px] mono inline). Tailwind text-2xl (24px) tier
  //   var ama k-display font-family + leading-none kombinasyonu için
  //   half-pixel tracking gerekli.
  "src/app/(app)/references/page.tsx",
  // R11.14.5 — Shared ReferencesTopbar (References family tek doğruluk
  //   kaynağı). Aynı half-pixel typography hierarchy.
  "src/features/references/components/ReferencesTopbar.tsx",
];
// Note: Rollout-9 keeps existing whitelisted files; no new client tsx with
// half-pixel typography added.

let hadError = false;

for (const { label, regex } of patterns) {
  try {
    const out = execSync(
      `rg -n --no-messages "${regex}" src tests || true`,
      { encoding: "utf8", shell: "/bin/bash" },
    );
    const hits = out
      .split("\n")
      .filter((line) => line && !whitelist.some((w) => line.includes(w)));
    if (hits.length > 0) {
      console.error(`\n❌ ${label}:`);
      for (const h of hits) console.error(`  ${h}`);
      hadError = true;
    }
  } catch (err) {
    console.error(`rg hata: ${(err as Error).message}`);
    hadError = true;
  }
}

if (!hadError) {
  console.log("✓ Token ihlali yok (src + tests).");
}

process.exit(hadError ? 1 : 0);
