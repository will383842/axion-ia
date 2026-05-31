/**
 * AuditAudience — « À qui s'adressent nos audits ? » : 3 cards par taille
 * d'entreprise, différenciées par durée + ampleur + prix (Server Component).
 *
 * Refonte 2026-05-31 (Will) — chaque segment doit se reconnaître immédiatement,
 * sans redondance entre TPE / PME / ETI-grandes :
 *   - TPE/artisans/commerçants : 1 journée sur place (prix fixe) ; plusieurs
 *     jours possibles selon l'activité → sur devis.
 *   - PME : de 2 jours à plusieurs semaines, à partir d'un prix d'entrée ;
 *     d'une tâche précise à une stratégie globale.
 *   - ETI & grandes entreprises : de 2 jours à plusieurs mois + accompagnement
 *     dans la durée ; du chantier ciblé à la stratégie IA du groupe (sur devis).
 *
 * Prix dérivés de la SSOT pricing.ts (price-gate OK). Zéro JS. FR canonique —
 * EN = miroir (locale 301→FR, règle Will 2026-05-16).
 */

import type { ReactNode } from "react";
import { Store, Building, Building2, Clock, ArrowRight, type LucideIcon } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { ZoomableImage } from "@/components/marketing/ZoomableImage";
import { AUDIT_TIERS, getTierById, formatAmount } from "@/content/pricing";

interface AudienceCard {
  readonly icon: LucideIcon;
  readonly labelFr: string;
  readonly labelEn: string;
  readonly descFr: string;
  readonly descEn: string;
  readonly durationFr: string;
  readonly durationEn: string;
  readonly priceFr: string;
  readonly priceEn: string;
  readonly scopeFr: string;
  readonly scopeEn: string;
  readonly ctaHref: string;
  readonly ctaFr: string;
  readonly ctaEn: string;
  readonly track: string;
}

export interface AuditAudienceProps {
  readonly isFr: boolean;
}

export function AuditAudience({ isFr }: AuditAudienceProps): ReactNode {
  // Ancres prix dérivées du SSOT (TPE = prix fixe présentiel ; PME/ETI = prix
  // d'entrée Ciblé). Compact, sans « HT » (ajouté dans le libellé).
  const loc = isFr ? "fr" : "en";
  const tpePrice = formatAmount(getTierById(AUDIT_TIERS, "audit-flash").priceFlat!, loc, {
    compact: true,
  });
  const entryFrom = formatAmount(getTierById(AUDIT_TIERS, "audit-cible").priceMin!, loc, {
    compact: true,
  });

  const cards: ReadonlyArray<AudienceCard> = [
    {
      icon: Store,
      labelFr: "TPE, artisans & commerçants",
      labelEn: "Small businesses, artisans & retailers",
      descFr:
        "Indépendant ou petite équipe ? On audite toute votre activité sur place et on repère, concret, tout ce que l'IA peut vous faire gagner.",
      descEn:
        "Independent or small team? We audit your whole activity on site and pinpoint, concretely, everything AI can save you.",
      durationFr: "Généralement 1 journée, sur place",
      durationEn: "Usually 1 day, on site",
      priceFr: `${tpePrice}`,
      priceEn: `${tpePrice}`,
      scopeFr: "Plusieurs jours selon votre activité : sur devis.",
      scopeEn: "Several days depending on your activity: on quote.",
      ctaHref: "/appel",
      ctaFr: "Réserver l'audit IA",
      ctaEn: "Book the AI audit",
      track: "audit_audience_tpe",
    },
    {
      icon: Building,
      labelFr: "PME",
      labelEn: "SME",
      descFr:
        "Vous grandissez, plusieurs services sont concernés ? On cible une fonction précise ou on cartographie toute l'organisation, selon votre ambition.",
      descEn:
        "Growing, several departments involved? We focus on one function or map the whole organisation, depending on your ambition.",
      durationFr: "De 2 jours à plusieurs semaines",
      durationEn: "From 2 days to several weeks",
      priceFr: `À partir de ${entryFrom}`,
      priceEn: `From ${entryFrom}`,
      scopeFr: "Une tâche précise, un service entier ou une stratégie IA globale.",
      scopeEn: "A precise task, a whole department or a global AI strategy.",
      ctaHref: "/contact",
      ctaFr: "Demander un devis",
      ctaEn: "Request a quote",
      track: "audit_audience_pme",
    },
    {
      icon: Building2,
      labelFr: "ETI & grandes entreprises",
      labelEn: "Mid-caps & large enterprises",
      descFr:
        "Multi-sites, multi-métiers, enjeux de gouvernance et de conformité ? Audit transverse et stratégie IA à l'échelle du groupe, sur le long terme.",
      descEn:
        "Multi-site, multi-business, governance and compliance stakes? A transverse audit and group-wide AI strategy, for the long run.",
      durationFr: "De 2 jours à plusieurs mois · accompagnement dans la durée",
      durationEn: "From 2 days to several months · long-term support",
      priceFr: `À partir de ${entryFrom} · sur devis`,
      priceEn: `From ${entryFrom} · on quote`,
      scopeFr: "Du chantier ciblé à la stratégie IA de tout le groupe.",
      scopeEn: "From a focused workstream to the whole group's AI strategy.",
      ctaHref: "/contact",
      ctaFr: "Demander un devis",
      ctaEn: "Request a quote",
      track: "audit_audience_eti",
    },
  ];

  return (
    <Section tone="canvas" className="py-16 sm:py-20 lg:py-24">
      {/* Header 2 colonnes — H2 grande taille à gauche, image des profils d'audit
          IA par taille à droite (Will 2026-05-31). */}
      <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
        <div>
          <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
            <span
              aria-hidden="true"
              className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
            />
            {isFr ? "Par taille d'entreprise" : "By company size"}
          </p>
          <h2 className="text-fg mt-5 text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight">
            {isFr ? "À qui s'adressent" : "Who are"}
            <span
              className="text-terracotta mx-2 italic"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {isFr ? "nos audits IA" : "our AI audits for"}
            </span>
            {isFr ? " ?" : "?"}
          </h2>
          <p className="text-fg-soft mt-6 max-w-xl text-lg leading-relaxed">
            {isFr
              ? "Quelle que soit votre taille, on audite votre entreprise en détail, avec rigueur et minutie — tout en présentiel. La durée et le périmètre de l'audit IA s'adaptent : d'une journée pour une TPE à plusieurs mois pour un groupe."
              : "Whatever your size, we audit your company in detail, rigorously and meticulously — fully on site. The AI audit's duration and scope adapt: from one day for a micro-business to several months for a group."}
          </p>
        </div>

        <ZoomableImage
          src="/illustrations/audit-segments-entreprise-v2.webp"
          alt={
            isFr
              ? "Audit IA en entreprise Axion-IA par taille : TPE, artisans et commerçants (1 journée sur site), PME (de 2 jours à plusieurs semaines), ETI et grandes entreprises (multi-sites, accompagnement long terme) — durée, prix et périmètre adaptés à chaque profil."
              : "Axion-IA enterprise AI audit by company size: small businesses, artisans and retailers (1 on-site day), SMEs (2 days to several weeks), mid-caps and large enterprises (multi-site, long-term support) — duration, price and scope tailored to each profile."
          }
          width={1536}
          height={1024}
          sizes="(max-width: 1024px) 92vw, 720px"
          unoptimized
          zoomLabel={isFr ? "Agrandir" : "Enlarge"}
          figureClassName="border-border shadow-card overflow-hidden rounded-2xl border"
        />
      </div>

      <ul className="mt-14 grid list-none gap-6 p-0 md:grid-cols-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <li key={c.track} className="h-full">
              <article className="group border-border bg-paper shadow-subtle hover:border-terracotta/50 hover:shadow-card flex h-full flex-col overflow-hidden rounded-3xl border transition">
                <span aria-hidden="true" className="bg-terracotta block h-1.5 w-full" />
                <div className="flex flex-1 flex-col p-7">
                  <span className="bg-terracotta-soft text-terracotta-deep mb-5 flex h-14 w-14 items-center justify-center rounded-2xl">
                    <Icon aria-hidden="true" className="h-7 w-7" strokeWidth={1.75} />
                  </span>
                  <h3 className="text-fg text-xl leading-snug font-semibold tracking-tight">
                    {isFr ? c.labelFr : c.labelEn}
                  </h3>
                  <p className="text-fg-soft mt-3 text-[14.5px] leading-relaxed">
                    {isFr ? c.descFr : c.descEn}
                  </p>

                  {/* Durée + prix + ampleur — différenciation par segment */}
                  <div className="border-border mt-5 flex flex-col gap-2 border-t pt-5">
                    <p className="text-fg flex items-start gap-2 text-[13.5px] leading-snug font-medium">
                      <Clock
                        aria-hidden="true"
                        className="text-terracotta-deep mt-0.5 h-4 w-4 shrink-0"
                        strokeWidth={2}
                      />
                      {isFr ? c.durationFr : c.durationEn}
                    </p>
                    <p className="text-terracotta-deep bg-terracotta-soft/40 border-terracotta/30 inline-flex w-fit items-center rounded-full border px-3 py-1 text-[12.5px] font-bold">
                      {isFr ? c.priceFr : c.priceEn}
                    </p>
                    <p className="text-fg-muted text-[12.5px] leading-snug">
                      {isFr ? c.scopeFr : c.scopeEn}
                    </p>
                  </div>

                  <Cta
                    href={c.ctaHref}
                    variant="terracotta"
                    shape="pill"
                    className="mt-6 w-fit"
                    track={c.track}
                  >
                    {isFr ? c.ctaFr : c.ctaEn}
                    <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </Cta>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
