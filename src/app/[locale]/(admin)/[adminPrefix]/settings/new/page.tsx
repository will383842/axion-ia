// Page admin /settings/new — creation parametre.

import { redirect } from "next/navigation";
import { auth } from "@/auth";
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
