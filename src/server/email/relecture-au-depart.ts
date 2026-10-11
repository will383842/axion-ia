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
  GABARITS_SOLLICITATION_FORMATEUR,
  type GabaritFormateurIndependant,
} from "@/lib/email/templates/formateur-independant-textes";
import { decryptPii } from "@/lib/pii-crypto";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { prisma } from "@/lib/prisma";
import { estTexteValide } from "@/server/email/textes-valides";
import { lireTextesValides } from "@/server/email/textes-valides-lecture";
import { lireDrapeauEnvoi } from "@/server/qualiopi/formateurs-independants/interrupteurs";
import { lireEtatsInterrupteurs } from "@/server/qualiopi/formateurs-independants/interrupteurs-etat";

/** Ce que le lecteur reçoit du job. */
export interface JobAuDepart {
  readonly template: string;
  /** L'adresse du destinataire (relue pour l'opposition d'une sollicitation formateur). */
  readonly to?: string | undefined;
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
 * Marque d'effacement posée par `rgpd-erase.ts` (`ERASED_PLACEHOLDER`). Copie LOCALE : ce
 * module est sur le trajet du worker et `rgpd-erase.ts` n'a rien à y faire. L'égalité est
 * vérifiée par `email-worker.formateur-au-depart.spec.ts`.
 */
export const MARQUE_EFFACEMENT = "[erased-rgpd-art17]";

const estEffacee = (adresse: string): boolean =>
  adresse.endsWith("@erased.local") || adresse === MARQUE_EFFACEMENT;

/**
 * La fiche d'un formateur (ou sa candidature) a-t-elle disparu ou été effacée ?
 * Lève si la base ne répond pas : l'appelant RETIENT.
 */
async function ficheFormateurEffacee(entityType: string, id: string): Promise<boolean> {
  if (entityType === "Trainer") {
    const t = await prisma.trainer.findUnique({ where: { id }, select: { email: true } });
    return t === null || estEffacee(t.email);
  }
  const a = await prisma.jobApplication.findUnique({ where: { id }, select: { email: true } });
  if (a === null) return true;
  // Échec fermé : une adresse indéchiffrable est un état invérifiable — on retient.
  const adresse = decryptPii(a.email);
  return typeof adresse !== "string" || estEffacee(adresse);
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
    // L'opposition est déjà relue par le verdict du worker, mais en échec OUVERT (règle
    // historique des apporteurs). Pour une sollicitation formateur, on la relit ici en
    // échec FERMÉ : une table muette retient.
    if (GABARITS_SOLLICITATION_FORMATEUR.has(gabarit)) {
      const empreinte = job.to ? hashEmailForLookup(job.to) : null;
      if (empreinte === null) return "destinataire invérifiable — retenu par prudence";
      const opposition = await prisma.emailOpposition.findUnique({
        where: { emailHash: empreinte },
        select: { id: true },
      });
      if (opposition !== null) return "la personne s'est opposée aux sollicitations";
    }
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

/**
 * Relance du dossier (F9, lot L6) : en plus du filet commun, le dossier doit être ENCORE
 * à compléter et `relances_auto` encore allumé. Un dossier envoyé entre l'enfilage et le
 * départ retient la relance. Échec fermé.
 */
const relireRelanceDossier: LecteurAuDepart = async (job) => {
  const commun = await relireFormateur(job);
  if (commun !== null) return commun;
  try {
    if (!lireDrapeauEnvoi(await lireEtatsInterrupteurs(), "relances_auto")) {
      return "relances automatiques coupées";
    }
    const t = await prisma.trainer.findUnique({
      where: { id: job.entityId! },
      select: { dossierStatut: true },
    });
    if (t?.dossierStatut !== "en_cours" && t?.dossierStatut !== "a_completer") {
      return "le dossier n'est plus à compléter";
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
  // L6 : la relance du dossier remplace le lecteur commun (elle l'appelle d'abord).
  ["formateur-dossier-relance", relireRelanceDossier],
]);
