// P0-2 Sprint P5 — Layout content-gen avec CTA "Nouvelle campagne" terracotta
// persistant sur toutes les sous-pages. Visible sur /coverage, /quality, /geo,
// /costs, /jobs, /settings/*, etc.
//
// Sticky top-0 dans le flux admin-main : colle en haut de la zone principale
// lorsque l'utilisateur scrolle vers le bas d'une page longue.
// P2 Sprint P5.5 — bandeau alerte anomalies (badge rouge monitoring worker).
// A-12 SP-X3 — bandeau orange/rouge cost cap 80%/100%.

import Link from "next/link";
import { ArrowRight, TriangleAlert } from "lucide-react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { prisma } from "@/lib/prisma";

/**
 * Les plafonds de coût sont libellés en dollars par les fournisseurs de
 * modèles. On ne convertit pas — on écrit à la française (« 12,30 $US »)
 * au lieu du « $12.30 » qui traînait dans ce bandeau.
 */
function formatUsd(montant: number | undefined): string {
  if (montant == null) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "USD" }).format(montant);
}

const ANOMALY_ALERT_KEYS = [
  "alert_quality_drop",
  "alert_reject_spike",
  "alert_pipeline_stall",
] as const;

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

  // Cost cap banner state
  type CostCapVal = {
    active?: boolean;
    provider?: string;
    pct?: number;
    spent_usd?: number;
    cap_usd?: number;
  } | null;
  let costCapVal: CostCapVal = null;

  try {
    const rows = await prisma.contentGenConfig.findMany({
      where: { key: { in: [...ANOMALY_ALERT_KEYS, "cost_cap_80_active"] } },
      select: { key: true, value: true },
    });
    for (const a of rows) {
      if (a.key === "cost_cap_80_active") {
        const v = a.value as CostCapVal;
        if (v?.active) costCapVal = v;
        continue;
      }
      const val = a.value as { active?: boolean; message?: string } | null;
      if (val?.active) {
        alertCount++;
        alertLabels.push(val.message ?? a.key);
      }
    }
  } catch {
    // DB not available — skip alerts
  }

  const costCapAt100 = costCapVal?.pct != null && costCapVal.pct >= 100;

  return (
    <>
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] px-[var(--space-admin-6)] py-[var(--space-admin-2)]">
        <nav
          aria-label="Fil d'ariane du générateur de contenus"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]"
        >
          {/* Le fil d'ariane disait « Content Generator » pendant que le titre
              de la page, 80 px plus bas, dit « Générateur de contenus ». Deux
              noms pour le même module, dans le même écran. */}
          <Link href={base} className="hover:text-[color:var(--color-admin-fg)]">
            Générateur de contenus
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
          href={`${base}/campaigns/new`}
          className="admin-button-cta text-[length:var(--text-admin-xs)]"
        >
          + Nouvelle campagne
        </Link>
      </div>

      {/* Cost cap banner — orange (80 %+) or red (100 %) */}
      {costCapVal ? (
        <div
          role="alert"
          className="border-b px-[var(--space-admin-6)] py-[var(--space-admin-2)] text-[length:var(--text-admin-xs)]"
          style={
            costCapAt100
              ? {
                  backgroundColor: "var(--color-admin-destructive-soft)",
                  borderColor: "var(--color-admin-destructive)",
                  color: "var(--color-admin-destructive-fg)",
                }
              : {
                  backgroundColor: "var(--color-admin-warning-soft)",
                  borderColor: "var(--color-admin-warning)",
                  color: "var(--color-admin-warning-fg)",
                }
          }
        >
          <strong className="inline-flex items-center gap-1">
            <TriangleAlert size={13} aria-hidden="true" className="shrink-0" />
            {costCapAt100 ? "Plafond mensuel atteint" : "Coût mensuel"} ({costCapVal.pct ?? "?"}
            %)
          </strong>{" "}
          {/* « Provider … : $12.30 / $50.00 » — un mot anglais et deux montants
              à l'anglaise dans un bandeau français. Les fournisseurs facturent
              bien en dollars : on garde la devise, on écrit les nombres à la
              française. */}
          Fournisseur {costCapVal.provider ?? "?"} : {formatUsd(costCapVal.spent_usd)} sur{" "}
          {formatUsd(costCapVal.cap_usd)}.
          {costCapAt100
            ? " Workers en pause. Réactivation via reset cap ou 1er du mois."
            : " Le plafond sera atteint prochainement."}{" "}
          <AdminButton href={`${base}/costs`} variant="ghost" size="sm" iconAfter={ArrowRight}>
            Voir coûts
          </AdminButton>
        </div>
      ) : null}

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
          <strong className="inline-flex items-center gap-1">
            <TriangleAlert size={13} aria-hidden="true" className="shrink-0" />
            Anomalies détectées ({alertCount}) :
          </strong>{" "}
          {alertLabels.join(" · ")}
          {" · "}
          <AdminButton href={`${base}/monitoring`} variant="ghost" size="sm" iconAfter={ArrowRight}>
            Voir monitoring
          </AdminButton>
        </div>
      )}
      {children}
    </>
  );
}
