/**
 * Espace formateur — détail d'une séance 1-to-1 (2026-06-13).
 * Les 5 formulaires AFEST. Garde de propriété : `getSessionForFormateur`
 * retourne null si la séance n'appartient pas au formateur → 404.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { requireFormateur } from "@/server/formateur/guard";
import { getSessionForFormateur } from "@/server/formateur/queries";
import { SeanceEditor } from "@/components/espace-formateur/SeanceEditor";
import { coachingInterventionLabel } from "@/server/formateur/coaching-options";
import { FORMATEUR_BASE_PATH } from "@/server/formateur/routes";

// Sérialise les types Prisma non transférables au client (Decimal, Date).
function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function SeancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { trainerId } = await requireFormateur();
  const { id } = await params;
  const s = await getSessionForFormateur(id, trainerId);
  if (!s) notFound();

  const data = {
    id: s.id,
    interventionSlug: s.interventionSlug,
    statut: s.statut,
    dateSeance: toDateInput(s.dateSeance),
    beneficiaireNom: s.beneficiaireNom,
    beneficiaireEntreprise: s.beneficiaireEntreprise,
    cartographie: s.cartographie
      ? {
          taches: (s.cartographie.taches as unknown[]) ?? [],
          chronophages: s.cartographie.chronophages,
          irritants: s.cartographie.irritants,
          donneesSensibles: s.cartographie.donneesSensibles,
          contraintes: s.cartographie.contraintes,
        }
      : null,
    optimisations: s.optimisations.map((o) => ({
      id: o.id,
      type: o.type,
      titre: o.titre,
      situationActuelle: o.situationActuelle,
      piste: o.piste,
      gainTempsMinParOcc: o.gainTempsMinParOcc,
      occurrencesSemaine: o.occurrencesSemaine,
      gainEuroOuRisque: o.gainEuroOuRisque,
      facilite: o.facilite,
      priorite: o.priorite,
      retenue: o.retenue,
    })),
    plan: s.plan
      ? {
          objectifs: s.plan.objectifs,
          optimisationsRetenues: (s.plan.optimisationsRetenues as unknown[]) ?? [],
          prochainesEtapes: (s.plan.prochainesEtapes as unknown[]) ?? [],
          pointsVigilance: s.plan.pointsVigilance,
          gainTempsHSemaine: toNum(s.plan.gainTempsHSemaine),
          suiviPropose: s.plan.suiviPropose,
        }
      : null,
    comptesRendus: s.comptesRendus.map((c) => ({
      id: c.id,
      dateSeance: toDateInput(c.dateSeance),
      dureeMinutes: c.dureeMinutes,
      objectifs: c.objectifs,
      misesEnSituation: (c.misesEnSituation as unknown[]) ?? [],
      phasesReflexives: (c.phasesReflexives as unknown[]) ?? [],
      planRemis: c.planRemis,
      suite: c.suite,
      notesConfidentielles: c.notesConfidentielles,
    })),
    journaux: s.journaux.map((j) => ({
      id: j.id,
      periode: j.periode,
      acquisitions: j.acquisitions,
      blocages: j.blocages,
      prochainsFocus: j.prochainsFocus,
      gainTempsCumuleHSem: toNum(j.gainTempsCumuleHSem),
      engagement: j.engagement,
    })),
  };

  return (
    <div className="space-y-5">
      <div>
        <Link href={FORMATEUR_BASE_PATH} className="text-terracotta text-xs hover:underline">
          ← Mes séances
        </Link>
        <h1 className="text-mocha mt-1 font-serif text-2xl font-semibold">
          {coachingInterventionLabel(s.interventionSlug)}
        </h1>
        <p className="text-fg-muted text-sm">
          {s.beneficiaireNom ?? "Bénéficiaire non renseigné"}
          {s.beneficiaireEntreprise ? ` · ${s.beneficiaireEntreprise}` : ""}
        </p>
      </div>
      <SeanceEditor session={data} />
    </div>
  );
}
