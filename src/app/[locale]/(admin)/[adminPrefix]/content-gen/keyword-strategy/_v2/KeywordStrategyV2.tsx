/**
 * Keyword Strategy View V2 — Server Component (RSC)
 *
 * Migration A-15 audit 2026-05-22 : V1 était un Client Component full
 * `'use client'` lisant ALL_KEYWORD_SEEDS (static in-memory).
 * V2 = RSC pur : filtrage + pagination côté serveur via searchParams URL.
 * Aucun state React, aucun JS côté client — filtres soumis via <form> GET.
 *
 * AdminPageShell + AdminPageHeader + AdminCard (pattern V2 standard).
 */

import { AdminPageShell, AdminPageHeader, AdminCard, AdminPagination } from "@/components/admin/ui";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { ALL_KEYWORD_SEEDS } from "@/content/keywords/master";
import type { KeywordSeed } from "@/content/keywords/types";

// ── Constantes ─────────────────────────────────────────────────────────────────

const MODULE_TO_VERTICAL: Record<string, string> = {
  audit: "audits",
  "interventions-formations": "interventions_formations",
  implementation: "implementations",
  "coaching-1-to-1": "un_a_un",
  "codage-developpement": "sites_web_augmentes",
  "maintenance-ia": "transversal",
  transversal: "transversal",
};

const VERTICAL_LABELS: Record<string, string> = {
  audits: "Audits",
  interventions_formations: "Interventions & Formations",
  implementations: "Implémentations",
  un_a_un: "Coaching 1-to-1",
  sites_web_augmentes: "Sites Web Augmentés",
  transversal: "Transversal",
};

const INTENT_LABELS: Record<string, string> = {
  transactionnel: "Transactionnel",
  benefice: "Bénéfice",
  informationnel: "Informationnel",
  aeo: "AEO",
  comparatif: "Comparatif",
  local: "Local/Géo",
  partenaire: "Partenaire",
  sectoriel: "Sectoriel",
  voice_search: "Voice Search",
  ai_overview: "AI Overview",
  featured_snippet: "Featured Snippet",
  commercial_investigation: "Investigation Commerciale",
};

const PAGE_SIZE = 100;

// ── Types ──────────────────────────────────────────────────────────────────────

interface SearchParams {
  vertical?: string;
  intent?: string;
  q?: string;
  page?: string;
}

interface Props {
  searchParams: SearchParams;
  adminPrefix: string;
}

// ── Composant RSC ──────────────────────────────────────────────────────────────

export async function KeywordStrategyV2({
  searchParams,
  adminPrefix,
}: Props): Promise<React.ReactElement> {
  const seeds = ALL_KEYWORD_SEEDS;

  const vertical = searchParams.vertical ?? "";
  const intent = searchParams.intent ?? "";
  const query = (searchParams.q ?? "").toLowerCase();
  const page = Math.max(1, Number(searchParams.page ?? 1));

  // Filtrage côté serveur
  const filtered = seeds.filter((s: KeywordSeed) => {
    if (vertical) {
      const v = MODULE_TO_VERTICAL[s.module] ?? "transversal";
      if (v !== vertical) return false;
    }
    if (intent && s.intent !== intent) return false;
    if (query) {
      if (!s.keyword.toLowerCase().includes(query) && !s.urlCible.toLowerCase().includes(query)) {
        return false;
      }
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Métriques
  const byVertical: Record<string, number> = {};
  const byIntent: Record<string, number> = {};
  for (const s of seeds) {
    const v = MODULE_TO_VERTICAL[s.module] ?? "transversal";
    byVertical[v] = (byVertical[v] ?? 0) + 1;
    byIntent[s.intent] = (byIntent[s.intent] ?? 0) + 1;
  }

  const basePath = `/fr/${adminPrefix}/content-gen/keyword-strategy`;

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Stratégie Keywords"
        description={`${seeds.length.toLocaleString("fr-FR")} keywords · 5 verticales · 12 intents`}
      />

      {/* Métriques globales */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total keywords", value: seeds.length },
          { label: "Voice Search", value: byIntent["voice_search"] ?? 0 },
          { label: "AI Overview", value: byIntent["ai_overview"] ?? 0 },
          { label: "Featured Snippet", value: byIntent["featured_snippet"] ?? 0 },
        ].map(({ label, value }) => (
          <AdminCard key={label}>
            <p className="text-sm text-[color:var(--color-admin-fg-muted)]">{label}</p>
            <p className="mt-1 text-2xl font-bold">{value.toLocaleString("fr-FR")}</p>
          </AdminCard>
        ))}
      </div>

      {/* Distribution par verticale */}
      <AdminCard>
        <h2 className="mb-3 font-semibold">Distribution par verticale</h2>
        <div className="space-y-2">
          {Object.keys(VERTICAL_LABELS).map((v) => {
            const count = byVertical[v] ?? 0;
            const pct = seeds.length > 0 ? Math.round((count / seeds.length) * 100) : 0;
            const StatutIcone =
              count >= 250 ? CheckCircle2 : count >= 150 ? AlertTriangle : XCircle;
            const statutLibelle =
              count >= 250
                ? "Couverture suffisante"
                : count >= 150
                  ? "Couverture juste"
                  : "Couverture insuffisante";
            return (
              <div key={v}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium">
                    <StatutIcone
                      size={14}
                      aria-label={statutLibelle}
                      className="inline shrink-0 align-[-2px]"
                    />{" "}
                    {VERTICAL_LABELS[v]}
                  </span>
                  <span className="text-[color:var(--color-admin-fg-muted)]">
                    {count.toLocaleString("fr-FR")} ({pct}%)
                  </span>
                </div>
                <div className="h-2 w-full rounded bg-[color:var(--color-admin-neutral-soft)]">
                  <div
                    className={`h-2 rounded ${count >= 250 ? "bg-[color:var(--color-admin-success)]" : count >= 150 ? "bg-[color:var(--color-admin-warning)]" : "bg-[color:var(--color-admin-destructive)]"}`}
                    style={{
                      width: `${seeds.length > 0 ? Math.min(100, (count / (seeds.length / 5)) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </AdminCard>

      {/* Filtres GET form (zéro JS) */}
      <form method="GET" action={basePath} className="flex flex-wrap gap-3">
        <select
          aria-label="Filtrer par verticale"
          name="vertical"
          defaultValue={vertical}
          className="rounded-md border border-[color:var(--color-admin-border-strong)] bg-[color:var(--color-admin-paper)] px-3 py-1.5 text-sm shadow-sm"
        >
          <option value="">Toutes les verticales</option>
          {Object.entries(VERTICAL_LABELS).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>

        <select
          aria-label="Filtrer par intention de recherche"
          name="intent"
          defaultValue={intent}
          className="rounded-md border border-[color:var(--color-admin-border-strong)] bg-[color:var(--color-admin-paper)] px-3 py-1.5 text-sm shadow-sm"
        >
          <option value="">Tous les intents</option>
          {Object.entries(INTENT_LABELS).map(([i, label]) => (
            <option key={i} value={i}>
              {label}
            </option>
          ))}
        </select>

        <input
          aria-label="Rechercher un keyword..."
          type="text"
          name="q"
          defaultValue={query}
          placeholder="Rechercher un keyword..."
          className="flex-1 rounded-md border border-[color:var(--color-admin-border-strong)] bg-[color:var(--color-admin-paper)] px-3 py-1.5 text-sm shadow-sm"
        />

        <button
          type="submit"
          className="rounded-md bg-[color:var(--color-admin-primary)] px-4 py-1.5 text-sm font-medium text-white"
        >
          Filtrer
        </button>

        {(vertical || intent || query) && (
          <a
            href={basePath}
            className="rounded-md border border-[color:var(--color-admin-border-strong)] bg-[color:var(--color-admin-paper)] px-4 py-1.5 text-sm text-[color:var(--color-admin-fg-muted)]"
          >
            Réinitialiser
          </a>
        )}

        <span className="flex items-center text-sm text-[color:var(--color-admin-fg-muted)]">
          {filtered.length.toLocaleString("fr-FR")} résultats
        </span>
      </form>

      {/* Table keywords */}
      <AdminCard variant="compact" className="!p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[color:var(--color-admin-surface-sunken)]">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-[color:var(--color-admin-fg-muted)]">
                  Keyword
                </th>
                <th className="px-4 py-3 text-left font-medium text-[color:var(--color-admin-fg-muted)]">
                  Verticale
                </th>
                <th className="px-4 py-3 text-left font-medium text-[color:var(--color-admin-fg-muted)]">
                  Intent
                </th>
                <th className="px-4 py-3 text-left font-medium text-[color:var(--color-admin-fg-muted)]">
                  URL cible
                </th>
                <th className="px-4 py-3 text-center font-medium text-[color:var(--color-admin-fg-muted)]">
                  Prio
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-admin-border)]">
              {paginated.map((s: KeywordSeed, i: number) => {
                const v = MODULE_TO_VERTICAL[s.module] ?? "transversal";
                const intentBadge =
                  s.intent === "voice_search"
                    ? "bg-[color:var(--color-admin-info-soft)] text-[color:var(--color-admin-info)]"
                    : s.intent === "ai_overview"
                      ? "bg-[color:var(--color-admin-info-soft)] text-[color:var(--color-admin-info)]"
                      : s.intent === "featured_snippet"
                        ? "bg-[color:var(--color-admin-warning-soft)] text-[color:var(--color-admin-warning-fg)]"
                        : s.intent === "transactionnel"
                          ? "bg-[color:var(--color-admin-success-soft)] text-[color:var(--color-admin-success-fg)]"
                          : "bg-[color:var(--color-admin-neutral-soft)] text-[color:var(--color-admin-fg-muted)]";
                return (
                  <tr
                    key={`${s.keyword}-${i}`}
                    className="hover:bg-[color:var(--color-admin-surface-sunken)]"
                  >
                    <td className="max-w-xs truncate px-4 py-2 font-medium text-[color:var(--color-admin-fg)]">
                      {s.keyword}
                    </td>
                    <td className="px-4 py-2 text-[color:var(--color-admin-fg-muted)]">
                      {VERTICAL_LABELS[v] ?? v}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${intentBadge}`}
                      >
                        {INTENT_LABELS[s.intent] ?? s.intent}
                      </span>
                    </td>
                    <td className="max-w-xs truncate px-4 py-2 text-xs text-[color:var(--color-admin-fg-disabled)]">
                      {s.urlCible}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span
                        className={`font-bold ${s.priorite === 1 ? "text-[color:var(--color-admin-destructive)]" : s.priorite === 2 ? "text-[color:var(--color-admin-warning)]" : "text-[color:var(--color-admin-fg-disabled)]"}`}
                      >
                        P{s.priorite}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {paginated.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-[color:var(--color-admin-fg-disabled)]"
                  >
                    Aucun keyword correspondant aux filtres.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </AdminCard>

      {/* Pagination via liens GET */}
      <AdminPagination
        page={safePage}
        totalPages={totalPages}
        baseHref={basePath}
        preservedParams={{
          ...(vertical ? { vertical } : {}),
          ...(intent ? { intent } : {}),
          ...(query ? { q: query } : {}),
        }}
      />
    </AdminPageShell>
  );
}
