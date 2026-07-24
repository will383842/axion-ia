/**
 * Qualiopi — Nettoyage générique du référentiel Formation/OffreSite (console).
 *
 * POURQUOI CE MODULE EXISTE
 * -------------------------
 * `archiveReplacedCatalogue()` (offres-v2.ts) archivait les formations obsolètes
 * à partir d'une LISTE DE SLUGS EN DUR (`REPLACED_AXION_SLUGS`), écrite à la main
 * lors de la refonte du 2026-07-19. Cette approche a un défaut structurel : elle
 * n'attrape que la génération que son auteur a pensé à lister.
 *
 * Constat (audit 2026-07-24) : la refonte du 2026-07-15 (commit 630b8b75,
 * « remplace les 17 formations par la nouvelle offre AXION ») n'a touché AUCUN
 * fichier de seed. Les 17 formations de la génération précédente (`ia-express`,
 * `art-du-prompt`, `claude-architecte`…) n'ont donc jamais été archivées : elles
 * restent `statut='actif'` + `statutGeneration='publie'`, donc acceptées par
 * `canCreateSessionFor()` et sélectionnables pour créer une session ou facturer.
 *
 * Ce module remplace la liste en dur par une RÈGLE dérivée du SSOT :
 *
 *   « Toute Formation dont le slug n'est plus dans `FORMATIONS_V2` doit être
 *     archivée — sauf si elle est sur-mesure (client spécifique), auquel cas
 *     elle n'a par définition jamais eu vocation à figurer au catalogue. »
 *
 * Appelé à chaque `pnpm qualiopi:seed`, il rend le problème structurellement
 * impossible : une future refonte du catalogue nettoie l'ancienne génération
 * sans qu'on ait à y penser.
 *
 * NON DESTRUCTIF — on ARCHIVE, on ne SUPPRIME jamais. Une formation archivée
 * sort du sélecteur de session mais conserve ses sessions, conventions,
 * attestations et factures (conservation légale 5 ans, indicateur Qualiopi).
 *
 * Helpers purs (aucune I/O) + un service Prisma, pour être testable sans DB et
 * exécutable aussi bien depuis le seed (`tsx`) que depuis une action console.
 */

import type { PrismaClient } from "../../../../prisma/generated/client";
import { FORMATIONS_V2 } from "../../../content/formations/catalog-v2";

// ─────────────────────────────────────────────────────────────────────────────
// Types (sous-ensembles minimaux — sélectionnés par le service)
// ─────────────────────────────────────────────────────────────────────────────

/** Champs Formation nécessaires au calcul du plan. */
export interface FormationCleanupRow {
  id: string;
  numero: string;
  slug: string;
  titre: string;
  /** `actif` | `publie` | `archive`. */
  statut: string;
  estSurMesure: boolean;
  offreSiteId: string;
}

/** Champs OffreSite nécessaires au calcul du plan. */
export interface OffreCleanupRow {
  id: string;
  code: string;
  slug: string;
  titreFr: string;
  actif: boolean;
}

export interface CataloguePlanInput {
  formations: ReadonlyArray<FormationCleanupRow>;
  offres: ReadonlyArray<OffreCleanupRow>;
  /** Slugs du catalogue public courant (SSOT). */
  catalogSlugs: ReadonlySet<string>;
  /**
   * Si false, les offres legacy (série `AXI-OFF-0xx`, portant un `tierId`
   * pricing.ts) sont épargnées même hors catalogue. Défaut : true (on nettoie).
   */
  includeLegacyOffres?: boolean;
  /** Codes d'offres à ne jamais désactiver (legacy identifiées par le service). */
  legacyOffreIds?: ReadonlySet<string>;
}

export interface CataloguePlan {
  /** Formations hors catalogue à passer en `statut='archive'`. */
  formationsToArchive: FormationCleanupRow[];
  /** Formations hors catalogue MAIS sur-mesure → conservées, listées pour info. */
  formationsSurMesureKept: FormationCleanupRow[];
  /** Offres à passer `actif=false` (hors catalogue, plus aucune formation vive). */
  offresToDeactivate: OffreCleanupRow[];
  /** Offres hors catalogue conservées car une formation vive y reste rattachée. */
  offresKeptWithLiveFormation: OffreCleanupRow[];
  /**
   * Anomalie : formation archivée dont le slug EST revenu au catalogue. On ne
   * la réactive PAS automatiquement (le contenu peut avoir divergé) — revue Will.
   */
  formationsArchiveesRevenuesAuCatalogue: FormationCleanupRow[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Plan (pur — aucune I/O)
// ─────────────────────────────────────────────────────────────────────────────

/** Slugs du catalogue public courant, dérivés du SSOT `catalog-v2.ts`. */
export function currentCatalogSlugs(): ReadonlySet<string> {
  return new Set(FORMATIONS_V2.map((f) => f.slugFr));
}

/** Une formation est « vivante » si elle n'est pas archivée. */
function estVivante(f: FormationCleanupRow): boolean {
  return f.statut !== "archive";
}

/**
 * Calcule le plan de nettoyage sans rien écrire.
 *
 * Ordre de raisonnement (important) : on détermine d'abord les formations à
 * archiver, PUIS on regarde quelles offres se retrouvent sans aucune formation
 * vivante — sinon on désactiverait une offre encore portée par une formation
 * sur-mesure en cours.
 */
export function planCatalogueCleanup(input: CataloguePlanInput): CataloguePlan {
  const { formations, offres, catalogSlugs } = input;
  const includeLegacy = input.includeLegacyOffres ?? true;
  const legacyIds = input.legacyOffreIds ?? new Set<string>();

  const formationsToArchive: FormationCleanupRow[] = [];
  const formationsSurMesureKept: FormationCleanupRow[] = [];
  const formationsArchiveesRevenuesAuCatalogue: FormationCleanupRow[] = [];

  for (const f of formations) {
    const auCatalogue = catalogSlugs.has(f.slug);

    if (auCatalogue) {
      // Slug présent au catalogue : rien à faire, sauf si elle est archivée —
      // cas d'une formation retirée puis remise au catalogue → revue manuelle.
      if (!estVivante(f)) formationsArchiveesRevenuesAuCatalogue.push(f);
      continue;
    }
    if (!estVivante(f)) continue; // déjà archivée, hors catalogue → rien à faire
    if (f.estSurMesure) {
      // Une formation sur-mesure est rattachée à un client précis ; elle n'a
      // jamais eu vocation à figurer au catalogue public → on la conserve.
      formationsSurMesureKept.push(f);
      continue;
    }
    formationsToArchive.push(f);
  }

  // Offres : celles qui, APRÈS archivage, ne portent plus aucune formation vive.
  const idsArchivees = new Set(formationsToArchive.map((f) => f.id));
  const offresAvecFormationVive = new Set<string>();
  for (const f of formations) {
    if (!estVivante(f)) continue;
    if (idsArchivees.has(f.id)) continue; // sera archivée par ce plan
    offresAvecFormationVive.add(f.offreSiteId);
  }

  const offresToDeactivate: OffreCleanupRow[] = [];
  const offresKeptWithLiveFormation: OffreCleanupRow[] = [];

  for (const o of offres) {
    if (!o.actif) continue;
    if (catalogSlugs.has(o.slug)) continue;
    if (!includeLegacy && legacyIds.has(o.id)) continue;
    if (offresAvecFormationVive.has(o.id)) {
      offresKeptWithLiveFormation.push(o);
      continue;
    }
    offresToDeactivate.push(o);
  }

  return {
    formationsToArchive,
    formationsSurMesureKept,
    offresToDeactivate,
    offresKeptWithLiveFormation,
    formationsArchiveesRevenuesAuCatalogue,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Service (I/O — client Prisma injecté)
// ─────────────────────────────────────────────────────────────────────────────

const FORMATION_SELECT = {
  id: true,
  numero: true,
  slug: true,
  titre: true,
  statut: true,
  estSurMesure: true,
  offreSiteId: true,
} as const;

const OFFRE_SELECT = {
  id: true,
  code: true,
  slug: true,
  titreFr: true,
  actif: true,
  tierId: true,
} as const;

export interface CleanupOptions {
  /** false (défaut) = simulation, aucune écriture. true = applique. */
  apply?: boolean;
  /** false = épargne les offres legacy (celles portant un `tierId`). */
  includeLegacyOffres?: boolean;
}

export interface CleanupResult extends CataloguePlan {
  applied: boolean;
  formationsArchivedCount: number;
  offresDeactivatedCount: number;
}

/**
 * Lit l'état du référentiel, calcule le plan, et l'applique si `apply=true`.
 *
 * Garde build (ADR 0026) : sous l'URL stub, le Proxy Prisma renvoie `[]` sur
 * les lectures et throw sur les mutations → on sort avec un plan vide.
 */
export async function cleanupCatalogue(
  db: PrismaClient,
  opts: CleanupOptions = {},
): Promise<CleanupResult> {
  const apply = opts.apply ?? false;

  if (process.env.DATABASE_URL?.includes("stub.invalid")) {
    return {
      applied: false,
      formationsToArchive: [],
      formationsSurMesureKept: [],
      offresToDeactivate: [],
      offresKeptWithLiveFormation: [],
      formationsArchiveesRevenuesAuCatalogue: [],
      formationsArchivedCount: 0,
      offresDeactivatedCount: 0,
    };
  }

  const formations = (await db.formation.findMany({
    select: FORMATION_SELECT,
    orderBy: { createdAt: "asc" },
  })) as unknown as FormationCleanupRow[];

  const offresRaw = (await db.offreSite.findMany({
    select: OFFRE_SELECT,
    orderBy: { code: "asc" },
  })) as unknown as Array<OffreCleanupRow & { tierId: string | null }>;

  // « Legacy » = offre rattachée à un tier pricing.ts (série AXI-OFF-001→011),
  // par opposition aux offres catalogue V2 (tierId null, prix par matrice).
  const legacyOffreIds = new Set(offresRaw.filter((o) => o.tierId !== null).map((o) => o.id));
  const offres: OffreCleanupRow[] = offresRaw.map(({ tierId: _tierId, ...rest }) => rest);

  const plan = planCatalogueCleanup({
    formations,
    offres,
    catalogSlugs: currentCatalogSlugs(),
    ...(opts.includeLegacyOffres !== undefined
      ? { includeLegacyOffres: opts.includeLegacyOffres }
      : {}),
    legacyOffreIds,
  });

  if (!apply) {
    return {
      ...plan,
      applied: false,
      formationsArchivedCount: 0,
      offresDeactivatedCount: 0,
    };
  }

  let formationsArchivedCount = 0;
  let offresDeactivatedCount = 0;

  if (plan.formationsToArchive.length > 0) {
    const res = await db.formation.updateMany({
      where: { id: { in: plan.formationsToArchive.map((f) => f.id) } },
      data: { statut: "archive" },
    });
    formationsArchivedCount = res.count;
  }
  if (plan.offresToDeactivate.length > 0) {
    const res = await db.offreSite.updateMany({
      where: { id: { in: plan.offresToDeactivate.map((o) => o.id) } },
      data: { actif: false },
    });
    offresDeactivatedCount = res.count;
  }

  return { ...plan, applied: true, formationsArchivedCount, offresDeactivatedCount };
}
