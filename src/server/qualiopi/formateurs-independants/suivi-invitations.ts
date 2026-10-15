/**
 * Lot 5 — ce que la console dit de l'invitation d'une candidature de formateur
 * indépendant, au-delà de la phrase pure de `invitation-formateur-resume.ts` :
 *
 *   · V1-A-2 : POURQUOI une candidature n'est pas invitée (opposition, entreprise fermée,
 *     registre muet…). Le motif est CALCULÉ à l'affichage, avec les mêmes faits que le
 *     balayage : aucune colonne ne le porte (`IssueInvitationFormateur` ne dit que
 *     l'issue d'une invitation PARTIE), et le schéma n'est pas touché ;
 *   · V1-A-4 : la liste des personnes invitées qui n'ont ni réservé ni répondu après J+14
 *     (le silence de la campagne S1), pour la tuile « à décider » du suivi.
 *
 * Lecture seule : aucun e-mail, aucune écriture.
 */

import {
  SEUIL_A_DECIDER_MS,
  resumeInvitationFormateur,
} from "@/lib/careers/invitation-formateur-resume";
import { prisma } from "@/lib/prisma";

import {
  motifRegistreSiret,
  type ControleSiretCandidature,
  controleSiretParDefaut,
} from "./controle-siret-candidature";
import {
  SELECT_CANDIDATURE_INVITATION,
  lireFaitsInvitation,
  motifNePasInviter,
  type CandidatureInvitation,
  type FaitsInvitation,
} from "./invitation-formateurs-faits";

const JOUR_MS = 24 * 60 * 60 * 1000;
/** Au-delà, la candidature est close « sans suite » (J+30) : elle ne se décide plus. */
const FENETRE_A_DECIDER_MS = 60 * JOUR_MS;

function origine(c: CandidatureInvitation): Date | null {
  return c.invitationFormateurAt ?? c.rattrapageAt;
}

/** Invitée depuis plus de 14 jours, et rien ne s'est passé : à Will de décider. */
function aDecider(c: CandidatureInvitation, f: FaitsInvitation, maintenant: Date): boolean {
  const depuis = origine(c);
  if (depuis === null || c.clotureSansSuiteAt !== null) return false;
  if (maintenant.getTime() - depuis.getTime() < SEUIL_A_DECIDER_MS) return false;
  return !f.reserve && !f.reponseHumaine && !f.ficheOuverte && !f.decidee;
}

export interface InvitationADecider {
  readonly candidatureId: string;
  readonly invitee: Date;
}

/** Les personnes invitées sans réservation ni réponse après J+14, de la plus ancienne. */
export async function listerInvitationsADecider(maintenant: Date): Promise<InvitationADecider[]> {
  const candidatures = (await prisma.jobApplication.findMany({
    where: {
      OR: [
        {
          invitationFormateurAt: {
            gte: new Date(maintenant.getTime() - FENETRE_A_DECIDER_MS),
            lte: new Date(maintenant.getTime() - SEUIL_A_DECIDER_MS),
          },
        },
        {
          rattrapageAt: {
            gte: new Date(maintenant.getTime() - FENETRE_A_DECIDER_MS),
            lte: new Date(maintenant.getTime() - SEUIL_A_DECIDER_MS),
          },
        },
      ],
      clotureSansSuiteAt: null,
      status: "new",
    },
    orderBy: { submittedAt: "asc" },
    take: 200,
    select: SELECT_CANDIDATURE_INVITATION,
  })) as CandidatureInvitation[];
  if (candidatures.length === 0) return [];
  const faits = await lireFaitsInvitation(candidatures, origine);
  const vues = new Set<string>();
  const sortie: InvitationADecider[] = [];
  for (const c of candidatures) {
    const f = faits.get(c.id);
    const depuis = origine(c);
    // Une ligne par personne : ses autres candidatures disent la même chose.
    if (!f || depuis === null || vues.has(f.personneId) || !aDecider(c, f, maintenant)) continue;
    vues.add(f.personneId);
    sortie.push({ candidatureId: c.id, invitee: depuis });
  }
  return sortie;
}

/**
 * Pourquoi cette candidature n'est pas (encore) invitée, ou `null`. Les mêmes faits que le
 * balayage ; le registre n'est interrogé que si rien d'autre ne retient déjà la candidature.
 * Ne lève pas : un état illisible n'affiche aucun motif.
 */
export async function motifAttenteInvitation(
  candidatureId: string,
  controleSiret: ControleSiretCandidature = controleSiretParDefaut,
): Promise<string | null> {
  try {
    const c = (await prisma.jobApplication.findUnique({
      where: { id: candidatureId },
      select: SELECT_CANDIDATURE_INVITATION,
    })) as CandidatureInvitation | null;
    if (!c || origine(c) !== null || c.clotureSansSuiteAt !== null) return null;
    const f = (await lireFaitsInvitation([c], () => null)).get(c.id);
    if (!f) return null;
    return motifNePasInviter(f) ?? (await motifRegistreSiret(f.siret, controleSiret));
  } catch {
    return null;
  }
}

/** La phrase de la fiche : l'invitation, son motif d'attente, ou le « à décider ». */
export async function resumeInvitationDeLaFiche(
  candidatureId: string,
  maintenant: Date = new Date(),
  controleSiret: ControleSiretCandidature = controleSiretParDefaut,
): Promise<string> {
  const c = (await prisma.jobApplication.findUnique({
    where: { id: candidatureId },
    select: SELECT_CANDIDATURE_INVITATION,
  })) as CandidatureInvitation | null;
  if (!c) return "Pas encore invitée.";
  if (origine(c) === null) {
    return resumeInvitationFormateur(c, maintenant, {
      motifAttente: await motifAttenteInvitation(candidatureId, controleSiret),
    });
  }
  let decider = false;
  try {
    const f = (await lireFaitsInvitation([c], origine)).get(c.id);
    decider = f !== undefined && aDecider(c, f, maintenant);
  } catch {
    decider = false;
  }
  return resumeInvitationFormateur(c, maintenant, { aDecider: decider });
}
