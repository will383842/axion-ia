// Page admin /settings/new — creation parametre.

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdminV2Enabled } from "@/lib/feature-flags";
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

  const v2 = await isAdminV2Enabled();
  if (v2) {
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

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <a href={`/fr/${adminPrefix}/settings`} className="admin-link admin-back">
            ← Paramètres
          </a>
          <h1 className="admin-h1-large">Nouvelle clé de paramètre</h1>
        </div>
      </div>
      <div className="admin-card admin-card-wide">
        <SettingForm />
      </div>
    </section>
  );
}
