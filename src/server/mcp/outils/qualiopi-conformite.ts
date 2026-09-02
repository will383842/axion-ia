/**
 * `axionia.qualiopi.conformite` — les alertes de conformité réglementaire.
 *
 * ⚠️ S'APPUIE SUR LA LECTURE PERSISTÉE `listAlertes()`, PAS SUR L'ÉVALUATEUR.
 *    `evaluerAlertesDetaille()` boucle séquentiellement sur 47 règles dont
 *    31 `findMany` sans `take`, et son propre commentaire dit que « le coût réel
 *    de ces 31 requêtes n'est aujourd'hui pas mesuré » — face à un budget de
 *    1,5 s au p95. Le cahier des charges le tranche : brancher sur la table
 *    `AlerteSysteme`, que la synchronisation planifiée alimente.
 *
 * Ce fichier importe le domaine Qualiopi : il est inscrit NOMINATIVEMENT dans
 * `CONSOMMATEURS_ASSUMES` de `scripts/qualiopi/isolation-check.ts` — jamais par
 * un motif de répertoire, que ce script qualifie de blanc-seing.
 */

import { z } from "zod/v4";

import { listAlertes } from "@/server/qualiopi/alertes/alertes-service";
import { AlerteNiveau } from "../../../../prisma/generated/client";

import { definirOutil } from "../contrat";
import { iso, meta, schemaSortie } from "../sortie";

export const VERSION = "1.0.0";

/** Dérivé de l'énumération Prisma — jamais recopié. */
const NIVEAUX = Object.values(AlerteNiveau) as [AlerteNiveau, ...AlerteNiveau[]];

const LIMITE_PAR_DEFAUT = 30;
const LIMITE_MAXIMALE = 60;

const Entree = z.strictObject({
  /** Par défaut, seules les alertes NON résolues. */
  resolues: z.boolean().optional(),
  niveau: z.enum(NIVEAUX).optional(),
  limite: z.number().int().min(1).max(LIMITE_MAXIMALE).optional(),
});

const Item = z.strictObject({
  id: z.string().uuid(),
  /** Code du catalogue (`opco_sans_accord`, `qualiopi_expire_j30`…). */
  code: z.string().regex(/^[a-z][a-z0-9_]*$/),
  niveau: z.enum(NIVEAUX),
  titre: z.string(),
  message: z.string(),
  lu: z.boolean(),
  creeLe: z.iso.datetime(),
  resolueLe: z.iso.datetime().nullable(),
  /** Rang 2 — l'entité visée, par type et identifiant opaque. */
  cible: z.strictObject({ type: z.string(), id: z.string() }).nullable().optional(),
});

export const qualiopiConformite = definirOutil({
  name: "qualiopi.conformite",
  version: VERSION,
  description:
    "Les alertes de conformité Qualiopi et réglementaires, non résolues par défaut, " +
    "par niveau (info, important, critique), les plus récentes en premier.",
  effect: "read",
  dataClass: "personal",
  idempotency: "n/a",
  pagination: "none",
  input: Entree,
  output: schemaSortie(Item),
  maxBytes: 40_960,
  compaction: { free: ["message", "titre"], tier2: ["cible"], aggregateBy: "niveau" },
  idFields: ["id"],
  governanceFields: [],
  fixtureMax: "fixtures/qualiopi-conformite.max.json",
  async handler(entree) {
    const limite = entree.limite ?? LIMITE_PAR_DEFAUT;
    // Une ligne de plus que demandé : c'est elle qui dit s'il en reste.
    const lignes = await listAlertes({
      resolue: entree.resolues ?? false,
      ...(entree.niveau !== undefined ? { niveau: entree.niveau } : {}),
      limit: limite + 1,
    });
    const retenues = lignes.slice(0, limite);

    return {
      items: retenues.map((a) => ({
        id: a.id,
        code: a.code,
        niveau: a.niveau,
        titre: a.titre,
        message: a.message,
        lu: a.lu,
        creeLe: a.createdAt.toISOString(),
        resolueLe: iso(a.resolueAt),
        cible: a.cibleType && a.cibleId ? { type: a.cibleType, id: a.cibleId } : null,
      })),
      meta: meta({
        returned: retenues.length,
        hasMore: lignes.length > limite,
        version: VERSION,
        asOf: new Date(),
      }),
    };
  },
});
