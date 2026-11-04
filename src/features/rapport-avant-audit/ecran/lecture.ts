/**
 * Écran « Rapport d'analyse » — les LECTURES du bloc de la fiche client (serveur, lecture seule).
 *
 * Assemble ce que le composant affiche : le rappel, l'état du bouton, l'historique, la liste
 * « Compléter la fiche » du dernier rapport lisible. Toute la décision est dans `logique.ts` ;
 * ici, on ne fait que lire (réponses reçues, rapports via `AccesRapports`, champs de la fiche).
 */

import { prisma } from "@/lib/prisma";
import {
  fichesCouvertes,
  questionnairesDesFiches,
} from "@/features/questionnaire-preaudit/de-la-fiche";

import type { AccesRapports, ResumeRapport } from "./contrat";
import {
  CHAMPS_FICHE,
  dernierRapportLisible,
  estSuperAdmin,
  etatBoutonLancer,
  listerPropositions,
  rappelReponses,
  type EtatBouton,
  type FicheActuelle,
  type LigneProposition,
  type Rappel,
} from "./logique";

/** La date de réception de chaque réponse au questionnaire de la fiche (mises à l'écart exclues). */
export async function datesDesReponses(clientId: string): Promise<Date[]> {
  const envois = await prisma.questionnaireAvantAuditEnvoi.findMany({
    where: {
      ecarteLe: null,
      questionnaire: questionnairesDesFiches(await fichesCouvertes(clientId)),
    },
    select: { recuLe: true },
  });
  return envois.map((e) => e.recuLe);
}

const SELECTION_FICHE = {
  siren: true,
  ...Object.fromEntries(CHAMPS_FICHE.map((c) => [c, true])),
} as Readonly<Record<string, true>>;

/** Les champs que « Compléter la fiche » peut remplir, lus maintenant ; `null` si la fiche n'existe pas. */
export async function lireFicheActuelle(clientId: string): Promise<FicheActuelle | null> {
  const c = (await prisma.client.findUnique({
    where: { id: clientId },
    select: SELECTION_FICHE,
  })) as Record<string, string | null> | null;
  if (c === null) return null;
  const fiche: Record<string, string | null> = { siren: c["siren"] ?? null };
  for (const champ of CHAMPS_FICHE) fiche[champ] = c[champ] ?? null;
  return fiche as FicheActuelle;
}

export interface EcranRapport {
  readonly superAdmin: boolean;
  readonly rappel: Rappel;
  readonly bouton: EtatBouton;
  /** Le plus récent d'abord. */
  readonly rapports: ReadonlyArray<ResumeRapport>;
  /** Le rapport dont on propose les téléchargements et la liste « Compléter la fiche ». */
  readonly courant: ResumeRapport | null;
  readonly propositions: ReadonlyArray<LigneProposition>;
}

export async function lireEcranRapport(e: {
  readonly clientId: string;
  readonly role: string | null | undefined;
  readonly interrupteurAllume: boolean;
  readonly acces: AccesRapports;
}): Promise<EcranRapport> {
  const superAdmin = estSuperAdmin(e.role);
  const [dates, rapports] = await Promise.all([
    datesDesReponses(e.clientId),
    e.acces.listerRapports(e.clientId),
  ]);
  const courant = dernierRapportLisible(rapports);
  // Les propositions ne se lisent que pour qui peut les appliquer.
  let propositions: ReadonlyArray<LigneProposition> = [];
  if (superAdmin && courant !== null) {
    const [brutes, fiche] = await Promise.all([
      e.acces.lirePropositions(e.clientId, courant.id),
      lireFicheActuelle(e.clientId),
    ]);
    if (fiche !== null) propositions = listerPropositions(brutes, fiche);
  }
  return {
    superAdmin,
    rappel: rappelReponses(dates, rapports),
    bouton: etatBoutonLancer({
      role: e.role,
      interrupteurAllume: e.interrupteurAllume,
      branche: e.acces.branche,
      nbReponses: dates.length,
      rapports,
    }),
    rapports,
    courant,
    propositions,
  };
}
