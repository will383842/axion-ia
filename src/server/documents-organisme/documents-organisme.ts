/**
 * 🔴 CHANTIER QNC, LOT L13 — lectures et interrupteur des documents de
 * l'organisme. La logique est dans `documents-organisme-pur.ts` ; ici, on lit.
 *
 * L'interrupteur `qualiopi.documents_organisme.actif` (eteint / essai / actif,
 * clé absente = éteint) :
 *   - rubrique Société et hub Documents : ces pièces ne portent aucune
 *     session, donc `essai` n'y agit pas (`estActifPour(etat, null)`) — seul
 *     `actif` les archive ;
 *   - notes sur une pièce générée : `essai` agit sur les pièces d'une session
 *     du banc d'essai (`estTestInterne`), `actif` sur toutes.
 *
 * Éteint, AUCUNE de ces lectures n'est faite par les écrans : rien ne change.
 */

import "server-only";

import { prisma } from "@/lib/prisma";
import {
  estActifPour,
  lireInterrupteurQualiopi,
  type EtatInterrupteur,
} from "@/server/qualiopi/socle/interrupteurs";
import {
  ACTION_DOCUMENT_REMPLACE,
  ACTION_NOTE_PIECE,
  CIBLE_EFFACEMENT_ATTENDUE,
  LOT_DOCUMENTS_ORGANISME,
  MOTIF_EFFACEMENT_ATTENDU,
  notesDepuisJournal,
  remplacementsDepuisJournal,
  separerVersions,
  type AvecId,
  type CibleDocumentOrganisme,
  type LigneJournal,
  type NotePiece,
  type Remplacement,
} from "./documents-organisme-pur";

const SELECT_LIGNE = {
  id: true,
  action: true,
  targetType: true,
  targetId: true,
  changes: true,
  adminUserId: true,
  createdAt: true,
} as const;

type ClientLecture = {
  setting: Pick<typeof prisma.setting, "findUnique">;
  activityLog: Pick<typeof prisma.activityLog, "findMany">;
  $queryRaw: typeof prisma.$queryRaw;
};

/** L'état de l'interrupteur du lot. Ne lève jamais (erreur = éteint). */
export async function etatDocumentsOrganisme(
  client: Pick<ClientLecture, "setting"> = prisma,
): Promise<EtatInterrupteur> {
  return lireInterrupteurQualiopi(LOT_DOCUMENTS_ORGANISME, client);
}

/**
 * Le lot archive-t-il la rubrique Société et le hub Documents ? Ces pièces
 * n'ont pas de session : seul `actif` les concerne.
 */
export async function archivageDocumentsOrganismeActif(
  client: Pick<ClientLecture, "setting"> = prisma,
): Promise<boolean> {
  return estActifPour(await etatDocumentsOrganisme(client), null);
}

/**
 * Qui remplace qui, pour une table. `ids` absent : toute la table (les
 * compteurs de l'accueil Société). Lecture d'affichage : une erreur rend une
 * carte vide — l'écran montre alors les versions comme avant le lot, il ne
 * perd rien.
 */
export async function lireRemplacements(
  cible: CibleDocumentOrganisme,
  ids?: ReadonlyArray<string>,
  client: Pick<ClientLecture, "activityLog"> = prisma,
): Promise<Map<string, Remplacement>> {
  if (ids !== undefined && ids.length === 0) return new Map();
  try {
    const lignes = await client.activityLog.findMany({
      where: {
        action: ACTION_DOCUMENT_REMPLACE,
        targetType: cible,
        ...(ids !== undefined ? { targetId: { in: [...ids] } } : {}),
      },
      orderBy: { createdAt: "asc" },
      select: SELECT_LIGNE,
    });
    return remplacementsDepuisJournal(lignes as LigneJournal[], cible);
  } catch {
    return new Map();
  }
}

/** Les notes des pièces données, dans l'ordre d'écriture. */
export async function lireNotesPieces(
  documentIds: ReadonlyArray<string>,
  client: Pick<ClientLecture, "activityLog"> = prisma,
): Promise<Map<string, NotePiece[]>> {
  if (documentIds.length === 0) return new Map();
  try {
    const lignes = await client.activityLog.findMany({
      where: {
        action: ACTION_NOTE_PIECE,
        targetType: "DocumentGenere",
        targetId: { in: [...documentIds] },
      },
      orderBy: { createdAt: "asc" },
      select: SELECT_LIGNE,
    });
    return notesDepuisJournal(lignes as LigneJournal[]);
  } catch {
    return new Map();
  }
}

/**
 * 🔴 GARDE-FOU DU RETRAIT. Le retrait s'inscrit dans `effacements_journal`,
 * dont les énumérations ne connaissent pas encore les documents de
 * l'organisme (besoin de schéma n° 2). On le demande à la BASE, pas à un
 * réglage : tant que les trois valeurs n'existent pas, le retrait est fermé.
 * Une erreur de lecture vaut « indisponible ».
 */
export async function retraitDocumentDisponible(
  cible: CibleDocumentOrganisme,
  client: Pick<ClientLecture, "$queryRaw"> = prisma,
): Promise<boolean> {
  try {
    const lignes = await client.$queryRaw<Array<{ n: number }>>`
      SELECT count(*)::int AS n
      FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE (t.typname = 'cible_effacement' AND e.enumlabel = ${CIBLE_EFFACEMENT_ATTENDUE[cible]})
         OR (t.typname = 'motif_effacement' AND e.enumlabel = ${MOTIF_EFFACEMENT_ATTENDU})`;
    return Number(lignes[0]?.n ?? 0) === 2;
  } catch {
    return false;
  }
}

/**
 * Les documents retirés d'une table. La comparaison se fait en TEXTE
 * (`table_cible::text`) : elle répond « aucun » aujourd'hui, sans erreur, alors
 * que la valeur n'existe pas encore dans l'énumération.
 */
export async function lireDocumentsRetires(
  cible: CibleDocumentOrganisme,
  client: Pick<ClientLecture, "$queryRaw"> = prisma,
): Promise<Set<string>> {
  try {
    const lignes = await client.$queryRaw<Array<{ ligne_id: string }>>`
      SELECT ligne_id FROM effacements_journal
      WHERE table_cible::text = ${CIBLE_EFFACEMENT_ATTENDUE[cible]}`;
    return new Set(lignes.map((l) => l.ligne_id));
  } catch {
    return new Set();
  }
}

/**
 * À appeler EN TRANSACTION, avant d'écrire une nouvelle version ou de modifier
 * une version : sérialise les gestes sur ce document (deux remplacements
 * croisés créeraient deux successeurs) et dit s'il est déjà remplacé.
 */
export async function verrouillerVersionDocument(
  tx: {
    $executeRaw: typeof prisma.$executeRaw;
    activityLog: Pick<typeof prisma.activityLog, "findFirst">;
  },
  cible: CibleDocumentOrganisme,
  id: string,
): Promise<{ readonly dejaRemplacee: boolean }> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`qualiopi.documents_organisme:${cible}:${id}`}))`;
  const deja = await tx.activityLog.findFirst({
    where: { action: ACTION_DOCUMENT_REMPLACE, targetType: cible, targetId: id },
    select: { id: true },
  });
  return { dejaRemplacee: deja !== null };
}

export interface VersionRemplacee<T> {
  readonly doc: T;
  readonly remplacement: Remplacement;
  /** La version qui la remplace, si elle est dans la même liste. */
  readonly par: T | null;
}

export interface VueArchivage<T> {
  readonly enVigueur: T[];
  readonly remplacees: Array<VersionRemplacee<T>>;
  /** Documents retirés (masqués, jamais effacés) : on en dit le nombre. */
  readonly nbRetires: number;
  /** Le bouton « Retirer » : super-administrateur ET base prête. */
  readonly retraitPossible: boolean;
}

/**
 * Ce qu'un écran de liste affiche, interrupteur allumé : les versions en
 * vigueur, les versions remplacées (chacune avec celle qui la remplace), le
 * nombre de documents retirés. `null` quand le lot est éteint : l'écran
 * reste exactement celui d'avant, sans aucune lecture de plus.
 */
export async function vueArchivage<T extends AvecId>(
  cible: CibleDocumentOrganisme,
  docs: ReadonlyArray<T>,
  role: string | undefined,
): Promise<VueArchivage<T> | null> {
  if (!(await archivageDocumentsOrganismeActif())) return null;
  const [remplacements, retires, retraitPret] = await Promise.all([
    lireRemplacements(
      cible,
      docs.map((d) => d.id),
    ),
    lireDocumentsRetires(cible),
    role === "super_admin" ? retraitDocumentDisponible(cible) : Promise.resolve(false),
  ]);
  const visibles = docs.filter((d) => !retires.has(d.id));
  const parId = new Map(docs.map((d) => [d.id, d]));
  const { enVigueur, remplacees } = separerVersions(visibles, remplacements);
  return {
    enVigueur,
    remplacees: remplacees.map((r) => ({
      doc: r as T,
      remplacement: r.remplacement,
      par: parId.get(r.remplacement.nouveauId) ?? null,
    })),
    nbRetires: docs.length - visibles.length,
    retraitPossible: retraitPret,
  };
}

/**
 * Les documents à NE PAS compter (remplacés ou retirés), pour les compteurs et
 * les alertes d'échéance. Vide quand le lot est éteint.
 */
export async function documentsHorsVigueur(cible: CibleDocumentOrganisme): Promise<Set<string>> {
  if (!(await archivageDocumentsOrganismeActif())) return new Set();
  const [remplacements, retires] = await Promise.all([
    lireRemplacements(cible),
    lireDocumentsRetires(cible),
  ]);
  return new Set([...remplacements.keys(), ...retires]);
}
