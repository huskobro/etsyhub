"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UserRole, UserStatus } from "@prisma/client";

type AdminUserRow = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
};

async function fetchUsers(): Promise<AdminUserRow[]> {
  const res = await fetch("/api/admin/users", { cache: "no-store" });
  if (!res.ok) throw new Error("Kullanıcı listesi alınamadı");
  const data = (await res.json()) as { users: AdminUserRow[] };
  return data.users;
}

async function patchUser(input: { userId: string; role?: UserRole; status?: UserStatus }) {
  const res = await fetch("/api/admin/users", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? "Güncelleme başarısız");
  return res.json();
}

export function UsersTable() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: fetchUsers,
  });
  const mutation = useMutation({
    mutationFn: patchUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  if (isLoading) return <p className="text-sm text-text-muted">Yükleniyor…</p>;
  if (error) return <p className="text-sm text-danger">{(error as Error).message}</p>;
  if (!data) return null;

  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface">
      <table className="w-full text-sm">
        <thead className="bg-surface-muted text-text-muted">
          <tr>
            <th className="px-4 py-2 text-left font-medium">E-posta</th>
            <th className="px-4 py-2 text-left font-medium">İsim</th>
            <th className="px-4 py-2 text-left font-medium">Rol</th>
            <th className="px-4 py-2 text-left font-medium">Durum</th>
            <th className="px-4 py-2 text-left font-medium">Oluşturma</th>
          </tr>
        </thead>
        <tbody>
          {data.map((u) => (
            <tr key={u.id} className="border-t border-border">
              <td className="px-4 py-2 text-text">{u.email}</td>
              <td className="px-4 py-2 text-text-muted">{u.name ?? "—"}</td>
              <td className="px-4 py-2">
                <select
                  value={u.role}
                  disabled={mutation.isPending}
                  onChange={(e) =>
                    mutation.mutate({ userId: u.id, role: e.target.value as UserRole })
                  }
                  className="rounded-md border border-border bg-bg px-2 py-1 text-sm"
                >
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </td>
              <td className="px-4 py-2">
                <select
                  value={u.status}
                  disabled={mutation.isPending}
                  onChange={(e) =>
                    mutation.mutate({ userId: u.id, status: e.target.value as UserStatus })
                  }
                  className="rounded-md border border-border bg-bg px-2 py-1 text-sm"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="DISABLED">DISABLED</option>
                </select>
              </td>
              <td className="px-4 py-2 text-text-muted">
                {new Date(u.createdAt).toLocaleDateString("tr-TR")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
