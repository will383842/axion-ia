// Wizard 4 étapes /content-gen/campaigns/new — POINT D'ENTRÉE UNIQUE.
//
// Étape 1 — Quoi générer ?        (cartes de types + presets en raccourci)
// Étape 2 — Pour qui / où ?       (verticale + villes + public)
// Étape 3 — Combien / à quel rythme ? (volume + estimation coût&durée en direct = M7)
// Étape 4 — Vérifier & lancer     (récap + Lancer → redirection /coverage/[id] = M8)
//
// State machine via useState(step). FormData accumulé entre étapes puis submit
// Étape 4 → createCampaignFromWizard server action (RÉUTILISÉE, non réécrite).
//
// B6 : accepte presetSeed (pré-remplissage depuis /coverage/presets?preset=).
// M5 : targetPerCity replié dans un bloc « avancé ».
// M7 : estimation coût&durée recalculée en direct à l'étape 3.

"use client";
// use-client: state machine wizard + sliders interactifs + sonner toast —
// composant client-side pur, pas de SSR possible.

import { useState } from "react";

import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { AdminBadge, AdminCard, AdminPageHeader, AdminPageShell } from "@/components/admin/ui";
import { cn } from "@/lib/utils";
import { createCampaignFromWizard } from "@/server/actions/content-gen/campaign-wizard";
import {
  WIZARD_SECTIONS,
  WIZARD_CONTENT_TYPE_LABELS,
  WIZARD_SERVICE_SECTORS,
  WIZARD_SEARCH_INTENTS,
  WIZARD_COMPANY_SIZES,
  WIZARD_ORG_TYPES,
  WIZARD_SURROUNDING_MODES,
  WIZARD_DURATION_MODES,
  type WizardContentType,
} from "@/server/actions/content-gen/campaign-wizard-constants";
import { CLIENT_SECTORS } from "@/content/sectors";

import type { PresetWizardSeed, ServiceSector } from "./preset-mapping";

// ─── Éditeur de pondérations (axes multi-axes : activité/secteur/intention/audience)
// Liste de lignes label + input %. Une somme = 0 → l'axe est inactif (réglage par
// défaut côté serveur). Proportions : la somme n'a pas à valoir 100 (normalisée).

interface WeightOption {
  readonly value: string;
  readonly labelFr: string;
}

function WeightEditor({
  options,
  value,
  onChange,
  ariaLabel,
  inactiveHint,
}: {
  readonly options: ReadonlyArray<WeightOption>;
  readonly value: Record<string, number>;
  readonly onChange: (next: Record<string, number>) => void;
  readonly ariaLabel: string;
  readonly inactiveHint: string;
}): React.ReactElement {
  const sum = Object.values(value).reduce((a, b) => a + (b || 0), 0);
  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-col gap-1.5">
      {options.map((o) => (
        <label key={o.value} className="flex items-center justify-between gap-3">
          <span className="text-[length:var(--text-admin-sm)]">{o.labelFr}</span>
          <input
            type="number"
            min={0}
            max={1000}
            value={value[o.value] ?? 0}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10) || 0;
              const next = { ...value };
              if (n <= 0) delete next[o.value];
              else next[o.value] = n;
              onChange(next);
            }}
            className="admin-input admin-input-w-sm text-right"
            aria-label={`${ariaLabel} — ${o.labelFr}`}
          />
        </label>
      ))}
      <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-soft)]">
        {sum > 0 ? `Somme : ${sum} (proportions, normalisées automatiquement)` : inactiveHint}
      </span>
    </div>
  );
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface Props {
  readonly adminPrefix: string;
  /** B6 — état initial dérivé d'un preset (?preset=<slug>). */
  readonly presetSeed?: PresetWizardSeed;
  /** Nom du preset (affiché en bandeau). */
  readonly presetName?: string;
  /** Slug de ville pré-sélectionné (?ville=<slug>, redirection villes). */
  readonly villeSlug?: string;
}

type VilleScopeMode = "global_queue" | "custom_subset";
type MixMode = "percentage" | "manual";

interface WizardState {
  step: 1 | 2 | 3 | 4;
  serviceSector: ServiceSector | null;
  name: string;
  dailyArticles: number;
  targetPerCity: number;
  villeScopeMode: VilleScopeMode;
  customVilleSlugs: string[];
  customVilleInput: string;
  startDate: string;
  endDate: string;
  mixMode: MixMode;
  contentTypeWeights: Record<WizardContentType, number>;
  // ── Axes multi-axes (tous optionnels : vides = comportement par défaut) ──
  serviceSectorWeights: Record<string, number>; // axe 2 — {} = activité unique
  targetSecteurWeights: Record<string, number>; // axe 3 — {} = aucun ciblage
  searchIntentMix: Record<string, number>; // axe 4 — {} = fallback global
  audienceSizeWeights: Record<string, number>; // axe 5 — {} = défaut
  audienceOrg: string; // type d'organisation appliqué aux tailles (axe 5)
  villeSurroundingMode: "none" | "radius" | "same_departement"; // axe 6
  villeSurroundingRadiusKm: number; // axe 6
  durationMode: "fixed" | "unlimited"; // axe 8
  submitting: boolean;
}

const SERVICE_LABELS: Record<ServiceSector, { fr: string; desc: string }> = {
  interventions_formations: {
    fr: "Interventions & Formations",
    desc: "Conférences, ateliers, masterclass IA",
  },
  audits: { fr: "Audits IA", desc: "Diagnostic maturité IA + roadmap" },
  implementations: { fr: "Implémentations IA", desc: "Build solutions IA sur-mesure" },
  un_a_un: { fr: "1-to-1 Coaching", desc: "Accompagnement dirigeant 1-to-1" },
  sites_web_augmentes: { fr: "Sites web augmentés IA", desc: "Refonte/build sites avec couche IA" },
};

// Sprint v7 Phase 8 — 21 sliders (9 V1 + 12 Phase 8) groupés en 6 sections.
// Default 'équilibré' : core 30% + sources 12% + comparatifs 11% + Q&A 13% +
// SEO long-tail 19% + conversion 15% = 100%.
const DEFAULT_WEIGHTS_BALANCED: Record<WizardContentType, number> = {
  // Section 1 — Core (2) = 30% (landing_ville retiré, CLI-only — % redistribué)
  blog_article: 18,
  guide_pilier: 12,
  // Section 2 — Sources externes (3) = 12%
  blog_from_rss: 5,
  blog_from_keywords: 5,
  blog_from_title: 2,
  // Section 3 — Comparatifs (3) = 11%
  comparison: 5,
  vs_comparator: 3,
  alternative_to: 3,
  // Section 4 — Q&A (3) = 13%
  qa_derived: 5,
  faq_standalone: 4,
  faq_geo: 4,
  // Section 5 — SEO long-tail (5) = 19%
  long_tail_keyword: 5,
  top_x_in_y: 4,
  how_to_x_in_y: 4,
  best_for_x_in_y: 3,
  what_is_x: 3,
  // Section 6 — Conversion locale (4) = 15%
  pain_point_solution: 5,
  case_study_local: 4,
  calculator_roi: 3,
  glossary_term: 3,
};

// ── Étape 1 — « Quoi générer ? » : cartes de grands types ─────────────────────
// Chaque carte applique un mix focalisé (somme = 100). « Mix équilibré » garde
// le preset par défaut ; le détail fin reste accessible en mode avancé (étape 3).
interface QuickType {
  id: string;
  fr: string;
  desc: string;
  emoji: string;
  weights: Record<WizardContentType, number>;
}

function focusedWeights(
  active: Partial<Record<WizardContentType, number>>,
): Record<WizardContentType, number> {
  const zeroed = Object.fromEntries(
    Object.keys(DEFAULT_WEIGHTS_BALANCED).map((k) => [k, 0]),
  ) as Record<WizardContentType, number>;
  return { ...zeroed, ...active };
}

const QUICK_TYPES: QuickType[] = [
  {
    id: "contenu_local",
    fr: "Contenu local",
    desc: "Problème/solution, cas d'usage et FAQ ancrés ville",
    emoji: "🏙️",
    weights: focusedWeights({ pain_point_solution: 40, case_study_local: 30, faq_geo: 30 }),
  },
  {
    id: "blog",
    fr: "Articles de blog",
    desc: "Articles éditoriaux & actualités",
    emoji: "📝",
    weights: focusedWeights({ blog_article: 60, blog_from_title: 20, blog_from_keywords: 20 }),
  },
  {
    id: "guides",
    fr: "Guides piliers",
    desc: "Contenus de fond, forte autorité",
    emoji: "📘",
    weights: focusedWeights({ guide_pilier: 100 }),
  },
  {
    id: "qr_faq",
    fr: "Q-R / FAQ",
    desc: "Questions-réponses & FAQ géo",
    emoji: "❓",
    weights: focusedWeights({ qa_derived: 40, faq_standalone: 30, faq_geo: 30 }),
  },
  {
    id: "equilibre",
    fr: "Mix équilibré",
    desc: "Répartition recommandée des 21 types",
    emoji: "⚖️",
    weights: { ...DEFAULT_WEIGHTS_BALANCED },
  },
];

// M7 — Estimation coût & durée (affichage indicatif côté wizard).
// Hypothèses internes : ~0,03 $ / contenu (Sonnet + juges + embeddings),
// ~1,5 min de génération effective / contenu réparti sur les workers.
const EST_COST_PER_ARTICLE_USD = 0.03;
const EST_MINUTES_PER_ARTICLE = 1.5;

function estimateTotals(dailyArticles: number): {
  totalArticles: number;
  costUsd: number;
  durationDays: number;
} {
  const totalArticles = Math.max(0, Math.round(dailyArticles * 30));
  const costUsd = totalArticles * EST_COST_PER_ARTICLE_USD;
  // Durée = nb de jours pour écouler le volume au rythme dailyArticles/jour.
  const durationDays = dailyArticles > 0 ? Math.ceil(totalArticles / dailyArticles) : 0;
  return { totalArticles, costUsd, durationDays };
}

function formatCost(usd: number): string {
  if (usd >= 100) return `~${Math.round(usd)} $`;
  return `~${usd.toFixed(1)} $`;
}

function formatDuration(days: number): string {
  if (days <= 1) return "~1 jour";
  if (days < 31) return `~${days} jours`;
  const months = Math.round(days / 30);
  return months <= 1 ? "~1 mois" : `~${months} mois`;
}

// ─── Composant principal ────────────────────────────────────────────────────

export function CampaignWizardV2({
  adminPrefix,
  presetSeed,
  presetName,
  villeSlug,
}: Props): React.ReactElement {
  const router = useRouter();
  const base = `/fr/${adminPrefix}/content-gen`;

  // B6 — état initial dérivé du preset / de la ville (?preset / ?ville).
  const [state, setState] = useState<WizardState>(() => {
    const presetWeights = presetSeed?.contentTypeWeights;
    const seededWeights: Record<WizardContentType, number> = presetWeights
      ? focusedWeights(presetWeights)
      : { ...DEFAULT_WEIGHTS_BALANCED };
    const hasVille = typeof villeSlug === "string" && villeSlug.length > 0;
    return {
      step: 1,
      serviceSector: presetSeed?.serviceSector ?? null,
      name: presetName ? `Campagne ${presetName}` : "",
      dailyArticles: presetSeed?.dailyArticles ?? 200,
      targetPerCity: presetSeed?.targetPerCity ?? 50,
      villeScopeMode: hasVille ? "custom_subset" : "global_queue",
      customVilleSlugs: hasVille ? [villeSlug] : [],
      customVilleInput: hasVille ? villeSlug : "",
      startDate: "",
      endDate: "",
      mixMode: "percentage",
      contentTypeWeights: seededWeights,
      serviceSectorWeights: {},
      targetSecteurWeights: {},
      searchIntentMix: {},
      audienceSizeWeights: {},
      audienceOrg: "entreprise_privee",
      villeSurroundingMode: "none",
      villeSurroundingRadiusKm: 50,
      durationMode: "fixed",
      submitting: false,
    };
  });

  // Détail fin du mix (mode avancé étape 1) + targetPerCity avancé (M5).
  const [showMixDetail, setShowMixDetail] = useState(false);
  const [showAdvancedScope, setShowAdvancedScope] = useState(false);
  // Ciblage avancé multi-axes (étape 2) : activité / secteur client / audience.
  const [showMultiAxes, setShowMultiAxes] = useState(false);

  function update<K extends keyof WizardState>(key: K, value: WizardState[K]): void {
    setState((s) => ({ ...s, [key]: value }));
  }

  const weightsSum = Object.values(state.contentTypeWeights).reduce((a, b) => a + b, 0);
  const hasContentType = weightsSum > 0;
  const mixValid = state.mixMode === "manual" || Math.abs(weightsSum - 100) <= 1;
  const canGoStep2 = hasContentType && mixValid;
  const canGoStep3 = !!state.serviceSector;
  const canGoStep4 = state.name.trim().length >= 2 && state.dailyArticles >= 1;

  const est = estimateTotals(state.dailyArticles);

  /** Carte « quoi » active si ses poids correspondent exactement à l'état. */
  function isQuickTypeActive(qt: QuickType): boolean {
    return (Object.keys(qt.weights) as WizardContentType[]).every(
      (k) => (state.contentTypeWeights[k] ?? 0) === qt.weights[k],
    );
  }

  async function handleSubmit(action: "draft" | "launch"): Promise<void> {
    if (!state.serviceSector) {
      toast.error("Choisissez une verticale (étape 2)");
      return;
    }
    update("submitting", true);
    try {
      // Axe 5 — recompose audienceMix « SIZE:ORG » depuis les poids par taille.
      const audienceMix: Record<string, number> = {};
      for (const [size, w] of Object.entries(state.audienceSizeWeights)) {
        if (w > 0) audienceMix[`${size}:${state.audienceOrg}`] = w;
      }
      const hasWeights = (r: Record<string, number>): boolean =>
        Object.values(r).some((v) => v > 0);
      const result = await createCampaignFromWizard({
        serviceSector: state.serviceSector,
        name: state.name.trim(),
        dailyArticles: state.dailyArticles,
        targetPerCity: state.targetPerCity,
        villeScopeMode: state.villeScopeMode,
        customVilleSlugs: state.customVilleSlugs,
        ...(state.startDate ? { startDate: new Date(state.startDate).toISOString() } : {}),
        ...(state.endDate ? { endDate: new Date(state.endDate).toISOString() } : {}),
        mixMode: state.mixMode,
        contentTypeWeights: state.contentTypeWeights,
        // ── Axes multi-axes : envoyés uniquement si renseignés ──
        ...(hasWeights(state.serviceSectorWeights)
          ? { serviceSectorWeights: state.serviceSectorWeights }
          : {}),
        ...(hasWeights(state.targetSecteurWeights)
          ? { targetSecteurWeights: state.targetSecteurWeights }
          : {}),
        ...(hasWeights(state.searchIntentMix) ? { searchIntentMix: state.searchIntentMix } : {}),
        ...(hasWeights(audienceMix) ? { audienceMix } : {}),
        villeSurroundingMode: state.villeSurroundingMode,
        ...(state.villeSurroundingMode === "radius"
          ? { villeSurroundingRadiusKm: state.villeSurroundingRadiusKm }
          : {}),
        durationMode: state.durationMode,
        action,
      });
      toast.success(action === "launch" ? "Campagne lancée" : "Brouillon enregistré");
      // M8 — redirection vers le détail de la campagne créée.
      router.push(`${base}/coverage/${result.campaignId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur création campagne";
      toast.error(`Échec : ${msg}`);
      update("submitting", false);
    }
  }

  const STEP_LABELS = ["Quoi", "Pour qui / où", "Combien / rythme", "Vérifier & lancer"];

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Nouvelle campagne"
        description={`Point d'entrée unique de génération — étape ${state.step} sur 4.`}
      />

      {presetName ? (
        <div className="mb-[var(--space-admin-4,8px)]">
          <AdminBadge tone="info">Pré-rempli depuis le modèle « {presetName} »</AdminBadge>
        </div>
      ) : null}

      {/* Stepper visuel */}
      <div className="mb-[var(--space-admin-6,16px)] flex items-center gap-[var(--space-admin-3,6px)]">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="flex flex-1 items-center gap-[var(--space-admin-2,4px)]">
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full border text-[length:var(--text-admin-xs)] font-semibold",
                state.step === n
                  ? "border-[color:var(--color-admin-accent)] bg-[color:var(--color-admin-accent)] text-white"
                  : state.step > n
                    ? "border-[color:var(--color-admin-success)] bg-[color:var(--color-admin-success-soft)] text-[color:var(--color-admin-success-fg)]"
                    : "border-[color:var(--color-admin-border)] text-[color:var(--color-admin-fg-soft)]",
              )}
              aria-current={state.step === n ? "step" : undefined}
            >
              {state.step > n ? "✓" : n}
            </span>
            <span className="hidden text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)] sm:inline">
              {STEP_LABELS[n - 1]}
            </span>
            {n < 4 ? (
              <span className="hidden h-px flex-1 bg-[color:var(--color-admin-border)] sm:inline" />
            ) : null}
          </div>
        ))}
      </div>

      {/* ── Étape 1 — Quoi générer ? ─────────────────────────────────────── */}
      {state.step === 1 ? (
        <AdminCard>
          <h2 className="mb-[var(--space-admin-5,12px)] text-[length:var(--text-admin-lg)] font-semibold">
            Étape 1 — Quoi générer ?
          </h2>
          <p className="mb-[var(--space-admin-4,8px)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]">
            Choisissez un type de contenu. Vous pourrez affiner la répartition fine plus bas.
          </p>

          <div
            className="grid grid-cols-1 gap-[var(--space-admin-3,6px)] sm:grid-cols-2 lg:grid-cols-3"
            role="radiogroup"
            aria-label="Type de contenu"
          >
            {QUICK_TYPES.map((qt) => {
              const active = isQuickTypeActive(qt);
              return (
                <button
                  key={qt.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => update("contentTypeWeights", { ...qt.weights })}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded border p-4 text-left transition",
                    active
                      ? "border-[color:var(--color-admin-accent)] bg-[color:var(--color-admin-surface-2)] ring-2 ring-[color:var(--color-admin-accent)]"
                      : "border-[color:var(--color-admin-border)] hover:bg-[color:var(--color-admin-surface-2)]",
                  )}
                >
                  <span className="text-[length:var(--text-admin-lg)]">{qt.emoji}</span>
                  <span className="font-semibold text-[color:var(--color-admin-fg)]">{qt.fr}</span>
                  <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]">
                    {qt.desc}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Raccourci presets */}
          <div className="mt-[var(--space-admin-5,12px)] flex flex-wrap items-center gap-[var(--space-admin-3,6px)] border-t border-[color:var(--color-admin-border)] pt-[var(--space-admin-4,8px)]">
            <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]">
              … ou partir d&apos;un modèle prêt à l&apos;emploi :
            </span>
            <button
              type="button"
              onClick={() => router.push(`${base}/coverage/presets`)}
              className="rounded border border-[color:var(--color-admin-border)] px-3 py-1.5 text-[length:var(--text-admin-sm)] hover:bg-[color:var(--color-admin-surface-2)]"
            >
              ✨ Voir les modèles prêts à l&apos;emploi
            </button>
            <button
              type="button"
              onClick={() => router.push(`${base}/orchestrator/adhoc`)}
              className="rounded border border-[color:var(--color-admin-border)] px-3 py-1.5 text-[length:var(--text-admin-sm)] hover:bg-[color:var(--color-admin-surface-2)]"
            >
              ⚡ Générer une seule page maintenant
            </button>
          </div>

          {/* Détail fin du mix (avancé) */}
          <div className="mt-[var(--space-admin-5,12px)] border-t border-[color:var(--color-admin-border)] pt-[var(--space-admin-4,8px)]">
            <button
              type="button"
              onClick={() => setShowMixDetail((v) => !v)}
              className="flex items-center gap-2 text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg-soft)] hover:text-[color:var(--color-admin-fg)]"
              aria-expanded={showMixDetail}
            >
              <span>{showMixDetail ? "▾" : "▸"}</span>
              Personnaliser la répartition fine des types (avancé)
            </button>

            {showMixDetail ? (
              <div className="mt-[var(--space-admin-4,8px)]">
                <div className="mb-[var(--space-admin-4,8px)] flex items-center gap-2">
                  <span className="text-[length:var(--text-admin-sm)]">Mode :</span>
                  <label className="flex items-center gap-1">
                    <input
                      type="radio"
                      name="mixMode"
                      checked={state.mixMode === "percentage"}
                      onChange={() => update("mixMode", "percentage")}
                    />
                    % Répartition
                  </label>
                  <label className="flex items-center gap-1">
                    <input
                      type="radio"
                      name="mixMode"
                      checked={state.mixMode === "manual"}
                      onChange={() => update("mixMode", "manual")}
                    />
                    Quotas manuels
                  </label>
                  <button
                    type="button"
                    onClick={() => update("contentTypeWeights", { ...DEFAULT_WEIGHTS_BALANCED })}
                    className="ml-auto rounded border border-[color:var(--color-admin-border)] px-2 py-1 text-[length:var(--text-admin-xs)] hover:bg-[color:var(--color-admin-surface-2)]"
                  >
                    Mix équilibré
                  </button>
                </div>
                <div className="space-y-[var(--space-admin-5,12px)]">
                  {WIZARD_SECTIONS.map((section) => (
                    <div key={section.id}>
                      <h3 className="mb-[var(--space-admin-2,4px)] text-[length:var(--text-admin-sm)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
                        {section.label} ({section.types.length})
                      </h3>
                      <div className="space-y-[var(--space-admin-3,6px)]">
                        {section.types.map((ct) => (
                          <div
                            key={ct}
                            className="grid grid-cols-12 items-center gap-2 border-b border-[color:var(--color-admin-border)] py-2"
                          >
                            <span className="col-span-4 flex flex-col">
                              <span className="text-[length:var(--text-admin-sm)] font-medium">
                                {WIZARD_CONTENT_TYPE_LABELS[ct as WizardContentType] ?? ct}
                              </span>
                              <span className="font-mono text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-soft)]">
                                {ct}
                              </span>
                            </span>
                            <input
                              type="range"
                              min={0}
                              max={state.mixMode === "percentage" ? 100 : 500}
                              value={state.contentTypeWeights[ct as WizardContentType] ?? 0}
                              onChange={(e) =>
                                update("contentTypeWeights", {
                                  ...state.contentTypeWeights,
                                  [ct]: parseInt(e.target.value, 10) || 0,
                                })
                              }
                              className="col-span-6"
                              aria-label={`Slider ${ct}`}
                            />
                            <span className="col-span-2 text-right text-[length:var(--text-admin-sm)] font-semibold">
                              {state.contentTypeWeights[ct as WizardContentType] ?? 0}
                              {state.mixMode === "percentage" ? "%" : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-[var(--space-admin-4,8px)] flex items-center gap-2">
                  <span className="text-[length:var(--text-admin-sm)]">
                    Somme :{" "}
                    <strong
                      className={cn(
                        mixValid
                          ? "text-[color:var(--color-admin-success-fg)]"
                          : "text-[color:var(--color-admin-destructive-fg)]",
                      )}
                    >
                      {weightsSum}
                      {state.mixMode === "percentage" ? "%" : ""}
                    </strong>
                  </span>
                  {state.mixMode === "percentage" && !mixValid ? (
                    <AdminBadge tone="destructive">Somme doit = 100</AdminBadge>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </AdminCard>
      ) : null}

      {/* ── Étape 2 — Pour qui / où ? ────────────────────────────────────── */}
      {state.step === 2 ? (
        <AdminCard>
          <h2 className="mb-[var(--space-admin-5,12px)] text-[length:var(--text-admin-lg)] font-semibold">
            Étape 2 — Pour qui / où ?
          </h2>

          <h3 className="mb-[var(--space-admin-2,4px)] text-[length:var(--text-admin-sm)] font-semibold">
            Verticale Axion-IA *
          </h3>
          <div
            className="mb-[var(--space-admin-5,12px)] grid grid-cols-1 gap-[var(--space-admin-3,6px)] sm:grid-cols-2 lg:grid-cols-3"
            role="radiogroup"
            aria-label="Verticale Axion-IA"
          >
            {(
              Object.entries(SERVICE_LABELS) as Array<[ServiceSector, { fr: string; desc: string }]>
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={state.serviceSector === key}
                onClick={() => update("serviceSector", key)}
                className={cn(
                  "flex flex-col items-start gap-1 rounded border p-4 text-left transition",
                  state.serviceSector === key
                    ? "border-[color:var(--color-admin-accent)] bg-[color:var(--color-admin-surface-2)] ring-2 ring-[color:var(--color-admin-accent)]"
                    : "border-[color:var(--color-admin-border)] hover:bg-[color:var(--color-admin-surface-2)]",
                )}
              >
                <span className="font-semibold text-[color:var(--color-admin-fg)]">{label.fr}</span>
                <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]">
                  {label.desc}
                </span>
              </button>
            ))}
          </div>

          <fieldset>
            <legend className="mb-[var(--space-admin-2,4px)] text-[length:var(--text-admin-sm)] font-semibold">
              Villes ciblées
            </legend>
            <div className="flex flex-col gap-1">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="villeScopeMode"
                  checked={state.villeScopeMode === "global_queue"}
                  onChange={() => update("villeScopeMode", "global_queue")}
                />
                Toutes les villes (file globale, ordre « Ordre de génération »)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="villeScopeMode"
                  checked={state.villeScopeMode === "custom_subset"}
                  onChange={() => update("villeScopeMode", "custom_subset")}
                />
                Sélection de villes (saisir les identifiants séparés par une virgule)
              </label>
              {state.villeScopeMode === "custom_subset" ? (
                <>
                  <textarea
                    rows={3}
                    value={state.customVilleInput}
                    onChange={(e) => {
                      const input = e.target.value;
                      update("customVilleInput", input);
                      const slugs = input
                        .split(/[,\n]/)
                        .map((s) => s.trim())
                        .filter((s) => s.length > 0);
                      update("customVilleSlugs", slugs);
                    }}
                    placeholder="paris, lyon, marseille, ..."
                    className="admin-input mt-2"
                    aria-label="Identifiants villes sélectionnées"
                  />
                  <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-soft)]">
                    {state.customVilleSlugs.length} ville(s) sélectionnée(s)
                  </span>
                </>
              ) : null}
            </div>

            {/* Axe 6 — ville & alentours (étend les villes choisies) */}
            <div className="mt-[var(--space-admin-4,8px)]">
              <span className="mb-[var(--space-admin-2,4px)] block text-[length:var(--text-admin-sm)] font-semibold">
                Ville &amp; alentours
              </span>
              <div className="flex flex-col gap-1">
                {WIZARD_SURROUNDING_MODES.map((m) => (
                  <label key={m.value} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="villeSurroundingMode"
                      checked={state.villeSurroundingMode === m.value}
                      onChange={() => update("villeSurroundingMode", m.value)}
                    />
                    {m.labelFr}
                  </label>
                ))}
                {state.villeSurroundingMode === "radius" ? (
                  <label className="mt-1 flex max-w-xs items-center gap-2">
                    <span className="text-[length:var(--text-admin-sm)]">Rayon (km)</span>
                    <input
                      type="number"
                      min={5}
                      max={200}
                      value={state.villeSurroundingRadiusKm}
                      onChange={(e) =>
                        update("villeSurroundingRadiusKm", parseInt(e.target.value, 10) || 50)
                      }
                      className="admin-input admin-input-w-sm"
                      aria-label="Rayon en km"
                    />
                  </label>
                ) : null}
                <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-soft)]">
                  Étend les villes <strong>choisies</strong> aux communes proches (la file globale
                  n&apos;est pas étendue).
                </span>
              </div>
            </div>
          </fieldset>

          {/* Ciblage avancé multi-axes : % activité (axe 2), % secteur client
                (axe 3), % audience (axe 5). Vides = réglages par défaut. */}
          <div className="mt-[var(--space-admin-5,12px)] border-t border-[color:var(--color-admin-border)] pt-[var(--space-admin-4,8px)]">
            <button
              type="button"
              onClick={() => setShowMultiAxes((v) => !v)}
              className="flex items-center gap-2 text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg-soft)] hover:text-[color:var(--color-admin-fg)]"
              aria-expanded={showMultiAxes}
            >
              <span>{showMultiAxes ? "▾" : "▸"}</span>
              Ciblage avancé (multi-axes) — activité, secteur client, audience
            </button>
            {showMultiAxes ? (
              <div className="mt-[var(--space-admin-4,8px)] grid grid-cols-1 gap-[var(--space-admin-5,12px)] lg:grid-cols-3">
                <div>
                  <h4 className="mb-[var(--space-admin-2,4px)] text-[length:var(--text-admin-sm)] font-semibold">
                    % par activité Axion-IA
                  </h4>
                  <WeightEditor
                    ariaLabel="Pondération par activité"
                    options={WIZARD_SERVICE_SECTORS}
                    value={state.serviceSectorWeights}
                    onChange={(next) => update("serviceSectorWeights", next)}
                    inactiveHint="Inactif → l'activité unique choisie ci-dessus est utilisée."
                  />
                </div>
                <div>
                  <h4 className="mb-[var(--space-admin-2,4px)] text-[length:var(--text-admin-sm)] font-semibold">
                    % par secteur client
                  </h4>
                  <WeightEditor
                    ariaLabel="Pondération par secteur client"
                    options={CLIENT_SECTORS.map((s) => ({ value: s.slug, labelFr: s.labelFr }))}
                    value={state.targetSecteurWeights}
                    onChange={(next) => update("targetSecteurWeights", next)}
                    inactiveHint="Inactif → contenu non ciblé par secteur (pain-matrix dormante)."
                  />
                </div>
                <div>
                  <h4 className="mb-[var(--space-admin-2,4px)] text-[length:var(--text-admin-sm)] font-semibold">
                    % par audience
                  </h4>
                  <label className="mb-[var(--space-admin-2,4px)] flex flex-col gap-1">
                    <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-soft)]">
                      Type d&apos;organisation
                    </span>
                    <select
                      value={state.audienceOrg}
                      onChange={(e) => update("audienceOrg", e.target.value)}
                      className="admin-input"
                      aria-label="Type d'organisation"
                    >
                      {WIZARD_ORG_TYPES.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.labelFr}
                        </option>
                      ))}
                    </select>
                  </label>
                  <WeightEditor
                    ariaLabel="Pondération par taille d'entreprise"
                    options={WIZARD_COMPANY_SIZES}
                    value={state.audienceSizeWeights}
                    onChange={(next) => update("audienceSizeWeights", next)}
                    inactiveHint="Inactif → audience par défaut."
                  />
                </div>
              </div>
            ) : null}
          </div>
        </AdminCard>
      ) : null}

      {/* ── Étape 3 — Combien / à quel rythme ? ──────────────────────────── */}
      {state.step === 3 ? (
        <AdminCard>
          <h2 className="mb-[var(--space-admin-5,12px)] text-[length:var(--text-admin-lg)] font-semibold">
            Étape 3 — Combien / à quel rythme ?
          </h2>
          <div className="grid grid-cols-1 gap-[var(--space-admin-4,8px)] sm:grid-cols-2">
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-[length:var(--text-admin-sm)] font-medium">
                Nom de la campagne *
              </span>
              <input
                type="text"
                value={state.name}
                onChange={(e) => update("name", e.target.value)}
                className="admin-input"
                placeholder="ex: Campagne Audits Q3 2026"
                aria-label="Nom de la campagne"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[length:var(--text-admin-sm)] font-medium">
                Contenus par jour * (1 à 1000)
              </span>
              <input
                type="number"
                min={1}
                max={1000}
                value={state.dailyArticles}
                onChange={(e) => update("dailyArticles", parseInt(e.target.value, 10) || 1)}
                className="admin-input"
                aria-label="Contenus par jour"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[length:var(--text-admin-sm)] font-medium">
                Date de début (optionnel)
              </span>
              <input
                type="date"
                value={state.startDate}
                onChange={(e) => update("startDate", e.target.value)}
                className="admin-input"
                aria-label="Date de début"
              />
            </label>
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-[length:var(--text-admin-sm)] font-medium">
                Date de fin (optionnel)
              </span>
              <input
                type="date"
                value={state.endDate}
                onChange={(e) => update("endDate", e.target.value)}
                className="admin-input"
                aria-label="Date de fin"
              />
            </label>
          </div>

          {/* Axe 8 — mode de durée */}
          <fieldset className="mt-[var(--space-admin-4,8px)]">
            <legend className="mb-[var(--space-admin-2,4px)] text-[length:var(--text-admin-sm)] font-semibold">
              Durée de la campagne
            </legend>
            <div className="flex flex-col gap-1">
              {WIZARD_DURATION_MODES.map((d) => (
                <label key={d.value} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="durationMode"
                    checked={state.durationMode === d.value}
                    onChange={() => update("durationMode", d.value)}
                  />
                  {d.labelFr}
                </label>
              ))}
              {state.durationMode === "unlimited" ? (
                <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-soft)]">
                  La campagne tourne en continu au rythme indiqué jusqu&apos;à un arrêt manuel (ou
                  la date de fin si renseignée).
                </span>
              ) : null}
            </div>
          </fieldset>

          {/* M5 — targetPerCity replié dans un bloc avancé */}
          <div className="mt-[var(--space-admin-4,8px)] border-t border-[color:var(--color-admin-border)] pt-[var(--space-admin-4,8px)]">
            <button
              type="button"
              onClick={() => setShowAdvancedScope((v) => !v)}
              className="flex items-center gap-2 text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg-soft)] hover:text-[color:var(--color-admin-fg)]"
              aria-expanded={showAdvancedScope}
            >
              <span>{showAdvancedScope ? "▾" : "▸"}</span>
              Options avancées
            </button>
            {showAdvancedScope ? (
              <label className="mt-[var(--space-admin-3,6px)] flex max-w-sm flex-col gap-1">
                <span className="text-[length:var(--text-admin-sm)] font-medium">
                  Cible de contenus par ville (1 à 200)
                </span>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={state.targetPerCity}
                  onChange={(e) => update("targetPerCity", parseInt(e.target.value, 10) || 1)}
                  className="admin-input"
                  aria-label="Cible de contenus par ville"
                />
                <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-soft)]">
                  Plafond de contenus générés par ville. Laissez la valeur par défaut si vous
                  n&apos;avez pas de besoin spécifique.
                </span>
              </label>
            ) : null}
            {/* Axe 4 — % intention de recherche (sinon réglage global console) */}
            {showAdvancedScope ? (
              <div className="mt-[var(--space-admin-4,8px)] max-w-sm">
                <h4 className="mb-[var(--space-admin-2,4px)] text-[length:var(--text-admin-sm)] font-semibold">
                  % par intention de recherche
                </h4>
                <WeightEditor
                  ariaLabel="Pondération par intention de recherche"
                  options={WIZARD_SEARCH_INTENTS}
                  value={state.searchIntentMix}
                  onChange={(next) => update("searchIntentMix", next)}
                  inactiveHint="Inactif → distribution globale par défaut (réglages console)."
                />
              </div>
            ) : null}
          </div>

          {/* M7 — Estimation en direct */}
          <div className="mt-[var(--space-admin-5,12px)] rounded border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface-2)] p-4">
            <h3 className="mb-[var(--space-admin-2,4px)] text-[length:var(--text-admin-sm)] font-semibold">
              Estimation en direct
            </h3>
            <dl className="grid grid-cols-1 gap-[var(--space-admin-2,4px)] text-[length:var(--text-admin-sm)] sm:grid-cols-3">
              <div>
                <dt className="text-[color:var(--color-admin-fg-soft)]">Contenus / mois</dt>
                <dd className="font-semibold">{est.totalArticles.toLocaleString("fr-FR")}</dd>
              </div>
              <div>
                <dt className="text-[color:var(--color-admin-fg-soft)]">Coût estimé</dt>
                <dd className="font-semibold">{formatCost(est.costUsd)}</dd>
              </div>
              <div>
                <dt className="text-[color:var(--color-admin-fg-soft)]">Durée estimée</dt>
                <dd className="font-semibold">{formatDuration(est.durationDays)}</dd>
              </div>
            </dl>
            <p className="mt-[var(--space-admin-2,4px)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-soft)]">
              Estimation indicative ({formatCost(EST_COST_PER_ARTICLE_USD)} et ~
              {EST_MINUTES_PER_ARTICLE} min par contenu). Le coût réel dépend des fournisseurs IA
              configurés.
            </p>
          </div>
        </AdminCard>
      ) : null}

      {/* ── Étape 4 — Vérifier & lancer ──────────────────────────────────── */}
      {state.step === 4 ? (
        <AdminCard>
          <h2 className="mb-[var(--space-admin-5,12px)] text-[length:var(--text-admin-lg)] font-semibold">
            Étape 4 — Vérifier & lancer
          </h2>
          <dl className="grid grid-cols-1 gap-[var(--space-admin-2,4px)] text-[length:var(--text-admin-sm)] sm:grid-cols-2">
            <div>
              <dt className="font-medium text-[color:var(--color-admin-fg-soft)]">Verticale</dt>
              <dd className="font-semibold">
                {state.serviceSector ? SERVICE_LABELS[state.serviceSector].fr : "—"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-[color:var(--color-admin-fg-soft)]">Nom</dt>
              <dd className="font-semibold">{state.name || "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-[color:var(--color-admin-fg-soft)]">
                Villes ciblées
              </dt>
              <dd className="font-semibold">
                {state.villeScopeMode === "global_queue"
                  ? "Toutes les villes"
                  : `Sélection (${state.customVilleSlugs.length})`}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-[color:var(--color-admin-fg-soft)]">Volume</dt>
              <dd className="font-semibold">
                {state.dailyArticles}/jour · ~{est.totalArticles.toLocaleString("fr-FR")} contenus
              </dd>
            </div>
            <div>
              <dt className="font-medium text-[color:var(--color-admin-fg-soft)]">Coût estimé</dt>
              <dd className="font-semibold">{formatCost(est.costUsd)}</dd>
            </div>
            <div>
              <dt className="font-medium text-[color:var(--color-admin-fg-soft)]">Durée estimée</dt>
              <dd className="font-semibold">
                {state.durationMode === "unlimited"
                  ? "Sans limite (arrêt manuel)"
                  : formatDuration(est.durationDays)}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-[color:var(--color-admin-fg-soft)]">Activités</dt>
              <dd className="font-semibold">
                {Object.keys(state.serviceSectorWeights).length > 0
                  ? `Mix de ${Object.keys(state.serviceSectorWeights).length} activités`
                  : state.serviceSector
                    ? SERVICE_LABELS[state.serviceSector].fr
                    : "—"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-[color:var(--color-admin-fg-soft)]">
                Secteurs clients
              </dt>
              <dd className="font-semibold">
                {Object.keys(state.targetSecteurWeights).length > 0
                  ? `${Object.keys(state.targetSecteurWeights).length} ciblé(s)`
                  : "Non ciblé"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-[color:var(--color-admin-fg-soft)]">
                Ville &amp; alentours
              </dt>
              <dd className="font-semibold">
                {state.villeSurroundingMode === "radius"
                  ? `Rayon ${state.villeSurroundingRadiusKm} km`
                  : state.villeSurroundingMode === "same_departement"
                    ? "Tout le département"
                    : "Villes choisies"}
              </dd>
            </div>
          </dl>
          <div className="mt-[var(--space-admin-5,12px)] flex flex-wrap gap-[var(--space-admin-3,6px)]">
            <button
              type="button"
              onClick={() => handleSubmit("draft")}
              disabled={state.submitting}
              className="admin-button"
            >
              {state.submitting ? "Enregistrement…" : "Enregistrer en brouillon"}
            </button>
            <button
              type="button"
              onClick={() => handleSubmit("launch")}
              disabled={state.submitting}
              className="admin-button-cta"
            >
              {state.submitting ? "Lancement…" : "🚀 Lancer la campagne"}
            </button>
          </div>
        </AdminCard>
      ) : null}

      {/* Navigation steps */}
      <div className="mt-[var(--space-admin-5,12px)] flex justify-between">
        <button
          type="button"
          onClick={() => update("step", Math.max(1, state.step - 1) as 1 | 2 | 3 | 4)}
          disabled={state.step === 1}
          className="admin-button"
        >
          ← Précédent
        </button>
        {state.step < 4 ? (
          <button
            type="button"
            onClick={() => {
              if (state.step === 1 && !canGoStep2) {
                toast.error(
                  state.mixMode === "percentage" && !mixValid
                    ? `Répartition fine : la somme doit = 100 (actuel : ${weightsSum})`
                    : "Choisissez un type de contenu",
                );
                return;
              }
              if (state.step === 2 && !canGoStep3) {
                toast.error("Choisissez une verticale");
                return;
              }
              if (state.step === 3 && !canGoStep4) {
                toast.error("Nom + contenus/jour requis");
                return;
              }
              update("step", (state.step + 1) as 1 | 2 | 3 | 4);
            }}
            className="admin-button-cta"
          >
            Suivant →
          </button>
        ) : null}
      </div>
    </AdminPageShell>
  );
}
