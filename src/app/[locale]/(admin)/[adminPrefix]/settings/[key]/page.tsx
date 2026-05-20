// Page admin /settings/[key] — edition parametre.

import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdminV2Enabled } from "@/lib/feature-flags";
import { AdminPageShell, AdminPageHeader } from "@/components/admin/ui";
import { getSettingAction } from "@/features/admin-settings/actions";
import { SettingForm } from "../SettingForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string; key: string }>;
}

export default async function EditSettingPage({ params }: PageProps) {
  const { adminPrefix, key } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const v2 = await isAdminV2Enabled();

  const decodedKey = decodeURIComponent(key);
  const setting = await getSettingAction(decodedKey);
  if (!setting) notFound();

  if (v2) {
    return (
      <AdminPageShell width="narrow">
        <AdminPageHeader
          title={`Éditer : ${setting.key}`}
          description={`Mise à jour : ${setting.updatedAt.toISOString().slice(0, 10)}`}
          breadcrumbs={
            <a href={`/fr/${adminPrefix}/settings`} className="admin-link admin-back">
              ← Paramètres
            </a>
          }
        />
        <div className="admin-card admin-card-wide">
          <SettingForm
            initial={{
              key: setting.key,
              value: setting.value,
              description: setting.description,
            }}
          />
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
          <h1 className="admin-h1-large">
            Éditer : <code>{setting.key}</code>
          </h1>
          <p className="admin-meta">Mise à jour : {setting.updatedAt.toISOString().slice(0, 10)}</p>
        </div>
      </div>
      <div className="admin-card admin-card-wide">
        <SettingForm
          initial={{
            key: setting.key,
            value: setting.value,
            description: setting.description,
          }}
        />
      </div>
    </section>
  );
}
