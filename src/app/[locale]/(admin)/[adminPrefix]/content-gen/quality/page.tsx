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

  return <QualityV2 />;
}

