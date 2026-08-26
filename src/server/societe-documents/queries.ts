// Lectures (server-only) du dossier société.
import "server-only";

import { prisma } from "@/lib/prisma";
import type { SocieteDocumentType } from "../../../prisma/generated/client";
import { SOCIETE_RUBRIQUES, type SocieteRubriqueKey, typesDeRubrique } from "./rubriques";

export interface SocieteDocListItem {
  id: string;
  type: SocieteDocumentType;
  titre: string;
  description: string | null;
  numeroPiece: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dateEmission: Date | null;
  dateExpiration: Date | null;
  sensitive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const LIST_SELECT = {
  id: true,
  type: true,
  titre: true,
  description: true,
  numeroPiece: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  dateEmission: true,
  dateExpiration: true,
  sensitive: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Pièces d'une rubrique, dans l'ordre des types déclarés puis par rang manuel.
 *
 * Le filtre passe par la liste de types de la rubrique — la table ne porte pas
 * de colonne « rubrique », c'est la SSOT TS qui classe (cf. `rubriques.ts`).
 */
export async function listSocieteDocsByRubrique(
  rubrique: SocieteRubriqueKey,
): Promise<SocieteDocListItem[]> {
  const types = typesDeRubrique(rubrique).map((t) => t.key);
  if (types.length === 0) return [];
  const docs = await prisma.societeDocument.findMany({
    where: { type: { in: types } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: LIST_SELECT,
  });
  // Regroupe visuellement par type, dans l'ordre où la rubrique les déclare —
  // sinon deux Kbis successifs se retrouveraient séparés par une RC pro.
  const rang = new Map(types.map((t, i) => [t as string, i]));
  return docs.sort((a, b) => (rang.get(a.type) ?? 0) - (rang.get(b.type) ?? 0));
}

/** Une pièce par son identifiant (écran de modification). */
export async function getSocieteDoc(id: string): Promise<SocieteDocListItem | null> {
  return prisma.societeDocument.findUnique({ where: { id }, select: LIST_SELECT });
}

/** Métadonnées nécessaires à la route de téléchargement. */
export async function getSocieteDocForDownload(id: string): Promise<{
  storagePath: string;
  fileName: string;
  mimeType: string;
  sensitive: boolean;
} | null> {
  return prisma.societeDocument.findUnique({
    where: { id },
    select: { storagePath: true, fileName: true, mimeType: true, sensitive: true },
  });
}

export interface RubriqueCompteur {
  rubrique: SocieteRubriqueKey;
  total: number;
}

/**
 * Nombre de pièces par rubrique — alimente la page d'accueil de l'onglet.
 *
 * Une seule requête groupée, puis répartition en mémoire selon la SSOT : un
 * `count` par rubrique multiplierait les allers-retours pour cinq chiffres.
 */
export async function compterParRubrique(): Promise<RubriqueCompteur[]> {
  const rows = await prisma.societeDocument.groupBy({
    by: ["type"],
    _count: { _all: true },
  });
  const parType = new Map(rows.map((r) => [r.type as string, r._count._all]));
  return SOCIETE_RUBRIQUES.map((r) => ({
    rubrique: r.key,
    total: r.types.reduce((n, t) => n + (parType.get(t.key as string) ?? 0), 0),
  }));
}

/**
 * Pièces qui périment dans les `jours` à venir, ou déjà périmées.
 *
 * Sert le bandeau d'alerte de l'onglet. Le tri met les périmées en tête : ce
 * sont elles qui bloquent un référencement en cours.
 */
export async function listSocieteDocsEnAlerte(
  maintenant: Date,
  jours: number,
): Promise<SocieteDocListItem[]> {
  const limite = new Date(maintenant.getTime() + jours * 24 * 60 * 60 * 1000);
  return prisma.societeDocument.findMany({
    where: { dateExpiration: { not: null, lte: limite } },
    orderBy: { dateExpiration: "asc" },
    select: LIST_SELECT,
  });
}
