"use client";

import { useState, useTransition } from "react";
import type { CityEquityRow } from "@/server/actions/content-gen/city-equity";
import {
  KEYWORD_CATALOG,
  type VerticalSlug,
} from "@/server/content-gen/keywords/keyword-catalog";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DistributionProfile {
  readonly slug: string;
  readonly label?: string | null;
}
interface AudienceProfile {
  readonly slug: string;
  readonly label?: string | null;
}

interface Props {
  distProfiles: DistributionProfile[];
  audProfiles: AudienceProfile[];
  cityEquity: CityEquityRow[];
  onSubmit: (formData: FormData) => Promise<void>;
  onDryRun: (formData: FormData) => Promise<void>;
  adminPrefix: string;
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

export function CoverageWizardClient({
  cityEquity,
  onSubmit,
  onDryRun,
}: Props) {
  const [step, setStep] = useState(1);
  const [isPending, startTransition] = useTransition();

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

  // Equity map
  const equityMap = Object.fromEntries(cityEquity.map((r) => [r.villeSlug, r.publishedArticles]));

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
            <div className="text-2xl mb-2">{v.icon}</div>
            <div className="font-semibold text-[length:var(--text-admin-sm)]">{v.label}</div>
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
      <div className="flex items-center gap-4 flex-wrap">
        <p className="admin-meta-small flex-1">
          {selectedCities.size} ville{selectedCities.size !== 1 ? "s" : ""} sélectionnée
          {selectedCities.size !== 1 ? "s" : ""}. La barre{" "}
          <span className="text-green-700 font-medium">verte</span> = bien couverte (≥ 10 articles),{" "}
          <span className="text-yellow-700 font-medium">jaune</span> = partielle,{" "}
          <span className="text-red-700 font-medium">rouge</span> = non démarrée.
        </p>
        <div className="admin-field" style={{ minWidth: 200 }}>
          <label className="admin-label text-[length:var(--text-admin-xs)]">Volume total cible</label>
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

      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
        {DEPARTMENTS.map((dept) => {
          const allSelected = dept.cities.every((c) => selectedCities.has(c.slug));
          const someSelected = dept.cities.some((c) => selectedCities.has(c.slug));
          const expanded = expandedDepts.has(dept.code);

          return (
            <div
              key={dept.code}
              className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] overflow-hidden"
            >
              <div className="flex items-center gap-3 px-[var(--space-admin-4)] py-2.5 bg-[color:var(--color-admin-surface-soft)]">
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
                  className="flex-1 text-left text-[length:var(--text-admin-sm)] font-medium flex items-center justify-between"
                >
                  <span>{dept.label}</span>
                  <span className="text-[color:var(--color-admin-fg-muted)] ml-2">
                    {expanded ? "▲" : "▼"} {dept.cities.length} ville
                    {dept.cities.length > 1 ? "s" : ""}
                  </span>
                </button>
              </div>

              {expanded && (
                <div className="px-[var(--space-admin-4)] py-2 space-y-1.5">
                  {dept.cities.map((city) => {
                    const count = equityMap[city.slug] ?? 0;
                    return (
                      <label
                        key={city.slug}
                        className="flex items-center justify-between gap-3 py-1 cursor-pointer"
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
        Les prompts et angles éditoriaux s'adapteront à chaque cible sélectionnée.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {AUDIENCE_OPTIONS.map((a) => (
          <label
            key={a.key}
            className={`flex items-start gap-3 rounded-[var(--radius-admin-md)] border-2 p-[var(--space-admin-4)] cursor-pointer transition-all ${
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
              <span className="font-semibold text-[length:var(--text-admin-sm)]">{a.label}</span>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {catalogKws.map((kw) => (
          <label key={kw} className="flex items-center gap-2 cursor-pointer py-1">
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

  // ─── Step 5 : Revue & Lancement ────────────────────────────────────────────

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
    return Object.fromEntries(
      keys.map((k, i) => [k, i === 0 ? share + remainder : share]),
    );
  };

  const typeDist = buildTypeDistribution();
  const audienceMix = buildAudienceMix();
  const estimatedCost = Math.round(targetCount * 0.04 * 100) / 100; // ~$0.04/article moyen

  const handleSubmit = (launchNow: boolean) => {
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
      fd.set(
        "anchorDepartementCodes",
        [...selectedDepts].join(","),
      );
      fd.set("anchorRegionSlugs", "");
      fd.set("typeDistribution", JSON.stringify(typeDist));
      fd.set("audienceMix", JSON.stringify(audienceMix));
      fd.set("primaryKeywords", [...selectedKeywords].join("\n"));
      if (launchNow) fd.set("launchNow", "on");

      await onSubmit(fd);
    });
  };

  const step5 = (
    <div className="space-y-[var(--space-admin-4)]">
      <h2 className="admin-h2">Étape 5 — Revue & Lancement</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-4)]">
          <p className="admin-label mb-2">Verticale</p>
          <p className="font-semibold">
            {VERTICALS.find((v) => v.slug === selectedVertical)?.icon}{" "}
            {VERTICALS.find((v) => v.slug === selectedVertical)?.label}
          </p>
        </div>

        <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-4)]">
          <p className="admin-label mb-2">Volume cible</p>
          <p className="font-semibold text-lg">{targetCount} articles</p>
          <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            Coût estimé : ~${estimatedCost}
          </p>
        </div>

        <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-4)]">
          <p className="admin-label mb-2">Villes ({selectedCities.size})</p>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
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

        <div className="sm:col-span-2 rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-4)]">
          <p className="admin-label mb-2">Mots-clés ({selectedKeywords.size})</p>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
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

        <div className="sm:col-span-2 rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-4)]">
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
                <div key={slug} className="flex items-center gap-2 text-[length:var(--text-admin-xs)]">
                  <span className="w-32 truncate">{slug}</span>
                  <div className="flex-1 bg-[color:var(--color-admin-border)] rounded-full h-1.5">
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

      <div className="admin-filters-actions">
        <button type="button" onClick={() => setStep(4)} className="admin-button-ghost">
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
    { n: 5, label: "Revue" },
  ];

  return (
    <div className="space-y-[var(--space-admin-6)]">
      {/* Progress */}
      <nav aria-label="Étapes du wizard" className="flex items-center gap-0">
        {steps.map((s, i) => (
          <div key={s.n} className="flex items-center flex-1">
            <button
              type="button"
              onClick={() => step > s.n && setStep(s.n)}
              disabled={step <= s.n}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[length:var(--text-admin-xs)] font-bold transition-all ${
                step > s.n
                  ? "bg-green-500 text-white cursor-pointer"
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
                className={`mx-2 flex-1 h-0.5 transition-all ${
                  step > s.n ? "bg-green-400" : "bg-[color:var(--color-admin-border)]"
                }`}
              />
            )}
          </div>
        ))}
      </nav>

      {/* Step content */}
      <div>
        {step === 1 && step1}
        {step === 2 && step2}
        {step === 3 && step3}
        {step === 4 && step4}
        {step === 5 && step5}
      </div>
    </div>
  );
}
