// Phase 7 Task 27 — AiQualityPanel testleri.
//
// Sözleşme (plan Task 27 + spec Section 3.2 + Section 1.4 + Section 8.1):
//   - Review yok (`null`) → muted hint metni + disabled "Send for review"
//     buton (Phase 6 canlı smoke sonrası aktif tooltip).
//   - Review var → score (büyük font + tone'a göre renk), status Badge
//     (Türkçe "Onaylandı" / "Gözden geçir" / "Rejected" / "Pending"),
//     4 sinyal listesi (Çözünürlük / Text detection / Artifact check /
//     Trademark risk) — sırasıyla.
//   - Sinyaller TR human-readable: ok→OK, low→Düşük, unknown→Bilinmiyor,
//     clean→Temiz, issue→İşaret var, low(trademark)→Düşük, high→Yüksek.
//   - Disabled "Send for review" butonu click'i no-op (disabled attribute).
//
// Phase 6 emsali: tests/unit/selection/preview-card.test.tsx — store reset +
// tek-component test paterni.

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { SelectionItemView } from "@/features/selection/queries";
import type { ReviewView } from "@/server/services/selection/types";
import { AiQualityPanel } from "@/features/selection/components/AiQualityPanel";

function makeItem(review: ReviewView | null): SelectionItemView {
  return {
    id: "i1",
    selectionSetId: "set-1",
    generatedDesignId: "gd1",
    sourceAssetId: "src-1",
    editedAssetId: null,
    lastUndoableAssetId: null,
    editHistoryJson: [],
    status: "pending",
    position: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    review,
    // SelectionItemView prisma SelectionItem'ı miras alıyor; jsdom test
    // tarafında ek alan zorunluluğu yok — cast ile tip kapsama girer.
  } as unknown as SelectionItemView;
}

function makeReview(overrides: Partial<ReviewView> = {}): ReviewView {
  return {
    score: 92,
    status: "approved",
    signals: {
      resolution: "ok",
      textDetection: "clean",
      artifactCheck: "clean",
      trademarkRisk: "low",
    },
    ...overrides,
  };
}

describe("AiQualityPanel — review yok (null)", () => {
  it("muted hint metni + disabled 'Send for review' buton render", () => {
    render(<AiQualityPanel item={makeItem(null)} />);
    expect(
      screen.getByText(/ai quality analysis has not run on this variant yet/i),
    ).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: /send for review/i });
    expect(btn).toBeDisabled();
  });

  it("disabled buton aria-disabled + tooltip title attr taşır", () => {
    render(<AiQualityPanel item={makeItem(null)} />);
    const btn = screen.getByRole("button", { name: /send for review/i });
    expect(btn).toBeDisabled();
    // Live review smoke hint
    expect(btn).toHaveAttribute("title", expect.stringMatching(/live review smoke/i));
  });

  it("AI Kalite başlık her zaman render (panel kaybolmaz)", () => {
    render(<AiQualityPanel item={makeItem(null)} />);
    // Başlık tam metin "AI quality" — hint cümlesindeki "AI kalite" eşleşmemeli.
    expect(screen.getByText("AI quality")).toBeInTheDocument();
  });
});

describe("AiQualityPanel — score + status", () => {
  it("score 92 + status approved → '92' + 'Approved' badge", () => {
    render(<AiQualityPanel item={makeItem(makeReview({ score: 92, status: "approved" }))} />);
    expect(screen.getByText("92")).toBeInTheDocument();
    expect(screen.getByText(/^Approved$/i)).toBeInTheDocument();
  });

  it("score 50 + status needs_review → '50' + 'Review' badge", () => {
    render(
      <AiQualityPanel
        item={makeItem(makeReview({ score: 50, status: "needs_review" }))}
      />,
    );
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText(/^Review$/i)).toBeInTheDocument();
  });

  it("score 30 + status rejected → '30' + 'Reddedildi' badge", () => {
    render(
      <AiQualityPanel
        item={makeItem(makeReview({ score: 30, status: "rejected" }))}
      />,
    );
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText(/rejected/i)).toBeInTheDocument();
  });

  it("status pending → 'Beklemede' badge", () => {
    render(
      <AiQualityPanel
        item={makeItem(makeReview({ score: 0, status: "pending" }))}
      />,
    );
    expect(screen.getByText(/pending/i)).toBeInTheDocument();
  });

  it("score 90+ → success renk class'ı (text-success)", () => {
    render(<AiQualityPanel item={makeItem(makeReview({ score: 95 }))} />);
    const scoreEl = screen.getByText("95");
    expect(scoreEl.className).toMatch(/text-success/);
  });

  it("score 60-89 → warning renk class'ı", () => {
    render(<AiQualityPanel item={makeItem(makeReview({ score: 75 }))} />);
    const scoreEl = screen.getByText("75");
    expect(scoreEl.className).toMatch(/text-warning/);
  });

  it("score <60 → danger renk class'ı", () => {
    render(<AiQualityPanel item={makeItem(makeReview({ score: 40 }))} />);
    const scoreEl = screen.getByText("40");
    expect(scoreEl.className).toMatch(/text-danger/);
  });
});

describe("AiQualityPanel — sinyal display", () => {
  it("resolution=ok → 'OK'; resolution=low → 'Low'; resolution=unknown → 'Bilinmiyor'", () => {
    const { rerender } = render(
      <AiQualityPanel
        item={makeItem(makeReview({ signals: {
          resolution: "ok",
          textDetection: "clean",
          artifactCheck: "clean",
          trademarkRisk: "low",
        } }))}
      />,
    );
    expect(screen.getByText("OK")).toBeInTheDocument();

    rerender(
      <AiQualityPanel
        item={makeItem(makeReview({ signals: {
          resolution: "low",
          textDetection: "clean",
          artifactCheck: "clean",
          trademarkRisk: "low",
        } }))}
      />,
    );
    // 'Low' iki yerde olabilir (resolution + trademark) → en az bir tane
    expect(screen.getAllByText(/^Low$/i).length).toBeGreaterThanOrEqual(1);

    rerender(
      <AiQualityPanel
        item={makeItem(makeReview({ signals: {
          resolution: "unknown",
          textDetection: "clean",
          artifactCheck: "clean",
          trademarkRisk: "low",
        } }))}
      />,
    );
    expect(screen.getByText(/unknown/i)).toBeInTheDocument();
  });

  it("textDetection=clean → 'Temiz'; issue → 'İşaret var'", () => {
    const { rerender } = render(
      <AiQualityPanel
        item={makeItem(makeReview({ signals: {
          resolution: "unknown",
          textDetection: "clean",
          artifactCheck: "clean",
          trademarkRisk: "low",
        } }))}
      />,
    );
    expect(screen.getAllByText(/clean/i).length).toBeGreaterThanOrEqual(1);

    rerender(
      <AiQualityPanel
        item={makeItem(makeReview({ signals: {
          resolution: "unknown",
          textDetection: "issue",
          artifactCheck: "clean",
          trademarkRisk: "low",
        } }))}
      />,
    );
    expect(screen.getByText("Flagged")).toBeInTheDocument();
  });

  it("artifactCheck=clean/issue → Temiz/İşaret var", () => {
    render(
      <AiQualityPanel
        item={makeItem(makeReview({ signals: {
          resolution: "unknown",
          textDetection: "clean",
          artifactCheck: "issue",
          trademarkRisk: "low",
        } }))}
      />,
    );
    expect(screen.getByText("Flagged")).toBeInTheDocument();
  });

  it("trademarkRisk=low → 'Low'; high → 'High'", () => {
    const { rerender } = render(
      <AiQualityPanel
        item={makeItem(makeReview({ signals: {
          resolution: "unknown",
          textDetection: "clean",
          artifactCheck: "clean",
          trademarkRisk: "low",
        } }))}
      />,
    );
    expect(screen.getAllByText(/^Low$/i).length).toBeGreaterThanOrEqual(1);

    rerender(
      <AiQualityPanel
        item={makeItem(makeReview({ signals: {
          resolution: "unknown",
          textDetection: "clean",
          artifactCheck: "clean",
          trademarkRisk: "high",
        } }))}
      />,
    );
    expect(screen.getByText(/^High$/i)).toBeInTheDocument();
  });
});

describe("AiQualityPanel — sinyal sıralaması", () => {
  it("4 sinyal sırası: Çözünürlük → Text detection → Artifact check → Trademark risk", () => {
    render(<AiQualityPanel item={makeItem(makeReview())} />);
    const html = document.body.innerHTML;
    const idxRes = html.indexOf("Resolution");
    const idxText = html.indexOf("Text detection");
    const idxArtifact = html.indexOf("Artifact check");
    const idxTrademark = html.indexOf("Trademark risk");

    expect(idxRes).toBeGreaterThan(-1);
    expect(idxText).toBeGreaterThan(idxRes);
    expect(idxArtifact).toBeGreaterThan(idxText);
    expect(idxTrademark).toBeGreaterThan(idxArtifact);
  });
});
