// Page admin /settings/new — creation parametre.

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminPageShell, AdminPageHeader } from "@/components/admin/ui";
import { SettingForm } from "../SettingForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

export default async function NewSettingPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader
        title="Nouvelle clé de paramètre"
        breadcrumbs={
          <a href={`/fr/${adminPrefix}/settings`} className="admin-link admin-back">
            ← Paramètres
          </a>
        }
      />
      <div className="admin-card admin-card-wide">
        <SettingForm />
      </div>
    </AdminPageShell>
  );
}
