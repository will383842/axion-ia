/**
 * 🔴 CHANTIER QNC, LOT L13 — DOCUMENTS DE L'ORGANISME ARCHIVÉS, JAMAIS EFFACÉS
 * (NC10, NC11, NC15 de l'audit du 16/10/2026 : « rien supprimé »).
 *
 * Partie PURE : constantes, formes du journal, dérivations. Aucune lecture de
 * base ici — `documents-organisme.ts` lit, ce module calcule (patron de
 * `verrou-dossier-pur.ts`).
 *
 * Ce que le lot change, interrupteur `qualiopi.documents_organisme.actif`
 * allumé :
 *   - remplacer une pièce de la rubrique Société ou un document du hub crée une
 *     NOUVELLE ligne ; l'ancienne reste, avec son fichier, étiquetée
 *     « remplacée par » ;
 *   - « Supprimer » disparaît ; un retrait passe par `effacements_journal`, est
 *     réservé au super-administrateur et n'efface rien physiquement ;
 *   - une NOTE datée par le serveur, avec l'auteur réel, s'ajoute à côté d'une
 *     pièce générée, même sur un dossier clos, sans jamais toucher la pièce.
 *
 * ⚠️ Pourquoi le journal d'activité porte « remplacée par » et les notes.
 * Le socle L00 n'a prévu aucune table pour ce lot, et le lot n'a pas le droit
 * d'en poser (section « Besoin de schéma » de la PR). En attendant, chaque fait
 * est une ligne `activity_logs` écrite avec `exiger: true` — dans la MÊME
 * transaction que la nouvelle version quand il y en a une : sans trace, pas de
 * geste. Aucun code ne réécrit ni ne supprime ces lignes ; la base, elle, ne
 * l'interdit pas encore (c'est le besoin de schéma n° 3).
 */

/** Clé de l'interrupteur : `qualiopi.documents_organisme.actif`. */
export const LOT_DOCUMENTS_ORGANISME = "documents_organisme" as const;

/** Les deux tables de documents de l'organisme que le lot archive. */
export const CIBLES_DOCUMENT_ORGANISME = ["SocieteDocument", "ConsoleDocument"] as const;
export type CibleDocumentOrganisme = (typeof CIBLES_DOCUMENT_ORGANISME)[number];

export function estCibleDocumentOrganisme(v: unknown): v is CibleDocumentOrganisme {
  return typeof v === "string" && (CIBLES_DOCUMENT_ORGANISME as ReadonlyArray<string>).includes(v);
}

/** Actions du journal. Un nom par fait, jamais réutilisé pour autre chose. */
export const ACTION_DOCUMENT_REMPLACE = "qualiopi.documents_organisme.remplace" as const;
export const ACTION_DOCUMENT_RETIRE = "qualiopi.documents_organisme.retire" as const;
export const ACTION_NOTE_PIECE = "qualiopi.documents_organisme.note_piece" as const;

/** Un motif ou une note se lit : dix caractères au moins (convention ADR 0060). */
export const LONGUEUR_MIN_TEXTE = 10;
export const LONGUEUR_MAX_TEXTE = 2000;

// ─────────────────────────────────────────────────────────────────────────────
// Remplacements
// ─────────────────────────────────────────────────────────────────────────────

/** Une ligne du journal, telle qu'on la lit (`activity_logs`). */
export interface LigneJournal {
  readonly id: string;
  readonly action: string;
  readonly targetType: string | null;
  readonly targetId: string | null;
  readonly changes: unknown;
  readonly adminUserId: string | null;
  readonly createdAt: Date;
}

export interface Remplacement {
  /** La version remplacée (la cible de la ligne de journal). */
  readonly ancienId: string;
  /** La version qui la remplace. */
  readonly nouveauId: string;
  /** Date posée par le serveur à l'écriture de la ligne. */
  readonly le: Date;
  readonly parId: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function champTexte(changes: unknown, cle: string): string | null {
  if (changes === null || typeof changes !== "object" || Array.isArray(changes)) return null;
  const v = (changes as Record<string, unknown>)[cle];
  return typeof v === "string" ? v : null;
}

/**
 * Pure : les lignes de journal → « qui remplace qui ». Une ligne mal formée est
 * ignorée (elle ne peut rien étiqueter). Si une version porte deux
 * remplacements — impossible par l'action, qui verrouille et relit, mais
 * possible par une écriture manuelle —, le PREMIER fait foi : c'est lui qui a
 * retiré la version de la vigueur.
 */
export function remplacementsDepuisJournal(
  lignes: ReadonlyArray<LigneJournal>,
  cible: CibleDocumentOrganisme,
): Map<string, Remplacement> {
  const triees = [...lignes].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const out = new Map<string, Remplacement>();
  for (const l of triees) {
    if (l.action !== ACTION_DOCUMENT_REMPLACE || l.targetType !== cible) continue;
    const nouveauId = champTexte(l.changes, "nouveauId");
    if (!l.targetId || !nouveauId || !UUID.test(nouveauId) || nouveauId === l.targetId) continue;
    if (out.has(l.targetId)) continue;
    out.set(l.targetId, {
      ancienId: l.targetId,
      nouveauId,
      le: l.createdAt,
      parId: l.adminUserId,
    });
  }
  return out;
}

export interface AvecId {
  readonly id: string;
}

/**
 * Pure : sépare les versions en vigueur des versions remplacées, sans rien
 * perdre — chaque document d'entrée ressort exactement une fois.
 */
export function separerVersions<T extends AvecId>(
  docs: ReadonlyArray<T>,
  remplacements: ReadonlyMap<string, Remplacement>,
): {
  readonly enVigueur: T[];
  readonly remplacees: Array<T & { readonly remplacement: Remplacement }>;
} {
  const enVigueur: T[] = [];
  const remplacees: Array<T & { readonly remplacement: Remplacement }> = [];
  for (const d of docs) {
    const r = remplacements.get(d.id);
    if (r) remplacees.push({ ...d, remplacement: r });
    else enVigueur.push(d);
  }
  return { enVigueur, remplacees };
}

// ─────────────────────────────────────────────────────────────────────────────
// Notes sur une pièce générée (dossier clos compris)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Les mentions qu'une note porte. La SSOT du libellé : l'écran, l'action et
 * le test lisent cette liste. Les cas de l'audit du 16/10 : pièces vierges
 * (n° 034, 040, 041, 042), pièces établies hors délai, pièces rectificatives
 * du 16/10, et la consigne « ne pas envoyer ».
 */
export const MENTIONS_PIECE = [
  {
    key: "ne_pas_envoyer",
    label: "Ne pas envoyer",
    aide: "La pièce reste au dossier mais ne doit être remise à personne.",
  },
  {
    key: "etablie_hors_delai",
    label: "Établie hors délai",
    aide: "La pièce a été produite après la date où elle était due : dire quand et pourquoi.",
  },
  {
    key: "piece_vierge",
    label: "Pièce vierge",
    aide: "La pièce a été émise sans contenu exploitable (numéro consommé, rien à remettre).",
  },
  {
    key: "piece_rectificative",
    label: "Pièce rectificative",
    aide: "La pièce rectifie une pièce antérieure : nommer laquelle et ce qui change.",
  },
  {
    key: "note",
    label: "Note",
    aide: "Toute autre précision utile à l'auditeur.",
  },
] as const;

export type MentionPiece = (typeof MENTIONS_PIECE)[number]["key"];

export function estMentionPiece(v: unknown): v is MentionPiece {
  return typeof v === "string" && MENTIONS_PIECE.some((m) => m.key === v);
}

export function libelleMention(m: MentionPiece): string {
  return MENTIONS_PIECE.find((x) => x.key === m)?.label ?? m;
}

export interface NotePiece {
  /** Identifiant de la ligne de journal. */
  readonly id: string;
  readonly documentId: string;
  readonly mention: MentionPiece;
  readonly texte: string;
  /** Nom de l'auteur FIGÉ au moment de la note (lu en base, jamais saisi). */
  readonly auteurNom: string;
  /** Date posée par le serveur. */
  readonly le: Date;
}

/** Pure : lignes de journal → notes, par pièce, dans l'ordre où elles ont été écrites. */
export function notesDepuisJournal(lignes: ReadonlyArray<LigneJournal>): Map<string, NotePiece[]> {
  const out = new Map<string, NotePiece[]>();
  const triees = [...lignes].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  for (const l of triees) {
    if (l.action !== ACTION_NOTE_PIECE || l.targetType !== "DocumentGenere" || !l.targetId) {
      continue;
    }
    const mention = champTexte(l.changes, "mention");
    const texte = champTexte(l.changes, "texte");
    const auteurNom = champTexte(l.changes, "auteurNom");
    if (!estMentionPiece(mention) || texte === null || auteurNom === null) continue;
    const note: NotePiece = {
      id: l.id,
      documentId: l.targetId,
      mention,
      texte,
      auteurNom,
      le: l.createdAt,
    };
    const liste = out.get(l.targetId);
    if (liste) liste.push(note);
    else out.set(l.targetId, [note]);
  }
  return out;
}

export type ValidationNote =
  | { readonly ok: true; readonly mention: MentionPiece; readonly texte: string }
  | { readonly ok: false; readonly error: string };

/**
 * Pure : valide une note saisie. Le navigateur n'envoie ni date ni auteur : ce
 * sont les seuls champs qu'il pourrait falsifier, et le serveur les pose.
 */
export function validerNote(entree: {
  readonly mention: unknown;
  readonly texte: unknown;
}): ValidationNote {
  if (!estMentionPiece(entree.mention)) return { ok: false, error: "Mention inconnue." };
  const texte = typeof entree.texte === "string" ? entree.texte.trim() : "";
  if (texte.length < LONGUEUR_MIN_TEXTE) {
    return {
      ok: false,
      error: `La note doit expliquer en ${LONGUEUR_MIN_TEXTE} caractères au moins.`,
    };
  }
  if (texte.length > LONGUEUR_MAX_TEXTE) {
    return { ok: false, error: `La note ne dépasse pas ${LONGUEUR_MAX_TEXTE} caractères.` };
  }
  return { ok: true, mention: entree.mention, texte };
}

/** Pure : « le 16/10/2026 à 14:32 », heure de Paris — jamais l'heure du navigateur. */
export function horodatageParis(d: Date): string {
  const jour = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
  const heure = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  return `le ${jour} à ${heure}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Retrait (journal des effacements)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valeurs que le retrait écrira dans `effacements_journal` — elles n'existent
 * PAS encore dans les énumérations `cible_effacement` et `motif_effacement`
 * (besoin de schéma n° 2). Tant qu'elles manquent, le retrait est REFUSÉ :
 * fermé par défaut, rien n'est retiré, rien n'est effacé.
 */
export const CIBLE_EFFACEMENT_ATTENDUE: Readonly<Record<CibleDocumentOrganisme, string>> = {
  SocieteDocument: "societe_documents",
  ConsoleDocument: "console_documents",
};
export const MOTIF_EFFACEMENT_ATTENDU = "retrait_document_organisme" as const;
