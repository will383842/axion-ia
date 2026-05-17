// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Quality dashboard V2 — AdminPageShell + AdminPageHeader + AdminCard.

import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { prisma } from "@/lib/prisma";

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

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Quality dashboard"
        description={`Scores moyens des articles publiés sur les ${WINDOW_DAYS} derniers jours. ${totalArticles} article${totalArticles > 1 ? "s" : ""} agrégé${totalArticles > 1 ? "s" : ""}. Bars CSS — pas de bibliothèque graphique.`}
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Moyenne globale (fenêtre 30j)</h2>
        <div className="mt-[var(--space-admin-4)] flex flex-col gap-[var(--space-admin-4)]">
          <ScoreBar label="SEO" value={globalAvg("avgSeo")} max={100} />
          <ScoreBar label="Quality" value={globalAvg("avgQuality")} max={100} />
          <ScoreBar label="Readability" value={globalAvg("avgReadability")} max={100} />
          <ScoreBar label="Fact-check" value={globalAvg("avgFactCheck")} max={100} />
          <ScoreBar label="Editorial" value={globalAvg("avgEditorial")} max={100} />
        </div>
      </AdminCard>

      <AdminCard variant="compact">
        <h2 className="admin-h2">Détail par jour</h2>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Jour</th>
                <th>Articles</th>
                <th>SEO</th>
                <th>Quality</th>
                <th>Readability</th>
                <th>Fact-check</th>
                <th>Editorial</th>
              </tr>
            </thead>
            <tbody>
              {dailyScores.length === 0 ? (
                <tr>
                  <td colSpan={7} className="admin-table-empty">
                    Aucun article publié sur les {WINDOW_DAYS} derniers jours.
                  </td>
                </tr>
              ) : (
                dailyScores.map((d) => (
                  <tr key={d.day}>
                    <td className="tabular-nums">{d.day}</td>
                    <td>{d.count}</td>
                    <td>{d.avgSeo || "—"}</td>
                    <td>{d.avgQuality || "—"}</td>
                    <td>{d.avgReadability || "—"}</td>
                    <td>{d.avgFactCheck || "—"}</td>
                    <td>{d.avgEditorial || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </AdminPageShell>
  );
}
