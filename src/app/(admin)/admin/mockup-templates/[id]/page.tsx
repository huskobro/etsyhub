import { TemplateDetailView } from "@/features/admin/mockup-templates/template-detail-view";

export default function AdminMockupTemplateDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div className="flex flex-col gap-4">
      <TemplateDetailView templateId={params.id} />
    </div>
  );
}
