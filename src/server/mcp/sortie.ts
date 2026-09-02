/**
 * **LA SORTIE STANDARD** (§ 13.2) — la même enveloppe pour tous les outils.
 *
 * ═══ TROIS CHAMPS QUE LE CODE RÉEL A IMPOSÉS ═══
 *
 * · `sourceIncomplete` — LA SOURCE avait déjà coupé, avant le socle :
 *   `listInbox` pose `truncated` dès qu'un canal atteint sa fenêtre de 100.
 *   Réutiliser le même booléen pour deux étages (la source, puis la compaction
 *   du socle) produirait exactement la troncature silencieuse qu'on veut
 *   éviter. Ici, `truncated` reste `false` : **c'est le socle qui compacte**,
 *   et lui seul le pose.
 * · `failedSources[]` — `listInbox` pousse déjà les canaux en panne dans
 *   `failedChannels` (`Promise.allSettled`), et son commentaire raconte que ce
 *   filet a masqué une panne pendant un déploiement entier. Sans emplacement
 *   dans la sortie, la boîte revient amputée d'un canal sur quatre sous
 *   l'apparence d'une réponse normale.
 * · `version` / `deprecated` / `sunsetAt` — sans quoi, six mois plus tard,
 *   personne ne sait si v1 peut être retirée.
 */

import { z } from "zod/v4";

export const SchemaMeta = z.strictObject({
  returned: z.number().int().min(0),
  hasMore: z.boolean(),
  cursor: z.string().nullable(),
  mode: z.enum(["items", "aggregate"]),
  /** Posé par le SOCLE quand il compacte. L'adaptateur le laisse à `false`. */
  truncated: z.boolean(),
  truncationNote: z.string().nullable(),
  /** La SOURCE avait déjà coupé — distinct de `truncated`. */
  sourceIncomplete: z.boolean(),
  sourceNote: z.string().nullable(),
  /** Obligatoire pour tout outil composite : les sources en PANNE, pas vides. */
  failedSources: z.array(z.string()),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  deprecated: z.boolean(),
  sunsetAt: z.string().nullable(),
  asOf: z.iso.datetime(),
});

export type Meta = z.output<typeof SchemaMeta>;

/** L'enveloppe : `items` + `meta`. */
export function schemaSortie<TItem extends z.ZodType>(item: TItem) {
  return z.strictObject({ items: z.array(item), meta: SchemaMeta });
}

/** L'enveloppe avec un bloc `synthese` propre à l'outil (compteurs, totaux). */
export function schemaSortieAvecSynthese<TItem extends z.ZodType, TSynthese extends z.ZodType>(
  item: TItem,
  synthese: TSynthese,
) {
  return z.strictObject({ items: z.array(item), meta: SchemaMeta, synthese });
}

export interface MetaPartielle {
  readonly returned: number;
  readonly version: string;
  readonly asOf: Date;
  readonly hasMore?: boolean;
  readonly sourceIncomplete?: boolean;
  readonly sourceNote?: string | null;
  readonly failedSources?: readonly string[];
}

/** Construit une `meta` complète : ce que l'outil sait, et les défauts HONNÊTES. */
export function meta(partielle: MetaPartielle): Meta {
  return {
    returned: partielle.returned,
    hasMore: partielle.hasMore ?? false,
    cursor: null,
    mode: "items",
    truncated: false,
    truncationNote: null,
    sourceIncomplete: partielle.sourceIncomplete ?? false,
    sourceNote: partielle.sourceNote ?? null,
    failedSources: [...(partielle.failedSources ?? [])],
    version: partielle.version,
    deprecated: false,
    sunsetAt: null,
    asOf: partielle.asOf.toISOString(),
  };
}

/** Une date en ISO 8601, ou `null` — jamais un objet `Date` sur le fil. */
export function iso(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}

/** Un jour civil « YYYY-MM-DD » — la forme que `z.iso.date()` referme. */
export const SchemaJour = z.iso.date();

/** Un entier de page, à partir de 1. */
export const SchemaPage = z.number().int().min(1);
