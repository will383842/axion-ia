// Grille À PLAT du catalogue des formations IA en entreprise (landing
// /formations/entreprise). Server Component pur (zéro JS client). Décision Will
// 2026-07-05 : PAS de tri/regroupement par durée — une seule grille, la durée
// est un badge affiché DANS chaque carte. Chaque carte est cliquable → fiche
// détail `/formations/{slugFr}`. AUCUN prix en dur : dérivé de la matrice
// (pricing.ts) via les helpers du catalogue.
//
// Design : accent de gamme (barre colorée), bénéfice client mis en avant
// (l'accroche), prix « à partir de » lisible, hover lift.

import { ArrowRight, Clock, Star } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/routing";
import {
  FORMATIONS_V2,
  getFormationV2EntryPrice,
  type FormationV2,
} from "@/content/formations/catalog-v2";
import { formatAmount, type FormationDuree, type FormationGamme } from "@/content/pricing";

// Libellé durée lisible affiché dans chaque carte (la durée « en clair »,
// exigence Will) — dérivé de l'enum `FormationDuree`.
const DUREE_LABEL: Record<FormationDuree, string> = {
  "4h": "4 heures",
  "1j": "1 jour",
  "2j": "2 jours",
  "3j": "3 jours et +",
};

// Gamme → libellé court + accent visuel (barre + pastille), aligné catalog-v2-meta.
const GAMME_STYLE: Record<FormationGamme, { label: string; pill: string; bar: string }> = {
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

function FormationCard({ f, locale }: { f: FormationV2; locale: Locale }) {
  const price = getFormationV2EntryPrice(f);
  // formatAmount renvoie déjà « … € HT » (ne PAS ré-ajouter « HT »).
  const priceLabel = price !== undefined ? formatAmount(price, locale) : "Sur devis";
  const gamme = GAMME_STYLE[f.gamme];

  return (
    <li>
      <Link
        href={`/formations/${f.slugFr}` as never}
        data-cta={`formation-card-${f.slugFr}`}
        className="border-border hover:border-terracotta hover:shadow-card group bg-paper relative flex h-full flex-col overflow-hidden rounded-2xl border transition duration-200 hover:-translate-y-0.5"
      >
        {/* Barre d'accent de gamme (pep's visuel) */}
        <span aria-hidden="true" className={cn("block h-1.5 w-full", gamme.bar)} />

        <div className="flex h-full flex-col p-6">
          {/* Badges : gamme + durée (la durée est TOUJOURS visible dans la carte) */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-tight",
                gamme.pill,
              )}
            >
              {gamme.label}
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

          {/* Titre + bénéfice client (l'accroche, mise en avant) */}
          <h3 className="text-fg text-lg leading-snug font-semibold tracking-tight">{f.titreFr}</h3>
          <p className="text-fg mt-2 text-[15px] leading-relaxed font-medium">{f.accrocheFr}</p>

          {/* Pied : prix « à partir de » + CTA carte */}
          <div className="border-border/70 mt-5 flex items-end justify-between gap-3 border-t pt-4">
            <span className="text-fg">
              <span className="text-fg-muted block text-[11px] tracking-tight uppercase">
                À partir de
              </span>
              <span className="text-lg font-semibold tracking-tight">{priceLabel}</span>
            </span>
            <span className="bg-terracotta-soft text-terracotta-deep group-hover:bg-terracotta group-hover:text-mocha-fg inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold transition">
              Voir la formation
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
}

export function FormationsCatalogueGrid({ locale }: { locale: Locale }) {
  return (
    <ul role="list" className="xs:grid-cols-2 grid grid-cols-1 gap-5 lg:grid-cols-3">
      {FORMATIONS_V2.map((f) => (
        <FormationCard key={f.id} f={f} locale={locale} />
      ))}
    </ul>
  );
}
