// P0-2 Sprint P5 — Layout content-gen avec CTA "Nouvelle campagne" terracotta
// persistant sur toutes les sous-pages. Visible sur /coverage, /quality, /geo,
// /costs, /jobs, /settings/*, etc.
//
// Sticky top-0 dans le flux admin-main : colle en haut de la zone principale
// lorsque l'utilisateur scrolle vers le bas d'une page longue.
// P2 Sprint P5.5 — bandeau alerte anomalies (badge rouge monitoring worker).

import Link from "next/link";
import { prisma } from "@/lib/prisma";

const ALERT_KEYS = ["alert_quality_drop", "alert_reject_spike", "alert_pipeline_stall"] as const;

interface ContentGenLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function ContentGenLayout({ children, params }: ContentGenLayoutProps) {
  const { adminPrefix } = await params;
  const base = `/fr/${adminPrefix}/content-gen`;

  // Read active anomaly alerts from contentGenConfig (set by content-monitoring-worker)
  let alertCount = 0;
  const alertLabels: string[] = [];
  try {
    const alerts = await prisma.contentGenConfig.findMany({
      where: { key: { in: [...ALERT_KEYS] } },
      select: { key: true, value: true },
    });
    for (const a of alerts) {
      const val = a.value as { active?: boolean; message?: string } | null;
      if (val?.active) {
        alertCount++;
        alertLabels.push(val.message ?? a.key);
      }
    }
  } catch {
    // DB not available — skip alerts
  }

  return (
    <>
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] px-[var(--space-admin-6)] py-[var(--space-admin-2)]">
        <nav
          aria-label="Fil d'ariane Content Generator"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]"
        >
          <Link href={base} className="hover:text-[color:var(--color-admin-fg)]">
            Content Generator
          </Link>
          {alertCount > 0 && (
            <span
              className="ml-[var(--space-admin-3)] inline-flex items-center justify-center rounded-full px-[var(--space-admin-3)] py-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] font-bold"
              style={{
                backgroundColor: "var(--color-admin-destructive)",
                color: "var(--color-admin-paper)",
              }}
              aria-label={`${alertCount} alerte${alertCount > 1 ? "s" : ""} monitoring actives`}
            >
              {alertCount} alerte{alertCount > 1 ? "s" : ""}
            </span>
          )}
        </nav>
        <Link
          href={`${base}/coverage/new`}
          className="admin-button-cta text-[length:var(--text-admin-xs)]"
        >
          + Nouvelle campagne
        </Link>
      </div>
      {alertCount > 0 && (
        <div
          role="alert"
          className="border-b px-[var(--space-admin-6)] py-[var(--space-admin-2)] text-[length:var(--text-admin-xs)]"
          style={{
            backgroundColor: "var(--color-admin-destructive-soft)",
            borderColor: "var(--color-admin-destructive)",
            color: "var(--color-admin-destructive-fg)",
          }}
        >
          <strong>⚠️ Anomalies détectées ({alertCount}) :</strong> {alertLabels.join(" · ")}
          {" · "}
          <Link href={`${base}/monitoring`} className="underline">
            Voir monitoring →
          </Link>
        </div>
      )}
      {children}
    </>
  );
}
