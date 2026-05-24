// Site Explorer — Page anomalies — Sprint Site Explorer Admin 2026-05-22.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listAnomalies, resolveAnomaly } from "@/server/actions/site-explorer/site-routes";
import { adminPath } from "@/lib/admin-path";

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
  const backUrl = adminPath("fr", "site-explorer");

  const severityBadge = (severity: string) => {
    if (severity === "high") return "bg-red-100 text-red-700";
    if (severity === "medium") return "bg-orange-100 text-orange-700";
    return "bg-yellow-100 text-yellow-700";
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <a href={backUrl} className="text-sm text-blue-600 hover:underline">
          ← Site Explorer
        </a>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900">Anomalies SEO</h1>
      </div>

      {/* Filtres rapides */}
      <div className="flex flex-wrap gap-2">
        {["", "high", "medium", "low"].map((sev) => (
          <a
            key={sev}
            href={`?severity=${sev}&resolved=false`}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              (sp.severity ?? "") === sev
                ? "border-gray-800 bg-gray-800 text-white"
                : "border-gray-300 hover:bg-gray-50"
            }`}
          >
            {sev === ""
              ? "Toutes"
              : sev === "high"
                ? "🔴 High"
                : sev === "medium"
                  ? "🟠 Medium"
                  : "🟡 Low"}
          </a>
        ))}
        <a
          href="?resolved=true"
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            sp.resolved === "true"
              ? "border-gray-800 bg-gray-800 text-white"
              : "border-gray-300 hover:bg-gray-50"
          }`}
        >
          ✅ Résolues
        </a>
      </div>

      <div className="text-sm text-gray-500">
        {total.toLocaleString("fr-FR")} anomalie{total > 1 ? "s" : ""}
      </div>

      {anomalies.length === 0 ? (
        <div className="rounded-lg border border-green-200 bg-green-50 py-8 text-center">
          <p className="font-medium text-green-700">🎉 Aucune anomalie active</p>
        </div>
      ) : (
        <div className="space-y-2">
          {anomalies.map((a) => (
            <div
              key={a.id}
              className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-medium ${severityBadge(a.severity)}`}
                  >
                    {a.severity}
                  </span>
                  <span className="font-mono text-xs text-gray-500">{a.type}</span>
                </div>
                <p className="text-sm text-gray-800">{a.description}</p>
                <a
                  href={adminPath(
                    "fr",
                    `site-explorer/${(a as { siteRoute?: { pathPattern: string } }).siteRoute ? "" : ""}`,
                  )}
                  className="font-mono text-xs text-blue-600 hover:underline"
                >
                  {a.siteRoute.pathRendered ?? a.siteRoute.pathPattern}
                </a>
                <p className="text-xs text-gray-400">
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
        className="shrink-0 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
      >
        Résoudre
      </button>
    </form>
  );
}
