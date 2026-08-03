// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Quality dashboard V2 — AdminPageShell + AdminPageHeader + AdminCard.

import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminTable,
  AdminEmptyState,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";
import { prisma } from "@/lib/prisma";
import { formatDateFrShort } from "@/lib/format-date-fr";
import { getQualityImprovementAttemptsDistribution } from "@/server/actions/content-gen/dashboard";

interface DailyScore {
  readonly day: string;
  readonly count: number;
  readonly avgSeo: number;
  readonly avgQuality: number;
  readonly avgReadability: number;
  readonly avgFactCheck: number;
  readonly avgEditorial: number;
}

const WINDOW_DAYS = 30;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

async function loadDailyScores(): Promise<ReadonlyArray<DailyScore>> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - WINDOW_DAYS);
  since.setUTCHours(0, 0, 0, 0);

  const articles = await prisma.article.findMany({
    where: {
      status: "published",
      publishedAt: { gte: since },
    },
    select: {
      publishedAt: true,
      seoScore: true,
      qualityScore: true,
      readabilityScore: true,
      factCheckScore: true,
      editorialScore: true,
    },
  });

  interface MutableBucket {
    day: string;
    count: number;
    _seo: number[];
    _qual: number[];
    _read: number[];
    _fact: number[];
    _edit: number[];
  }
  const buckets = new Map<string, MutableBucket>();
  for (const a of articles) {
    if (!a.publishedAt) continue;
    const key = startOfDay(a.publishedAt).toISOString().slice(0, 10);
    if (!buckets.has(key)) {
      buckets.set(key, {
        day: key,
        count: 0,
        _seo: [],
        _qual: [],
        _read: [],
        _fact: [],
        _edit: [],
      });
    }
    const b = buckets.get(key)!;
    b.count++;
    if (a.seoScore !== null) b._seo.push(a.seoScore);
    if (a.qualityScore !== null) b._qual.push(a.qualityScore);
    if (a.readabilityScore !== null) b._read.push(Number(a.readabilityScore));
    if (a.factCheckScore !== null) b._fact.push(a.factCheckScore);
    if (a.editorialScore !== null) b._edit.push(a.editorialScore);
  }

  const avg = (xs: number[]): number =>
    xs.length === 0 ? 0 : Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);

  return Array.from(buckets.values())
    .map((b) => ({
      day: b.day,
      count: b.count,
      avgSeo: avg(b._seo),
      avgQuality: avg(b._qual),
      avgReadability: avg(b._read),
      avgFactCheck: avg(b._fact),
      avgEditorial: avg(b._edit),
    }))
    .sort((a, b) => (a.day < b.day ? 1 : -1));
}

/**
 * Sprint Final P1-13 — Histogramme distribution des tentatives quality-improver.
 *
 * Affiche combien d'articles ont nécessité 0, 1, 2, 3+ itérations LLM-judge →
 * quality-improver-worker avant d'atteindre `published` ou `needs_review`.
 * Source data : ContentGenJob.qualityImprovementAttempts.
 *
 * Rendu : server component async (RSC). Pas d'export `revalidate` ici — la
 * page parent est `force-dynamic` (cohérent avec les autres KPIs admin qui
 * exigent fraîcheur temps-réel). Couleurs : terracotta brand sur fond ivoire
 * (--color-admin-paper / --color-admin-terracotta).
 */
async function QualityAttemptsDistributionBlock(): Promise<React.ReactElement> {
  const { buckets, total } = await getQualityImprovementAttemptsDistribution();
  const maxCount = buckets.reduce((m, b) => (b.count > m ? b.count : m), 0);

  // Bucket "3+" : on agrège tous les attempts >= 3 pour rester lisible (la cap
  // configurable côté worker est typiquement 3-5, peu de jobs au-delà).
  interface DisplayBucket {
    label: string;
    count: number;
  }
  const display: DisplayBucket[] = [];
  for (let i = 0; i <= 2; i++) {
    const c = buckets.filter((b) => b.attempts === i).reduce((s, b) => s + b.count, 0);
    display.push({ label: `${i} itération${i > 1 ? "s" : ""}`, count: c });
  }
  const threePlus = buckets.filter((b) => b.attempts >= 3).reduce((s, b) => s + b.count, 0);
  display.push({ label: "3+ itérations", count: threePlus });
  const displayMax = display.reduce((m, d) => (d.count > m ? d.count : m), Math.max(1, maxCount));

  return (
    <AdminCard className="mt-[var(--space-admin-5)]">
      <h2 className="admin-h2">Nombre de passages d&apos;amélioration avant décision</h2>
      <p className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-text-muted)]">
        Nombre de relectures automatiques avant qu&apos;un contenu soit publié ou envoyé en
        relecture humaine. {total} contenu
        {total > 1 ? "s" : ""} agrégé{total > 1 ? "s" : ""}.
      </p>
      <div className="mt-[var(--space-admin-4)] flex flex-col gap-[var(--space-admin-3)]">
        {total === 0 ? (
          <div className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-text-muted)]">
            Aucun contenu publié ou en attente de relecture pour l&apos;instant.
          </div>
        ) : (
          display.map((d) => {
            const pct = displayMax === 0 ? 0 : Math.round((d.count / displayMax) * 100);
            const pctTotal = total === 0 ? 0 : Math.round((d.count / total) * 100);
            return (
              <div
                key={d.label}
                className="flex items-center gap-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]"
              >
                <span className="w-[140px]">{d.label}</span>
                <div className="h-[14px] flex-1 overflow-hidden rounded-[var(--radius-admin-sm)] bg-[color:var(--color-admin-surface-soft)]">
                  <div
                    style={{ width: `${pct}%`, backgroundColor: "var(--color-admin-terracotta)" }}
                    className="h-full"
                  />
                </div>
                <span className="w-[80px] text-right tabular-nums">
                  {d.count} ({pctTotal}%)
                </span>
              </div>
            );
          })
        )}
      </div>
    </AdminCard>
  );
}

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="flex items-center gap-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]">
      <span className="w-[100px]">{label}</span>
      <div className="h-[12px] flex-1 overflow-hidden rounded-[var(--radius-admin-sm)] bg-[color:var(--color-admin-surface-soft)]">
        <div style={{ width: `${pct}%` }} className="h-full bg-[color:var(--color-admin-info)]" />
      </div>
      <span className="w-[40px] text-right tabular-nums">{value}</span>
    </div>
  );
}

export async function QualityV2(): Promise<React.ReactElement> {
  const dailyScores = await loadDailyScores();
  const totalArticles = dailyScores.reduce((s, d) => s + d.count, 0);

  const globalAvg = (key: keyof DailyScore): number => {
    if (totalArticles === 0) return 0;
    let weighted = 0;
    for (const d of dailyScores) {
      const v = d[key];
      if (typeof v === "number") weighted += v * d.count;
    }
    return Math.round(weighted / totalArticles);
  };

  const columns: ReadonlyArray<AdminTableColumn<DailyScore>> = [
    {
      key: "day",
      header: "Jour",
      // `day` reste une clé ISO (tri lexicographique + rowId) — seul l'AFFICHAGE
      // passe en format FR.
      cell: (d) => <span className="tabular-nums">{formatDateFrShort(d.day)}</span>,
    },
    { key: "count", header: "Articles", cell: (d) => d.count },
    { key: "seo", header: "SEO", cell: (d) => d.avgSeo || "—" },
    { key: "quality", header: "Qualité", cell: (d) => d.avgQuality || "—" },
    { key: "readability", header: "Lisibilité", cell: (d) => d.avgReadability || "—" },
    { key: "factCheck", header: "Vérif. des faits", cell: (d) => d.avgFactCheck || "—" },
    { key: "editorial", header: "Éditorial", cell: (d) => d.avgEditorial || "—" },
  ];

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Tableau de bord qualité"
        description={`Scores moyens des articles publiés sur les ${WINDOW_DAYS} derniers jours. ${totalArticles} article${totalArticles > 1 ? "s" : ""} agrégé${totalArticles > 1 ? "s" : ""}. `}
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Moyenne globale (fenêtre 30j)</h2>
        <div className="mt-[var(--space-admin-4)] flex flex-col gap-[var(--space-admin-4)]">
          <ScoreBar label="SEO" value={globalAvg("avgSeo")} max={100} />
          <ScoreBar label="Qualité" value={globalAvg("avgQuality")} max={100} />
          <ScoreBar label="Lisibilité" value={globalAvg("avgReadability")} max={100} />
          <ScoreBar label="Vérif. des faits" value={globalAvg("avgFactCheck")} max={100} />
          <ScoreBar label="Éditorial" value={globalAvg("avgEditorial")} max={100} />
        </div>
      </AdminCard>

      <AdminCard variant="compact">
        <h2 className="admin-h2">Détail par jour</h2>
        {dailyScores.length === 0 ? (
          <AdminEmptyState title={`Aucun article publié sur les ${WINDOW_DAYS} derniers jours.`} />
        ) : (
          <AdminTable
            columns={columns}
            rows={dailyScores}
            getRowId={(d) => d.day}
            caption="Scores moyens des articles publiés par jour"
          />
        )}
      </AdminCard>

      {/* Sprint Final P1-13 — Bloc additionnel distribution boucle qualité */}
      <QualityAttemptsDistributionBlock />
    </AdminPageShell>
  );
}
