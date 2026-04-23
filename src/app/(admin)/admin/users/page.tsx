import { UsersTable } from "@/features/admin/users/users-table";

export default function AdminUsersPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Kullanıcılar</h1>
        <p className="text-sm text-text-muted">Rol ve durum değişiklikleri audit log&apos;a işlenir.</p>
      </div>
      <UsersTable />
    </div>
  );
}
