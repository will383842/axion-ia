// Création d'une offre d'emploi (admin).

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminPageShell, AdminPageHeader } from "@/components/admin/ui";
import { JobOfferForm } from "../JobOfferForm";
import { lireEtatsEntree } from "@/server/qualiopi/formateurs-independants/interrupteurs-lecture";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

export default async function NewJobOfferPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);
  const { nature_offre: natureLue } = await lireEtatsEntree();

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Nouvelle offre d'emploi"
        description="Créer une offre publiée dynamiquement sur /carrieres."
        actions={
          <Link href={`/fr/${adminPrefix}/offres-emploi`} className="admin-button-ghost">
            ← Retour à la liste
          </Link>
        }
      />
      <JobOfferForm natureLue={natureLue} />
    </AdminPageShell>
  );
}
