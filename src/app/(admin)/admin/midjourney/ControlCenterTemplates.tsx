// Pass 87 — Operator Control Center: Recent Templates strip.
//
// Section D — son güncellenen 5 template + run count + variables badge.
// Tıklanan template → /templates/[id] (edit + run history Pass 85).
// "Hepsini gör" → /templates list.

import Link from "next/link";
import type { MjTemplateSummary } from "@/server/services/midjourney/templates";

type TemplatesProps = {
  templates: MjTemplateSummary[];
};

export function ControlCenterTemplates({ templates }: TemplatesProps) {
  return (
    <section
      className="rounded-md border border-border bg-surface p-3"
      data-testid="mj-cc-templates"
      aria-label="Recent templates"
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Templates</h3>
        <div className="flex gap-3 text-xs">
          <Link
            href="/admin/midjourney/templates/new"
            className="text-accent underline hover:no-underline"
          >
            + Yeni
          </Link>
          <Link
            href="/admin/midjourney/templates"
            className="text-text-muted underline hover:text-text"
          >
            Hepsini gör →
          </Link>
        </div>
      </div>
      {templates.length === 0 ? (
        <p className="rounded border border-dashed border-border bg-surface-2 p-3 text-center text-xs text-text-muted">
          Henüz template yok.{" "}
          <Link
            href="/admin/midjourney/templates/new"
            className="text-accent underline"
          >
            İlk template&apos;i oluştur
          </Link>
          .
        </p>
      ) : (
        <ul
          className="flex flex-col gap-1.5"
          data-testid="mj-cc-templates-list"
        >
          {templates.slice(0, 5).map((t) => (
            <li key={t.id}>
              <Link
                href={`/admin/midjourney/templates/${t.id}`}
                className="flex items-center justify-between gap-2 rounded border border-border bg-bg p-2 transition hover:border-border-strong"
              >
                <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                  <span className="truncate text-sm font-medium text-text">
                    {t.name}
                  </span>
                  {t.promptTemplateText ? (
                    <code
                      className="truncate font-mono text-xs text-text-muted"
                      title={t.promptTemplateText}
                    >
                      {t.promptTemplateText.slice(0, 100)}
                      {t.promptTemplateText.length > 100 ? "…" : ""}
                    </code>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {t.templateVariables.length > 0 ? (
                    <span
                      className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-text-muted"
                      title={t.templateVariables.join(", ")}
                    >
                      {t.templateVariables.length} var
                    </span>
                  ) : null}
                  {t.activeVersion ? (
                    <span className="rounded bg-accent-soft px-1.5 py-0.5 font-mono text-xs text-accent">
                      v{t.activeVersion}
                    </span>
                  ) : null}
                  <Link
                    href={`/admin/midjourney/batch-run?templateId=${t.id}`}
                    className="text-xs text-accent underline hover:no-underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Run →
                  </Link>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
