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
];

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
