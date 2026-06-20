/**
 * Qualiopi — Import du catalogue marketing (catalog-v2.ts) vers la table Formation.
 *
 * Pont entre le SSOT public statique (17 formations, `src/content/formations/
 * catalog-v2.ts`) et le référentiel opérationnel `Formation` (DB) requis pour
 * créer des sessions, conventions, certificats et factures. Sans cet import, un
 * admin devrait re-saisir chaque formation à la main avant toute facturation.
 *
 * Propriétés :
 *   - IDEMPOTENT par slug : ne crée que les formations absentes, ne TOUCHE PAS
 *     les formations déjà en base (préserve les éventuelles éditions admin).
 *   - SESSION-READY : les formations créées sortent en `statutGeneration='publie'`
 *     + `statut='actif'` → `canCreateSessionFor()` les accepte immédiatement
 *     (cf. sessions.ts). Le contenu (objectifs, programme, public, durée) est
 *     repris VERBATIM du catalogue ; les méthodes/moyens reçoivent un libellé
 *     standard fidèle au format atelier (l'admin peut affiner par formation).
 *   - NON IA : `aiGenerated=false` (contenu rédigé humainement) → aucune
 *     obligation de validation AI Act art. 50. `validatedBy/At` sont posés quand
 *     l'import est déclenché par un admin (traçabilité), null en contexte seed.
 *   - LIAISON OBLIGATOIRE offre : chaque Formation est rattachée à son `OffreSite`
 *     (résolu par slug = slugFr) ; une formation dont l'offre V2 manque est
 *     ignorée et reportée (lancer `pnpm qualiopi:seed` d'abord).
 *
 * Aucune fuite publique : la fiche publique `/formations/[slug]` priorise le
 * catalogue statique et reste gated par `OF_PUBLIC_DISCLOSURE_ENABLED` (Phase A).
 *
 * Imports RELATIFS (pas d'alias `@/`) pour rester exécutable côté Next ET côté
 * seed `tsx` (`prisma/seeds/qualiopi/catalog-formations.ts`).
 */

import type { PrismaClient } from "../../../../prisma/generated/client";
import type { FormationDuree } from "../../../content/pricing";
import type { FormationV2 } from "../../../content/formations/catalog-v2";
import { FORMATIONS_V2 } from "../../../content/formations/catalog-v2";
import { formatDocumentNumber } from "../numbering/formats";

// ─────────────────────────────────────────────────────────────────────────────
// Constantes de mapping (alignées sur catalog-v2-meta + seed offres-v2)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Heures face-à-face canoniques par durée catalogue. Cohérent avec
 * `FORMATION_DUREE_ISO` (1j = PT7H) et inclus dans les plages `OffreSite`
 * (`DUREE_HEURES` du seed offres-v2 : 4h[4,4] · 1j[6,8] · 2j[12,14] · 3j[18,21]).
 */
const CANONICAL_DUREE_HEURES: Record<FormationDuree, number> = {
  "4h": 4,
  "1j": 7,
  "2j": 14,
  "3j": 21,
};

/**
 * Ratio pratique affiché (≥ plancher Qualiopi `ratio_pratique_min`, défaut 60 %).
 * Les formats catalogue sont des ateliers (production réelle dès la séance) →
 * 70 % est un plancher honnête et fidèle au déroulé.
 */
const RATIO_PRATIQUE_PCT = 70;

const METHODES_PEDAGOGIQUES =
  "Pédagogie active et inductive : chaque participant produit dès la séance sur " +
  "ses propres cas (atelier majoritaire), en alternance avec de courtes " +
  "démonstrations. Reformulation, itération guidée jusqu'au résultat attendu, " +
  "quiz de clôture et engagement individuel.";

const MOYENS_TECHNIQUES =
  "Salle équipée et vidéoprojecteur en présentiel, ou visioconférence en " +
  "distanciel. Chaque participant utilise son smartphone ou son poste avec un " +
  "compte IA gratuit ; aucun prérequis matériel ni installation.";

const RESSOURCES_PEDAGOGIQUES: ReadonlyArray<{ type: string; libelle: string }> = [
  { type: "support", libelle: "Support de présentation projeté en séance" },
  { type: "memo", libelle: "Fiche mémo des méthodes vues (réutilisable au poste)" },
  { type: "exercices", libelle: "Exercices pratiques sur les cas réels des participants" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Mapping pur (testable sans DB)
// ─────────────────────────────────────────────────────────────────────────────

export interface FormationObjectifPedagogique {
  id: string;
  /** Verbe d'action en tête d'objectif (indicateur 5). */
  verbe: string;
  description: string;
}

export interface FormationProgrammeSequence {
  id: string;
  titre: string;
  /** Repère de temps si présent dans le catalogue (« 35' », « Pause »). */
  temps?: string;
}

export interface FormationProgrammeModule {
  moduleId: string;
  titre: string;
  sequences: FormationProgrammeSequence[];
}

/** Données de création Formation dérivées d'une entrée catalogue (hors `numero`). */
export interface FormationImportData {
  titre: string;
  slug: string;
  offreSiteId: string;
  dureeHeures: number;
  modalite: "presentiel";
  objectifsPedagogiques: FormationObjectifPedagogique[];
  programmeDetaille: FormationProgrammeModule[];
  methodesPedagogiques: string;
  moyensTechniques: string;
  ressourcesPedagogiques: ReadonlyArray<{ type: string; libelle: string }>;
  accessibleHandicap: boolean;
  ratioPratiquePct: number;
  certificationType: "aucune";
  typesActionQualiopi: ["classique"];
  estSurMesure: false;
  aiGenerated: false;
  statutGeneration: "publie";
  statut: "actif";
  validatedBy: string | null;
  validatedAt: Date | null;
}

/** Premier mot (verbe d'action) d'un objectif pédagogique. */
export function premierVerbe(phrase: string): string {
  return phrase.trim().split(/\s+/)[0] ?? "";
}

export interface BuildFormationImportDataOptions {
  /** Admin déclencheur (validatedBy + validatedAt). Null en contexte seed. */
  adminUserId?: string | null;
  /** Horodatage de validation (injecté pour testabilité). Défaut : now. */
  now?: Date;
}

/**
 * Construit les données de création Formation à partir d'une entrée catalogue.
 * Pur : aucune I/O. `numero` est alloué séparément par le service (compteur DB).
 */
export function buildFormationImportData(
  f: FormationV2,
  offreSiteId: string,
  opts: BuildFormationImportDataOptions = {},
): FormationImportData {
  const adminUserId = opts.adminUserId ?? null;
  const validatedAt = adminUserId ? (opts.now ?? new Date()) : null;

  const objectifsPedagogiques: FormationObjectifPedagogique[] = f.objectifsFr.map((o, i) => ({
    id: `obj-${i + 1}`,
    verbe: premierVerbe(o),
    description: o,
  }));

  const programmeDetaille: FormationProgrammeModule[] = f.programme.map((section, i) => ({
    moduleId: `mod-${i + 1}`,
    titre: section.titreFr,
    sequences: section.steps.map((step, j) => {
      const seq: FormationProgrammeSequence = {
        id: `seq-${i + 1}-${j + 1}`,
        titre: step.titre,
      };
      if (step.temps !== undefined) seq.temps = step.temps;
      return seq;
    }),
  }));

  return {
    titre: f.titreFr,
    slug: f.slugFr,
    offreSiteId,
    dureeHeures: CANONICAL_DUREE_HEURES[f.duree],
    modalite: "presentiel",
    objectifsPedagogiques,
    programmeDetaille,
    methodesPedagogiques: METHODES_PEDAGOGIQUES,
    moyensTechniques: MOYENS_TECHNIQUES,
    ressourcesPedagogiques: RESSOURCES_PEDAGOGIQUES,
    // Formats sans prérequis, adaptables (référent handicap org, indicateur 26).
    accessibleHandicap: true,
    ratioPratiquePct: RATIO_PRATIQUE_PCT,
    certificationType: "aucune",
    typesActionQualiopi: ["classique"],
    estSurMesure: false,
    aiGenerated: false,
    statutGeneration: "publie",
    statut: "actif",
    validatedBy: adminUserId,
    validatedAt,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Service d'import (I/O — DB via client injecté)
// ─────────────────────────────────────────────────────────────────────────────

export interface CatalogImportOptions {
  adminUserId?: string | null;
  now?: Date;
}

export type CatalogImportStatus = "created" | "skipped_existante" | "skipped_offre_absente";

export interface CatalogImportItemResult {
  slug: string;
  titre: string;
  status: CatalogImportStatus;
  numero?: string;
}

export interface CatalogImportReport {
  total: number;
  created: number;
  skippedExistantes: number;
  skippedOffreAbsente: number;
  items: CatalogImportItemResult[];
}

/** Détection structurelle d'une violation d'unicité Prisma (P2002). */
function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

/**
 * Crée une Formation avec allocation de `numero` (AXI-FORM-YYYY-NNN) et retry
 * sur collision d'unicité (numéro OU slug), comme `withNumberRetry` côté action.
 */
async function createFormationWithNumero(
  db: PrismaClient,
  data: FormationImportData,
  year: number,
): Promise<{ id: string; numero: string }> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    const count = await db.formation.count();
    const numero = formatDocumentNumber("formation", year, count + 1);
    try {
      const created = await db.formation.create({
        // Cast contrôlé : champs Json (objectifs/programme/ressources) + enums
        // string-literaux acceptés par l'UncheckedCreateInput (offreSiteId scalaire).
        data: { numero, ...data } as never,
        select: { id: true, numero: true },
      });
      return created;
    } catch (err) {
      lastErr = err;
      if (isUniqueViolation(err) && attempt < 4) continue;
      throw err;
    }
  }
  throw lastErr;
}

/**
 * Importe les 17 formations du catalogue V2 dans la table Formation.
 *
 * Idempotent : une formation déjà présente (par slug) est préservée et reportée
 * `skipped_existante`. Une offre V2 absente (seed offres non lancé) → la
 * formation est reportée `skipped_offre_absente` (jamais bloquante).
 *
 * @param db          Client Prisma (singleton runtime OU PrismaClient du seed).
 * @param opts.adminUserId  Admin déclencheur (validatedBy + audit). Null en seed.
 */
export async function importCatalogFormations(
  db: PrismaClient,
  opts: CatalogImportOptions = {},
): Promise<CatalogImportReport> {
  const year = (opts.now ?? new Date()).getFullYear();
  const ordered = [...FORMATIONS_V2].sort((a, b) => a.numero - b.numero);

  const items: CatalogImportItemResult[] = [];
  let created = 0;
  let skippedExistantes = 0;
  let skippedOffreAbsente = 0;

  for (const f of ordered) {
    // 1) Déjà en base (par slug) → préserver, ne rien toucher.
    const existing = await db.formation.findUnique({
      where: { slug: f.slugFr },
      select: { id: true },
    });
    if (existing) {
      skippedExistantes += 1;
      items.push({ slug: f.slugFr, titre: f.titreFr, status: "skipped_existante" });
      continue;
    }

    // 2) Offre V2 rattachée (liaison obligatoire) — résolue par slug.
    const offre = await db.offreSite.findUnique({
      where: { slug: f.slugFr },
      select: { id: true },
    });
    if (!offre) {
      skippedOffreAbsente += 1;
      items.push({ slug: f.slugFr, titre: f.titreFr, status: "skipped_offre_absente" });
      continue;
    }

    // 3) Création session-ready.
    const data = buildFormationImportData(f, offre.id, {
      adminUserId: opts.adminUserId ?? null,
      ...(opts.now !== undefined ? { now: opts.now } : {}),
    });
    const row = await createFormationWithNumero(db, data, year);
    created += 1;
    items.push({ slug: f.slugFr, titre: f.titreFr, status: "created", numero: row.numero });
  }

  return {
    total: ordered.length,
    created,
    skippedExistantes,
    skippedOffreAbsente,
    items,
  };
}
