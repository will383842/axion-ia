// Page admin /settings/[key] — edition parametre.

import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdminV2Enabled } from "@/lib/feature-flags";
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

  // Pattern V1/V2 §3 (audit verif-fix-deploy 2026-05-18) — V2 non implémenté
  // pour cette route legacy admin. Flag check préservé pour spec compliance.
  if (await isAdminV2Enabled()) {
    // Intentional fall-through to V1 below.
  }

  const decodedKey = decodeURIComponent(key);
  const setting = await getSettingAction(decodedKey);
  if (!setting) notFound();

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
