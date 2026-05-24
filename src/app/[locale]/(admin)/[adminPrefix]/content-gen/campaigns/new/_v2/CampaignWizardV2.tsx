// Sprint v7 Phase 3 commit 1 — Wizard 4 steps /content-gen/campaigns/new.
//
// State machine simple via useState(currentStep). FormData accumulé entre
// steps puis submit Step 4 → createCampaignFromWizard server action.
//
// 9 sliders ContentType actuels (les 19 Phase 8 viendront ensuite).

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
  WIZARD_CONTENT_TYPES,
  WIZARD_SECTIONS,
  type WizardContentType,
} from "@/server/actions/content-gen/campaign-wizard-constants";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Props {
  readonly adminPrefix: string;
}

type ServiceSector =
  | "interventions_formations"
  | "audits"
  | "implementations"
  | "un_a_un"
  | "sites_web_augmentes";

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
  // Section 1 — Core (3) = 30%
  landing_ville: 10,
  blog_article: 12,
  guide_pilier: 8,
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

// ─── Composant principal ────────────────────────────────────────────────────

export function CampaignWizardV2({ adminPrefix }: Props): React.ReactElement {
  const router = useRouter();
  const [state, setState] = useState<WizardState>({
    step: 1,
    serviceSector: null,
    name: "",
    dailyArticles: 200,
    targetPerCity: 50,
    villeScopeMode: "global_queue",
    customVilleSlugs: [],
    customVilleInput: "",
    startDate: "",
    endDate: "",
    mixMode: "percentage",
    contentTypeWeights: { ...DEFAULT_WEIGHTS_BALANCED },
    submitting: false,
  });

  function update<K extends keyof WizardState>(key: K, value: WizardState[K]): void {
    setState((s) => ({ ...s, [key]: value }));
  }

  const canGoStep2 = !!state.serviceSector;
  const canGoStep3 = state.name.trim().length >= 2 && state.dailyArticles >= 1;
  const weightsSum = Object.values(state.contentTypeWeights).reduce((a, b) => a + b, 0);
  const canGoStep4 = state.mixMode === "manual" || Math.abs(weightsSum - 100) <= 1;

  async function handleSubmit(action: "draft" | "launch"): Promise<void> {
    if (!state.serviceSector) {
      toast.error("Verticale manquante (step 1)");
      return;
    }
    update("submitting", true);
    try {
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
        action,
      });
      toast.success(action === "launch" ? "Campagne lancée" : "Brouillon enregistré");
      router.push(`/fr/${adminPrefix}/content-gen/coverage/${result.campaignId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur création campagne";
      toast.error(`Échec : ${msg}`);
      update("submitting", false);
    }
  }

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Nouvelle campagne"
        description={`Étape ${state.step} sur 4 — wizard 21 sliders × 6 sections (9 V1 + 12 Phase 8).`}
      />

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
              {n === 1
                ? "Verticale"
                : n === 2
                  ? "Volume & scope"
                  : n === 3
                    ? "Mix contenu"
                    : "Récap"}
            </span>
            {n < 4 ? (
              <span className="hidden h-px flex-1 bg-[color:var(--color-admin-border)] sm:inline" />
            ) : null}
          </div>
        ))}
      </div>

      {/* Step 1 — Verticale */}
      {state.step === 1 ? (
        <AdminCard>
          <h2 className="mb-[var(--space-admin-5,12px)] text-[length:var(--text-admin-lg)] font-semibold">
            Étape 1 — Choisir une verticale Axion-IA
          </h2>
          <div
            className="grid grid-cols-1 gap-[var(--space-admin-3,6px)] sm:grid-cols-2 lg:grid-cols-3"
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
        </AdminCard>
      ) : null}

      {/* Step 2 — Volume & scope */}
      {state.step === 2 ? (
        <AdminCard>
          <h2 className="mb-[var(--space-admin-5,12px)] text-[length:var(--text-admin-lg)] font-semibold">
            Étape 2 — Nom, volume, scope villes, période
          </h2>
          <div className="grid grid-cols-1 gap-[var(--space-admin-4,8px)] sm:grid-cols-2">
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-[length:var(--text-admin-sm)] font-medium">Nom *</span>
              <input
                type="text"
                value={state.name}
                onChange={(e) => update("name", e.target.value)}
                className="admin-input rounded border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface-1)] px-3 py-2"
                placeholder="ex: Campagne Audits Q3 2026"
                aria-label="Nom de la campagne"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[length:var(--text-admin-sm)] font-medium">
                Articles/jour * (1..1000)
              </span>
              <input
                type="number"
                min={1}
                max={1000}
                value={state.dailyArticles}
                onChange={(e) => update("dailyArticles", parseInt(e.target.value, 10) || 1)}
                className="admin-input rounded border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface-1)] px-3 py-2"
                aria-label="Articles par jour"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[length:var(--text-admin-sm)] font-medium">
                Cible articles/ville * (1..200)
              </span>
              <input
                type="number"
                min={1}
                max={200}
                value={state.targetPerCity}
                onChange={(e) => update("targetPerCity", parseInt(e.target.value, 10) || 1)}
                className="admin-input rounded border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface-1)] px-3 py-2"
                aria-label="Cible par ville"
              />
            </label>
            <fieldset className="sm:col-span-2">
              <legend className="mb-1 text-[length:var(--text-admin-sm)] font-medium">
                Scope villes
              </legend>
              <div className="flex flex-col gap-1">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="villeScopeMode"
                    checked={state.villeScopeMode === "global_queue"}
                    onChange={() => update("villeScopeMode", "global_queue")}
                  />
                  File globale (2150 villes ordre `/cities-order`)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="villeScopeMode"
                    checked={state.villeScopeMode === "custom_subset"}
                    onChange={() => update("villeScopeMode", "custom_subset")}
                  />
                  Sous-ensemble personnalisé (saisir slugs séparés par virgule)
                </label>
                {state.villeScopeMode === "custom_subset" ? (
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
                    className="admin-input mt-2 rounded border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface-1)] px-3 py-2"
                    aria-label="Slugs villes personnalisés"
                  />
                ) : null}
                {state.villeScopeMode === "custom_subset" ? (
                  <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-soft)]">
                    {state.customVilleSlugs.length} ville(s) sélectionnée(s)
                  </span>
                ) : null}
              </div>
            </fieldset>
            <label className="flex flex-col gap-1">
              <span className="text-[length:var(--text-admin-sm)] font-medium">
                Date début (optionnel)
              </span>
              <input
                type="date"
                value={state.startDate}
                onChange={(e) => update("startDate", e.target.value)}
                className="admin-input rounded border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface-1)] px-3 py-2"
                aria-label="Date début"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[length:var(--text-admin-sm)] font-medium">
                Date fin (optionnel)
              </span>
              <input
                type="date"
                value={state.endDate}
                onChange={(e) => update("endDate", e.target.value)}
                className="admin-input rounded border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface-1)] px-3 py-2"
                aria-label="Date fin"
              />
            </label>
          </div>
        </AdminCard>
      ) : null}

      {/* Step 3 — Mix contenu (21 sliders groupés en 6 sections — Phase 8) */}
      {state.step === 3 ? (
        <AdminCard>
          <h2 className="mb-[var(--space-admin-5,12px)] text-[length:var(--text-admin-lg)] font-semibold">
            Étape 3 — Mix types contenu (21 sliders · 6 sections)
          </h2>
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
              Preset équilibré
            </button>
          </div>
          <div className="space-y-[var(--space-admin-5,12px)]">
            {WIZARD_SECTIONS.map((section) => (
              <div key={section.id}>
                <h3 className="text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-fg-muted)] uppercase tracking-wide mb-[var(--space-admin-2,4px)]">
                  {section.label} ({section.types.length})
                </h3>
                <div className="space-y-[var(--space-admin-3,6px)]">
                  {section.types.map((ct) => (
                    <div
                      key={ct}
                      className="grid grid-cols-12 items-center gap-2 border-b border-[color:var(--color-admin-border)] py-2"
                    >
                      <span className="col-span-4 font-mono text-[length:var(--text-admin-sm)]">
                        {ct}
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
                  canGoStep4
                    ? "text-[color:var(--color-admin-success-fg)]"
                    : "text-[color:var(--color-admin-destructive-fg)]",
                )}
              >
                {weightsSum}
                {state.mixMode === "percentage" ? "%" : ""}
              </strong>
            </span>
            {state.mixMode === "percentage" && !canGoStep4 ? (
              <AdminBadge tone="destructive">Somme doit = 100</AdminBadge>
            ) : null}
          </div>
        </AdminCard>
      ) : null}

      {/* Step 4 — Récap + Submit */}
      {state.step === 4 ? (
        <AdminCard>
          <h2 className="mb-[var(--space-admin-5,12px)] text-[length:var(--text-admin-lg)] font-semibold">
            Étape 4 — Récapitulatif
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
              <dt className="font-medium text-[color:var(--color-admin-fg-soft)]">Articles/jour</dt>
              <dd className="font-semibold">{state.dailyArticles}</dd>
            </div>
            <div>
              <dt className="font-medium text-[color:var(--color-admin-fg-soft)]">Cible/ville</dt>
              <dd className="font-semibold">{state.targetPerCity}</dd>
            </div>
            <div>
              <dt className="font-medium text-[color:var(--color-admin-fg-soft)]">Scope villes</dt>
              <dd className="font-semibold">
                {state.villeScopeMode === "global_queue"
                  ? "File globale 2150 villes"
                  : `Custom (${state.customVilleSlugs.length})`}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-[color:var(--color-admin-fg-soft)]">Mode mix</dt>
              <dd className="font-semibold">{state.mixMode}</dd>
            </div>
          </dl>
          <div className="mt-[var(--space-admin-5,12px)] flex flex-wrap gap-[var(--space-admin-3,6px)]">
            <button
              type="button"
              onClick={() => handleSubmit("draft")}
              disabled={state.submitting}
              className="rounded border border-[color:var(--color-admin-border)] px-4 py-2 hover:bg-[color:var(--color-admin-surface-2)] disabled:opacity-50"
            >
              {state.submitting ? "Enregistrement…" : "Enregistrer en brouillon"}
            </button>
            <button
              type="button"
              onClick={() => handleSubmit("launch")}
              disabled={state.submitting}
              className="rounded border border-[color:var(--color-admin-accent)] bg-[color:var(--color-admin-accent)] px-4 py-2 text-white hover:opacity-90 disabled:opacity-50"
            >
              {state.submitting ? "Lancement…" : "Lancer la campagne"}
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
          className="rounded border border-[color:var(--color-admin-border)] px-4 py-2 disabled:opacity-30"
        >
          ← Précédent
        </button>
        {state.step < 4 ? (
          <button
            type="button"
            onClick={() => {
              if (state.step === 1 && !canGoStep2) {
                toast.error("Sélectionnez une verticale");
                return;
              }
              if (state.step === 2 && !canGoStep3) {
                toast.error("Nom + articles/jour requis");
                return;
              }
              if (state.step === 3 && !canGoStep4) {
                toast.error(`Somme sliders doit = 100 (actuel : ${weightsSum})`);
                return;
              }
              update("step", (state.step + 1) as 1 | 2 | 3 | 4);
            }}
            className="rounded border border-[color:var(--color-admin-accent)] bg-[color:var(--color-admin-accent)] px-4 py-2 text-white"
          >
            Suivant →
          </button>
        ) : null}
      </div>
    </AdminPageShell>
  );
}
