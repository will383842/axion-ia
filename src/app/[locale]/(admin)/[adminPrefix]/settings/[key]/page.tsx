// Page admin /settings/[key] — edition parametre.

import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminPageShell, AdminPageHeader } from "@/components/admin/ui";
import { getSettingAction } from "@/features/admin-settings/actions";
import { SettingForm } from "../SettingForm";
import { formatDateFrShort } from "@/lib/format-date-fr";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string; key: string }>;
}

export default async function EditSettingPage({ params }: PageProps) {
  const { adminPrefix, key } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const decodedKey = decodeURIComponent(key);
  const setting = await getSettingAction(decodedKey);
  if (!setting) notFound();

  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader
        title={`Éditer : ${setting.key}`}
        description={`Mise à jour : ${formatDateFrShort(setting.updatedAt)}`}
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
