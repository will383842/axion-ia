// Server Component — carte d'une formation du catalogue V2 (gated derrière le
// flag OF par les pages appelantes). Lien vers /formations/[slug]. Prix dérivé
// de la matrice (pricing.ts) — jamais en dur. Contenu 100 % FR.

import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { type FormationV2, getFormationV2EntryPrice } from "@/content/formations/catalog-v2";
import { getDureeMeta, getGammeMeta } from "@/content/formations/catalog-v2-meta";
import { formatAmount } from "@/content/pricing";

interface Props {
  formation: FormationV2;
  /** Locale courante — préfixe l'URL (évite un 307 du proxy localePrefix:always). */
  locale: string;
  /** Affiche le badge de gamme (utile sur les pages par durée, pas sur la page gamme). */
  showGamme?: boolean;
  /** Affiche le badge de durée (utile sur les pages par gamme). */
  showDuree?: boolean;
}

export function FormationCardV2({
  formation,
  locale,
  showGamme = true,
  showDuree = true,
}: Props): ReactNode {
  const duree = getDureeMeta(formation.duree);
  const gamme = getGammeMeta(formation.gamme);
  const entryPrice = getFormationV2EntryPrice(formation);
  const priceLabel = entryPrice ? `à partir de ${formatAmount(entryPrice, "fr")}` : "Sur devis";

  return (
    <a
      href={`/${locale}/formations/${formation.slugFr}`}
      className="group border-border-strong bg-paper hover:border-terracotta hover:shadow-card relative flex h-full flex-col rounded-3xl border p-6 transition-all sm:p-7"
    >
      {/* Badges durée / gamme / à la une */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {showDuree ? (
          <span className="border-border text-fg-muted rounded-full border px-2.5 py-1 text-[11px] font-semibold">
            {duree.shortFr}
          </span>
        ) : null}
        {showGamme && gamme.thematique ? (
          <span className="bg-sage-soft text-sage rounded-full px-2.5 py-1 text-[11px] font-semibold">
            {gamme.labelFr}
          </span>
        ) : null}
        {formation.featured ? (
          <span className="bg-terracotta-soft text-terracotta-deep rounded-full px-2.5 py-1 text-[11px] font-semibold">
            <span aria-hidden="true">★</span> À la une
          </span>
        ) : null}
      </div>

      <h3 className="text-fg text-xl leading-tight font-semibold tracking-tight">
        {formation.titreFr}
      </h3>
      <p className="text-fg-soft mt-2 text-[15px] leading-relaxed">{formation.accrocheFr}</p>

      {formation.prerequisFr ? (
        <p className="text-fg-muted mt-3 text-[12px] leading-snug">
          Pré-requis : {formation.prerequisFr}
        </p>
      ) : null}

      {/* Prix + CTA */}
      <div className="mt-auto flex items-end justify-between gap-3 pt-6">
        <p className="text-fg text-base font-semibold">{priceLabel}</p>
        <span className="text-terracotta group-hover:text-terracotta-deep inline-flex items-center gap-1 text-sm font-semibold">
          Voir le programme
          <ArrowRight
            aria-hidden="true"
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
          />
        </span>
      </div>
    </a>
  );
}
