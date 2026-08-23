/**
 * Console éditoriale — lectures d'une publication et de sa liste (lot 1).
 *
 * Server-only. Séparé de `queries.ts`, qui sert le calendrier : mélanger les
 * deux ferait un module que personne n'ose plus toucher.
 */

import "server-only";
import { prisma } from "@/lib/prisma";
import { dayKeyOfGridDate } from "@/lib/calendar-grid";
import type { FiltreIdentite } from "@/server/editorial/calendrier-pur";

export interface LignePublication {
  id: string;
  dayKey: string;
  heurePrevue: string;
  titreInterne: string;
  compteLibelle: string;
  identite: "perso" | "pro";
  statutRedaction: string;
  statutAsset: string;
  statutDiffusion: string;
  tags: string[];
  estReprise: boolean;
  versionCourante: number;
}

/** Liste filtrable — la vue « publications » du §3. */
export async function listerPublications(options: {
  identite?: FiltreIdentite;
  statutRedaction?: string;
  recherche?: string;
  limite?: number;
}): Promise<LignePublication[]> {
  const { identite = "toutes", statutRedaction, recherche, limite = 100 } = options;

  const lignes = await prisma.edPublication.findMany({
    where: {
      archiveeA: null,
      ...(identite === "toutes" ? {} : { compte: { identite } }),
      ...(statutRedaction ? { statutRedaction: statutRedaction as never } : {}),
      // Recherche provisoire par `contains` : l'index `tsvector` du §2 bis B
      // arrive avec le critère 6, dans sa propre migration SQL brute. En
      // attendant, mieux vaut une recherche honnête et lente qu'aucune.
      ...(recherche
        ? {
            OR: [
              { titreInterne: { contains: recherche, mode: "insensitive" as const } },
              { accroche: { contains: recherche, mode: "insensitive" as const } },
              { corps: { contains: recherche, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      datePrevue: true,
      heurePrevue: true,
      titreInterne: true,
      statutRedaction: true,
      statutAsset: true,
      statutDiffusion: true,
      tags: true,
      sourceId: true,
      versionCourante: true,
      compte: { select: { libelle: true, identite: true } },
    },
    orderBy: [{ datePrevue: "asc" }, { heurePrevue: "asc" }],
    take: limite,
  });

  return lignes.map((l) => ({
    id: l.id,
    dayKey: dayKeyOfGridDate(l.datePrevue),
    heurePrevue: l.heurePrevue,
    titreInterne: l.titreInterne,
    compteLibelle: l.compte.libelle,
    identite: l.compte.identite,
    statutRedaction: l.statutRedaction,
    statutAsset: l.statutAsset,
    statutDiffusion: l.statutDiffusion,
    tags: l.tags,
    estReprise: l.sourceId !== null,
    versionCourante: l.versionCourante,
  }));
}

export interface PublicationDetaillee {
  id: string;
  dayKey: string;
  heurePrevue: string;
  titreInterne: string;
  accroche: string | null;
  corps: string | null;
  premierCommentaire: string | null;
  tags: string[];
  lienUrl: string | null;
  statutRedaction: string;
  statutAsset: string;
  statutDiffusion: string;
  urlPubliee: string | null;
  versionCourante: number;
  compte: { id: string; libelle: string; identite: string; plateforme: string };
  /** Les assets liés, dans l'ordre voulu par le kit. */
  assets: {
    id: string;
    libelle: string;
    type: string;
    statut: string;
    cheminObjet: string | null;
    dureeSec: number | null;
  }[];
  /** Les versions antérieures, la plus récente d'abord. */
  versions: {
    version: number;
    corps: string | null;
    accroche: string | null;
    premierCommentaire: string | null;
    tags: string[];
    motif: string | null;
    creeA: string;
  }[];
}

export async function chargerPublication(id: string): Promise<PublicationDetaillee | null> {
  const p = await prisma.edPublication.findUnique({
    where: { id },
    select: {
      id: true,
      datePrevue: true,
      heurePrevue: true,
      titreInterne: true,
      accroche: true,
      corps: true,
      premierCommentaire: true,
      tags: true,
      lienUrl: true,
      statutRedaction: true,
      statutAsset: true,
      statutDiffusion: true,
      urlPubliee: true,
      versionCourante: true,
      compte: { select: { id: true, libelle: true, identite: true, plateforme: true } },
      assets: {
        orderBy: { ordre: "asc" },
        select: {
          ordre: true,
          asset: {
            select: {
              id: true,
              libelle: true,
              type: true,
              statut: true,
              cheminObjet: true,
              dureeSec: true,
            },
          },
        },
      },
      versions: {
        orderBy: { version: "desc" },
        select: {
          version: true,
          corps: true,
          accroche: true,
          premierCommentaire: true,
          tags: true,
          motif: true,
          createdAt: true,
        },
      },
    },
  });
  if (!p) return null;

  return {
    id: p.id,
    dayKey: dayKeyOfGridDate(p.datePrevue),
    heurePrevue: p.heurePrevue,
    titreInterne: p.titreInterne,
    accroche: p.accroche,
    corps: p.corps,
    premierCommentaire: p.premierCommentaire,
    tags: p.tags,
    lienUrl: p.lienUrl,
    statutRedaction: p.statutRedaction,
    statutAsset: p.statutAsset,
    statutDiffusion: p.statutDiffusion,
    urlPubliee: p.urlPubliee,
    versionCourante: p.versionCourante,
    compte: p.compte,
    assets: p.assets.map((a) => a.asset),
    versions: p.versions.map((v) => ({
      version: v.version,
      corps: v.corps,
      accroche: v.accroche,
      premierCommentaire: v.premierCommentaire,
      tags: v.tags,
      motif: v.motif,
      creeA: v.createdAt.toISOString(),
    })),
  };
}

/** Les comptes actifs, pour les listes déroulantes de création. */
export async function listerComptesActifs(): Promise<
  { id: string; libelle: string; identite: string }[]
> {
  return prisma.edCompte.findMany({
    where: { actif: true },
    select: { id: true, libelle: true, identite: true },
    orderBy: { libelle: "asc" },
  });
}

export interface LigneIdee {
  id: string;
  titre: string;
  detail: string | null;
  statut: string;
  interet: number | null;
  promueVersId: string | null;
  creeA: string;
}

export async function listerIdees(statut?: string): Promise<LigneIdee[]> {
  const idees = await prisma.edIdee.findMany({
    where: statut ? { statut: statut as never } : { statut: { not: "archivee" } },
    select: {
      id: true,
      titre: true,
      detail: true,
      statut: true,
      interet: true,
      promueVersId: true,
      createdAt: true,
    },
    orderBy: [{ interet: "desc" }, { createdAt: "desc" }],
    take: 200,
  });
  return idees.map((i) => ({
    id: i.id,
    titre: i.titre,
    detail: i.detail,
    statut: i.statut,
    interet: i.interet,
    promueVersId: i.promueVersId,
    creeA: i.createdAt.toISOString(),
  }));
}

/**
 * Les publications à J-N dont l'asset n'est pas prêt — critère 18 du lot 1.
 *
 * Le seuil vient de la règle d'alerte `asset-retard` (§9), lue EN BASE : le
 * tableau de bord et l'alerte doivent dire la même chose, et ils le diront
 * tant qu'ils lisent la même valeur.
 */
export async function publicationsSansAssetPret(aujourdhui: Date): Promise<{
  jours: number;
  lignes: LignePublication[];
}> {
  const regle = await prisma.edRegleAlerte.findUnique({ where: { code: "asset-retard" } });
  const parametres = (regle?.parametres ?? {}) as { jours?: number };
  const jours = typeof parametres.jours === "number" ? parametres.jours : 3;

  const debut = new Date(
    Date.UTC(aujourdhui.getUTCFullYear(), aujourdhui.getUTCMonth(), aujourdhui.getUTCDate()),
  );
  const fin = new Date(debut);
  fin.setUTCDate(fin.getUTCDate() + jours + 1);

  const lignes = await prisma.edPublication.findMany({
    where: {
      archiveeA: null,
      datePrevue: { gte: debut, lt: fin },
      // « Sans asset prêt » : tout sauf `pret` et `non_requis`. Une
      // publication en texte seul n'est pas en retard — elle n'attend rien.
      statutAsset: { in: ["a_produire", "en_cours", "a_valider"] },
      statutDiffusion: { not: "publie" },
    },
    select: {
      id: true,
      datePrevue: true,
      heurePrevue: true,
      titreInterne: true,
      statutRedaction: true,
      statutAsset: true,
      statutDiffusion: true,
      tags: true,
      sourceId: true,
      versionCourante: true,
      compte: { select: { libelle: true, identite: true } },
    },
    orderBy: [{ datePrevue: "asc" }, { heurePrevue: "asc" }],
    take: 50,
  });

  return {
    jours,
    lignes: lignes.map((l) => ({
      id: l.id,
      dayKey: dayKeyOfGridDate(l.datePrevue),
      heurePrevue: l.heurePrevue,
      titreInterne: l.titreInterne,
      compteLibelle: l.compte.libelle,
      identite: l.compte.identite,
      statutRedaction: l.statutRedaction,
      statutAsset: l.statutAsset,
      statutDiffusion: l.statutDiffusion,
      tags: l.tags,
      estReprise: l.sourceId !== null,
      versionCourante: l.versionCourante,
    })),
  };
}
