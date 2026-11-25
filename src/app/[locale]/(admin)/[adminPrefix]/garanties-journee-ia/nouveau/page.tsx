/** Admin — Garantie Journée IA · création d'un dossier (depuis une mission d'audit, ou à la main). */
import type { Metadata } from "next";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminSubmitButton } from "@/components/admin/ui/AdminSubmitButton";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";
import { creerGarantieJourneeIaAction } from "@/server/actions/qualiopi/garanties-journee-ia";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Nouveau dossier de garantie Journée IA | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
  searchParams: Promise<{ erreur?: string; mission?: string }>;
}

export default async function NouvelleGarantiePage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix } = await params;
  const q = await searchParams;
  const acces = await gardePage("ecriture", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }
  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader
        title="Nouveau dossier de garantie"
        description="Avec une mission d'audit, le client, la date, le prix et le devis sont repris de la mission."
      />
      {q.erreur ? (
        <p role="alert" className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm">
          {q.erreur}
        </p>
      ) : null}
      <form action={creerGarantieJourneeIaAction} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Identifiant de la mission d&apos;audit (facultatif)
          <input name="auditMissionId" defaultValue={q.mission ?? ""} className="admin-input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Identifiant du client (obligatoire sans mission)
          <input name="clientId" className="admin-input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Date de la journée
          <input name="dateJournee" type="date" className="admin-input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Prix HT (€)
          <input name="prixHtEuros" inputMode="decimal" className="admin-input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Seuil HT de la garantie (€)
          <input name="seuilHtEuros" inputMode="decimal" required className="admin-input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Notes internes
          <textarea name="notes" rows={3} className="admin-input" />
        </label>
        <AdminSubmitButton>Créer le dossier</AdminSubmitButton>
      </form>
    </AdminPageShell>
  );
}
