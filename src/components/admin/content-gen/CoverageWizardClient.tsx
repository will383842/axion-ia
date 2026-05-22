"use client";
// use-client: wizard multi-étapes avec état local React (useState/useTransition)

import { useState, useTransition } from "react";
import type { CityEquityRow } from "@/server/actions/content-gen/city-equity";
import { KEYWORD_CATALOG, type VerticalSlug } from "@/server/content-gen/keywords/keyword-catalog";
import { AdminFormError } from "@/components/admin/ui/AdminFormError";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DistributionProfile {
  readonly slug: string;
  readonly label?: string | null;
}
interface AudienceProfile {
  readonly slug: string;
  readonly label?: string | null;
}

// Sprint A-suite P6 — Item 6. CampaignTemplate preset pour step 0 wizard.
interface CampaignTemplateItem {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly config: unknown;
}

interface Props {
  distProfiles: DistributionProfile[];
  audProfiles: AudienceProfile[];
  cityEquity: CityEquityRow[];
  onSubmit: (formData: FormData) => Promise<void>;
  onDryRun?: (formData: FormData) => Promise<void>;
  adminPrefix: string;
  /** Presets CampaignTemplate actifs. Si vide → step 0 ignoré. */
  templates?: CampaignTemplateItem[];
}

// ─── Données statiques ────────────────────────────────────────────────────────

const VERTICALS = [
  {
    slug: "audits" as VerticalSlug,
    label: "Audits IA",
    icon: "🔍",
    description: "Diagnostic, évaluation maturité, conformité AI Act",
    dbValue: "audits",
  },
  {
    slug: "interventions_formations" as VerticalSlug,
    label: "Formations & Interventions",
    icon: "🎓",
    description: "Ateliers, sensibilisation, montée en compétence équipes",
    dbValue: "interventions_formations",
  },
  {
    slug: "implementations" as VerticalSlug,
    label: "Implémentations",
    icon: "⚙️",
    description: "Déploiement IA, automatisation, intégration LLM",
    dbValue: "implementations",
  },
  {
    slug: "un_a_un" as VerticalSlug,
    label: "Coaching 1-to-1",
    icon: "🤝",
    description: "Accompagnement personnalisé dirigeants et CDO",
    dbValue: "un_a_un",
  },
  {
    slug: "sites_web_augmentes" as VerticalSlug,
    label: "Plateformes Web & IA",
    icon: "🌐",
    description: "Sites web augmentés, chatbots, agents conversationnels",
    dbValue: "sites_web_augmentes",
  },
] as const;

const AUDIENCE_OPTIONS = [
  { key: "TPE:entreprise_privee", label: "TPE", desc: "< 10 salariés" },
  { key: "PME:entreprise_privee", label: "PME", desc: "10 – 250 salariés" },
  { key: "ETI:entreprise_privee", label: "ETI", desc: "250 – 5 000 salariés" },
  { key: "GE:entreprise_privee", label: "Grande Entreprise", desc: "> 5 000 salariés" },
  { key: "PME:secteur_public", label: "Secteur Public", desc: "Collectivités, OPCO, hôpitaux" },
] as const;

// 39 villes pilote groupées par département
const DEPARTMENTS = [
  { code: "75", label: "Paris (75)", cities: [{ slug: "paris", name: "Paris" }] },
  {
    code: "13",
    label: "Bouches-du-Rhône (13)",
    cities: [
      { slug: "marseille", name: "Marseille" },
      { slug: "aix-en-provence", name: "Aix-en-Provence" },
    ],
  },
  {
    code: "69",
    label: "Rhône (69)",
    cities: [
      { slug: "lyon", name: "Lyon" },
      { slug: "villeurbanne", name: "Villeurbanne" },
    ],
  },
  { code: "31", label: "Haute-Garonne (31)", cities: [{ slug: "toulouse", name: "Toulouse" }] },
  { code: "06", label: "Alpes-Maritimes (06)", cities: [{ slug: "nice", name: "Nice" }] },
  { code: "44", label: "Loire-Atlantique (44)", cities: [{ slug: "nantes", name: "Nantes" }] },
  { code: "34", label: "Hérault (34)", cities: [{ slug: "montpellier", name: "Montpellier" }] },
  { code: "67", label: "Bas-Rhin (67)", cities: [{ slug: "strasbourg", name: "Strasbourg" }] },
  { code: "33", label: "Gironde (33)", cities: [{ slug: "bordeaux", name: "Bordeaux" }] },
  { code: "59", label: "Nord (59)", cities: [{ slug: "lille", name: "Lille" }] },
  {
    code: "35",
    label: "Ille-et-Vilaine (35)",
    cities: [{ slug: "rennes", name: "Rennes" }],
  },
  { code: "83", label: "Var (83)", cities: [{ slug: "toulon", name: "Toulon" }] },
  { code: "51", label: "Marne (51)", cities: [{ slug: "reims", name: "Reims" }] },
  { code: "42", label: "Loire (42)", cities: [{ slug: "saint-etienne", name: "Saint-Étienne" }] },
  {
    code: "76",
    label: "Seine-Maritime (76)",
    cities: [
      { slug: "le-havre", name: "Le Havre" },
      { slug: "rouen", name: "Rouen" },
    ],
  },
  { code: "21", label: "Côte-d'Or (21)", cities: [{ slug: "dijon", name: "Dijon" }] },
  {
    code: "49",
    label: "Maine-et-Loire (49)",
    cities: [{ slug: "angers", name: "Angers" }],
  },
  { code: "38", label: "Isère (38)", cities: [{ slug: "grenoble", name: "Grenoble" }] },
  { code: "30", label: "Gard (30)", cities: [{ slug: "nimes", name: "Nîmes" }] },
  {
    code: "63",
    label: "Puy-de-Dôme (63)",
    cities: [{ slug: "clermont-ferrand", name: "Clermont-Ferrand" }],
  },
  { code: "72", label: "Sarthe (72)", cities: [{ slug: "le-mans", name: "Le Mans" }] },
  { code: "29", label: "Finistère (29)", cities: [{ slug: "brest", name: "Brest" }] },
  {
    code: "37",
    label: "Indre-et-Loire (37)",
    cities: [{ slug: "tours", name: "Tours" }],
  },
  { code: "80", label: "Somme (80)", cities: [{ slug: "amiens", name: "Amiens" }] },
  { code: "74", label: "Haute-Savoie (74)", cities: [{ slug: "annecy", name: "Annecy" }] },
  {
    code: "87",
    label: "Haute-Vienne (87)",
    cities: [{ slug: "limoges", name: "Limoges" }],
  },
  {
    code: "57",
    label: "Moselle (57)",
    cities: [{ slug: "metz", name: "Metz" }],
  },
  {
    code: "66",
    label: "Pyrénées-Orientales (66)",
    cities: [{ slug: "perpignan", name: "Perpignan" }],
  },
  {
    code: "92",
    label: "Hauts-de-Seine (92)",
    cities: [{ slug: "boulogne-billancourt", name: "Boulogne-Billancourt" }],
  },
  {
    code: "25",
    label: "Doubs (25)",
    cities: [{ slug: "besancon", name: "Besançon" }],
  },
  {
    code: "45",
    label: "Loiret (45)",
    cities: [{ slug: "orleans", name: "Orléans" }],
  },
  {
    code: "93",
    label: "Seine-Saint-Denis (93)",
    cities: [{ slug: "montreuil", name: "Montreuil" }],
  },
  {
    code: "14",
    label: "Calvados (14)",
    cities: [{ slug: "caen", name: "Caen" }],
  },
  {
    code: "95",
    label: "Val-d'Oise (95)",
    cities: [{ slug: "argenteuil", name: "Argenteuil" }],
  },
  {
    code: "68",
    label: "Haut-Rhin (68)",
    cities: [{ slug: "mulhouse", name: "Mulhouse" }],
  },
  {
    code: "54",
    label: "Meurthe-et-Moselle (54)",
    cities: [{ slug: "nancy", name: "Nancy" }],
  },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function equityColor(count: number, target = 10): "green" | "yellow" | "red" {
  if (count >= target) return "green";
  if (count >= target * 0.5) return "yellow";
  return "red";
}

function equityBadge(count: number, target = 10) {
  const color = equityColor(count, target);
  const colors = {
    green: "bg-green-100 text-green-800",
    yellow: "bg-yellow-100 text-yellow-800",
    red: "bg-red-100 text-red-800",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${colors[color]}`}>
      {count}/{target}
    </span>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function CoverageWizardClient({ cityEquity, onSubmit, templates = [] }: Props) {
  // Step 0 si des templates sont disponibles, sinon on commence à 1.
  const hasTemplates = templates.length > 0;
  const [step, setStep] = useState(hasTemplates ? 0 : 1);
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Step 1 — Vertical
  const [selectedVertical, setSelectedVertical] = useState<VerticalSlug | null>(null);

  // Step 2 — Géo
  const [selectedCities, setSelectedCities] = useState<Set<string>>(new Set());
  const [selectedDepts, setSelectedDepts] = useState<Set<string>>(new Set());
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [targetCount, setTargetCount] = useState(100);

  // Step 3 — Audiences
  const [selectedAudiences, setSelectedAudiences] = useState<Set<string>>(
    new Set(["PME:entreprise_privee", "TPE:entreprise_privee"]),
  );

  // Step 4 — Keywords
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());
  const [customKeyword, setCustomKeyword] = useState("");

  // Step 5 — Planification
  const [cityProcessingMode, setCityProcessingMode] = useState<"parallel" | "sequential">(
    "parallel",
  );
  const [startDateInput, setStartDateInput] = useState("");
  const [endDateInput, setEndDateInput] = useState("");
  const [startNow, setStartNow] = useState(true);
  const [neverEnd, setNeverEnd] = useState(true);
  const [schedulePreset, setSchedulePreset] = useState<
    "none" | "daily" | "weekly" | "monthly" | "custom"
  >("none");
  const [scheduleDay, setScheduleDay] = useState("1"); // 1=Lundi pour weekly
  const [scheduleHour, setScheduleHour] = useState("9");
  const [customCron, setCustomCron] = useState("");

  // Equity map
  const equityMap = Object.fromEntries(cityEquity.map((r) => [r.villeSlug, r.publishedArticles]));

  // ─── Step 0 : Preset (Sprint A-suite P6 — Item 6) ────────────────────────
  // Affiché uniquement si templates.length > 0. Permet de choisir un preset
  // CampaignTemplate ou de partir de zéro (→ step 1).

  const applyPreset = (tmpl: CampaignTemplateItem) => {
    const cfg = tmpl.config as Record<string, unknown>;
    // Pre-fill vertical
    const verticals = Array.isArray(cfg.verticals) ? (cfg.verticals as string[]) : [];
    if (verticals[0]) {
      const v = VERTICALS.find((vv) => vv.slug === verticals[0] || vv.dbValue === verticals[0]);
      if (v) {
        setSelectedVertical(v.slug);
        setSelectedKeywords(new Set(KEYWORD_CATALOG[v.slug]));
      }
    }
    // Pre-fill city processing mode
    if (cfg.cityProcessingMode === "sequential" || cfg.cityProcessingMode === "parallel") {
      setCityProcessingMode(cfg.cityProcessingMode as "parallel" | "sequential");
    }
    // Pre-fill recurring schedule
    if (typeof cfg.recurringSchedule === "string" && cfg.recurringSchedule) {
      setSchedulePreset("custom");
      setCustomCron(cfg.recurringSchedule);
    }
    // Sauter directement à l'étape 2 (Géo) après sélection preset.
    setStep(2);
  };

  const step0 = hasTemplates ? (
    <div className="space-y-[var(--space-admin-4)]">
      <h2 className="admin-h2">Étape 0 — Choisir un preset</h2>
      <p className="admin-meta-small">Démarrez avec un preset pré-configuré ou partez de zéro.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((tmpl) => (
          <button
            key={tmpl.id}
            type="button"
            onClick={() => applyPreset(tmpl)}
            className="rounded-[var(--radius-admin-md)] border-2 border-[color:var(--color-admin-border)] p-[var(--space-admin-4)] text-left transition-all hover:border-[color:var(--color-admin-accent)]/50 hover:bg-[color:var(--color-admin-accent)]/5"
          >
            <div className="text-[length:var(--text-admin-sm)] font-semibold">{tmpl.name}</div>
            <div className="mt-1 text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
              {tmpl.description}
            </div>
          </button>
        ))}
      </div>
      <div className="admin-filters-actions">
        <button type="button" onClick={() => setStep(1)} className="admin-button-ghost">
          Partir de zéro →
        </button>
      </div>
    </div>
  ) : null;

  // ─── Step 1 : Vertical ─────────────────────────────────────────────────────

  const step1 = (
    <div className="space-y-[var(--space-admin-4)]">
      <h2 className="admin-h2">Étape 1 — Quelle verticale ?</h2>
      <p className="admin-meta-small">
        Chaque verticale a ses propres prompts, persona et mots-clés pré-remplis.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {VERTICALS.map((v) => (
          <button
            key={v.slug}
            type="button"
            onClick={() => setSelectedVertical(v.slug)}
            className={`rounded-[var(--radius-admin-md)] border-2 p-[var(--space-admin-4)] text-left transition-all ${
              selectedVertical === v.slug
                ? "border-[color:var(--color-admin-accent)] bg-[color:var(--color-admin-accent)]/5"
                : "border-[color:var(--color-admin-border)] hover:border-[color:var(--color-admin-accent)]/50"
            }`}
          >
            <div className="mb-2 text-2xl">{v.icon}</div>
            <div className="text-[length:var(--text-admin-sm)] font-semibold">{v.label}</div>
            <div className="mt-1 text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
              {v.description}
            </div>
          </button>
        ))}
      </div>
      <div className="admin-filters-actions">
        <button
          type="button"
          onClick={() => {
            if (selectedVertical) {
              // Pré-remplir les keywords pour cette verticale
              setSelectedKeywords(new Set(KEYWORD_CATALOG[selectedVertical]));
              setStep(2);
            }
          }}
          disabled={!selectedVertical}
          className="admin-button"
        >
          Suivant →
        </button>
      </div>
    </div>
  );

  // ─── Step 2 : Géo ──────────────────────────────────────────────────────────

  function toggleCity(slug: string) {
    setSelectedCities((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function toggleDept(code: string, cities: ReadonlyArray<{ slug: string }>) {
    const allSelected = cities.every((c) => selectedCities.has(c.slug));
    setSelectedCities((prev) => {
      const next = new Set(prev);
      if (allSelected) cities.forEach((c) => next.delete(c.slug));
      else cities.forEach((c) => next.add(c.slug));
      return next;
    });
    setSelectedDepts((prev) => {
      const next = new Set(prev);
      if (allSelected) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function toggleExpandDept(code: string) {
    setExpandedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  const step2 = (
    <div className="space-y-[var(--space-admin-4)]">
      <h2 className="admin-h2">Étape 2 — Géographie</h2>
      <div className="flex flex-wrap items-center gap-4">
        <p className="admin-meta-small flex-1">
          {selectedCities.size} ville{selectedCities.size !== 1 ? "s" : ""} sélectionnée
          {selectedCities.size !== 1 ? "s" : ""}. La barre{" "}
          <span className="font-medium text-green-700">verte</span> = bien couverte (≥ 10 articles),{" "}
          <span className="font-medium text-yellow-700">jaune</span> = partielle,{" "}
          <span className="font-medium text-red-700">rouge</span> = non démarrée.
        </p>
        <div className="admin-field" style={{ minWidth: 200 }}>
          <label className="admin-label text-[length:var(--text-admin-xs)]">
            Volume total cible
          </label>
          <input
            type="number"
            min={1}
            max={10000}
            value={targetCount}
            onChange={(e) => setTargetCount(Number(e.target.value))}
            className="admin-input"
          />
        </div>
      </div>

      <div className="max-h-[500px] space-y-2 overflow-y-auto pr-1">
        {DEPARTMENTS.map((dept) => {
          const allSelected = dept.cities.every((c) => selectedCities.has(c.slug));
          const someSelected = dept.cities.some((c) => selectedCities.has(c.slug));
          const expanded = expandedDepts.has(dept.code);

          return (
            <div
              key={dept.code}
              className="overflow-hidden rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)]"
            >
              <div className="flex items-center gap-3 bg-[color:var(--color-admin-surface-soft)] px-[var(--space-admin-4)] py-2.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected && !allSelected;
                  }}
                  onChange={() => toggleDept(dept.code, dept.cities)}
                  className="h-4 w-4 accent-[color:var(--color-admin-accent)]"
                  aria-label={`Sélectionner tout ${dept.label}`}
                />
                <button
                  type="button"
                  onClick={() => toggleExpandDept(dept.code)}
                  aria-expanded={expanded}
                  aria-label={`${expanded ? "Réduire" : "Afficher"} les villes de ${dept.label}`}
                  className="flex flex-1 items-center justify-between text-left text-[length:var(--text-admin-sm)] font-medium"
                >
                  <span>{dept.label}</span>
                  <span className="ml-2 text-[color:var(--color-admin-fg-muted)]">
                    {expanded ? "▲" : "▼"} {dept.cities.length} ville
                    {dept.cities.length > 1 ? "s" : ""}
                  </span>
                </button>
              </div>

              {expanded && (
                <div className="space-y-1.5 px-[var(--space-admin-4)] py-2">
                  {dept.cities.map((city) => {
                    const count = equityMap[city.slug] ?? 0;
                    return (
                      <label
                        key={city.slug}
                        className="flex cursor-pointer items-center justify-between gap-3 py-1"
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedCities.has(city.slug)}
                            onChange={() => toggleCity(city.slug)}
                            className="h-4 w-4 accent-[color:var(--color-admin-accent)]"
                          />
                          <span className="text-[length:var(--text-admin-sm)]">{city.name}</span>
                        </span>
                        {equityBadge(count)}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="admin-filters-actions">
        <button type="button" onClick={() => setStep(1)} className="admin-button-ghost">
          ← Retour
        </button>
        <button
          type="button"
          onClick={() => setStep(3)}
          disabled={selectedCities.size === 0}
          className="admin-button"
        >
          Suivant → ({selectedCities.size} ville{selectedCities.size !== 1 ? "s" : ""})
        </button>
      </div>
    </div>
  );

  // ─── Step 3 : Audiences ────────────────────────────────────────────────────

  function toggleAudience(key: string) {
    setSelectedAudiences((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const step3 = (
    <div className="space-y-[var(--space-admin-4)]">
      <h2 className="admin-h2">Étape 3 — Cibles</h2>
      <p className="admin-meta-small">
        Les prompts et angles éditoriaux s&apos;adapteront à chaque cible sélectionnée.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {AUDIENCE_OPTIONS.map((a) => (
          <label
            key={a.key}
            className={`flex cursor-pointer items-start gap-3 rounded-[var(--radius-admin-md)] border-2 p-[var(--space-admin-4)] transition-all ${
              selectedAudiences.has(a.key)
                ? "border-[color:var(--color-admin-accent)] bg-[color:var(--color-admin-accent)]/5"
                : "border-[color:var(--color-admin-border)]"
            }`}
          >
            <input
              type="checkbox"
              checked={selectedAudiences.has(a.key)}
              onChange={() => toggleAudience(a.key)}
              className="mt-0.5 h-4 w-4 accent-[color:var(--color-admin-accent)]"
            />
            <span>
              <span className="text-[length:var(--text-admin-sm)] font-semibold">{a.label}</span>
              <span className="ml-2 text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                {a.desc}
              </span>
            </span>
          </label>
        ))}
      </div>
      <div className="admin-filters-actions">
        <button type="button" onClick={() => setStep(2)} className="admin-button-ghost">
          ← Retour
        </button>
        <button
          type="button"
          onClick={() => setStep(4)}
          disabled={selectedAudiences.size === 0}
          className="admin-button"
        >
          Suivant →
        </button>
      </div>
    </div>
  );

  // ─── Step 4 : Mots-clés ────────────────────────────────────────────────────

  function toggleKeyword(kw: string) {
    setSelectedKeywords((prev) => {
      const next = new Set(prev);
      if (next.has(kw)) next.delete(kw);
      else next.add(kw);
      return next;
    });
  }

  function addCustomKeyword() {
    const kw = customKeyword.trim();
    if (!kw) return;
    setSelectedKeywords((prev) => new Set([...prev, kw]));
    setCustomKeyword("");
  }

  const catalogKws = selectedVertical ? KEYWORD_CATALOG[selectedVertical] : [];

  const step4 = (
    <div className="space-y-[var(--space-admin-4)]">
      <h2 className="admin-h2">Étape 4 — Mots-clés</h2>
      <p className="admin-meta-small">
        Liste pré-remplie pour la verticale{" "}
        <strong>{VERTICALS.find((v) => v.slug === selectedVertical)?.label}</strong>. Cochez ceux à
        inclure, ajoutez les vôtres.
      </p>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {catalogKws.map((kw) => (
          <label key={kw} className="flex cursor-pointer items-center gap-2 py-1">
            <input
              type="checkbox"
              checked={selectedKeywords.has(kw)}
              onChange={() => toggleKeyword(kw)}
              className="h-4 w-4 accent-[color:var(--color-admin-accent)]"
            />
            <span className="text-[length:var(--text-admin-sm)]">{kw}</span>
          </label>
        ))}
      </div>

      {/* Mots-clés personnalisés ajoutés par l'utilisateur */}
      {[...selectedKeywords].filter((kw) => !catalogKws.includes(kw as never)).length > 0 && (
        <div className="border-t pt-3">
          <p className="admin-meta-small mb-2">Mots-clés personnalisés :</p>
          <div className="flex flex-wrap gap-2">
            {[...selectedKeywords]
              .filter((kw) => !catalogKws.includes(kw as never))
              .map((kw) => (
                <span
                  key={kw}
                  className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-admin-accent)]/10 px-3 py-1 text-[length:var(--text-admin-xs)]"
                >
                  {kw}
                  <button
                    type="button"
                    onClick={() => toggleKeyword(kw)}
                    className="ml-1 hover:text-red-600"
                    aria-label={`Supprimer ${kw}`}
                  >
                    ×
                  </button>
                </span>
              ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={customKeyword}
          onChange={(e) => setCustomKeyword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCustomKeyword()}
          placeholder="Ajouter un mot-clé personnalisé..."
          className="admin-input flex-1"
        />
        <button
          type="button"
          onClick={addCustomKeyword}
          disabled={!customKeyword.trim()}
          className="admin-button-ghost"
        >
          Ajouter
        </button>
      </div>

      <div className="admin-filters-actions">
        <button type="button" onClick={() => setStep(3)} className="admin-button-ghost">
          ← Retour
        </button>
        <button
          type="button"
          onClick={() => setStep(5)}
          disabled={selectedKeywords.size === 0}
          className="admin-button"
        >
          Suivant → ({selectedKeywords.size} mot{selectedKeywords.size !== 1 ? "s" : ""}-clé
          {selectedKeywords.size !== 1 ? "s" : ""})
        </button>
      </div>
    </div>
  );

  // ─── Helper Planification ──────────────────────────────────────────────────

  function buildCronExpression(): string | null {
    if (schedulePreset === "none") return null;
    if (schedulePreset === "daily") return `0 ${scheduleHour} * * *`;
    if (schedulePreset === "weekly") return `0 ${scheduleHour} * * ${scheduleDay}`;
    if (schedulePreset === "monthly") return `0 ${scheduleHour} 1 * *`;
    if (schedulePreset === "custom") return customCron.trim() || null;
    return null;
  }

  // ─── Step 5 : Planification ────────────────────────────────────────────────

  const step5 = (
    <div className="space-y-[var(--space-admin-4)]">
      <h2 className="admin-h2">Étape 5 — Planification</h2>

      {/* Mode traitement villes */}
      <div className="admin-field">
        <label className="admin-label">Mode traitement villes</label>
        <div className="space-y-2">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="radio"
              checked={cityProcessingMode === "parallel"}
              onChange={() => setCityProcessingMode("parallel")}
              className="h-4 w-4"
            />
            <span className="text-[length:var(--text-admin-sm)]">
              <strong>Parallèle</strong> — toutes les villes simultanément (défaut)
            </span>
          </label>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="radio"
              checked={cityProcessingMode === "sequential"}
              onChange={() => setCityProcessingMode("sequential")}
              className="h-4 w-4"
            />
            <span className="text-[length:var(--text-admin-sm)]">
              <strong>Séquentiel</strong> — ville par ville dans l&apos;ordre sélectionné
            </span>
          </label>
        </div>
      </div>

      {/* Date de démarrage */}
      <div className="admin-field">
        <label className="admin-label">Date de démarrage</label>
        <label className="mb-2 flex items-center gap-2">
          <input
            type="checkbox"
            checked={startNow}
            onChange={(e) => setStartNow(e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-[length:var(--text-admin-sm)]">Démarrer immédiatement</span>
        </label>
        {!startNow && (
          <input
            type="datetime-local"
            value={startDateInput}
            onChange={(e) => setStartDateInput(e.target.value)}
            className="admin-input"
          />
        )}
      </div>

      {/* Date de fin */}
      <div className="admin-field">
        <label className="admin-label">Date de fin (auto-stop)</label>
        <label className="mb-2 flex items-center gap-2">
          <input
            type="checkbox"
            checked={neverEnd}
            onChange={(e) => setNeverEnd(e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-[length:var(--text-admin-sm)]">Durée illimitée</span>
        </label>
        {!neverEnd && (
          <input
            type="datetime-local"
            value={endDateInput}
            onChange={(e) => setEndDateInput(e.target.value)}
            className="admin-input"
          />
        )}
      </div>

      {/* Récurrence */}
      <div className="admin-field">
        <label className="admin-label">Récurrence</label>
        <select
          value={schedulePreset}
          onChange={(e) => setSchedulePreset(e.target.value as typeof schedulePreset)}
          className="admin-input"
        >
          <option value="none">One-shot (par défaut)</option>
          <option value="daily">Quotidien</option>
          <option value="weekly">Hebdomadaire</option>
          <option value="monthly">Mensuel (1er du mois)</option>
          <option value="custom">Cron personnalisé</option>
        </select>
        {schedulePreset === "daily" && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[length:var(--text-admin-sm)]">à</span>
            <input
              type="number"
              min={0}
              max={23}
              value={scheduleHour}
              onChange={(e) => setScheduleHour(e.target.value)}
              className="admin-input w-20"
            />
            h
          </div>
        )}
        {schedulePreset === "weekly" && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              value={scheduleDay}
              onChange={(e) => setScheduleDay(e.target.value)}
              className="admin-input"
            >
              <option value="1">Lundi</option>
              <option value="2">Mardi</option>
              <option value="3">Mercredi</option>
              <option value="4">Jeudi</option>
              <option value="5">Vendredi</option>
              <option value="6">Samedi</option>
              <option value="0">Dimanche</option>
            </select>
            <span className="text-[length:var(--text-admin-sm)]">à</span>
            <input
              type="number"
              min={0}
              max={23}
              value={scheduleHour}
              onChange={(e) => setScheduleHour(e.target.value)}
              className="admin-input w-20"
            />
            h
          </div>
        )}
        {schedulePreset === "custom" && (
          <div className="mt-2">
            <input
              type="text"
              value={customCron}
              onChange={(e) => setCustomCron(e.target.value)}
              placeholder="ex: 0 9 * * 1 (lundis 9h)"
              className="admin-input"
            />
          </div>
        )}
      </div>

      <div className="admin-filters-actions">
        <button type="button" onClick={() => setStep(4)} className="admin-button-ghost">
          ← Retour
        </button>
        <button type="button" onClick={() => setStep(6)} className="admin-button">
          Suivant →
        </button>
      </div>
    </div>
  );

  // ─── Step 6 : Revue & Lancement ────────────────────────────────────────────

  // Calcul automatique de la distribution type → landing_ville pour les villes
  // Répartition : 40% landing_ville + 60% partagé entre blog/guide/faq
  const buildTypeDistribution = () => {
    if (selectedCities.size > 0) {
      return {
        landing_ville: 40,
        blog_from_keywords: 25,
        guide_pilier: 20,
        faq_standalone: 15,
      };
    }
    return {
      blog_from_keywords: 30,
      blog_from_title: 25,
      guide_pilier: 25,
      faq_standalone: 20,
    };
  };

  // Répartition audiences proportionnelle
  const buildAudienceMix = () => {
    const count = selectedAudiences.size;
    if (count === 0) return { "PME:entreprise_privee": 100 };
    const share = Math.floor(100 / count);
    const remainder = 100 - share * count;
    const keys = [...selectedAudiences];
    return Object.fromEntries(keys.map((k, i) => [k, i === 0 ? share + remainder : share]));
  };

  const typeDist = buildTypeDistribution();
  const audienceMix = buildAudienceMix();
  const estimatedCost = Math.round(targetCount * 0.04 * 100) / 100; // ~$0.04/article moyen

  const handleSubmit = (launchNow: boolean) => {
    setSubmitError(null);
    startTransition(async () => {
      const fd = new FormData();
      const vertical = VERTICALS.find((v) => v.slug === selectedVertical);

      fd.set(
        "name",
        `Campagne ${vertical?.label ?? ""} — ${selectedCities.size} villes — ${new Date().toLocaleDateString("fr-FR")}`,
      );
      fd.set("scope", selectedCities.size > 0 ? "ville" : "multi");
      fd.set("serviceSector", vertical?.dbValue ?? "");
      fd.set("totalTargetCount", String(targetCount));
      fd.set("anchorVilleSlugs", [...selectedCities].join(","));
      fd.set("anchorDepartementCodes", [...selectedDepts].join(","));
      fd.set("anchorRegionSlugs", "");
      fd.set("typeDistribution", JSON.stringify(typeDist));
      fd.set("audienceMix", JSON.stringify(audienceMix));
      fd.set("primaryKeywords", [...selectedKeywords].join("\n"));
      // Sprint Campaign Controls — step 5 Planification fields
      fd.set("cityProcessingMode", cityProcessingMode);
      fd.set("startDate", startNow ? "" : startDateInput);
      fd.set("endDate", neverEnd ? "" : endDateInput);
      fd.set("recurringSchedule", buildCronExpression() ?? "");
      if (launchNow) fd.set("launchNow", "on");

      try {
        await onSubmit(fd);
      } catch (err: unknown) {
        // NEXT_REDIRECT est une erreur de navigation — ne pas l'intercepter
        if (
          err != null &&
          typeof err === "object" &&
          "digest" in err &&
          typeof (err as { digest: unknown }).digest === "string" &&
          (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
        ) {
          throw err;
        }
        if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
        const msg =
          err instanceof Error
            ? err.message
            : "Une erreur inattendue est survenue lors du lancement.";
        setSubmitError(msg);
      }
    });
  };

  const step6 = (
    <div className="space-y-[var(--space-admin-4)]">
      <h2 className="admin-h2">Étape 6 — Revue & Lancement</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-4)]">
          <p className="admin-label mb-2">Verticale</p>
          <p className="font-semibold">
            {VERTICALS.find((v) => v.slug === selectedVertical)?.icon}{" "}
            {VERTICALS.find((v) => v.slug === selectedVertical)?.label}
          </p>
        </div>

        <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-4)]">
          <p className="admin-label mb-2">Volume cible</p>
          <p className="text-lg font-semibold">{targetCount} articles</p>
          <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            Coût estimé : ~${estimatedCost}
          </p>
        </div>

        <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-4)]">
          <p className="admin-label mb-2">Villes ({selectedCities.size})</p>
          <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
            {[...selectedCities].map((slug) => {
              const count = equityMap[slug] ?? 0;
              return (
                <span
                  key={slug}
                  className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-admin-surface-soft)] px-2 py-0.5 text-[10px]"
                >
                  {slug} {equityBadge(count)}
                </span>
              );
            })}
          </div>
        </div>

        <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-4)]">
          <p className="admin-label mb-2">Cibles</p>
          <div className="flex flex-wrap gap-1.5">
            {[...selectedAudiences].map((k) => (
              <span
                key={k}
                className="rounded-full bg-[color:var(--color-admin-accent)]/10 px-2 py-0.5 text-[10px] font-medium"
              >
                {AUDIENCE_OPTIONS.find((a) => a.key === k)?.label ?? k}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-4)] sm:col-span-2">
          <p className="admin-label mb-2">Mots-clés ({selectedKeywords.size})</p>
          <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
            {[...selectedKeywords].map((kw) => (
              <span
                key={kw}
                className="rounded-full bg-[color:var(--color-admin-surface-soft)] px-2 py-0.5 text-[10px]"
              >
                {kw}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-4)] sm:col-span-2">
          <p className="admin-label mb-2">Distribution types (auto-calculée)</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(typeDist).map(([type, pct]) => (
              <span
                key={type}
                className="rounded-full bg-[color:var(--color-admin-surface-soft)] px-2.5 py-1 text-[10px] font-medium"
              >
                {type}: {pct}%
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Indicateur équité global */}
      {selectedCities.size > 0 && (
        <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-4)]">
          <p className="admin-label mb-2">Équité géographique actuelle</p>
          <div className="space-y-1.5">
            {[...selectedCities].map((slug) => {
              const count = equityMap[slug] ?? 0;
              const pct = Math.min(100, (count / 10) * 100);
              return (
                <div
                  key={slug}
                  className="flex items-center gap-2 text-[length:var(--text-admin-xs)]"
                >
                  <span className="w-32 truncate">{slug}</span>
                  <div className="h-1.5 flex-1 rounded-full bg-[color:var(--color-admin-border)]">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        pct >= 100 ? "bg-green-500" : pct >= 50 ? "bg-yellow-400" : "bg-red-400"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-12 text-right text-[color:var(--color-admin-fg-muted)]">
                    {count}/10
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {submitError && (
        <div className="mt-[var(--space-admin-4)]">
          <AdminFormError message={submitError} onDismiss={() => setSubmitError(null)} />
        </div>
      )}

      <div className="admin-filters-actions">
        <button type="button" onClick={() => setStep(5)} className="admin-button-ghost">
          ← Retour
        </button>
        <button
          type="button"
          onClick={() => handleSubmit(false)}
          disabled={isPending}
          className="admin-button-ghost"
        >
          {isPending ? "Enregistrement…" : "Enregistrer en brouillon"}
        </button>
        <button
          type="button"
          onClick={() => handleSubmit(true)}
          disabled={isPending}
          className="admin-button"
        >
          {isPending ? "Lancement…" : "🚀 Lancer la campagne"}
        </button>
      </div>
    </div>
  );

  // ─── Progress bar ─────────────────────────────────────────────────────────

  const steps = [
    { n: 1, label: "Verticale" },
    { n: 2, label: "Géo" },
    { n: 3, label: "Cibles" },
    { n: 4, label: "Keywords" },
    { n: 5, label: "Planning" },
    { n: 6, label: "Revue" },
  ];

  return (
    <div className="space-y-[var(--space-admin-6)]">
      {/* Progress */}
      <nav aria-label="Étapes du wizard" className="flex items-center gap-0">
        {steps.map((s, i) => (
          <div key={s.n} className="flex flex-1 items-center">
            <button
              type="button"
              onClick={() => step > s.n && setStep(s.n)}
              disabled={step <= s.n}
              aria-label={`Étape ${s.n} : ${s.label}${step > s.n ? " (complétée)" : step === s.n ? " (en cours)" : ""}`}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[length:var(--text-admin-xs)] font-bold transition-all ${
                step > s.n
                  ? "cursor-pointer bg-green-500 text-white"
                  : step === s.n
                    ? "bg-[color:var(--color-admin-accent)] text-white"
                    : "bg-[color:var(--color-admin-border)] text-[color:var(--color-admin-fg-muted)]"
              }`}
              aria-current={step === s.n ? "step" : undefined}
            >
              {step > s.n ? "✓" : s.n}
            </button>
            <span
              className={`ml-2 hidden text-[length:var(--text-admin-xs)] sm:block ${
                step === s.n
                  ? "font-semibold text-[color:var(--color-admin-fg)]"
                  : "text-[color:var(--color-admin-fg-muted)]"
              }`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div
                className={`mx-2 h-0.5 flex-1 transition-all ${
                  step > s.n ? "bg-green-400" : "bg-[color:var(--color-admin-border)]"
                }`}
              />
            )}
          </div>
        ))}
      </nav>

      {/* Step content */}
      <div>
        {step === 0 && step0}
        {step === 1 && step1}
        {step === 2 && step2}
        {step === 3 && step3}
        {step === 4 && step4}
        {step === 5 && step5}
        {step === 6 && step6}
      </div>
    </div>
  );
}
