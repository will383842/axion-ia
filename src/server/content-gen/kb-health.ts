/**
 * Content Generator — KB health hard gate (§ 11.2 master prompt v2.5).
 *
 * Sprint 1 Day 4 AGT-E. Vérifie que la KB V4 est suffisamment peuplée
 * avant tout appel LLM. Hard gate :
 * - ≥ 50 entries publiées (KnowledgeEntry status='published', deletedAt=null)
 * - ≥ 60 % audience='public' (canonical ratio)
 * - dernière écriture d'une fiche publiée < 180 jours (cf. HARD_GATE_MAX_DAYS_SINCE_LAST)
 *
 * Mode dégradé : `KB_BYPASS=true` env → bypass gate + banner rouge admin.
 */

import { prisma } from "@/lib/prisma";

export interface KbHealthSnapshot {
  readonly publishedTotal: number;
  readonly publicPublished: number;
  readonly canonicalRatio: number;
  readonly lastPublishedAt: Date | null;
  /**
   * Dernière écriture (horloge de la base, `updatedAt`) d'une fiche publiée. C'est
   * elle, avec `lastPublishedAt`, qui mesure la fraîcheur du garde-fou.
   */
  readonly lastWrittenAt: Date | null;
  /** Fiches publiées dont la date de revue (`reviewDueAt`) est dépassée. Informatif : ne bloque rien. */
  readonly reviewOverdueCount: number;
  /** Part des fiches publiées à relire (0 à 1). Informatif : ne bloque rien. */
  readonly reviewOverdueRatio: number;
  readonly healthy: boolean;
  readonly bypassMode: boolean;
  readonly reason?: string;
}

const HARD_GATE_MIN_PUBLISHED = 50;
const HARD_GATE_MIN_CANONICAL_RATIO = 0.6;
// Audit KB 2026-08-11 — 90 → 180 j. La KB de faits est un corpus stable seedé
// (pas un flux) : à 90 j le gate coupait TOUT le content-gen chaque trimestre
// sans re-seed. Le signal de revue reste à 90 j (`reviewDueAt` posé par
// `seed-kb-facts.ts`) : l'admin voit la péremption bien avant le hard stop.
//
// ⚠️ À lire avec ce seuil : le blocage RETOMBE 180 jours après la dernière écriture, et
// cette écriture vient d'un seed lancé À LA MAIN. Le signal mesure donc l'ACTIVITÉ
// d'ingestion plus que la FRAÎCHEUR des faits : un seed qui republie des fiches périmées
// remet le compteur à zéro sans qu'un fait ait été revérifié. La fraîcheur réelle se lit
// dans `reviewOverdueCount` / `reviewOverdueRatio`.
//
// Vague 3 (11/11/2026) — « bombe » du 22/04/2027. Pour les fiches de faits,
// `publishedAt` vaut `verifiedAt`, une date ÉCRITE DANS LE CODE : le fait le plus
// récent porte « 2026-10-24 », donc le gate aurait coupé le content-gen le
// 22/04/2027 même si la base était réécrite chaque jour. La fraîcheur se lit
// désormais sur la plus récente de `publishedAt` et de `updatedAt` (posé par
// l'horloge de la base à chaque écriture) : jamais plus tôt qu'avant, et plus
// jamais sur une date figée.
const HARD_GATE_MAX_DAYS_SINCE_LAST = 180;

function plusRecente(a: Date | null, b: Date | null): Date | null {
  if (!a) return b;
  if (!b) return a;
  return a.getTime() >= b.getTime() ? a : b;
}

export class KbNotReadyError extends Error {
  constructor(public readonly snapshot: KbHealthSnapshot) {
    super(
      `KB_NOT_READY: ${snapshot.publishedTotal} published, canonical ratio ${(snapshot.canonicalRatio * 100).toFixed(0)}%, last ingest ${snapshot.lastPublishedAt?.toISOString() ?? "never"}`,
    );
    this.name = "KbNotReadyError";
  }
}

function isBypassActive(): boolean {
  const raw = process.env.KB_BYPASS;
  return raw === "true" || raw === "1";
}

/**
 * Snapshot santé KB. Si DB pas accessible (P2021 / PrismaInit), retourne
 * un snapshot vide marqué `bypassMode=true` (V0 transitoire dev/tests).
 */
export async function getKbHealth(): Promise<KbHealthSnapshot> {
  const bypassMode = isBypassActive();
  try {
    const [publishedTotal, publicPublished, lastIngest, reviewOverdueCount, lastWrite] =
      await Promise.all([
        prisma.knowledgeEntry.count({ where: { status: "published", deletedAt: null } }),
        prisma.knowledgeEntry.count({
          where: { status: "published", audience: "public", deletedAt: null },
        }),
        prisma.knowledgeEntry.findFirst({
          where: { status: "published", deletedAt: null },
          orderBy: { publishedAt: "desc" },
          select: { publishedAt: true },
        }),
        // Fraîcheur : le volume seul ne dit pas si les faits sont périmés. Signal
        // affiché, pas un blocage (le hard stop reste à 180 j, décision du 11/08).
        prisma.knowledgeEntry.count({
          where: { status: "published", deletedAt: null, reviewDueAt: { lt: new Date() } },
        }),
        prisma.knowledgeEntry.findFirst({
          where: { status: "published", deletedAt: null },
          orderBy: { updatedAt: "desc" },
          select: { updatedAt: true },
        }),
      ]);
    const reviewOverdueRatio = publishedTotal > 0 ? reviewOverdueCount / publishedTotal : 0;

    const canonicalRatio = publishedTotal > 0 ? publicPublished / publishedTotal : 0;
    const lastPublishedAt = lastIngest?.publishedAt ?? null;
    const lastWrittenAt = lastWrite?.updatedAt ?? null;
    const derniereActivite = plusRecente(lastPublishedAt, lastWrittenAt);
    const daysSinceLast = derniereActivite
      ? (Date.now() - derniereActivite.getTime()) / 86_400_000
      : Number.POSITIVE_INFINITY;

    const healthy =
      bypassMode ||
      (publishedTotal >= HARD_GATE_MIN_PUBLISHED &&
        canonicalRatio >= HARD_GATE_MIN_CANONICAL_RATIO &&
        daysSinceLast < HARD_GATE_MAX_DAYS_SINCE_LAST);

    let reason: string | undefined;
    if (!healthy) {
      const reasons: string[] = [];
      if (publishedTotal < HARD_GATE_MIN_PUBLISHED) {
        reasons.push(`${publishedTotal} entries publiées < ${HARD_GATE_MIN_PUBLISHED}`);
      }
      if (canonicalRatio < HARD_GATE_MIN_CANONICAL_RATIO) {
        reasons.push(
          `canonical ratio ${(canonicalRatio * 100).toFixed(0)}% < ${HARD_GATE_MIN_CANONICAL_RATIO * 100}%`,
        );
      }
      if (daysSinceLast >= HARD_GATE_MAX_DAYS_SINCE_LAST) {
        reasons.push(
          `dernière activité (publication ou écriture) > ${HARD_GATE_MAX_DAYS_SINCE_LAST}j`,
        );
      }
      reason = reasons.join(" + ");
    }

    return {
      publishedTotal,
      publicPublished,
      canonicalRatio,
      lastPublishedAt,
      lastWrittenAt,
      reviewOverdueCount,
      reviewOverdueRatio,
      healthy,
      bypassMode,
      ...(reason ? { reason } : {}),
    };
  } catch (err) {
    if (
      err instanceof Error &&
      (("code" in err && (err as { code: string }).code === "P2021") ||
        err.constructor.name === "PrismaClientInitializationError")
    ) {
      // DB pas accessible (test sans DB / table pas migrée) → mode dégradé.
      // ⚠️ Observabilité (audit 2026-06-25) : ce bypass laissait passer le
      // content-gen SANS KB → RAG vide → risque d'hallucinations SILENCIEUSES.
      // On log désormais explicitement pour qu'un incident DB worker soit visible
      // (au build stub.invalid, prisma renvoie 0 sans throw → ce chemin ne s'active pas).
      console.warn(
        "[kb-health] ⚠️ DB inaccessible (P2021/PrismaInit) → bypass dégradé : " +
          "content-gen tourne SANS garde KB (RAG potentiellement vide). " +
          "Vérifier la connexion DB / migrations du worker.",
      );
      return {
        publishedTotal: 0,
        publicPublished: 0,
        canonicalRatio: 0,
        lastPublishedAt: null,
        lastWrittenAt: null,
        reviewOverdueCount: 0,
        reviewOverdueRatio: 0,
        healthy: true, // accept en mode dégradé
        bypassMode: true,
        reason: "DB not accessible (P2021/PrismaInit) — bypass V0",
      };
    }
    throw err;
  }
}

/**
 * Hard gate à appeler en début d'orchestrator avant tout job content-gen.
 * Throw `KbNotReadyError` si KB pas prête ET pas en bypass mode.
 */
export async function assertKbReady(): Promise<KbHealthSnapshot> {
  const snapshot = await getKbHealth();
  if (!snapshot.healthy) {
    throw new KbNotReadyError(snapshot);
  }
  return snapshot;
}
