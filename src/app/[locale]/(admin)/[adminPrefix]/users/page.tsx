// Listing utilisateurs admin (M9 Tier 3 section 3 — ordre §14).

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listAdminUsersAction } from "@/features/admin-users/actions";
import { UsersV2 } from "./_v2/UsersV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  editor: "Éditeur",
  reader: "Lecteur",
};
const STATUS_LABELS: Record<string, string> = {
  active: "Actif",
  suspended: "Suspendu",
};

export default async function UsersListPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);
  const callerRole = (session.user as { role?: string }).role;
  const isSuperAdmin = callerRole === "super_admin";

  const result = await listAdminUsersAction({
    role: sp.role as never,
    status: sp.status as never,
    search: sp.search,
    page: sp.page ? parseInt(sp.page, 10) : 1,
  });

  return (
    <UsersV2
      adminPrefix={adminPrefix}
      searchParams={sp}
      items={result.items}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
      isSuperAdmin={isSuperAdmin}
    />
  );
}

