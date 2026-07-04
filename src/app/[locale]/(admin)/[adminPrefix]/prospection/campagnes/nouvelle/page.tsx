import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { WizardForm } from "./WizardForm";

export const dynamic = "force-dynamic";

export default async function NouvelleCampagnePage({
  params,
}: {
  params: Promise<{ adminPrefix: string }>;
}) {
  const { adminPrefix } = await params;
  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Nouvelle campagne"
        description="Département × secteur/NAF × taille. Un ciblage vide (aucun secteur ni NAF) est refusé."
      />
      <WizardForm base={`/fr/${adminPrefix}/prospection/campagnes`} />
    </AdminPageShell>
  );
}
