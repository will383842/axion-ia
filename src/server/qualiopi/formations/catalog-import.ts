/**
 * Qualiopi — Import du catalogue marketing (catalog-v2.ts) vers la table Formation.
 *
 * Pont entre le SSOT public statique (17 formations, `src/content/formations/
 * catalog-v2.ts`) et le référentiel opérationnel `Formation` (DB) requis pour
 * créer des sessions, conventions, certificats et factures. Sans cet import, un
 * admin devrait re-saisir chaque formation à la main avant toute facturation.
 *
 * Propriétés :
 *   - IDEMPOTENT par slug : ne crée que les formations absentes.
 *   - AUTO-SYNCÉ (WS2) : sur ré-exécution, réconcilie les 7 champs partagés avec
 *     le catalogue via un merge 3-way (catalogue vs DB vs `catalogSnapshot`).
 *     Une formation déjà en base est mise à jour si le catalogue a bougé ET que
 *     l'admin n'a pas édité le champ ; en cas de conflit (édition admin + champ
 *     catalogue modifié) le champ admin est PRÉSERVÉ et l'écart est reporté
 *     (`drifted`) pour revue. Sans baseline (`catalogSnapshot` null, lignes
 *     créées avant WS2) on ne devine pas une édition admin → on ne réécrit pas,
 *     on reporte l'écart si catalogue ≠ DB et on adopte le catalogue en baseline
 *     quand ils coïncident.
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
import { ratioPratiqueDeclarable } from "./ratio-pratique";
import { nextNumero } from "../numbering/allocate";
import { countLockingSessions } from "./edit-guard";

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
 * 🔴 `const RATIO_PRATIQUE_PCT = 70` vivait ici, et cette valeur partait dans
 * `Formation.ratioPratiquePct` — c'est-à-dire dans le programme officiel remis
 * au client et à l'OPCO — pour les 22 formations, sans que personne ne l'ait
 * jamais vérifiée. Les minutages reconstitués le 2026-08-06 donnent 41 à 62 %
 * selon les fiches : de 8 à 29 points d'écart sur une donnée opposable en audit.
 *
 * Le ratio est désormais CALCULÉ depuis le programme (cf. `ratio-pratique.ts`),
 * et vaut `null` tant qu'aucune durée n'est renseignée — ce qui est le cas des
 * 22 fiches actuelles. Une case vide appelle une correction ; un chiffre faux
 * se défend devant un auditeur.
 */

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
  /** Prérequis (depuis catalogue prerequisFr) — enrichit la génération IA. */
  prerequis: string;
  /** `null` tant que le programme n'est pas minuté — jamais une valeur de repli. */
  ratioPratiquePct: number | null;
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
    prerequis: f.prerequisFr ?? "",
    // Calculé, jamais présumé — `null` tant que le programme n'est pas minuté.
    ratioPratiquePct: ratioPratiqueDeclarable(programmeDetaille, f.duree),
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
// Réconciliation 3-way catalogue ↔ DB ↔ snapshot (pur, testable sans DB)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Les 7 champs qu'un import écrit ET qu'un admin peut éditer : seuls ceux-là
 * font l'objet du merge 3-way (les autres — numéro, offre, statut… — ne sont
 * jamais touchés par une re-synchro). Ordre figé = clés du `catalogSnapshot`.
 */
export const RECONCILED_FIELDS = [
  "titre",
  "objectifsPedagogiques",
  "programmeDetaille",
  "methodesPedagogiques",
  "ratioPratiquePct",
  "accessibleHandicap",
  "certificationType",
] as const;

export type ReconciledField = (typeof RECONCILED_FIELDS)[number];

/** Sous-ensemble catalogue persisté comme baseline du merge. */
export type CatalogSnapshot = Pick<FormationImportData, ReconciledField>;

/** Valeurs DB courantes des 7 champs réconciliés (lues sur la Formation). */
export type FormationReconcileCurrent = {
  [K in ReconciledField]: FormationImportData[K] | null | undefined;
};

/** Extrait la baseline catalogue (7 champs) des données d'import dérivées. */
export function toCatalogSnapshot(data: FormationImportData): CatalogSnapshot {
  return {
    titre: data.titre,
    objectifsPedagogiques: data.objectifsPedagogiques,
    programmeDetaille: data.programmeDetaille,
    methodesPedagogiques: data.methodesPedagogiques,
    ratioPratiquePct: data.ratioPratiquePct,
    accessibleHandicap: data.accessibleHandicap,
    certificationType: data.certificationType,
  };
}

/** Égalité structurelle stable (JSON canonique à clés triées). */
function deepEqual(a: unknown, b: unknown): boolean {
  return canonical(a) === canonical(b);
}

function canonical(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

export interface ReconcileResult {
  /** Champs à écrire en DB (catalogue adopté, aucun conflit). */
  updates: Partial<CatalogSnapshot>;
  /** Champs auto-synchronisés depuis le catalogue (= clés de `updates`). */
  syncedFields: ReconciledField[];
  /** Champs en conflit (édition admin préservée) → revue manuelle. */
  driftFields: ReconciledField[];
  /** Nouvelle baseline à persister (catalogue adopté sauf champs en conflit). */
  nextSnapshot: CatalogSnapshot;
}

/**
 * Merge 3-way pur d'une Formation existante.
 *
 * Pour chaque champ réconcilié :
 *   - DB == catalogue → rien à faire (baseline adoptée = catalogue).
 *   - DB ≠ catalogue, pas de baseline → écart reporté, DB préservée (on ne sait
 *     pas distinguer édition admin d'une création stale).
 *   - DB ≠ catalogue, DB == baseline → l'admin n'a pas touché, le catalogue a
 *     bougé → auto-synchro vers le catalogue.
 *   - DB ≠ catalogue, DB ≠ baseline → édition admin + catalogue modifié =
 *     conflit → DB préservée, écart reporté, baseline NON adoptée pour ce champ.
 */
export function reconcileFormationFields(
  desired: CatalogSnapshot,
  current: FormationReconcileCurrent,
  snapshot: CatalogSnapshot | null,
): ReconcileResult {
  const updates: Partial<CatalogSnapshot> = {};
  const syncedFields: ReconciledField[] = [];
  const driftFields: ReconciledField[] = [];
  const nextSnapshot = { ...(snapshot ?? ({} as CatalogSnapshot)) } as CatalogSnapshot;

  for (const field of RECONCILED_FIELDS) {
    const d = desired[field];
    const c = current[field];
    const hasSnapshot = snapshot !== null && field in snapshot;

    if (deepEqual(d, c)) {
      // DB déjà aligné sur le catalogue → on adopte le catalogue en baseline.
      assignSnapshot(nextSnapshot, field, d);
      continue;
    }
    if (!hasSnapshot) {
      // Pas de baseline → on ne réécrit pas, on signale juste l'écart.
      driftFields.push(field);
      continue;
    }
    if (deepEqual(c, snapshot[field])) {
      // Admin n'a pas touché, catalogue a bougé → synchro sûre.
      assignSnapshot(updates, field, d);
      assignSnapshot(nextSnapshot, field, d);
      syncedFields.push(field);
    } else {
      // Conflit : édition admin + catalogue modifié → on préserve l'admin.
      driftFields.push(field);
    }
  }

  return { updates, syncedFields, driftFields, nextSnapshot };
}

function assignSnapshot<T extends Partial<CatalogSnapshot>>(
  target: T,
  field: ReconciledField,
  value: CatalogSnapshot[ReconciledField],
): void {
  (target as Record<string, unknown>)[field] = value;
}

// ─────────────────────────────────────────────────────────────────────────────
// Service d'import (I/O — DB via client injecté)
// ─────────────────────────────────────────────────────────────────────────────

export interface CatalogImportOptions {
  adminUserId?: string | null;
  now?: Date;
}

export type CatalogImportStatus =
  | "created"
  | "unchanged"
  | "synced"
  | "drifted"
  | "skipped_offre_absente";

export interface CatalogImportItemResult {
  slug: string;
  titre: string;
  status: CatalogImportStatus;
  numero?: string;
  /** Champs auto-synchronisés depuis le catalogue (status `synced`). */
  syncedFields?: ReconciledField[];
  /** Champs en écart non résolu (status `drifted`) → revue admin. */
  driftFields?: ReconciledField[];
}

export interface CatalogImportReport {
  total: number;
  created: number;
  /** Existantes alignées sur le catalogue (rien à faire). */
  skippedExistantes: number;
  /** Existantes auto-synchronisées depuis le catalogue. */
  synced: number;
  /** Existantes en écart non résolu (édition admin ≠ catalogue) → revue. */
  drifted: number;
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
  now: Date,
): Promise<{ id: string; numero: string }> {
  let lastErr: unknown;
  // Baseline 3-way posée dès la création : toute re-synchro future part de l'état
  // catalogue exact à l'import (cf. reconcileFormationFields).
  const catalogSnapshot = toCatalogSnapshot(data);
  for (let attempt = 0; attempt < 5; attempt++) {
    // 🔴 V20 — même série que `allocateFormationNumero`, donc même mécanique
    // OBLIGATOIREMENT. Deux allocateurs de la même série dont l'un compte et
    // l'autre lit le max divergeraient dès le premier trou. (Le filtre d'année,
    // posé ici par F63 le 2026-07-26, est désormais porté par `seriesPrefix`.)
    const numero = await nextNumero("formation", year, (prefixe) =>
      db.formation.findMany({
        where: { numero: { startsWith: prefixe } },
        select: { numero: true },
      }),
    );
    try {
      const created = await db.formation.create({
        // Cast contrôlé : champs Json (objectifs/programme/ressources) + enums
        // string-literaux acceptés par l'UncheckedCreateInput (offreSiteId scalaire).
        data: { numero, ...data, catalogSnapshot, catalogSyncedAt: now } as never,
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

/** Sélection des 7 champs réconciliés + baseline, lue sur une Formation existante. */
const RECONCILE_SELECT = {
  id: true,
  titre: true,
  objectifsPedagogiques: true,
  programmeDetaille: true,
  methodesPedagogiques: true,
  ratioPratiquePct: true,
  accessibleHandicap: true,
  certificationType: true,
  catalogSnapshot: true,
} as const;

/**
 * Importe les 17 formations du catalogue V2 dans la table Formation, puis
 * RÉCONCILIE les existantes (merge 3-way, cf. reconcileFormationFields).
 *
 * Une offre V2 absente (seed offres non lancé) → `skipped_offre_absente` (jamais
 * bloquante). Une existante est reportée `unchanged` / `synced` / `drifted`.
 *
 * @param db          Client Prisma (singleton runtime OU PrismaClient du seed).
 * @param opts.adminUserId  Admin déclencheur (validatedBy + audit). Null en seed.
 */
export async function importCatalogFormations(
  db: PrismaClient,
  opts: CatalogImportOptions = {},
): Promise<CatalogImportReport> {
  const now = opts.now ?? new Date();
  const year = now.getFullYear();
  const ordered = [...FORMATIONS_V2].sort((a, b) => a.numero - b.numero);

  // Garde build/SSG (ADR 0026) : sous l'URL stub, le Proxy Prisma throw sur toute
  // mutation. Aucune synchro à effectuer hors runtime/seed → rapport vide.
  if (process.env.DATABASE_URL?.includes("stub.invalid")) {
    return {
      total: ordered.length,
      created: 0,
      skippedExistantes: 0,
      synced: 0,
      drifted: 0,
      skippedOffreAbsente: 0,
      items: [],
    };
  }

  const items: CatalogImportItemResult[] = [];
  let created = 0;
  let skippedExistantes = 0;
  let synced = 0;
  let drifted = 0;
  let skippedOffreAbsente = 0;

  for (const f of ordered) {
    // 1) Offre V2 rattachée (liaison obligatoire) — résolue par slug.
    const offre = await db.offreSite.findUnique({
      where: { slug: f.slugFr },
      select: { id: true },
    });
    if (!offre) {
      skippedOffreAbsente += 1;
      items.push({ slug: f.slugFr, titre: f.titreFr, status: "skipped_offre_absente" });
      continue;
    }

    const data = buildFormationImportData(f, offre.id, {
      adminUserId: opts.adminUserId ?? null,
      now,
    });

    // 2) Déjà en base (par slug) → réconcilier (merge 3-way), jamais clobber.
    const existing = await db.formation.findUnique({
      where: { slug: f.slugFr },
      select: RECONCILE_SELECT,
    });
    if (existing) {
      const { id, catalogSnapshot, ...current } = existing as Record<string, unknown> & {
        id: string;
        catalogSnapshot: unknown;
      };
      const result = reconcileFormationFields(
        toCatalogSnapshot(data),
        current as FormationReconcileCurrent,
        (catalogSnapshot as CatalogSnapshot | null) ?? null,
      );

      // Alignement WS4 : on n'auto-réécrit JAMAIS le contenu d'une formation dont
      // une session est en cours/réalisée (contenu Qualiopi figé). Les champs qui
      // auraient été synchronisés deviennent des écarts (drift) à arbitrer
      // manuellement (archivage + duplication). La baseline n'est PAS adoptée sur
      // ces champs → l'écart persiste au prochain import jusqu'à résolution.
      if (result.syncedFields.length > 0 && (await countLockingSessions(db, id)) > 0) {
        const baseline = (catalogSnapshot ?? null) as Record<string, unknown> | null;
        for (const field of result.syncedFields) {
          delete (result.updates as Record<string, unknown>)[field];
          if (baseline && field in baseline) {
            (result.nextSnapshot as Record<string, unknown>)[field] = baseline[field];
          } else {
            delete (result.nextSnapshot as Record<string, unknown>)[field];
          }
        }
        result.driftFields.push(...result.syncedFields);
        result.syncedFields.length = 0;
      }

      if (result.driftFields.length > 0) {
        // Écart non résolu : on persiste la baseline (champs sûrs adoptés) +
        // l'horodatage de drift, sans toucher aux champs en conflit.
        drifted += 1;
        await db.formation.update({
          where: { id },
          data: {
            ...(result.updates as Record<string, unknown>),
            catalogSnapshot: result.nextSnapshot as never,
            catalogDriftAt: now,
            ...(result.syncedFields.length > 0 ? { catalogSyncedAt: now } : {}),
          } as never,
        });
        items.push({
          slug: f.slugFr,
          titre: f.titreFr,
          status: "drifted",
          driftFields: result.driftFields,
          ...(result.syncedFields.length > 0 ? { syncedFields: result.syncedFields } : {}),
        });
        continue;
      }

      if (result.syncedFields.length > 0) {
        // Synchro propre : catalogue adopté, baseline + syncedAt rafraîchis,
        // drift effacé.
        synced += 1;
        await db.formation.update({
          where: { id },
          data: {
            ...(result.updates as Record<string, unknown>),
            catalogSnapshot: result.nextSnapshot as never,
            catalogSyncedAt: now,
            catalogDriftAt: null,
          } as never,
        });
        items.push({
          slug: f.slugFr,
          titre: f.titreFr,
          status: "synced",
          syncedFields: result.syncedFields,
        });
        continue;
      }

      // Rien à synchroniser. On (re)pose la baseline si elle manquait (ligne
      // créée avant WS2) pour activer le merge 3-way dès le prochain import.
      skippedExistantes += 1;
      if (catalogSnapshot == null) {
        await db.formation.update({
          where: { id },
          data: { catalogSnapshot: result.nextSnapshot as never, catalogSyncedAt: now } as never,
        });
      }
      items.push({ slug: f.slugFr, titre: f.titreFr, status: "unchanged" });
      continue;
    }

    // 3) Création session-ready (baseline posée à la création).
    const row = await createFormationWithNumero(db, data, year, now);
    created += 1;
    items.push({ slug: f.slugFr, titre: f.titreFr, status: "created", numero: row.numero });
  }

  return {
    total: ordered.length,
    created,
    skippedExistantes,
    synced,
    drifted,
    skippedOffreAbsente,
    items,
  };
}
