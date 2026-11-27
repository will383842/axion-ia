// Relevé mensuel des apporteurs (lot 3e) : statistiques et liste des périodes. LECTURE SEULE.
// Ni préparation, ni envoi : ces actions viennent dans des lots à part.

import { AdminCard, AdminPageHeader } from "@/components/admin/ui";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { CartesReleves } from "@/components/admin/apporteurs/releves/CartesReleves";
import { ListePeriodes } from "@/components/admin/apporteurs/releves/ListePeriodes";
import { SerieDouzeMois } from "@/components/admin/apporteurs/releves/SerieDouzeMois";
import { lireVueStatistiques } from "@/features/apporteurs-reseau/releve-mensuel/statistiques";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

export default async function RelevesApporteursPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const acces = await gardePage("consultation", `/fr/${adminPrefix}/login`);
  if (!acces.autorise) return <AccesRefuse motif={acces.motif} retourHref={`/fr/${adminPrefix}`} />;
  const base = `/fr/${adminPrefix}`;
  const vue = await lireVueStatistiques();

  return (
    <div className="flex flex-col gap-[var(--space-admin-5)]">
      <AdminPageHeader
        title="Relevés mensuels des apporteurs"
        description="Un relevé d'information par apporteur et par mois (ce n'est pas une facture). Écran de lecture : aucun envoi n'est possible ici."
      />
      <CartesReleves cartes={vue.cartes} />
      <AdminCard as="section">
        <h2 className="mb-[var(--space-admin-3)] font-semibold">Évolution sur 12 mois</h2>
        <SerieDouzeMois points={vue.serie} />
      </AdminCard>
      <AdminCard as="section">
        <h2 className="mb-[var(--space-admin-3)] font-semibold">Périodes</h2>
        <ListePeriodes base={base} periodes={vue.periodes} />
      </AdminCard>
    </div>
  );
}
