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
 *
 * Vérification n° 2 (V2-P-1 à V2-P-4, V2-P-7) : chaque RELANCE de campagne aux formateurs
 * (F9, F18, F45, F27, F21, F61) est relue avec les règles du passage qui l'a décidée —
 * ses interrupteurs (mère et filles), son objet (contrat signé, lettre signée, numéro
 * transmis, bilan remis), la réponse du formateur depuis l'envoi de départ, l'opposition.
 * Le code F17 l'est sur son échéance.
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
import { CLE_CODE_SIGNATURE } from "@/server/email/code-en-file";
import { CLE_DEPART_RELANCE, reponsesFormateurs } from "@/server/relances/reponses-formateurs";
import {
  rendreLienPrecedent,
  ligneDuLien,
} from "@/server/qualiopi/documents/signature/lien-precedent";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { prisma } from "@/lib/prisma";
import { VARIANTES_VALIDEES_A_PART } from "@/server/email/textes-formateurs-a-valider";
import { estTexteValide } from "@/server/email/textes-valides";
import { lireTextesValides } from "@/server/email/textes-valides-lecture";
import { interrupteurAllume } from "@/server/qualiopi/formateurs-independants/interrupteur-allume";
import {
  lireDrapeauEnvoi,
  type CleEnvoi,
} from "@/server/qualiopi/formateurs-independants/interrupteurs";
import { ndaEstEnCours } from "@/server/qualiopi/formateurs-independants/nda-en-cours";
import { lireEtatsInterrupteurs } from "@/server/qualiopi/formateurs-independants/interrupteurs-etat";

/** Ce que le lecteur reçoit du job. */
export interface JobAuDepart {
  readonly template: string;
  /** L'adresse du destinataire (relue pour l'opposition d'une sollicitation formateur). */
  readonly to?: string | undefined;
  readonly entityType?: string | undefined;
  readonly entityId?: string | undefined;
  /** Le payload du job (relances de pièces : `origineRelance`, jamais une adresse). */
  readonly payload?: unknown;
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
 * La VARIANTE validée à part que porte ce job, s'il en porte une — la même lecture que
 * l'enfilage (`varianteAValider`, `envois.ts`) : l'étape du payload.
 */
function varianteDuJob(gabarit: GabaritFormateurIndependant, payload: unknown): string | undefined {
  const etape =
    payload !== null && typeof payload === "object"
      ? (payload as Record<string, unknown>).etape
      : undefined;
  return typeof etape === "number" ? VARIANTES_VALIDEES_A_PART[gabarit]?.[etape] : undefined;
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
    const registre = await lireTextesValides();
    if (!estTexteValide(registre, gabarit)) return "texte de cet e-mail non validé";
    // V1-D-3 : la variante aussi, comme à l'enfilage — une variante changée depuis sa
    // validation ne part pas, même déjà en file.
    const variante = varianteDuJob(gabarit, job.payload);
    if (variante !== undefined && !estTexteValide(registre, gabarit, variante)) {
      return "variante de cet e-mail non validée";
    }
    // L'opposition est déjà relue par le verdict du worker, mais en échec OUVERT (règle
    // historique des apporteurs). Pour une sollicitation formateur, on la relit ici en
    // échec FERMÉ : une table muette retient.
    // V2-P-4 : une RELANCE de campagne aussi — le moteur des campagnes ne la décide pas
    // pour une personne opposée (`decisionCampagne`, motif `opposition`), le départ suit la
    // même règle. L'envoi de départ d'une obligation (F16, F26…) n'est pas concerné.
    const relance = estRelanceDeCampagne(gabarit, job.payload);
    if (GABARITS_SOLLICITATION_FORMATEUR.has(gabarit) || relance) {
      const empreinte = job.to ? hashEmailForLookup(job.to) : null;
      if (empreinte === null) return "destinataire invérifiable — retenu par prudence";
      const opposition = await prisma.emailOpposition.findUnique({
        where: { emailHash: empreinte },
        select: { id: true },
      });
      if (opposition !== null) {
        return relance
          ? "la personne s'est opposée aux relances"
          : "la personne s'est opposée aux sollicitations";
      }
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
 * Relances des pièces à renouveler (F40, F41 — lot L13b) : le filet commun des
 * formateurs, PUIS la campagne relue pour CETTE fiche et CETTE pièce (population stricte,
 * pièce toujours à renouveler, dépôt, opposition — classe B —, rebond, interrupteurs).
 * Import paresseux : `pieces-relances.ts` importe ce module (marque d'effacement).
 */
const GABARITS_RELANCE_PIECE: ReadonlySet<string> = new Set([
  "formateur-vigilance",
  "formateur-piece-a-renouveler",
]);

const relireRelancePiece: LecteurAuDepart = async (job) => {
  const commun = await relireFormateur(job);
  if (commun !== null) return commun;
  try {
    const { motifRetenueRelancePiece } =
      await import("@/server/qualiopi/formateurs-independants/pieces-relances");
    return await motifRetenueRelancePiece(
      job.template,
      job.entityType,
      job.entityId,
      job.payload,
      async (cles) => {
        const etats = await lireEtatsInterrupteurs();
        return cles.every((cle) => lireDrapeauEnvoi(etats, cle));
      },
    );
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
    const etats = await lireEtatsInterrupteurs();
    // La clé mère d'abord : dossier coupé = le lien mènerait à la page neutre.
    if (!lireDrapeauEnvoi(etats, "dossier_en_ligne")) return "dossier en ligne coupé";
    if (!lireDrapeauEnvoi(etats, "relances_auto")) return "relances automatiques coupées";
    const t = await prisma.trainer.findUnique({
      where: { id: job.entityId! },
      select: { dossierStatut: true },
    });
    if (t?.dossierStatut !== "en_cours" && t?.dossierStatut !== "a_completer") {
      return "le dossier n'est plus à compléter";
    }
    return await motifReponseFormateur(job);
  } catch {
    return "état illisible au départ — retenu par prudence";
  }
};

const GABARITS_INVITATION_FORMATEUR = [
  "formateur-invitation-echange",
  "formateur-invitation-relance",
  "formateur-invitation-rattrapage",
] as const;

/** Les règles communes d'abord, puis l'état de la candidature. Échec fermé. */
const relireInvitationFormateur: LecteurAuDepart = async (job) => {
  const commun = await relireFormateur(job);
  if (commun !== null) return commun;
  if (job.entityType !== "JobApplication" || !job.entityId) {
    return "invitation formateur sans candidature liée — état invérifiable";
  }
  try {
    // Couper l'invitation (ou le suivi) retient aussi ce qui est déjà en file ou garé.
    const { lireEtatsEntree } =
      await import("@/server/qualiopi/formateurs-independants/etats-entree");
    const etats = await lireEtatsInterrupteurs();
    if (!lireDrapeauEnvoi(etats, "invitation_auto") || !(await lireEtatsEntree()).suivi_echange) {
      return "invitation automatique ou suivi de l'échange coupé";
    }
    const { motifRetenueInvitationFormateur } =
      await import("@/server/qualiopi/formateurs-independants/invitation-formateurs-faits");
    return await motifRetenueInvitationFormateur(job.entityId, job.template);
  } catch {
    return "état illisible au départ — retenu par prudence";
  }
};

/**
 * L'invitation F1 a DEUX origines, sous le même gabarit :
 * - le balayage automatique (L-INV), jugé par `relireInvitationFormateur` ;
 * - l'invitation posée À LA MAIN par « Ajouter un candidat formateur » (L0c-3), qui ne
 *   dépend que de la relecture commune — son comportement d'avant L-INV, à l'identique,
 *   quels que soient les interrupteurs de l'invitation automatique.
 *
 * L'origine se lit EN BASE, sur la candidature : `origine = console` n'est écrit que par
 * l'action de la console (le formulaire public prend le défaut `formulaire`), et le
 * balayage n'invite jamais une candidature `console`. Ni la clé d'idempotence (perdue
 * quand l'e-mail sort de la corbeille de validation), ni un champ du payload ne
 * décident. Tout ce qui n'est pas prouvé `console` passe par le lecteur strict ; une base
 * muette retient.
 */
const relireInvitationEchange: LecteurAuDepart = async (job) => {
  if (job.entityType === "JobApplication" && job.entityId) {
    let origine: string | null | undefined;
    try {
      const a = await prisma.jobApplication.findUnique({
        where: { id: job.entityId },
        select: { origine: true },
      });
      origine = a?.origine;
    } catch {
      return "état illisible au départ — retenu par prudence";
    }
    if (origine === "console") return relireFormateur(job);
  }
  return relireInvitationFormateur(job);
};

// ─────────────────────────────────────────────────────────────────────────────
// Vérification n° 2 — les relances de campagne aux formateurs, relues au départ
// ─────────────────────────────────────────────────────────────────────────────

const F18 = "formateur-contrat-relance";
const F45 = "formateur-contrat-nouvelle-version";
const F27 = "formateur-lettre-relance";
const F21 = "formateur-nda-a-transmettre";
const F61 = "formateur-bilan-fin-formation";
const F9 = "formateur-dossier-relance";
const F17 = "formateur-code-signature";

/**
 * Les gabarits qui ne partent QUE comme relance d'une campagne du registre. F45 en est une
 * à partir de sa variante 2 (la variante 1 est l'envoi de départ de la nouvelle version,
 * posé par la console). Les relances de pièces (F40, F41) ont leur propre lecteur, qui lit
 * déjà l'opposition. Cohérence avec le registre : `relecture-au-depart.relances.spec.ts`.
 */
export const GABARITS_RELANCE_DE_CAMPAGNE: ReadonlySet<string> = new Set([F9, F18, F27, F21, F61]);

const etapeDuPayload = (payload: unknown): number | undefined => {
  const e =
    payload !== null && typeof payload === "object"
      ? (payload as Record<string, unknown>).etape
      : undefined;
  return typeof e === "number" ? e : undefined;
};

/** Ce job est-il une relance de campagne (et non l'envoi de départ d'une obligation) ? */
export function estRelanceDeCampagne(gabarit: string, payload: unknown): boolean {
  if (GABARITS_RELANCE_DE_CAMPAGNE.has(gabarit)) return true;
  return gabarit === F45 && (etapeDuPayload(payload) ?? 1) >= 2;
}

const champ = (payload: unknown, cle: string): unknown =>
  payload !== null && typeof payload === "object"
    ? (payload as Record<string, unknown>)[cle]
    : undefined;

const JOUR_MS = 86_400_000;
/**
 * Sans date de départ dans le job (relance enfilée avant ce lot), toute réponse humaine de
 * ces 30 derniers jours retient : on ne sait pas à quel envoi elle répond, on s'abstient.
 */
export const REPONSE_SANS_DEPART_JOURS = 30;

/**
 * V2-P-2 — la règle du passage (`passer-campagnes.ts`, lot 8A) : une réponse HUMAINE du
 * formateur reçue APRÈS l'envoi de départ arrête la relance. Le départ est celui que le
 * passage a lu, porté par le payload. Réponses illisibles : on retient.
 */
async function motifReponseFormateur(
  job: JobAuDepart,
  maintenant: Date = new Date(),
): Promise<string | null> {
  if (job.entityType !== "Trainer" || !job.entityId) return null;
  const brut = champ(job.payload, CLE_DEPART_RELANCE);
  const lu = typeof brut === "string" ? new Date(brut) : null;
  const depart =
    lu !== null && !Number.isNaN(lu.getTime())
      ? lu
      : new Date(maintenant.getTime() - REPONSE_SANS_DEPART_JOURS * JOUR_MS);
  const reponses = await reponsesFormateurs([job.entityId], depart);
  if (reponses === null) return "réponses du formateur illisibles — retenu par prudence";
  const repondu = (reponses.get(job.entityId) ?? []).some((r) => r.getTime() > depart.getTime());
  return repondu ? "le formateur a répondu depuis l'envoi de départ" : null;
}

/** Les clés d'envoi d'une séquence, la mère d'abord : la première coupée donne le motif. */
async function motifInterrupteurs(cles: readonly CleEnvoi[]): Promise<string | null> {
  const etats = await lireEtatsInterrupteurs();
  for (const cle of cles) {
    if (!lireDrapeauEnvoi(etats, cle)) return `interrupteur « ${cle} » coupé`;
  }
  return null;
}

/**
 * L'état du contrat-cadre visé par une relance F18 / F45 : la pièce du LIEN porté par le
 * job (le jeton relu en base) ; à défaut de lien, le dernier contrat de la fiche. Aucune
 * pièce : rien à affirmer (`inconnu`) — la relance n'est pas retenue sur ce point.
 */
async function etatDuContrat(
  job: JobAuDepart,
): Promise<"a-signer" | "signe" | "plus-a-signer" | "annule" | "inconnu"> {
  const ligne = await ligneDuLien(champ(job.payload, "lien"));
  const select = {
    annuleeAt: true,
    statutSignature: true,
    signatures: { where: { revokedAt: null, partie: "sous_traitant" }, select: { id: true } },
  } as const;
  const doc =
    ligne !== null
      ? await prisma.documentGenere.findUnique({ where: { id: ligne.documentGenereId }, select })
      : await prisma.documentGenere.findFirst({
          where: {
            trainerId: job.entityId!,
            type: "contrat_sous_traitance",
            sousTraitantId: null,
          },
          orderBy: { createdAt: "desc" },
          select,
        });
  if (doc === null) return "inconnu";
  if (doc.annuleeAt !== null) return "annule";
  if (doc.signatures.length > 0 || doc.statutSignature === "signee") return "signe";
  if (doc.statutSignature !== "en_attente" && doc.statutSignature !== "partielle") {
    return "plus-a-signer";
  }
  return "a-signer";
}

/**
 * F18 et F45 : la relance retenue alors que le contrat reste à signer rend au formateur le
 * lien qu'il avait (V2-P-6) — le lien neuf qu'elle portait ne lui parviendra pas.
 */
async function rendreLienSiEncoreASigner(job: JobAuDepart): Promise<void> {
  try {
    if (job.entityType !== "Trainer" || !job.entityId) return;
    if ((await etatDuContrat(job)) !== "a-signer") return;
    const t = await prisma.trainer.findUnique({
      where: { id: job.entityId },
      select: { finCollaborationAt: true },
    });
    if (t === null || t.finCollaborationAt !== null) return;
    await rendreLienPrecedent(champ(job.payload, "lien"), "revoquer");
  } catch {
    // Best-effort : la relance est retenue de toute façon.
  }
}

/** F18 (relance du contrat) et F45 (nouvelle version : envoi de départ et relances). */
const motifRelanceContrat = async (job: JobAuDepart): Promise<string | null> => {
  const commun = await relireFormateur(job);
  if (commun !== null) return commun;
  const relance = estRelanceDeCampagne(job.template, job.payload);
  try {
    // V2-P-3 / V2-P-5 : la nouvelle version a sa propre clé (registre des signatures).
    if (job.template === F45 && !(await interrupteurAllume("nouvelle_version_contrat"))) {
      return "interrupteur « nouvelle_version_contrat » coupé";
    }
    if (relance) {
      const coupe = await motifInterrupteurs(["dossier_en_ligne", "relances_auto"]);
      if (coupe !== null) return coupe;
    }
    // V2-P-1 : l'objet de la relance est atteint.
    const etat = await etatDuContrat(job);
    if (etat === "signe") return "le contrat est déjà signé";
    if (etat === "annule") return "le contrat a été annulé";
    if (etat === "plus-a-signer") return "le contrat n'est plus à signer";
    return relance ? await motifReponseFormateur(job) : null;
  } catch {
    return "état illisible au départ — retenu par prudence";
  }
};

const relireRelanceContrat: LecteurAuDepart = async (job) => {
  const motif = await motifRelanceContrat(job);
  if (motif !== null) await rendreLienSiEncoreASigner(job);
  return motif;
};

/** L'identifiant de la lettre d'un lien `…?lettre=<id>`, ou `null`. */
function lettreDuLien(lien: unknown): string | null {
  if (typeof lien !== "string") return null;
  try {
    return new URL(lien).searchParams.get("lettre");
  } catch {
    return null;
  }
}

/** F27 : `contrat_auto` (mère) et `lettre_auto` ; lettre signée, annulée, mission commencée. */
const relireRelanceLettre: LecteurAuDepart = async (job) => {
  const commun = await relireFormateur(job);
  if (commun !== null) return commun;
  try {
    const coupe = await motifInterrupteurs(["contrat_auto", "lettre_auto"]);
    if (coupe !== null) return coupe;
    const lettreId = lettreDuLien(champ(job.payload, "lien"));
    if (lettreId !== null) {
      const doc = await prisma.documentGenere.findUnique({
        where: { id: lettreId },
        select: {
          annuleeAt: true,
          statutSignature: true,
          signatures: { where: { revokedAt: null, partie: "formateur" }, select: { id: true } },
        },
      });
      if (doc === null || doc.annuleeAt !== null) return "la lettre de mission a été annulée";
      if (doc.signatures.length > 0 || doc.statutSignature === "signee") {
        return "la lettre de mission est déjà signée";
      }
      // « Rien après le début de la mission. »
      const mission = await prisma.missionFormateur.findFirst({
        where: { lettreMissionId: lettreId, trainerId: job.entityId! },
        select: { session: { select: { dateDebut: true } } },
      });
      if (mission?.session && mission.session.dateDebut.getTime() <= Date.now()) {
        return "la mission a commencé";
      }
    }
    return await motifReponseFormateur(job);
  } catch {
    return "état illisible au départ — retenu par prudence";
  }
};

/** F21 : `dossier_en_ligne` (mère) et `relances_auto` ; numéro transmis. */
const relireRelanceNda: LecteurAuDepart = async (job) => {
  const commun = await relireFormateur(job);
  if (commun !== null) return commun;
  try {
    const coupe = await motifInterrupteurs(["dossier_en_ligne", "relances_auto"]);
    if (coupe !== null) return coupe;
    const t = await prisma.trainer.findUnique({
      where: { id: job.entityId! },
      select: { sousTraitantNda: true },
    });
    if (!ndaEstEnCours(t?.sousTraitantNda ?? null)) {
      return "le numéro de déclaration d'activité n'est plus « en cours »";
    }
    return await motifReponseFormateur(job);
  } catch {
    return "état illisible au départ — retenu par prudence";
  }
};

/** La session d'un lien `…/sessions/<id>#…`, ou `null`. */
function sessionDuLien(lien: unknown): string | null {
  if (typeof lien !== "string") return null;
  try {
    const morceaux = new URL(lien).pathname.split("/").filter(Boolean);
    const i = morceaux.lastIndexOf("sessions");
    return i >= 0 && morceaux[i + 1] ? decodeURIComponent(morceaux[i + 1] as string) : null;
  } catch {
    return null;
  }
}

/** F61 : `signature.bilan_fin_formation` ; bilan terminé ou « payer quand même ». */
const relireRelanceBilan: LecteurAuDepart = async (job) => {
  const commun = await relireFormateur(job);
  if (commun !== null) return commun;
  try {
    if (!(await interrupteurAllume("bilan_fin_formation"))) {
      return "interrupteur « bilan_fin_formation » coupé";
    }
    const sessionId = sessionDuLien(champ(job.payload, "lien"));
    if (sessionId !== null) {
      const b = await prisma.bilanFinFormation.findUnique({
        where: { sessionId_trainerId: { sessionId, trainerId: job.entityId! } },
        select: { termineAt: true, payerQuandMemeAt: true },
      });
      if (b?.termineAt != null) return "le bilan de fin de formation est déjà remis";
      if (b?.payerQuandMemeAt != null) return "« payer quand même » a été décidé";
    }
    return await motifReponseFormateur(job);
  } catch {
    return "état illisible au départ — retenu par prudence";
  }
};

/**
 * F17 (V2-P-7) : le code doit être encore VIVANT au départ — ni utilisé, ni remplacé, ni
 * expiré. Sinon il ne part pas : le formateur en redemande un (message d'écran inchangé).
 */
const relireCodeSignature: LecteurAuDepart = async (job) => {
  const commun = await relireFormateur(job);
  if (commun !== null) return commun;
  try {
    const maintenant = new Date();
    const id = champ(job.payload, CLE_CODE_SIGNATURE);
    const select = { expiresAt: true, utiliseAt: true, invalideAt: true } as const;
    let code: { expiresAt: Date; utiliseAt: Date | null; invalideAt: Date | null } | null;
    if (typeof id === "string") {
      code = await prisma.documentSignatureCode.findUnique({ where: { id }, select });
    } else {
      // Code enfilé avant ce lot : le dernier code émis pour les pièces de la fiche.
      const pieces = await prisma.documentGenere.findMany({
        where: { trainerId: job.entityId!, type: "contrat_sous_traitance" },
        select: { id: true },
      });
      code = await prisma.documentSignatureCode.findFirst({
        where: { documentGenereId: { in: pieces.map((p) => p.id) }, partie: "sous_traitant" },
        orderBy: { createdAt: "desc" },
        select,
      });
    }
    if (code === null) return "code de signature introuvable";
    if (code.utiliseAt !== null) return "le code de signature a déjà servi";
    if (code.invalideAt !== null) return "le code de signature a été remplacé";
    if (code.expiresAt.getTime() <= maintenant.getTime()) return "le code de signature a expiré";
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
  ...GABARITS_FORMATEUR_INDEPENDANT.map((g): [string, LecteurAuDepart] => [
    g,
    GABARITS_RELANCE_PIECE.has(g) ? relireRelancePiece : relireFormateur,
  ]),
  // L6 : la relance du dossier remplace le lecteur commun (elle l'appelle d'abord).
  ["formateur-dossier-relance", relireRelanceDossier],
  // L-INV : l'invitation, ses rappels et le rattrapage relisent EN PLUS la candidature
  // (réservé, répondu, décidé, fiche ouverte) — la dernière entrée d'une clé l'emporte.
  // F1 : l'invitation posée à la main par la console garde la relecture commune.
  ...GABARITS_INVITATION_FORMATEUR.map((g): [string, LecteurAuDepart] => [
    g,
    g === "formateur-invitation-echange" ? relireInvitationEchange : relireInvitationFormateur,
  ]),
  // Vérification n° 2 : chaque relance de campagne relit ses interrupteurs, son objet, la
  // réponse du formateur et l'opposition ; F17 relit l'échéance de son code.
  [F18, relireRelanceContrat],
  [F45, relireRelanceContrat],
  [F27, relireRelanceLettre],
  [F21, relireRelanceNda],
  [F61, relireRelanceBilan],
  [F17, relireCodeSignature],
]);
