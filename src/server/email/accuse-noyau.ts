/**
 * L'ACCUSÉ DE RÉCEPTION AUTOMATIQUE — le noyau commun, sans accès à la base.
 *
 * Plusieurs écrans en ont besoin : la fiche d'une CANDIDATURE
 * (`JobApplication`), la liste et la fiche d'un MESSAGE (`Submission` — dont
 * les candidatures commerciales). Tous rattachent un envoi du journal
 * `email_logs` à leur entité par la MÊME règle — exact d'abord, sinon par
 * adresse et heure — et décrivent l'état par les MÊMES faits. La règle vit donc
 * ici une seule fois, paramétrée par le type d'entité : deux copies
 * divergeraient au premier correctif, et un écran dirait « parti » quand
 * l'autre dirait « introuvable ».
 *
 * ⚠️ Un accusé n'est PAS une réponse. Rien ici ne touche au statut d'une
 * demande ni à son drapeau « à traiter ».
 *
 * Module PUR : ni Prisma, ni session. La lecture groupée vit dans
 * `accuse-lecture.ts` ; la garde de droit, chez chaque appelant.
 */

import type { EmailLogStatus } from "../../../prisma/generated/client";

/**
 * Fenêtre du rattachement par adresse et heure. L'accusé est enfilé dans la
 * même requête que la création de la demande : quelques secondes après. Une
 * minute avant tolère un décalage d'horloge ; une heure après couvre une file
 * lente sans aller chercher l'envoi d'une autre époque.
 */
export const MARGE_AVANT_MS = 60_000;
export const FENETRE_APRES_MS = 3_600_000;

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
  /** `hard` / `soft` (webhook ZeptoMail) — commande le geste, cf. `email_logs`. */
  readonly bounceType: string | null;
  readonly createdAt: Date;
}

/** Une ligne du journal, avec son destinataire — pour le rattachement groupé. */
export type LigneAvecDestinataire = LigneEnvoiAccuse & { readonly recipient: string };

export type EtatAccuse = "envoye" | "en_attente" | "echec" | "rebond" | "annule" | "absent";

export interface AccuseReception {
  readonly etat: EtatAccuse;
  /** Date du fait décrit : dernier envoi réussi, échec, rebond, ou enfilage. */
  readonly date: Date | null;
  /** Nombre d'essais de la chaîne d'envoi (1 = parti du premier coup). */
  readonly essais: number;
  readonly motif: string | null;
  /**
   * Nature du rebond, quand il y en a un. Un rebond TEMPORAIRE (boîte pleine,
   * serveur indisponible) ne dit rien de l'adresse ; seul un rebond DÉFINITIF
   * la met en doute. `null` hors rebond, ou quand le relais ne l'a pas dit.
   */
  readonly rebond: "hard" | "soft" | null;
  /** `null` quand aucun envoi n'a été trouvé. */
  readonly rattachement: "exact" | "adresse_et_date" | null;
}

export interface AccuseRetenu {
  readonly ligne: LigneEnvoiAccuse;
  readonly rattachement: "exact" | "adresse_et_date";
}

/** L'entité dont on cherche l'accusé. */
export interface EntiteAccusee {
  readonly id: string;
  /**
   * Adresse DÉCHIFFRÉE, telle qu'affichée. Quand elle est illisible (clé
   * absente : `decryptPii` rend alors un libellé de remplacement), la lecture
   * (`accuse-lecture.ts`) la remplace par une chaîne vide avant d'arriver ici.
   */
  readonly email: string;
  readonly submittedAt: Date;
}

/**
 * Retient l'accusé de CETTE entité parmi des envois candidats.
 *
 * Les `lignes` doivent déjà être celles adressées à la bonne personne (ou
 * exactement liées à l'entité) : cette fonction ne connaît pas les adresses.
 * Un envoi EXACTEMENT lié à une AUTRE entité du même type n'est jamais retenu
 * — c'est ce qui garde à chaque fiche SON accusé quand une même personne a
 * déposé deux demandes à deux minutes d'écart (cas réel, 18/09/2026).
 */
export function choisirAccuse(
  lignes: ReadonlyArray<LigneEnvoiAccuse>,
  entite: { type: string; id: string; submittedAt: Date },
): AccuseRetenu | null {
  const exacts = lignes
    .filter((l) => l.entityType === entite.type && l.entityId === entite.id)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  if (exacts[0]) return { ligne: exacts[0], rattachement: "exact" };

  const depot = entite.submittedAt.getTime();
  const libres = lignes.filter((l) => {
    if (l.entityType === entite.type && l.entityId !== null) return false;
    const t = l.createdAt.getTime();
    return t >= depot - MARGE_AVANT_MS && t <= depot + FENETRE_APRES_MS;
  });
  const proche = [...libres].sort(
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
    return {
      etat: "absent",
      date: null,
      essais: 0,
      motif: null,
      rebond: null,
      rattachement: null,
    };
  }
  const { ligne: l, rattachement } = retenu;
  const base = { essais: l.attempts, rattachement, rebond: null };
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
        rebond: l.bounceType === "hard" || l.bounceType === "soft" ? l.bounceType : null,
        date: l.bouncedAt ?? l.createdAt,
        motif: motifCourt(l.bounceReason),
      };
    case "cancelled":
      return { ...base, etat: "annule", date: l.createdAt, motif: null };
    case "pending":
      return { ...base, etat: "en_attente", date: l.createdAt, motif: null };
  }
}

function normaliser(adresse: string): string {
  return adresse.trim().toLowerCase();
}

/**
 * Rattache et décrit, entité par entité, parmi des envois DÉJÀ lus en une fois.
 *
 * Chaque entité ne voit que les envois adressés à SA personne (adresse
 * comparée sans casse) ou exactement liés à ELLE — jamais l'accusé d'une autre
 * personne parti la même minute.
 */
export function attribuerAccuses(
  entityType: string,
  entites: ReadonlyArray<EntiteAccusee>,
  lignes: ReadonlyArray<LigneAvecDestinataire>,
): Map<string, AccuseReception> {
  const resultat = new Map<string, AccuseReception>();
  for (const e of entites) {
    const adresse = normaliser(e.email);
    const candidats = lignes.filter(
      (l) =>
        (adresse.length > 0 && normaliser(l.recipient) === adresse) ||
        (l.entityType === entityType && l.entityId === e.id),
    );
    resultat.set(
      e.id,
      decrireAccuse(
        choisirAccuse(candidats, { type: entityType, id: e.id, submittedAt: e.submittedAt }),
      ),
    );
  }
  return resultat;
}

/** Colonnes lues dans `email_logs` — les mêmes pour tous les écrans. */
export const SELECT_LIGNE_ACCUSE = {
  id: true,
  template: true,
  recipient: true,
  status: true,
  entityType: true,
  entityId: true,
  attempts: true,
  error: true,
  sentAt: true,
  failedAt: true,
  bouncedAt: true,
  bounceReason: true,
  bounceType: true,
  createdAt: true,
} as const;
