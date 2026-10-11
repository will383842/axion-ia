/**
 * Le FILET DU DÉPART, par gabarit (lot CAMP-1, 08 §12.3 couche 3).
 *
 * `enqueueEmail` vérifie à l'enfilage, donc l'état de CET instant. Un rappel retardé, ou
 * garé en corbeille, part des heures ou des jours plus tard : une réservation, une
 * opposition, une fin de collaboration arrivées entre-temps ne se lisent qu'ici, juste
 * avant l'envoi. Chaque gabarit relu déclare son LECTEUR : il rend le motif de la retenue,
 * ou `null` si l'envoi peut partir. Un envoi retenu est clos « annulé », jamais « échec ».
 *
 * ⚠️ SUR LE TRAJET DU WORKER D'E-MAILS : base, déchiffrement, règles pures — ni
 * `server-only`, ni Next, ni `queues.ts`. Gardé par
 * `workers/__tests__/email-worker.opposition.graphe-worker.spec.ts`.
 *
 * 🔴 Les lecteurs des formateurs indépendants sont en ÉCHEC FERMÉ : une base muette
 * RETIENT. L'entrée apporteur garde son comportement exact (`motifRetenueRelanceInvitation`
 * inchangée).
 */

import { motifRetenueRelanceInvitation } from "@/features/commercial-application/relance-invitation-etat";
import { GABARIT_RELANCE_INVITATION } from "@/lib/commercial-application/relance-invitation";
import {
  GABARITS_ARGENT_FORMATEUR,
  GABARITS_FORMATEUR_INDEPENDANT,
  type GabaritFormateurIndependant,
} from "@/lib/email/templates/formateur-independant-textes";
import { decryptPii } from "@/lib/pii-crypto";
import { prisma } from "@/lib/prisma";
import { estTexteValide } from "@/server/email/textes-valides";
import { lireTextesValides } from "@/server/email/textes-valides-lecture";
import { lireDrapeauEnvoi } from "@/server/qualiopi/formateurs-independants/interrupteurs";
import { lireEtatsInterrupteurs } from "@/server/qualiopi/formateurs-independants/interrupteurs-etat";

/** Ce que le lecteur reçoit du job. */
export interface JobAuDepart {
  readonly template: string;
  readonly entityType?: string | undefined;
  readonly entityId?: string | undefined;
}

export type LecteurAuDepart = (job: JobAuDepart) => Promise<string | null>;

/** Rappels de l'invitation apporteur (2026-09-27) : comportement d'origine, inchangé. */
const relireRelanceInvitationApporteur: LecteurAuDepart = async (job) => {
  if (job.entityType !== "Submission" || !job.entityId) {
    return "rappel d'invitation sans fiche liée — état invérifiable";
  }
  return motifRetenueRelanceInvitation(job.entityId);
};

/**
 * La fiche d'un formateur (ou sa candidature) a-t-elle disparu ou été effacée ?
 * Lève si la base ne répond pas : l'appelant RETIENT.
 */
async function ficheFormateurEffacee(entityType: string, id: string): Promise<boolean> {
  if (entityType === "Trainer") {
    const t = await prisma.trainer.findUnique({ where: { id }, select: { email: true } });
    return t === null || t.email.endsWith("@erased.local");
  }
  const a = await prisma.jobApplication.findUnique({ where: { id }, select: { email: true } });
  if (a === null) return true;
  let adresse: string | null = null;
  try {
    adresse = decryptPii(a.email);
  } catch {
    adresse = null;
  }
  return typeof adresse === "string" && adresse.endsWith("@erased.local");
}

async function finDeCollaboration(id: string): Promise<boolean> {
  const t = await prisma.trainer.findUnique({
    where: { id },
    select: { finCollaborationAt: true },
  });
  return t?.finCollaborationAt != null;
}

/**
 * Tout e-mail aux formateurs indépendants : le texte doit être encore validé au départ
 * (une validation retirée retient même un e-mail approuvé en corbeille), la fiche doit
 * exister, et une fin de collaboration ne laisse partir que l'argent.
 */
const relireFormateur: LecteurAuDepart = async (job) => {
  const gabarit = job.template as GabaritFormateurIndependant;
  if ((job.entityType !== "Trainer" && job.entityType !== "JobApplication") || !job.entityId) {
    return "e-mail formateur sans fiche liée — état invérifiable";
  }
  try {
    const etats = await lireEtatsInterrupteurs();
    if (!lireDrapeauEnvoi(etats, "textes_valides"))
      return "textes des e-mails formateurs non validés";
    if (!estTexteValide(await lireTextesValides(), gabarit))
      return "texte de cet e-mail non validé";
    if (await ficheFormateurEffacee(job.entityType, job.entityId)) {
      return "la fiche a été supprimée ou effacée (RGPD)";
    }
    if (
      job.entityType === "Trainer" &&
      !GABARITS_ARGENT_FORMATEUR.has(gabarit) &&
      (await finDeCollaboration(job.entityId))
    ) {
      return "fin de collaboration : seuls les e-mails d'argent partent";
    }
    return null;
  } catch {
    return "état illisible au départ — retenu par prudence";
  }
};

/** Le registre : gabarit → lecteur d'état. */
export const RELECTURES_AU_DEPART: ReadonlyMap<string, LecteurAuDepart> = new Map<
  string,
  LecteurAuDepart
>([
  [GABARIT_RELANCE_INVITATION, relireRelanceInvitationApporteur],
  ...GABARITS_FORMATEUR_INDEPENDANT.map((g): [string, LecteurAuDepart] => [g, relireFormateur]),
]);
