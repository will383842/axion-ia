/**
 * Relevé du baromètre rattaché à un article « Chiffres » (G8).
 *
 * ⚠️ Jointure : AUCUNE clé article → relevé n'est persistée (le générateur
 * `barometer-insight.ts` lit `BarometerSnapshot("latest")` au démarrage du job et ne
 * garde ni l'identifiant ni la date du relevé ; pas de changement de schéma ici). Or le
 * worker recalcule « latest » toutes les 6 h SANS condition (`computedAt` change même si les
 * réponses n'ont pas bougé) : comparer `latest.computedAt` au début du job ferait disparaître
 * les chiffres au premier recalcul. La jointure se fait donc sur l'historique append-only
 * (`BarometerSnapshotHistory`, une ligne par recalcul : date, effectif, constats phares) :
 * la dernière ligne antérieure au début du job (`computedAt <= job.startedAt ?? createdAt`)
 * est le relevé que le générateur a lu.
 *  - constats, effectif, date : toujours ceux de cette ligne d'historique ;
 *  - maturité (absente de l'historique) : lue dans « latest », et seulement si « latest » a
 *    le même effectif et les mêmes constats que la ligne d'historique (sinon : pas de barres) ;
 *  - historisation « au mieux » : ligne manquante → `null`, jamais de chiffre deviné.
 *
 * Tolère le Proxy `stub.invalid` et toute erreur de lecture (→ `null`).
 */
import { prisma } from "@/lib/prisma";
import { SNAPSHOT_KEY_LATEST } from "@/content/observatoire/study";

/** Constats phares du baromètre (mêmes clés que le générateur). */
export const CLES_CONSTATS = [
  "competitors_use_ai",
  "no_formal_strategy",
  "rgpd_concern",
  "investment_intent",
] as const;
export type CleConstat = (typeof CLES_CONSTATS)[number];

export interface Releve {
  /** Date du relevé, AAAA-MM-JJ (UTC). */
  readonly dateIso: string;
  /** Effectif du relevé. */
  readonly total: number;
  /** Constats phares, pourcentages entiers > 0, tels que stockés. */
  readonly constats: ReadonlyArray<{ readonly cle: CleConstat; readonly pct: number }>;
  /** Répartition de la maturité IA (pourcentages entiers), vide si non rattachable. */
  readonly maturite: ReadonlyArray<{ readonly valeur: string; readonly pct: number }>;
}

const estPct = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100;

function memesConstats(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  return CLES_CONSTATS.every((cle) => a[cle] === b[cle]);
}

export async function chargerReleve(
  generatedByJobId: string | null | undefined,
): Promise<Releve | null> {
  if (!generatedByJobId) return null;
  if (process.env.DATABASE_URL?.includes("stub.invalid")) return null;
  try {
    const job = await prisma.contentGenJob.findUnique({
      where: { id: generatedByJobId },
      select: { contentType: true, startedAt: true, createdAt: true },
    });
    if (!job || job.contentType !== "barometer_insight") return null;
    const debut = job.startedAt ?? job.createdAt;
    if (!debut) return null;
    const histo = await prisma.barometerSnapshotHistory.findFirst({
      where: { computedAt: { lte: debut } },
      orderBy: { computedAt: "desc" },
      select: { computedAt: true, totalResponses: true, insights: true },
    });
    if (!histo) return null;
    const insights = (histo.insights ?? {}) as Record<string, unknown>;
    const constats = CLES_CONSTATS.flatMap((cle) => {
      const v = insights[cle];
      return estPct(v) && v > 0 ? [{ cle, pct: v }] : [];
    });

    // Maturité : seulement si « latest » est (à l'effectif et aux constats près) le même relevé.
    let maturite: Array<{ valeur: string; pct: number }> = [];
    const latest = await prisma.barometerSnapshot.findUnique({
      where: { key: SNAPSHOT_KEY_LATEST },
      select: { totalResponses: true, payload: true },
    });
    const payload = (latest?.payload ?? null) as {
      insights?: Record<string, unknown>;
      distributions?: Record<string, ReadonlyArray<{ value?: unknown; pct?: unknown }>>;
    } | null;
    if (
      latest &&
      latest.totalResponses === histo.totalResponses &&
      memesConstats(payload?.insights ?? {}, insights)
    ) {
      maturite = (payload?.distributions?.maturityLevel ?? []).flatMap((d) =>
        typeof d.value === "string" && estPct(d.pct) ? [{ valeur: d.value, pct: d.pct }] : [],
      );
    }
    return {
      dateIso: histo.computedAt.toISOString().slice(0, 10),
      total: histo.totalResponses,
      constats,
      maturite,
    };
  } catch {
    return null;
  }
}
