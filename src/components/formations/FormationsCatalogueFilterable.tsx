"use client";
// use-client: filtre interactif (useState) par CATÉGORIE sur la grille
// catalogue (refonte 2026-07-19 — l'axe durée/gamme disparaît, la durée reste
// un badge par carte). Data-in : les items sont calculés CÔTÉ SERVEUR (page)
// et passés en props slim (prix déjà formaté) → le catalogue catalog-v2 reste
// hors bundle client. Empreinte JS minime (22 items + logique de filtre).

import { useMemo, useState, type ReactNode } from "react";
import { ArrowRight, Clock, Star } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type SlimCategorie = "generale" | "metier" | "secteur" | "seminaire";

export interface SlimFormation {
  slugFr: string;
  titreFr: string;
  accrocheFr: string;
  categorie: SlimCategorie;
  /** « RH », « Santé »… (métiers/secteurs) — badge de carte. */
  axeLabel?: string;
  /** « 4 heures », « 1 journée », « 2 journées · scindable 2×1j ». */
  dureeLabel: string;
  featured: boolean;
  /** Prix déjà formaté côté serveur (porte « € HT ») — ou « Sur devis ». */
  priceLabel: string;
  /** true si le prix est fixe (affichage « Prix groupe » au lieu de « Tarif »). */
  fixedPrice: boolean;
}

const CATEGORIE_STYLE: Record<SlimCategorie, { label: string; pill: string; bar: string }> = {
  generale: {
    label: "Offre générale",
    pill: "bg-terracotta-soft text-terracotta-deep",
    bar: "bg-terracotta",
  },
  metier: { label: "Par métier", pill: "bg-sage-soft text-fg", bar: "bg-sage" },
  secteur: { label: "Par secteur", pill: "bg-primary-soft text-primary", bar: "bg-primary" },
  seminaire: {
    label: "Séminaire",
    pill: "bg-terracotta-soft text-terracotta-deep",
    bar: "bg-terracotta-deep",
  },
};

const CATEGORIE_ORDER: readonly SlimCategorie[] = ["generale", "metier", "secteur", "seminaire"];

const CATEGORIE_FILTER_LABEL: Record<SlimCategorie, string> = {
  generale: "Offres générales",
  metier: "Par métier",
  secteur: "Par secteur d'activité",
  seminaire: "Séminaire",
};

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
  const [categorie, setCategorie] = useState<SlimCategorie | null>(null);

  const filtered = useMemo(
    () => items.filter((f) => (categorie ? f.categorie === categorie : true)),
    [items, categorie],
  );

  return (
    <div>
      {/* Barre de filtres — chips segmentés par catégorie */}
      <div className="mb-8 flex flex-wrap items-center gap-2">
        <span className="text-fg-muted mr-2 shrink-0 text-[11px] font-semibold tracking-[0.14em] uppercase">
          {isFr ? "Catégorie" : "Category"}
        </span>
        <FilterChip active={categorie === null} onClick={() => setCategorie(null)}>
          {isFr ? "Toutes" : "All"}
        </FilterChip>
        {CATEGORIE_ORDER.map((c) => (
          <FilterChip key={c} active={categorie === c} onClick={() => setCategorie(c)}>
            {CATEGORIE_FILTER_LABEL[c]}
          </FilterChip>
        ))}
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
          const c = CATEGORIE_STYLE[f.categorie];
          return (
            <li key={f.slugFr}>
              <Link
                href={`/formations/${f.slugFr}` as never}
                data-cta={`formation-card-${f.slugFr}`}
                className="shadow-subtle hover:shadow-elevated group bg-paper relative flex h-full flex-col overflow-hidden rounded-2xl transition duration-200 hover:-translate-y-1"
              >
                <span aria-hidden="true" className={cn("block h-1.5 w-full", c.bar)} />
                <div className="flex h-full flex-col p-6">
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-tight",
                        c.pill,
                      )}
                    >
                      {f.axeLabel ?? c.label}
                    </span>
                    <span className="text-fg-soft border-border inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-tight">
                      <Clock aria-hidden="true" className="h-3 w-3" />
                      {f.dureeLabel}
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
                        {f.fixedPrice
                          ? isFr
                            ? "Prix groupe"
                            : "Group price"
                          : isFr
                            ? "Tarif"
                            : "Price"}
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
