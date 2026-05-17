// KB-3 — Création d'une nouvelle entrée Knowledge Base.
//
// V1 minimal : form HTML natif POST → server action.
// V1.5 : étendre avec react-hook-form + RHF + Tiptap intégré (KB-16).

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ConnaissancesNouvelleForm } from "./ConnaissancesNouvelleForm";
import { isAdminV2Enabled } from "@/lib/feature-flags";
import { ConnaissancesNouvelleV2 } from "./_v2/ConnaissancesNouvelleV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

export default async function ConnaissancesNouvellePage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  if (await isAdminV2Enabled()) {
    return <ConnaissancesNouvelleV2 adminPrefix={adminPrefix} />;
  }

  return (
    <section>
      <div className="admin-dashboard-head">
        <h1 className="admin-h1-large">Nouvelle entrée connaissance</h1>
      </div>
      <ConnaissancesNouvelleForm adminPrefix={adminPrefix} />
    </section>
  );
}
