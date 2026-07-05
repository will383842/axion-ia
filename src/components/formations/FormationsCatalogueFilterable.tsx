"use client";
// use-client: filtre interactif (useState) durée + thème sur la grille catalogue.
// Data-in : les items sont calculés CÔTÉ SERVEUR (page) et passés en props slim
// (prix déjà formaté) → le catalogue catalog-v2 (~1600 lignes) reste hors bundle
// client. Empreinte JS minime (17 items + logique de filtre).

import { useMemo, useState, type ReactNode } from "react";
import { ArrowRight, Clock, Star } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type SlimGamme = "ia-standard" | "agents-automatisations" | "claude";
export type SlimDuree = "4h" | "1j" | "2j" | "3j";

export interface SlimFormation {
  slugFr: string;
  titreFr: string;
  accrocheFr: string;
  gamme: SlimGamme;
  duree: SlimDuree;
  featured: boolean;
  priceLabel: string;
}

const DUREE_LABEL: Record<SlimDuree, string> = {
  "4h": "4 heures",
  "1j": "1 jour",
  "2j": "2 jours",
  "3j": "3 jours et +",
};

const GAMME_STYLE: Record<SlimGamme, { label: string; pill: string; bar: string }> = {
  "ia-standard": {
    label: "IA",
    pill: "bg-terracotta-soft text-terracotta-deep",
    bar: "bg-terracotta",
  },
  "agents-automatisations": {
    label: "Agents & auto",
    pill: "bg-sage-soft text-fg",
    bar: "bg-sage",
  },
  claude: { label: "Claude", pill: "bg-primary-soft text-primary", bar: "bg-primary" },
};

const DUREE_ORDER: readonly SlimDuree[] = ["4h", "1j", "2j", "3j"];
const GAMME_ORDER: readonly SlimGamme[] = ["ia-standard", "agents-automatisations", "claude"];

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "focus-visible:ring-terracotta inline-flex items-center rounded-full border px-4 py-2 text-[13px] font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        active
          ? "bg-terracotta text-mocha-fg border-terracotta shadow-cta-terracotta"
          : "bg-paper text-fg-soft border-border hover:border-terracotta hover:text-terracotta",
      )}
    >
      {children}
    </button>
  );
}

export function FormationsCatalogueFilterable({
  items,
  isFr,
}: {
  items: readonly SlimFormation[];
  isFr: boolean;
}) {
  const [duree, setDuree] = useState<SlimDuree | null>(null);
  const [gamme, setGamme] = useState<SlimGamme | null>(null);

  const filtered = useMemo(
    () =>
      items.filter((f) => (duree ? f.duree === duree : true) && (gamme ? f.gamme === gamme : true)),
    [items, duree, gamme],
  );

  return (
    <div>
      {/* Barre de filtres — chips segmentés, accent terracotta sur l'actif */}
      <div className="mb-8 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-fg-muted mr-2 w-14 shrink-0 text-[11px] font-semibold tracking-[0.14em] uppercase">
            {isFr ? "Durée" : "Duration"}
          </span>
          <FilterChip active={duree === null} onClick={() => setDuree(null)}>
            {isFr ? "Toutes" : "All"}
          </FilterChip>
          {DUREE_ORDER.map((d) => (
            <FilterChip key={d} active={duree === d} onClick={() => setDuree(d)}>
              {DUREE_LABEL[d]}
            </FilterChip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-fg-muted mr-2 w-14 shrink-0 text-[11px] font-semibold tracking-[0.14em] uppercase">
            {isFr ? "Thème" : "Theme"}
          </span>
          <FilterChip active={gamme === null} onClick={() => setGamme(null)}>
            {isFr ? "Tous" : "All"}
          </FilterChip>
          {GAMME_ORDER.map((g) => (
            <FilterChip key={g} active={gamme === g} onClick={() => setGamme(g)}>
              {GAMME_STYLE[g].label}
            </FilterChip>
          ))}
        </div>
      </div>

      {/* Compteur */}
      <p className="text-fg-muted mb-5 text-[13px]" aria-live="polite">
        {filtered.length}{" "}
        {isFr
          ? `formation${filtered.length > 1 ? "s" : ""} affichée${filtered.length > 1 ? "s" : ""}`
          : `training${filtered.length > 1 ? "s" : ""} shown`}
      </p>

      {/* Grille */}
      <ul role="list" className="xs:grid-cols-2 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {filtered.map((f) => {
          const g = GAMME_STYLE[f.gamme];
          return (
            <li key={f.slugFr}>
              <Link
                href={`/formations/${f.slugFr}` as never}
                data-cta={`formation-card-${f.slugFr}`}
                className="shadow-subtle hover:shadow-elevated group bg-paper relative flex h-full flex-col overflow-hidden rounded-2xl transition duration-200 hover:-translate-y-1"
              >
                <span aria-hidden="true" className={cn("block h-1.5 w-full", g.bar)} />
                <div className="flex h-full flex-col p-6">
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-tight",
                        g.pill,
                      )}
                    >
                      {g.label}
                    </span>
                    <span className="text-fg-soft border-border inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-tight">
                      <Clock aria-hidden="true" className="h-3 w-3" />
                      {DUREE_LABEL[f.duree]}
                    </span>
                    {f.featured ? (
                      <span className="text-terracotta-deep bg-terracotta-soft ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-tight">
                        <Star aria-hidden="true" className="h-3 w-3 fill-current" />À la une
                      </span>
                    ) : null}
                  </div>
                  <h3 className="text-fg text-lg leading-snug font-semibold tracking-tight">
                    {f.titreFr}
                  </h3>
                  <p className="text-fg mt-2 text-[15px] leading-relaxed font-medium">
                    {f.accrocheFr}
                  </p>
                  <div className="border-border/70 mt-5 flex items-end justify-between gap-3 border-t pt-4">
                    <span className="text-fg">
                      <span className="text-fg-muted block text-[11px] tracking-tight uppercase">
                        {isFr ? "À partir de" : "From"}
                      </span>
                      <span className="text-lg font-semibold tracking-tight">{f.priceLabel}</span>
                    </span>
                    <span className="bg-terracotta-soft text-terracotta-deep group-hover:bg-terracotta group-hover:text-mocha-fg inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold transition">
                      {isFr ? "Voir la formation" : "View training"}
                      <ArrowRight
                        aria-hidden="true"
                        className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                      />
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
