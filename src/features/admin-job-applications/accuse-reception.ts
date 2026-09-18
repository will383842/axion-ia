import "server-only";

/**
 * L'ACCUSÉ DE RÉCEPTION AUTOMATIQUE d'une candidature — lecture.
 *
 * ## Le défaut que ce module ferme (production, 2026-09-18)
 *
 * Le dépôt d'une candidature enfile un accusé (`candidature-recue`). Il part,
 * ou il échoue — pendant la panne du relais du 16 au 17/09, dix-huit sont
 * restés à quai. Mais la FICHE du candidat n'en disait rien : « Historique —
 * Rien n'a encore été consigné », que l'accusé soit livré, en échec ou jamais
 * enfilé. Le seul écran où on le voyait était « E-mails envoyés », qu'on
 * n'ouvre pas pour traiter un candidat.
 *
 * ## Ce que ce module rend, et ce qu'il ne rend pas
 *
 * L'ÉTAT de l'envoi, lu dans `email_logs` : envoyé (à quelle date, au bout de
 * combien d'essais), en file, en échec (avec un motif court), refusé par le
 * destinataire, annulé — ou ABSENT. Jamais le contenu : la console ne le
 * conserve pas, et n'a pas à le montrer.
 *
 * ⚠️ Un accusé n'est PAS une réponse. Il ne touche ni au statut, ni au drapeau
 * « à traiter » : c'est un automate qui accuse réception, pas quelqu'un qui a
 * lu le dossier.
 *
 * ## Le rattachement — exact d'abord, sinon par adresse et heure
 *
 * Depuis ce correctif, l'accusé est enfilé avec l'entité liée
 * (`JobApplication` / id) : le lien est EXACT. Les envois antérieurs n'en ont
 * pas. Pour eux, on retient l'accusé adressé au candidat le plus proche de
 * l'heure de dépôt, dans une fenêtre courte, en écartant ceux qui sont
 * exactement liés à une AUTRE candidature. Le cas qui l'impose est réel : une
 * même personne a candidaté à deux offres à deux minutes d'écart le 18/09 —
 * chaque fiche doit garder SON accusé, pas les deux.
 */

import { prisma } from "@/lib/prisma";
import { peutOuvrirDossierCandidat } from "@/server/auth/habilitations";
import type { EmailLogStatus } from "../../../prisma/generated/client";

/** Gabarits d'accusé de réception d'une `JobApplication`. */
export const GABARITS_ACCUSE = ["candidature-recue"] as const;

/** `EmailLog.entityType` posé à l'enfilage de l'accusé. */
export const ENTITE_CANDIDATURE = "JobApplication";

/**
 * Fenêtre du rattachement par adresse et heure. L'accusé est enfilé dans la
 * même requête que la création de la candidature : quelques secondes après.
 * Une minute avant tolère un décalage d'horloge ; une heure après couvre une
 * file lente sans aller chercher l'envoi d'une autre époque.
 */
const MARGE_AVANT_MS = 60_000;
const FENETRE_APRES_MS = 3_600_000;

/** Longueur maximale du motif d'échec affiché. */
const MOTIF_MAX = 160;

export interface LigneEnvoiAccuse {
  readonly id: string;
  readonly template: string;
  readonly status: EmailLogStatus;
  readonly entityType: string | null;
  readonly entityId: string | null;
  readonly attempts: number;
  readonly error: string | null;
  readonly sentAt: Date | null;
  readonly failedAt: Date | null;
  readonly bouncedAt: Date | null;
  readonly bounceReason: string | null;
  readonly createdAt: Date;
}

export type EtatAccuse = "envoye" | "en_attente" | "echec" | "rebond" | "annule" | "absent";

export interface AccuseReception {
  readonly etat: EtatAccuse;
  /** Date du fait décrit : dernier envoi réussi, échec, rebond, ou enfilage. */
  readonly date: Date | null;
  /** Nombre d'essais de la chaîne d'envoi (1 = parti du premier coup). */
  readonly essais: number;
  readonly motif: string | null;
  /** `null` quand aucun envoi n'a été trouvé. */
  readonly rattachement: "exact" | "adresse_et_date" | null;
}

export interface AccuseRetenu {
  readonly ligne: LigneEnvoiAccuse;
  readonly rattachement: "exact" | "adresse_et_date";
}

/** Retient l'accusé de CETTE candidature parmi des envois candidats. */
export function choisirAccuse(
  lignes: ReadonlyArray<LigneEnvoiAccuse>,
  candidature: { id: string; submittedAt: Date },
): AccuseRetenu | null {
  const exacts = lignes
    .filter((l) => l.entityType === ENTITE_CANDIDATURE && l.entityId === candidature.id)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  if (exacts[0]) return { ligne: exacts[0], rattachement: "exact" };

  const depot = candidature.submittedAt.getTime();
  const libres = lignes.filter((l) => {
    // Un accusé EXACTEMENT lié à une autre candidature n'est jamais celui-ci.
    if (l.entityType === ENTITE_CANDIDATURE && l.entityId !== null) return false;
    const t = l.createdAt.getTime();
    return t >= depot - MARGE_AVANT_MS && t <= depot + FENETRE_APRES_MS;
  });
  const proche = libres.sort(
    (a, b) => Math.abs(a.createdAt.getTime() - depot) - Math.abs(b.createdAt.getTime() - depot),
  )[0];
  return proche ? { ligne: proche, rattachement: "adresse_et_date" } : null;
}

function motifCourt(brut: string | null): string | null {
  const premiere = brut?.split("\n")[0]?.trim();
  if (!premiere) return null;
  return premiere.length > MOTIF_MAX ? `${premiere.slice(0, MOTIF_MAX - 1)}…` : premiere;
}

/** L'état RÉEL d'un accusé retenu — ou son absence. */
export function decrireAccuse(retenu: AccuseRetenu | null): AccuseReception {
  if (retenu === null) {
    return { etat: "absent", date: null, essais: 0, motif: null, rattachement: null };
  }
  const { ligne: l, rattachement } = retenu;
  const base = { essais: l.attempts, rattachement };
  switch (l.status) {
    case "sent":
      return { ...base, etat: "envoye", date: l.sentAt ?? l.createdAt, motif: null };
    case "failed":
      return {
        ...base,
        etat: "echec",
        date: l.failedAt ?? l.createdAt,
        motif: motifCourt(l.error),
      };
    case "bounced":
      return {
        ...base,
        etat: "rebond",
        date: l.bouncedAt ?? l.createdAt,
        motif: motifCourt(l.bounceReason),
      };
    case "cancelled":
      return { ...base, etat: "annule", date: l.createdAt, motif: null };
    case "pending":
      return { ...base, etat: "en_attente", date: l.createdAt, motif: null };
  }
}

/**
 * L'accusé de réception d'une candidature, tel qu'il est RÉELLEMENT parti.
 *
 * 🔴 Refuse par défaut, avec le même prédicat que l'ouverture du dossier : la
 * lecture porte sur l'adresse du candidat. `null` = pas le droit de savoir ;
 * `etat: "absent"` = on a cherché, il n'y a rien.
 *
 * `email` est l'adresse DÉCHIFFRÉE (celle de la fiche). Vide — déchiffrement
 * impossible — on ne cherche que le lien exact : un filtre sur une chaîne vide
 * ne trouverait rien, mais il ne doit pas non plus avoir l'air d'avoir cherché.
 */
export async function lireAccuseReception(
  candidature: { id: string; email: string; submittedAt: Date },
  acteur: { role: string | null | undefined },
): Promise<AccuseReception | null> {
  if (!peutOuvrirDossierCandidat(acteur.role)) return null;

  const depot = candidature.submittedAt.getTime();
  const email = candidature.email.trim();
  const lignes = await prisma.emailLog.findMany({
    where: {
      template: { in: [...GABARITS_ACCUSE] },
      OR: [
        { entityType: ENTITE_CANDIDATURE, entityId: candidature.id },
        ...(email.length > 0
          ? [
              {
                recipient: email,
                createdAt: {
                  gte: new Date(depot - MARGE_AVANT_MS),
                  lte: new Date(depot + FENETRE_APRES_MS),
                },
              },
            ]
          : []),
      ],
    },
    orderBy: { createdAt: "asc" },
    take: 20,
    select: {
      id: true,
      template: true,
      status: true,
      entityType: true,
      entityId: true,
      attempts: true,
      error: true,
      sentAt: true,
      failedAt: true,
      bouncedAt: true,
      bounceReason: true,
      createdAt: true,
    },
  });

  return decrireAccuse(choisirAccuse(lignes, candidature));
}
