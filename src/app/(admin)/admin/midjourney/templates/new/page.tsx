// Pass 81 — Yeni MJ Template create page.

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { TemplateForm } from "../TemplateForm";

export default function NewMjTemplatePage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Yeni Midjourney Template</h1>
          <p className="mt-1 text-sm text-text-muted">
            Mustache <code className="font-mono">{"{{var}}"}</code> syntax&apos;ı
            ile prompt şablonu oluştur. Initial version <code>v1</code> ACTIVE.
          </p>
        </div>
        <Link href="/admin/midjourney/templates">
          <Button variant="ghost" size="sm">
            ← Templates
          </Button>
        </Link>
      </header>

      <TemplateForm mode="new" />
    </div>
  );
}
