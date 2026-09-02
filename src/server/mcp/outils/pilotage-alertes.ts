/**
 * `axionia.pilotage.alertes` — les signaux du hub de planning.
 *
 * S'appuie sur `getHubSignaux` (`admin-planning/hub-queries`), l'agrégateur
 * que `pilotage-dashboard.ts` consomme déjà : sessions non staffées, conflits,
 * formateurs indisponibles ou non conformes, surcharges, relevés à valider,
 * anomalies de rémunération. Sans session.
 *
 * ⚠️ L'agrégateur construit des liens de console pour l'écran. Ils ne sortent
 *    PAS d'ici : chaque élément ne garde que son libellé. Le segment
 *    d'administration passé à l'agrégateur est un mot neutre — il ne sert qu'à
 *    fabriquer ces liens que l'on jette.
 */

import { z } from "zod/v4";

import { getHubSignaux } from "@/features/admin-planning/hub-queries";

import { definirOutil } from "../contrat";
import { meta, schemaSortie } from "../sortie";

export const VERSION = "1.0.0";

const NIVEAUX = ["critique", "attention"] as const;

/** Un mot neutre : les liens fabriqués avec lui sont jetés avant la sortie. */
const SEGMENT_NEUTRE = "x";

const Entree = z.strictObject({
  annee: z.number().int().min(2020).max(2100).optional(),
  mois: z.number().int().min(1).max(12).optional(),
});

const Item = z.strictObject({
  code: z.string().regex(/^[a-z][a-z0-9_]*$/),
  niveau: z.enum(NIVEAUX),
  titre: z.string(),
  explication: z.string(),
  nombre: z.number().int().min(0),
  /** Rang 2 — les éléments nommés (sessions, formateurs). */
  elements: z.array(z.strictObject({ libelle: z.string() })).optional(),
});

export const pilotageAlertes = definirOutil({
  name: "pilotage.alertes",
  version: VERSION,
  description:
    "Les signaux du planning d'un mois : sessions sans formateur, conflits, " +
    "indisponibilités, conformité et charge des formateurs, relevés et rémunérations.",
  effect: "read",
  dataClass: "personal",
  idempotency: "n/a",
  pagination: "none",
  input: Entree,
  output: schemaSortie(Item),
  maxBytes: 32_768,
  compaction: { free: ["explication"], tier2: ["elements"], aggregateBy: "niveau" },
  idFields: [],
  governanceFields: [],
  fixtureMax: "fixtures/pilotage-alertes.max.json",
  async handler(entree) {
    const maintenant = new Date();
    const annee = entree.annee ?? maintenant.getUTCFullYear();
    const mois = entree.mois ?? maintenant.getUTCMonth() + 1;
    const signaux = await getHubSignaux(annee, mois, SEGMENT_NEUTRE, maintenant);

    return {
      items: signaux.map((s) => ({
        code: s.code,
        niveau: s.niveau,
        titre: s.titre,
        explication: s.explication,
        nombre: s.items.length,
        elements: s.items.map((it) => ({ libelle: it.label })),
      })),
      meta: meta({ returned: signaux.length, version: VERSION, asOf: maintenant }),
    };
  },
});
