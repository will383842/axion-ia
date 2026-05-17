/**
 * Content Generator — Quality dashboard (Sprint 12.5 V2).
 *
 * Affiche 5 scores moyens (seoScore, qualityScore, readabilityScore,
 * factCheckScore, editorialScore) sur 30 jours glissants par jour.
 *
 * Bars CSS inline pour rester ZERO dep graphes lourds (Recharts/Chart.js
 * ajouteraient ~80 KB gz au bundle admin sans gain critique V1).
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdminV2Enabled } from "@/lib/feature-flags";
import { QualityV2 } from "./_v2/QualityV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

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
    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: "0.85rem" }}>
      <span style={{ width: "100px" }}>{label}</span>
      <div
        style={{
          flex: 1,
          background: "var(--color-bg-elevated)",
          height: "12px",
          borderRadius: "2px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: "var(--color-terracotta)",
          }}
        />
      </div>
      <span style={{ width: "40px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </span>
    </div>
  );
}

export default async function QualityDashboardPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  if (await isAdminV2Enabled()) {
    return <QualityV2 />;
  }

  const dailyScores = await loadDailyScores();
  const totalArticles = dailyScores.reduce((s, d) => s + d.count, 0);

  // Agrégat global (moyenne pondérée par count)
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
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Quality dashboard</h1>
          <p className="admin-meta">
            Scores moyens des articles publiés sur les {WINDOW_DAYS} derniers jours. {totalArticles}{" "}
            article{totalArticles > 1 ? "s" : ""} agrégé
            {totalArticles > 1 ? "s" : ""}. Bars CSS — pas de bibliothèque graphique.
          </p>
        </div>
      </div>

      <div className="admin-card">
        <h2 className="admin-h2">Moyenne globale (fenêtre 30j)</h2>
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "1rem" }}
        >
          <ScoreBar label="SEO" value={globalAvg("avgSeo")} max={100} />
          <ScoreBar label="Quality" value={globalAvg("avgQuality")} max={100} />
          <ScoreBar label="Readability" value={globalAvg("avgReadability")} max={100} />
          <ScoreBar label="Fact-check" value={globalAvg("avgFactCheck")} max={100} />
          <ScoreBar label="Editorial" value={globalAvg("avgEditorial")} max={100} />
        </div>
      </div>

      <div className="admin-card admin-table-wrapper" style={{ marginTop: "1.5rem" }}>
        <h2 className="admin-h2">Détail par jour</h2>
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
                <td colSpan={7} style={{ textAlign: "center", color: "var(--color-fg-muted)" }}>
                  Aucun article publié sur les {WINDOW_DAYS} derniers jours.
                </td>
              </tr>
            ) : (
              dailyScores.map((d) => (
                <tr key={d.day}>
                  <td style={{ fontVariantNumeric: "tabular-nums" }}>{d.day}</td>
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
    </section>
  );
}
