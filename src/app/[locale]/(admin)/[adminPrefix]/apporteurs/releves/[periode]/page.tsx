// Relevé mensuel : vérification d'une période avant tout envoi (lot 3e). LECTURE SEULE.
// Tableau par apporteur, anomalies bloquantes, aperçu du PDF STOCKÉ. Aucun bouton d'action.

import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminCard, AdminPageHeader } from "@/components/admin/ui";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { BandeauAnomalies } from "@/components/admin/apporteurs/releves/BandeauAnomalies";
import { moisLisible } from "@/components/admin/apporteurs/releves/format";
import { TableauReleves } from "@/components/admin/apporteurs/releves/TableauReleves";
import { periodeValide } from "@/features/apporteurs-reseau/releve-mensuel/periode";
import {
  anomaliesDePeriode,
  lireVuePeriode,
} from "@/features/apporteurs-reseau/releve-mensuel/statistiques";
import { gardePage } from "@/server/auth/garde-page";
import { peutEngager, peutOuvrirDossierApporteur } from "@/server/auth/habilitations";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string; periode: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function VerificationRelevesPage({ params }: PageProps) {
  const { adminPrefix, periode } = await params;
  const acces = await gardePage("consultation", `/fr/${adminPrefix}/login`);
  if (!acces.autorise) return <AccesRefuse motif={acces.motif} retourHref={`/fr/${adminPrefix}`} />;
  if (!periodeValide(periode)) notFound();
  const base = `/fr/${adminPrefix}`;
  // Un compte de consultation (`reader`) ne lit pas l'identité des apporteurs ; le PDF est une
  // pièce financière : droit de facturation.
  const voitIdentite = peutOuvrirDossierApporteur(acces.role);
  const peutVoirPdf = peutEngager(acces.role, "facturer");
  const vue = await lireVuePeriode(periode, voitIdentite);
  const anomalies = anomaliesDePeriode(vue);

  return (
    <div className="flex flex-col gap-[var(--space-admin-5)]">
      <AdminPageHeader
        title={`Relevés de ${moisLisible(periode)}`}
        description="Vérification avant envoi. Lecture seule : le PDF affiché est celui qui sera envoyé."
        actions={
          <Link href={`${base}/apporteurs/releves`} className="underline">
            Toutes les périodes
          </Link>
        }
      />
      <BandeauAnomalies anomalies={anomalies} />
      <AdminCard as="section">
        <TableauReleves
          base={base}
          periode={periode}
          releves={vue.releves}
          peutVoirPdf={peutVoirPdf}
        />
      </AdminCard>
    </div>
  );
}
