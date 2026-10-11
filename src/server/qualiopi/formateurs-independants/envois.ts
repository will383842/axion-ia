/**
 * Formateurs indépendants — TOUS les e-mails partent d'ici (lot L-ENV).
 *
 * Adaptateur du module d'envoi commun (`server/email/envoi-monde.ts`, FAC-1) : il garde
 * SON appel à `enqueueEmail` et la liste LITTÉRALE de ses gabarits (le catalogue retrouve
 * l'émetteur d'un gabarit à son nom écrit dans le fichier qui enfile).
 *
 * 🔴 Avant TOUT enfilage, quel que soit l'appelant (console, cron, worker) :
 *   1. le texte doit être validé par Will — interrupteur `textes_valides` allumé ET
 *      gabarit inscrit au registre « texte validé ». Sinon : `texte-non-valide`, rien
 *      n'est enfilé, rien n'est garé ;
 *   2. après une fin de collaboration, seuls les e-mails d'argent partent
 *      (`GABARITS_ARGENT_FORMATEUR`) ;
 *   3. le lien « Ouvrir mon espace » est toujours RECALCULÉ, jamais repris du payload.
 *      Tant que l'espace formateur n'existe pas (lot L5), il n'y en a aucun.
 *
 * `apercu()` rend l'e-mail exact sans rien envoyer : la console le montre avant tout
 * envoi décidé par Will, même texte non validé.
 */

import type { GabaritFormateurIndependant } from "@/lib/email/templates/formateur-independant-textes";
import { remplir, varianteDe } from "@/lib/email/templates/_formateur-independant";
import {
  CROCHET_NON_REMPLI,
  GABARITS_ARGENT_FORMATEUR,
  TEXTES_FORMATEUR,
} from "@/lib/email/templates/formateur-independant-textes";
import { assemblerParagraphes } from "@/lib/email/texte-par-defaut";
import { prisma } from "@/lib/prisma";
import {
  apercuGabarit,
  avecLienEspaceRecalcule,
  jobIdSansDeuxPoints,
  resultatDeLEnfilage,
  retirerEnvoiEchoue,
  type ApercuRendu,
  type ResultatEnvoi,
} from "@/server/email/envoi-monde";
import { estTexteValide } from "@/server/email/textes-valides";
import { lireTextesValides } from "@/server/email/textes-valides-lecture";
import { enqueueEmail } from "@/server/queue/queues";

import { lireDrapeauEnvoi } from "./interrupteurs";
import { lireEtatsInterrupteurs } from "./interrupteurs-etat";

export type GabaritFormateur = GabaritFormateurIndependant;

export const GABARITS_FORMATEUR: readonly GabaritFormateur[] = [
  "formateur-invitation-echange",
  "formateur-invitation-relance",
  "formateur-invitation-rattrapage",
  "formateur-echange-confirme",
  "formateur-echange-rappel",
  "formateur-issue-retenu",
  "formateur-issue-non-retenu",
  "formateur-issue-absent",
  "formateur-dossier-lien",
  "formateur-dossier-relance",
  "formateur-dossier-recu",
  "formateur-dossier-a-verifier",
  "formateur-dossier-a-completer",
  "formateur-dossier-refuse",
  "formateur-lien-espace",
  "formateur-statut-non-ouvert",
  "formateur-contrat-a-signer",
  "formateur-code-signature",
  "formateur-contrat-relance",
  "formateur-espace-ouvert",
  "formateur-nda-a-transmettre",
  "formateur-presentation-methode",
  "formateur-contrat-nouvelle-version",
  "formateur-proposition-close",
  "formateur-accord-enregistre",
  "formateur-lettre-a-signer",
  "formateur-lettre-relance",
  "formateur-lettre-copie-signature",
  "formateur-lettre-rectifiee",
  "formateur-mission-retiree",
  "formateur-formation-annulee",
  "formateur-mission-en-attente",
  "formateur-feuilles-manquantes",
  "formateur-desistement-recu",
  "formateur-releve-connexion",
  "formateur-virement-fait",
  "formateur-virement-en-attente",
  "formateur-facture-rectifiee",
  "formateur-trop-percu",
  "formateur-facture-deposee",
  "formateur-desaccord-recu",
  "formateur-desaccord-non-retenu",
  "formateur-vigilance",
  "formateur-piece-a-renouveler",
  "formateur-piece-deposee",
  "formateur-iban-changement",
  "formateur-iban-valide",
  "formateur-fin-autofacturation",
  "formateur-fin-collaboration",
  "formateur-avertissement",
  "formateur-dossier-a-jour",
];

/** Après une fin de collaboration, seuls ceux-ci partent encore (même nom que chez les apporteurs). */
export { GABARITS_ARGENT_FORMATEUR };

export type ResultatEnvoiFormateur =
  | ResultatEnvoi
  | "texte-non-valide"
  | "fin-de-collaboration"
  /** Un [crochet] du texte n'a pas reçu sa valeur : rien n'est enfilé. */
  | "valeurs-manquantes";

/**
 * Le texte qui partirait contient-il un [crochet] non rempli ? Le texte réécrit par Will
 * remplace le corps ; l'objet, lui, vient toujours du gabarit.
 */
export function valeursManquantes(
  gabarit: GabaritFormateur,
  payload: Record<string, unknown>,
): boolean {
  const v = varianteDe(gabarit, payload);
  const libre = typeof payload.texteLibre === "string" && payload.texteLibre.trim() !== "";
  const textes = [v.objet, ...(libre ? [payload.texteLibre as string] : v.paragraphes)];
  return textes.some((t) => CROCHET_NON_REMPLI.test(remplir(t, payload)));
}

export interface EnvoiFormateur {
  gabarit: GabaritFormateur;
  destinataire: string;
  payload: Record<string, unknown>;
  /** Traçabilité (EmailLog) : la fiche formateur, ou la candidature avant elle. */
  entityType: "Trainer" | "JobApplication";
  entityId: string;
  /** Clé d'idempotence : un même envoi n'est jamais doublé. */
  jobId?: string;
  attachments?: Array<{ filename: string; r2Key: string; contentType?: string }>;
  /** Relances : `priority: 10` (le code de signature et le lien de connexion n'en ont pas). */
  priority?: number;
  /**
   * Jamais garé en corbeille de validation — réservé aux e-mails qui expirent (le code de
   * signature) : le texte, lui, reste exigé validé.
   */
  sansValidation?: boolean;
}

/** Le texte principal par défaut (pré-remplit « Modifier le texte »). */
export function texteParDefautFormateur(
  gabarit: string,
  payload: Record<string, unknown>,
): string | null {
  if (!Object.prototype.hasOwnProperty.call(TEXTES_FORMATEUR, gabarit)) return null;
  const vs = TEXTES_FORMATEUR[gabarit as GabaritFormateur].variantes;
  const e = typeof payload.etape === "number" && payload.etape >= 1 ? payload.etape - 1 : 0;
  return assemblerParagraphes((vs[e] ?? vs[0]).paragraphes);
}

export function apercu(
  e: Pick<EnvoiFormateur, "gabarit" | "destinataire" | "payload">,
): Promise<ApercuRendu<GabaritFormateur>> {
  return apercuGabarit(e, texteParDefautFormateur);
}

/** Le texte de ce gabarit peut-il partir ? Lecture en échec : non. */
export async function texteValide(gabarit: GabaritFormateur): Promise<boolean> {
  const etats = await lireEtatsInterrupteurs();
  if (!lireDrapeauEnvoi(etats, "textes_valides")) return false;
  return estTexteValide(await lireTextesValides(), gabarit);
}

/** La collaboration est-elle finie ? `null` : on ne sait pas (base injoignable). */
async function finDeCollaboration(trainerId: string): Promise<boolean | null> {
  try {
    const t = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: { finCollaborationAt: true },
    });
    return t?.finCollaborationAt != null;
  } catch {
    return null;
  }
}

/** Le lien de l'espace : aucun tant que l'espace formateur n'existe pas (lot L5). */
async function lienEspace(_e: EnvoiFormateur): Promise<string | null> {
  return null;
}

export async function envoyer(e: EnvoiFormateur): Promise<ResultatEnvoiFormateur> {
  try {
    if (!(await texteValide(e.gabarit))) return "texte-non-valide";
    if (valeursManquantes(e.gabarit, e.payload)) return "valeurs-manquantes";
    if (e.entityType === "Trainer" && !GABARITS_ARGENT_FORMATEUR.has(e.gabarit)) {
      const fin = await finDeCollaboration(e.entityId);
      if (fin === null) return "indisponible";
      if (fin) return "fin-de-collaboration";
    }
    const jobId = jobIdSansDeuxPoints(e.jobId);
    if (jobId) await retirerEnvoiEchoue(jobId);
    const payload = await avecLienEspaceRecalcule(e.payload, () => lienEspace(e));
    const r = await enqueueEmail(e.gabarit, e.destinataire, "fr", payload, {
      entityType: e.entityType,
      entityId: e.entityId,
      ...(jobId ? { jobId } : {}),
      ...(e.attachments ? { attachments: e.attachments } : {}),
      ...(e.priority !== undefined ? { priority: e.priority } : {}),
      ...(e.sansValidation ? { bypassValidation: true } : {}),
    });
    return resultatDeLEnfilage(r);
  } catch {
    return "indisponible";
  }
}
