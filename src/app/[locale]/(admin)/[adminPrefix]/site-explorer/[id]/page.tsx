// Site Explorer — Détail route — Sprint Site Explorer Admin 2026-05-22.

import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { CheckCircle2, AlertTriangle, XCircle, Circle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { auth } from "@/auth";
import {
  getSiteRouteDetail,
  triggerInspection,
  resolveAnomaly,
  setRouteQualityStatus,
  toggleGscIndexationRequested,
  setRouteAdminNotes,
} from "@/server/actions/site-explorer/site-routes";
import type { SiteRouteQuality } from "../../../../../../../prisma/generated/client";
import { SiteRouteStatusBadge } from "@/components/admin/site-explorer/SiteRouteStatusBadge";
import { adminPath } from "@/lib/admin-path";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Détail URL — Site Explorer Admin",
  robots: { index: false, follow: false },
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
const GITHUB_REPO = "https://github.com/will383842/axion-ia/blob/main";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string; id: string }>;
}

export default async function SiteRouteDetailPage({ params }: PageProps) {
  const { adminPrefix, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const route = await getSiteRouteDetail(id);
  if (!route) notFound();

  const backUrl = adminPath("fr", "site-explorer");
  const displayPath = route.pathRendered ?? route.pathPattern;
  const isResolvable = !displayPath.includes("[");

  async function handleReInspect() {
    "use server";
    await triggerInspection(id);
    redirect(adminPath("fr", `site-explorer/${id}`));
  }

  async function handleSetQuality(formData: FormData) {
    "use server";
    const q = String(formData.get("quality") ?? "unset") as SiteRouteQuality;
    await setRouteQualityStatus(id, q);
    redirect(adminPath("fr", `site-explorer/${id}`));
  }

  async function handleToggleGsc() {
    "use server";
    const current = await getSiteRouteDetail(id);
    await toggleGscIndexationRequested(id, !current?.gscIndexationRequested);
    redirect(adminPath("fr", `site-explorer/${id}`));
  }

  async function handleSetNotes(formData: FormData) {
    "use server";
    await setRouteAdminNotes(id, String(formData.get("notes") ?? ""));
    redirect(adminPath("fr", `site-explorer/${id}`));
  }

  // Les quatre verdicts étaient quatre pastilles RONDES ne différant que par
  // la teinte : en vision des couleurs déficiente, choisir « Parfaite » plutôt
  // que « Cassée » relevait de la lecture du libellé seul. Quatre dessins
  // distincts rendent le verdict lisible avant même le texte.
  const QUALITY_BTNS: Array<{ value: SiteRouteQuality; Icone: LucideIcon; label: string }> = [
    { value: "green", Icone: CheckCircle2, label: "Parfaite" },
    { value: "orange", Icone: AlertTriangle, label: "À retoucher" },
    { value: "red", Icone: XCircle, label: "Cassée" },
    { value: "unset", Icone: Circle, label: "Non revue" },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <a href={backUrl} className="admin-link text-sm">
          ← Site Explorer
        </a>
        <span className="text-[color:var(--color-admin-fg-disabled)]">/</span>
        <code className="text-sm text-[color:var(--color-admin-fg-soft)]">{displayPath}</code>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-mono text-xl font-bold text-[color:var(--color-admin-fg)]">
            {displayPath}
          </h1>
          {route.metaTitle && (
            <p className="mt-1 text-[color:var(--color-admin-fg-muted)]">{route.metaTitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <SiteRouteStatusBadge status={route.status} httpStatus={route.httpStatus} />
          {isResolvable && (
            <a
              href={`${SITE_URL}${displayPath}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded border border-[color:var(--color-admin-border-strong)] px-3 py-1.5 text-sm hover:bg-[color:var(--color-admin-surface-sunken)]"
            >
              Voir la page
            </a>
          )}
          {route.editable && route.editorRoute && (
            <a href={route.editorRoute} className="admin-button">
              Éditer
            </a>
          )}
          {!route.editable && route.filePath && (
            <a
              href={`${GITHUB_REPO}/${route.filePath}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded border border-[color:var(--color-admin-border-strong)] px-3 py-1.5 text-sm text-[color:var(--color-admin-fg-muted)] hover:bg-[color:var(--color-admin-surface-sunken)]"
              title="Page statique — voir le code source"
            >
              Code source
            </a>
          )}
          {isResolvable && (
            <form action={handleReInspect}>
              <button
                type="submit"
                className="rounded border border-[color:var(--color-admin-border-strong)] px-3 py-1.5 text-sm hover:bg-[color:var(--color-admin-surface-sunken)]"
              >
                Re-inspecter
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Métadonnées */}
        <section className="space-y-3 rounded-lg border border-[color:var(--color-admin-border)] p-4">
          <h2 className="font-semibold text-[color:var(--color-admin-fg)]">Métadonnées SEO</h2>
          <dl className="space-y-2 text-sm">
            <Row label="Type" value={route.type} />
            <Row label="Section" value={route.section ?? "—"} />
            <Row label="metaTitle" value={route.metaTitle ?? "—"} mono />
            <Row label="metaDescription" value={route.metaDescription ?? "—"} />
            <Row label="H1" value={route.h1 ?? "—"} />
            <Row label="Source" value={route.sourceDbTable ?? "static"} />
            {route.sourceDbId && <Row label="Source DB ID" value={route.sourceDbId} mono />}
          </dl>
        </section>

        {/* Métriques contenu */}
        <section className="space-y-3 rounded-lg border border-[color:var(--color-admin-border)] p-4">
          <h2 className="font-semibold text-[color:var(--color-admin-fg)]">Métriques contenu</h2>
          <dl className="space-y-2 text-sm">
            <Row label="Mots" value={route.wordCount?.toLocaleString("fr-FR") ?? "—"} />
            <Row label="JSON-LD" value={route.jsonLdCount?.toString() ?? "—"} />
            <Row label="Liens internes" value={route.internalLinkCount?.toString() ?? "—"} />
            <Row label="Liens externes" value={route.externalLinkCount?.toString() ?? "—"} />
            <Row
              label="AiDisclaimer"
              value={
                route.hasAiDisclaimer === null ? "?" : route.hasAiDisclaimer ? "Présent" : "Absent"
              }
            />
            <Row
              label="Dernière inspection"
              value={
                route.lastInspectedAt
                  ? new Date(route.lastInspectedAt).toLocaleString("fr-FR")
                  : "Jamais"
              }
            />
          </dl>
        </section>

        {/* Indexabilité & GSC */}
        <section className="space-y-3 rounded-lg border border-[color:var(--color-admin-border)] p-4">
          <h2 className="font-semibold text-[color:var(--color-admin-fg)]">
            Indexabilité &amp; GSC
          </h2>
          <dl className="space-y-2 text-sm">
            <Row
              label="Indexable (live)"
              value={
                route.isIndexable === null
                  ? "— (non calculé)"
                  : route.isIndexable
                    ? "Indexable"
                    : `Noindex — ${route.noindexReason ?? ""}`
              }
            />
            <Row label="Catégorie" value={route.category ?? "—"} />
            <Row label="Source" value={route.source} />
            <Row
              label="Indexation GSC"
              value={
                route.gscIndexationRequested
                  ? `Demandée${route.gscIndexationRequestedAt ? ` le ${new Date(route.gscIndexationRequestedAt).toLocaleDateString("fr-FR")}` : ""}`
                  : "Non demandée"
              }
            />
            <Row
              label="Trafic GSC (28j)"
              value={
                route.gscImpressions === null
                  ? "—"
                  : `${route.gscClicks ?? 0} clics · ${route.gscImpressions} impressions${
                      route.gscPosition != null ? ` · pos. ${route.gscPosition.toFixed(1)}` : ""
                    }`
              }
            />
            <Row
              label="Vue/découverte"
              value={
                route.lastSeenAt ? new Date(route.lastSeenAt).toLocaleString("fr-FR") : "jamais"
              }
            />
            {route.removedAt && (
              <Row label="Disparue le" value={new Date(route.removedAt).toLocaleString("fr-FR")} />
            )}
          </dl>
          <form action={handleToggleGsc}>
            <button
              type="submit"
              className="rounded border border-[color:var(--color-admin-border-strong)] px-3 py-1.5 text-sm text-[color:var(--color-admin-fg-soft)] hover:bg-[color:var(--color-admin-surface-sunken)]"
            >
              {route.gscIndexationRequested
                ? "Décocher « indexation GSC demandée »"
                : "Marquer « indexation GSC demandée »"}
            </button>
          </form>
        </section>

        {/* Revue manuelle : feu tricolore + notes */}
        <section className="space-y-3 rounded-lg border border-[color:var(--color-admin-border)] p-4">
          <h2 className="font-semibold text-[color:var(--color-admin-fg)]">
            Revue (feu &amp; notes)
          </h2>
          <form action={handleSetQuality} className="flex flex-wrap gap-2">
            {QUALITY_BTNS.map((b) => (
              <button
                key={b.value}
                type="submit"
                name="quality"
                value={b.value}
                className={`rounded border px-2.5 py-1.5 text-sm hover:bg-[color:var(--color-admin-surface-sunken)] ${
                  route.qualityStatus === b.value
                    ? "border-[color:var(--color-admin-accent)] font-semibold text-[color:var(--color-admin-accent)]"
                    : "border-[color:var(--color-admin-border-strong)] text-[color:var(--color-admin-fg-muted)]"
                }`}
              >
                <b.Icone size={14} aria-hidden="true" className="inline shrink-0 align-[-2px]" />{" "}
                {b.label}
              </button>
            ))}
          </form>
          {route.reviewedAt && (
            <p className="text-xs text-[color:var(--color-admin-fg-disabled)]">
              Dernière revue : {new Date(route.reviewedAt).toLocaleString("fr-FR")}
            </p>
          )}
          <form action={handleSetNotes} className="space-y-2">
            <textarea
              aria-label="Notes internes sur cette URL"
              name="notes"
              defaultValue={route.adminNotes ?? ""}
              rows={3}
              placeholder="Notes internes sur cette URL…"
              className="w-full rounded-lg border border-[color:var(--color-admin-border-strong)] px-3 py-2 text-sm"
            />
            <button type="submit" className="admin-button">
              Enregistrer la note
            </button>
          </form>
        </section>

        {/* Lighthouse */}
        {(route.lighthousePerf !== null || route.lighthouseSeo !== null) && (
          <section className="space-y-3 rounded-lg border border-[color:var(--color-admin-border)] p-4">
            <h2 className="font-semibold text-[color:var(--color-admin-fg)]">Lighthouse</h2>
            <div className="flex gap-4">
              {[
                { label: "Perf", score: route.lighthousePerf },
                { label: "SEO", score: route.lighthouseSeo },
                { label: "A11y", score: route.lighthouseA11y },
                { label: "BP", score: route.lighthouseBP },
              ].map(
                ({ label, score }) =>
                  score !== null && (
                    <div key={label} className="text-center">
                      <div
                        className={`text-2xl font-bold ${
                          (score ?? 0) >= 90
                            ? "text-[color:var(--color-admin-success)]"
                            : (score ?? 0) >= 70
                              ? "text-[color:var(--color-admin-warning)]"
                              : "text-[color:var(--color-admin-destructive)]"
                        }`}
                      >
                        {score}
                      </div>
                      <div className="text-xs text-[color:var(--color-admin-fg-muted)]">
                        {label}
                      </div>
                    </div>
                  ),
              )}
            </div>
            {route.lighthouseRunAt && (
              <p className="text-xs text-[color:var(--color-admin-fg-disabled)]">
                Audit: {new Date(route.lighthouseRunAt).toLocaleString("fr-FR")}
              </p>
            )}
          </section>
        )}

        {/* Anomalies */}
        {route.anomalies.length > 0 && (
          <section className="space-y-3 rounded-lg border border-[color:var(--color-admin-destructive)] bg-[color:var(--color-admin-destructive-soft)] p-4">
            <h2 className="font-semibold text-[color:var(--color-admin-destructive-fg)]">
              ⚠️ Anomalies ({route.anomalies.length})
            </h2>
            <ul className="space-y-2">
              {route.anomalies.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3">
                  <div>
                    <span
                      className={`mr-1.5 inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${
                        a.severity === "high"
                          ? "bg-[color:var(--color-admin-destructive-soft)] text-[color:var(--color-admin-destructive-fg)]"
                          : a.severity === "medium"
                            ? "bg-[color:var(--color-admin-warning-soft)] text-[color:var(--color-admin-warning-fg)]"
                            : "bg-[color:var(--color-admin-warning-soft)] text-[color:var(--color-admin-warning-fg)]"
                      }`}
                    >
                      {a.severity}
                    </span>
                    <span className="text-sm text-[color:var(--color-admin-destructive-fg)]">
                      {a.description}
                    </span>
                  </div>
                  <ResolveButton anomalyId={a.id} routeId={id} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

// ─── Composants auxiliaires ────────────────────────────────────────────────────

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-2">
      <dt className="w-32 shrink-0 text-[color:var(--color-admin-fg-muted)]">{label}</dt>
      <dd
        className={`break-all text-[color:var(--color-admin-fg)] ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

function ResolveButton({ anomalyId, routeId }: { anomalyId: string; routeId: string }) {
  async function handleResolve() {
    "use server";
    await resolveAnomaly(anomalyId);
    redirect(adminPath("fr", `site-explorer/${routeId}`));
  }

  return (
    <form action={handleResolve}>
      <button
        type="submit"
        className="shrink-0 rounded border border-[color:var(--color-admin-destructive)] px-2 py-0.5 text-xs text-[color:var(--color-admin-destructive)] hover:bg-[color:var(--color-admin-destructive-soft)]"
      >
        Résoudre
      </button>
    </form>
  );
}
