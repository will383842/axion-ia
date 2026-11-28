/**
 * Relevé du baromètre rattaché à un article « Chiffres » (G8).
 *
 * ⚠️ Jointure : AUCUNE clé article → relevé n'est persistée (le générateur
 * `barometer-insight.ts` lit `BarometerSnapshot("latest")` au démarrage du job et ne
 * garde ni l'identifiant ni la date du relevé ; pas de changement de schéma ici). La seule
 * jointure sûre est donc temporelle : la ligne « latest » est celle que le générateur a lue
 * si, et seulement si, elle n'a pas été recalculée depuis le début du job
 * (`computedAt <= job.startedAt`). Recalculée depuis : `null` — jamais de chiffres d'un
 * relevé plus récent à côté d'un texte rédigé sur un autre.
 *
 * Tolère le Proxy `stub.invalid` du build et toute erreur de lecture (→ `null`).
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
  /** Répartition de la maturité IA, pourcentages entiers tels que stockés. */
  readonly maturite: ReadonlyArray<{ readonly valeur: string; readonly pct: number }>;
}

const estPct = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100;

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
    const ligne = await prisma.barometerSnapshot.findUnique({
      where: { key: SNAPSHOT_KEY_LATEST },
      select: { computedAt: true, totalResponses: true, payload: true },
    });
    if (!ligne || !debut || ligne.computedAt.getTime() > debut.getTime()) return null;

    const payload = ligne.payload as {
      insights?: Record<string, unknown>;
      distributions?: Record<string, ReadonlyArray<{ value?: unknown; pct?: unknown }>>;
    } | null;
    const constats = CLES_CONSTATS.flatMap((cle) => {
      const v = payload?.insights?.[cle];
      return estPct(v) && v > 0 ? [{ cle, pct: v }] : [];
    });
    const maturite = (payload?.distributions?.maturityLevel ?? []).flatMap((d) =>
      typeof d.value === "string" && estPct(d.pct) ? [{ valeur: d.value, pct: d.pct }] : [],
    );
    return {
      dateIso: ligne.computedAt.toISOString().slice(0, 10),
      total: ligne.totalResponses,
      constats,
      maturite,
    };
  } catch {
    return null;
  }
}
