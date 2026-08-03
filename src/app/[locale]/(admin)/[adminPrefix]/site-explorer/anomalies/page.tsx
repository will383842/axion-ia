// Site Explorer — Page anomalies — Sprint Site Explorer Admin 2026-05-22.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listAnomalies, resolveAnomaly } from "@/server/actions/site-explorer/site-routes";
import { adminPath } from "@/lib/admin-path";
import { AdminPagination } from "@/components/admin/ui";
import { libelleGravite, libelleAnomalie } from "@/server/site-explorer/anomalies-labels";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Anomalies SEO — Site Explorer Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<Record<string, string>>;
}

export default async function SiteExplorerAnomaliesPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const sp = await searchParams;
  const filters = {
    page: sp.page ? parseInt(sp.page, 10) : 1,
    pageSize: 50,
    ...(sp.type ? { type: sp.type } : {}),
    ...(sp.severity ? { severity: sp.severity } : {}),
    ...(sp.resolved === "true"
      ? { resolved: true }
      : sp.resolved === "false"
        ? { resolved: false }
        : {}),
  };

  const { anomalies, total } = await listAnomalies(filters);
  const page = filters.page;
  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));
  const backUrl = adminPath("fr", "site-explorer");

  const severityBadge = (severity: string) => {
    if (severity === "high")
      return "bg-[color:var(--color-admin-destructive-soft)] text-[color:var(--color-admin-destructive-fg)]";
    if (severity === "medium")
      return "bg-[color:var(--color-admin-warning-soft)] text-[color:var(--color-admin-warning-fg)]";
    return "bg-[color:var(--color-admin-warning-soft)] text-[color:var(--color-admin-warning-fg)]";
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <a href={backUrl} className="admin-link text-sm">
          ← Site Explorer
        </a>
        <span className="text-[color:var(--color-admin-fg-disabled)]">/</span>
        <h1 className="text-xl font-bold text-[color:var(--color-admin-fg)]">Anomalies SEO</h1>
      </div>

      {/* Filtres rapides */}
      <div className="flex flex-wrap gap-2">
        {["", "high", "medium", "low"].map((sev) => (
          <a
            key={sev}
            href={`?severity=${sev}&resolved=false`}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              (sp.severity ?? "") === sev
                ? "border-[color:var(--color-admin-accent)] bg-[color:var(--color-admin-accent)] text-[color:var(--color-admin-accent-fg)]"
                : "border-[color:var(--color-admin-border-strong)] hover:bg-[color:var(--color-admin-surface-sunken)]"
            }`}
          >
            {sev === "" ? "Toutes" : libelleGravite(sev)}
          </a>
        ))}
        <a
          href="?resolved=true"
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            sp.resolved === "true"
              ? "border-[color:var(--color-admin-accent)] bg-[color:var(--color-admin-accent)] text-[color:var(--color-admin-accent-fg)]"
              : "border-[color:var(--color-admin-border-strong)] hover:bg-[color:var(--color-admin-surface-sunken)]"
          }`}
        >
          Résolues
        </a>
      </div>

      <div className="text-sm text-[color:var(--color-admin-fg-muted)]">
        {total.toLocaleString("fr-FR")} anomalie{total > 1 ? "s" : ""} · page {page}/
        {Math.max(1, Math.ceil(total / 50))}
      </div>

      {anomalies.length === 0 ? (
        <div className="rounded-lg border border-[color:var(--color-admin-success)] bg-[color:var(--color-admin-success-soft)] py-8 text-center">
          <p className="font-medium text-[color:var(--color-admin-success-fg)]">
            Aucune anomalie active
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {anomalies.map((a) => (
            <div
              key={a.id}
              className="flex items-start justify-between gap-4 rounded-lg border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-medium ${severityBadge(a.severity)}`}
                  >
                    {libelleGravite(a.severity)}
                  </span>
                  <span className="text-xs text-[color:var(--color-admin-fg-muted)]" title={a.type}>
                    {libelleAnomalie(a.type)}
                  </span>
                </div>
                <p className="text-sm text-[color:var(--color-admin-fg)]">{a.description}</p>
                {/* 🔴 Ce lien portait `site-explorer/${cond ? "" : ""}` — les
                    DEUX branches du ternaire vides. Il affichait le chemin de
                    la route concernée et ramenait invariablement à la liste
                    complète. `listAnomalies` ne sélectionnait même pas
                    l'identifiant de la route ; il l'expose désormais. */}
                <a
                  href={adminPath("fr", `site-explorer/${a.siteRoute.id}`)}
                  className="admin-link font-mono text-xs"
                >
                  {a.siteRoute.pathRendered ?? a.siteRoute.pathPattern}
                </a>
                <p className="text-xs text-[color:var(--color-admin-fg-disabled)]">
                  Détectée : {new Date(a.detectedAt).toLocaleDateString("fr-FR")}
                  {a.resolvedAt &&
                    ` — Résolue : ${new Date(a.resolvedAt).toLocaleDateString("fr-FR")}`}
                </p>
              </div>
              {!a.resolvedAt && <ResolveAnomalyButton anomalyId={a.id} />}
            </div>
          ))}
        </div>
      )}

      {/* 🔴 « 312 anomalies » puis cinquante lignes, et rien pour aller plus
          loin : la requête pagine (pageSize 50) mais la page ne rendait aucun
          contrôle. Les anomalies au-delà de la cinquantième n'étaient
          atteignables qu'en tapant ?page=2 dans la barre d'adresse. */}
      <AdminPagination
        page={page}
        totalPages={totalPages}
        baseHref={adminPath("fr", "site-explorer/anomalies")}
        preservedParams={{ severity: sp.severity, resolved: sp.resolved, type: sp.type }}
      />
    </div>
  );
}

function ResolveAnomalyButton({ anomalyId }: { anomalyId: string }) {
  async function handleResolve() {
    "use server";
    await resolveAnomaly(anomalyId);
    redirect(adminPath("fr", "site-explorer/anomalies"));
  }

  return (
    <form action={handleResolve}>
      <button
        type="submit"
        className="shrink-0 rounded border border-[color:var(--color-admin-border-strong)] px-3 py-1.5 text-sm text-[color:var(--color-admin-fg-muted)] hover:bg-[color:var(--color-admin-surface-sunken)]"
      >
        Résoudre
      </button>
    </form>
  );
}
