import Link from "next/link";
import { TemplateCreateForm } from "@/features/admin/mockup-templates/template-create-form";

export default function AdminMockupTemplateNewPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <Link href="/admin/mockup-templates" className="hover:text-text">
          ← Mockup Template'leri
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-semibold">Yeni Mockup Template</h1>
        <p className="text-sm text-text-muted">
          DRAFT state'te oluşturulur. Oluşturduktan sonra binding ekleyip ACTIVE'e
          geçirebilirsin (Apply page'inde gösterilmesi için en az 1 ACTIVE binding gerek).
        </p>
      </div>
      <TemplateCreateForm />
    </div>
  );
}
