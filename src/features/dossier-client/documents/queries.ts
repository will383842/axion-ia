/**
 * Lectures de la rubrique « Documents » d'un projet (ADR 0063).
 *
 * ⛔ Aucune lecture des OCTETS ici : `SELECT_DOCUMENT_LISTE` est la seule
 * sélection de la liste, et elle ne nomme pas `contenu`. Les compteurs sont des
 * comptages groupés, jamais un chargement.
 *
 * Toute lecture porte `clientId` ET `projetId` : la page a déjà vérifié le
 * projet du client, et la requête le redit.
 */

import { prisma } from "@/lib/prisma";
import type {
  AnalyseAntivirusDocument,
  CoteDocumentProjet,
  FormatFichierDocument,
  NatureDocumentProjet,
} from "../../../../prisma/generated/client";

/** La sélection UNIQUE d'une liste de documents — sans `contenu`, par construction. */
export const SELECT_DOCUMENT_LISTE = {
  id: true,
  cote: true,
  nature: true,
  titre: true,
  envoyeLe: true,
  lienUrl: true,
  fichierNom: true,
  fichierFormat: true,
  fichierTailleOctets: true,
  analyseAntivirus: true,
  archiveLe: true,
  createdAt: true,
  ajouteParId: true,
} as const;

export interface DocumentDeLaListe {
  readonly id: string;
  readonly cote: CoteDocumentProjet;
  readonly nature: NatureDocumentProjet;
  readonly titre: string;
  readonly envoyeLe: Date | null;
  readonly lienUrl: string | null;
  readonly fichierNom: string | null;
  readonly fichierFormat: FormatFichierDocument | null;
  readonly fichierTailleOctets: number | null;
  readonly analyseAntivirus: AnalyseAntivirusDocument | null;
  readonly archiveLe: Date | null;
  readonly createdAt: Date;
  /** Prénom de l'administrateur qui l'a ajouté (ou le début de son adresse). */
  readonly auteur: string | null;
}

export interface OuverturesDuDocument {
  readonly navigateur: number;
  readonly derniere: Date | null;
  readonly apercus: number;
}

/** « Williams Jullin » → « Williams » ; sans nom → la partie avant le @. */
export function prenomDeLAuteur(u: { name: string; email: string }): string {
  const prenom = u.name.trim().split(/\s+/)[0];
  if (prenom) return prenom;
  return u.email.split("@")[0] ?? u.email;
}

/** Tous les documents du projet (actifs et archivés), métadonnées seulement. */
export async function lireDocumentsDuProjet(
  clientId: string,
  projetId: string,
): Promise<DocumentDeLaListe[]> {
  const lignes = await prisma.documentProjet.findMany({
    where: { clientId, projetId },
    select: SELECT_DOCUMENT_LISTE,
    orderBy: { createdAt: "desc" },
  });
  const ids = [...new Set(lignes.map((l) => l.ajouteParId).filter((x): x is string => !!x))];
  const auteurs =
    ids.length === 0
      ? []
      : await prisma.adminUser.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true, email: true },
        });
  const nomDe = new Map(auteurs.map((a) => [a.id, prenomDeLAuteur(a)]));
  return lignes.map(({ ajouteParId, ...l }) => ({
    ...l,
    auteur: ajouteParId ? (nomDe.get(ajouteParId) ?? null) : null,
  }));
}

/** Nombre de documents ACTIFS par projet de la fiche (archivés exclus), par comptage groupé. */
export async function compterDocumentsParProjet(
  clientId: string,
): Promise<Readonly<Record<string, number>>> {
  const groupes = await prisma.documentProjet.groupBy({
    by: ["projetId"],
    where: { clientId, archiveLe: null },
    _count: { _all: true },
  });
  const sortie: Record<string, number> = {};
  for (const g of groupes) sortie[g.projetId] = g._count._all;
  return sortie;
}

/** Les ouvertures du lien public, par document : comptées, jamais détaillées. */
export async function lireOuvertures(
  ids: ReadonlyArray<string>,
): Promise<Readonly<Record<string, OuverturesDuDocument>>> {
  if (ids.length === 0) return {};
  const groupes = await prisma.documentProjetOuverture.groupBy({
    by: ["documentId", "origine"],
    where: { documentId: { in: [...ids] } },
    _count: { _all: true },
    _max: { ouvertLe: true },
  });
  const sortie: Record<string, OuverturesDuDocument> = {};
  for (const g of groupes) {
    const avant = sortie[g.documentId] ?? { navigateur: 0, derniere: null, apercus: 0 };
    sortie[g.documentId] =
      g.origine === "navigateur"
        ? { ...avant, navigateur: g._count._all, derniere: g._max.ouvertLe ?? null }
        : { ...avant, apercus: g._count._all };
  }
  return sortie;
}
