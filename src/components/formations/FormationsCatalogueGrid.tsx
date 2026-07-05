// Grille À PLAT du catalogue des 17 formations IA en entreprise (landing
// /formations/entreprise). Server Component pur (zéro JS client). Décision Will
// 2026-07-05 : PAS de tri/regroupement par durée — une seule grille, la durée
// est un badge affiché DANS chaque carte. Chaque carte est cliquable → fiche
// détail `/formations/{slugFr}`. AUCUN prix en dur : dérivé de la matrice
// (pricing.ts) via les helpers du catalogue.

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

// Gamme → libellé court + style de pastille (accent aligné sur catalog-v2-meta).
const GAMME_STYLE: Record<FormationGamme, { label: string; cls: string }> = {
  "ia-standard": { label: "IA", cls: "bg-terracotta-soft text-terracotta-deep" },
  "agents-automatisations": { label: "Agents & auto", cls: "bg-sage-soft text-fg" },
  claude: { label: "Claude", cls: "bg-primary-soft text-primary" },
};

function FormationCard({ f, locale }: { f: FormationV2; locale: Locale }) {
  const price = getFormationV2EntryPrice(f);
  const priceLabel = price !== undefined ? formatAmount(price, locale) : "Sur devis";
  const gamme = GAMME_STYLE[f.gamme];

  return (
    <li>
      <Link
        href={`/formations/${f.slugFr}` as never}
        data-cta={`formation-card-${f.slugFr}`}
        className="border-border hover:border-terracotta hover:shadow-card group bg-paper flex h-full flex-col rounded-2xl border p-6 transition"
      >
        {/* Badges : gamme + durée (la durée est TOUJOURS visible dans la carte) */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-tight",
              gamme.cls,
            )}
          >
            {gamme.label}
          </span>
          <span className="text-fg-soft border-border inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-tight">
            <Clock aria-hidden="true" className="h-3 w-3" />
            {DUREE_LABEL[f.duree]}
          </span>
          {f.featured ? (
            <span className="text-terracotta-deep bg-terracotta-soft inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-tight">
              <Star aria-hidden="true" className="h-3 w-3 fill-current" />À la une
            </span>
          ) : null}
        </div>

        {/* Titre + accroche */}
        <h3 className="text-fg text-lg leading-snug font-semibold tracking-tight">{f.titreFr}</h3>
        <p className="text-fg-soft mt-2 text-sm leading-relaxed">{f.accrocheFr}</p>

        {/* Pied : prix « à partir de » + CTA carte */}
        <div className="border-border/70 mt-5 flex items-end justify-between gap-3 border-t pt-4">
          <span className="text-fg">
            <span className="text-fg-muted block text-[11px] tracking-tight uppercase">
              À partir de
            </span>
            <span className="text-base font-semibold tracking-tight">{priceLabel} HT</span>
          </span>
          <span className="text-terracotta inline-flex items-center gap-1 text-sm font-semibold">
            Voir la formation
            <ArrowRight
              aria-hidden="true"
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
            />
          </span>
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
