// use-client: filtres interactifs (useState) + pagination + table live
"use client";

/**
 * Keyword Strategy View — Vue globale de la stratégie mots-clés Axion-IA
 * Phase 7 Sprint Perfection 2026-05-22
 *
 * Affiche :
 *  - Métriques globales (total, par verticale, par intent)
 *  - Liste filtrée + paginée (100/page)
 *  - Filtres verticale / intent / recherche texte
 *  - Export CSV (à implémenter)
 */

import { useMemo, useState } from "react";
import { ALL_KEYWORD_SEEDS } from "@/content/keywords/master";
import type { KeywordSeed } from "@/content/keywords/types";

// ── Mapping module → verticale ────────────────────────────────────────────────
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

// ── Barre de progression ───────────────────────────────────────────────────────
function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-2 w-full rounded bg-gray-100">
      <div className={`h-2 rounded ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── Card métrique ──────────────────────────────────────────────────────────────
function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

// ── Composant principal ────────────────────────────────────────────────────────

interface Props {
  searchParams?: {
    vertical?: string;
    intent?: string;
    q?: string;
    page?: string;
  };
}

export function KeywordStrategyView({ searchParams }: Props) {
  const seeds = ALL_KEYWORD_SEEDS;

  // State filtres
  const [vertical, setVertical] = useState(searchParams?.vertical ?? "");
  const [intent, setIntent] = useState(searchParams?.intent ?? "");
  const [query, setQuery] = useState(searchParams?.q ?? "");
  const [page, setPage] = useState(Number(searchParams?.page ?? 1));

  const PAGE_SIZE = 100;

  // Calcul métriques globales
  const byVertical = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of seeds) {
      const v = MODULE_TO_VERTICAL[s.module] ?? "transversal";
      counts[v] = (counts[v] ?? 0) + 1;
    }
    return counts;
  }, [seeds]);

  const byIntent = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of seeds) {
      counts[s.intent] = (counts[s.intent] ?? 0) + 1;
    }
    return counts;
  }, [seeds]);

  // Seeds filtrés
  const filtered = useMemo(() => {
    return seeds.filter((s: KeywordSeed) => {
      if (vertical) {
        const v = MODULE_TO_VERTICAL[s.module] ?? "transversal";
        if (v !== vertical) return false;
      }
      if (intent && s.intent !== intent) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!s.keyword.toLowerCase().includes(q) && !s.urlCible.toLowerCase().includes(q))
          return false;
      }
      return true;
    });
  }, [seeds, vertical, intent, query]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const allVerticals = Object.keys(VERTICAL_LABELS);
  const allIntents = Object.keys(INTENT_LABELS);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Stratégie Keywords</h1>
        <p className="mt-1 text-sm text-gray-500">
          {seeds.length.toLocaleString()} keywords · 5 verticales · 12 intents
        </p>
      </div>

      {/* Métriques globales */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard label="Total keywords" value={seeds.length.toLocaleString()} />
        <MetricCard
          label="Voice search"
          value={(byIntent["voice_search"] ?? 0).toLocaleString()}
          sub="Questions naturelles"
        />
        <MetricCard
          label="AI Overview"
          value={(byIntent["ai_overview"] ?? 0).toLocaleString()}
          sub="Sources IA génératives"
        />
        <MetricCard
          label="Featured Snippet"
          value={(byIntent["featured_snippet"] ?? 0).toLocaleString()}
          sub="Position 0 Google"
        />
      </div>

      {/* Distribution par verticale */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold text-gray-700">Distribution par verticale</h2>
        <div className="space-y-3">
          {allVerticals.map((v) => {
            const count = byVertical[v] ?? 0;
            const pct = Math.round((count / seeds.length) * 100);
            const status = count >= 250 ? "✅" : count >= 150 ? "⚠️" : "🔴";
            return (
              <div key={v}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700">
                    {status} {VERTICAL_LABELS[v]}
                  </span>
                  <span className="text-gray-500">
                    {count.toLocaleString()} ({pct}%)
                  </span>
                </div>
                <ProgressBar
                  value={count}
                  max={seeds.length / 5}
                  color={
                    count >= 250 ? "bg-green-500" : count >= 150 ? "bg-yellow-400" : "bg-red-400"
                  }
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Distribution par intent */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold text-gray-700">Distribution par intent</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Object.entries(byIntent)
            .sort(([, a], [, b]) => b - a)
            .map(([intentKey, count]) => (
              <div key={intentKey} className="rounded bg-gray-50 p-2 text-center">
                <p className="text-xs text-gray-500">{INTENT_LABELS[intentKey] ?? intentKey}</p>
                <p className="font-bold text-gray-900">{count.toLocaleString()}</p>
                <p className="text-xs text-gray-400">{Math.round((count / seeds.length) * 100)}%</p>
              </div>
            ))}
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <select
          value={vertical}
          onChange={(e) => {
            setVertical(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          <option value="">Toutes les verticales</option>
          {allVerticals.map((v) => (
            <option key={v} value={v}>
              {VERTICAL_LABELS[v]}
            </option>
          ))}
        </select>

        <select
          value={intent}
          onChange={(e) => {
            setIntent(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          <option value="">Tous les intents</option>
          {allIntents.map((i) => (
            <option key={i} value={i}>
              {INTENT_LABELS[i] ?? i}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Rechercher un keyword..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />

        <span className="flex items-center text-sm text-gray-500">
          {filtered.length.toLocaleString()} résultats
        </span>
      </div>

      {/* Table keywords */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Keyword</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Verticale</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Intent</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">URL cible</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Prio</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginated.map((s: KeywordSeed, i) => {
              const v = MODULE_TO_VERTICAL[s.module] ?? "transversal";
              const intentColor =
                s.intent === "voice_search"
                  ? "bg-purple-100 text-purple-700"
                  : s.intent === "ai_overview"
                    ? "bg-blue-100 text-blue-700"
                    : s.intent === "featured_snippet"
                      ? "bg-yellow-100 text-yellow-700"
                      : s.intent === "transactionnel"
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600";
              return (
                <tr key={`${s.keyword}-${i}`} className="hover:bg-gray-50">
                  <td className="max-w-xs truncate px-4 py-2 font-medium text-gray-900">
                    {s.keyword}
                  </td>
                  <td className="px-4 py-2 text-gray-500">{VERTICAL_LABELS[v] ?? v}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${intentColor}`}>
                      {INTENT_LABELS[s.intent] ?? s.intent}
                    </span>
                  </td>
                  <td className="max-w-xs truncate px-4 py-2 text-xs text-gray-400">
                    {s.urlCible}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span
                      className={`font-bold ${s.priorite === 1 ? "text-red-600" : s.priorite === 2 ? "text-yellow-600" : "text-gray-400"}`}
                    >
                      P{s.priorite}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            ← Précédent
          </button>
          <span className="text-sm text-gray-500">
            Page {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Suivant →
          </button>
        </div>
      )}
    </div>
  );
}
