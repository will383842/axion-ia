/**
 * AuditAudience — « À qui s'adressent nos audits IA ? » : 3 cartes par taille
 * d'entreprise (TPE/artisans, PME, ETI/grandes). Server Component.
 *
 * Refonte 2026-05-31 (Will) — 3 cartes (TPE / PME / ETI & grandes) avec, pour
 * chacune : un visuel, le profil, ce que l'IA change, et des CTAs d'action.
 *
 * CTAs (Will 2026-05-31) :
 *   - TPE : « Pré-réserver l'audit (1 jour) » (→ /audit/flash) en action
 *     principale + « Réserver un appel » (/appel) et « Nous écrire » (/contact)
 *     pour ceux qui préfèrent des renseignements complémentaires. Prix dérivé
 *     SSOT pricing.ts (audit-flash 1190 €).
 *   - PME & ETI/grandes : pas de « devis » — on invite à entrer en contact
 *     (« Réserver un appel » + « Nous écrire »).
 *   - Les 3 : « Plus d'infos sur le déroulement » → page détail du tier
 *     (/audit/flash, /audit/strategique-pme, /audit/strategique-eti).
 *
 * Server Component pur, zéro JS. Prix via SSOT (jamais en dur). FR canonique —
 * EN = miroir (locale 301→FR, règle Will 2026-05-16).
 */

import type { ReactNode } from "react";
import Image from "next/image";
import { ArrowRight, CalendarCheck, Phone, Mail } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { Link } from "@/i18n/navigation";
import { AUDIT_TIERS, formatAmount, getTierById } from "@/content/pricing";

interface AudienceCard {
  readonly segment: string;
  readonly sizeFr: string;
  readonly sizeEn: string;
  readonly titleFr: string;
  readonly titleEn: string;
  readonly bodyFr: string;
  readonly bodyEn: string;
  readonly image: string;
  readonly imageAltFr: string;
  readonly imageAltEn: string;
  /** Métadonnée prix/format affichée au-dessus des CTAs. */
  readonly metaFr: string;
  readonly metaEn: string;
  /** Page détail du tier — « plus d'infos sur le déroulement ». */
  readonly detailHref: string;
  /** TPE uniquement : action de pré-réservation directe. */
  readonly preReserveFr?: string;
  readonly preReserveEn?: string;
  readonly preReserveHref?: string;
}

// Prix d'entrée audit sur place (TPE) — SSOT pricing.ts (audit-flash).
const FLASH_PRICE = formatAmount(getTierById(AUDIT_TIERS, "audit-flash").priceFlat!, "fr", {
  compact: true,
});

// Prix d'entrée audit (PME/ETI) — SSOT pricing.ts (audit-cible priceMin).
const ENTRY_PRICE = formatAmount(getTierById(AUDIT_TIERS, "audit-cible").priceMin!, "fr", {
  compact: true,
});

const CARDS: ReadonlyArray<AudienceCard> = [
  {
    segment: "TPE",
    sizeFr: "TPE, artisans & commerçants",
    sizeEn: "Small businesses, artisans & retailers",
    titleFr: "L'IA accessible, tout de suite",
    titleEn: "AI made accessible, right now",
    bodyFr:
      "Vous portez l'entreprise au quotidien. On identifie 3 à 5 automatisations qui vous libèrent du temps dès la première semaine — devis, relances, administratif.",
    bodyEn:
      "You carry the business day to day. We pinpoint 3 to 5 automations that free up your time from week one — quotes, follow-ups, admin.",
    image: "/images/axion-ia-audit-ia-solutions-artisans-commercants-tpe-pme-eti-banniere.webp",
    imageAltFr: "Audit IA pour TPE, artisans et commerçants",
    imageAltEn: "AI audit for small businesses, artisans and retailers",
    metaFr: `1 journée sur place · ${FLASH_PRICE}`,
    metaEn: `1 full day on site · ${FLASH_PRICE}`,
    detailHref: "/audit/flash",
    preReserveFr: "Pré-réserver l'audit (1 jour)",
    preReserveEn: "Pre-book the audit (1 day)",
    preReserveHref: "/reserver",
  },
  {
    segment: "PME",
    sizeFr: "PME",
    sizeEn: "SMEs",
    titleFr: "Structurer et passer à l'échelle",
    titleEn: "Structure and scale up",
    bodyFr:
      "Vous avez déjà testé quelques outils IA. On structure ce qui marche, on élimine le superflu, et on chiffre les prochains chantiers prioritaires.",
    bodyEn:
      "You've already tried a few AI tools. We structure what works, cut the fluff, and cost the next priority projects.",
    image:
      "/images/axion-ia-automatisation-ia-benefices-concrets-mesurables-durables-banniere.webp",
    imageAltFr: "Audit IA pour PME",
    imageAltEn: "AI audit for SMEs",
    metaFr: `À partir de ${ENTRY_PRICE} · sur devis`,
    metaEn: `From ${ENTRY_PRICE} · on quote`,
    detailHref: "/audit/strategique-pme",
  },
  {
    segment: "ETI",
    sizeFr: "ETI & grandes entreprises",
    sizeEn: "Mid-caps & large enterprises",
    titleFr: "Gouvernance et impact à grande échelle",
    titleEn: "Governance and impact at scale",
    bodyFr:
      "Vous pilotez des enjeux multi-sites. On cartographie l'ensemble, on priorise par ROI, et on cadre la gouvernance IA (AI Act, RGPD, conduite du changement).",
    bodyEn:
      "You steer multi-site challenges. We map everything, prioritise by ROI, and frame AI governance (AI Act, GDPR, change management).",
    image:
      "/images/axion-ia-architecture-groupe-international-consolidation-financiere-rh-banniere.webp",
    imageAltFr: "Audit IA pour ETI et grandes entreprises",
    imageAltEn: "AI audit for mid-caps and large enterprises",
    metaFr: `À partir de ${ENTRY_PRICE} · sur devis`,
    metaEn: `From ${ENTRY_PRICE} · on quote`,
    detailHref: "/audit/strategique-eti",
  },
];

function CardCtas({ card, isFr }: { card: AudienceCard; isFr: boolean }): ReactNode {
  return (
    <div className="mt-6 flex flex-col gap-2.5">
      {/* TPE : action principale de pré-réservation */}
      {card.preReserveHref ? (
        <Cta
          href={card.preReserveHref}
          variant="secondary"
          size="md"
          className="w-full"
          track={`audit-audience-prebook-${card.segment.toLowerCase()}`}
        >
          <CalendarCheck aria-hidden="true" className="h-4 w-4" />
          {isFr ? card.preReserveFr : card.preReserveEn}
        </Cta>
      ) : null}

      {/* Contact — réserver un appel / nous écrire (les 3 cartes).
          Couleurs alignées sur les CTAs du header (Will 2026-05-31) :
          « Réserver un appel » = bleu primary ; « Nous écrire » = ivoire +
          terracotta. */}
      <div className="grid grid-cols-2 gap-2.5">
        <Cta
          href="/appel"
          variant="primary"
          size="sm"
          className="bg-primary text-primary-fg hover:bg-primary-hover w-full"
          track={`audit-audience-call-${card.segment.toLowerCase()}`}
        >
          <Phone aria-hidden="true" className="h-3.5 w-3.5" />
          {isFr ? "Réserver un appel" : "Book a call"}
        </Cta>
        <Cta
          href="/contact"
          variant="outline"
          size="sm"
          className="bg-paper text-terracotta hover:bg-paper/95 w-full"
          track={`audit-audience-contact-${card.segment.toLowerCase()}`}
        >
          <Mail aria-hidden="true" className="h-3.5 w-3.5" />
          {isFr ? "Nous écrire" : "Email us"}
        </Cta>
      </div>

      {/* Plus d'infos sur le déroulement → page détail du tier (les 3 cartes) */}
      <Link
        href={card.detailHref as never}
        className="text-fg-muted hover:text-terracotta-deep mt-1 inline-flex items-center gap-1.5 text-[13px] font-medium underline-offset-2 hover:underline"
      >
        {isFr ? "Plus d'infos sur le déroulement" : "More on how it works"}
        <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

export function AuditAudience({ isFr }: { isFr: boolean }): ReactNode {
  return (
    <Section
      tone="paper"
      eyebrow={isFr ? "À qui s'adressent nos audits IA ?" : "Who are our AI audits for?"}
      title={isFr ? "Un audit adapté à" : "An audit tailored to"}
      titleEm={isFr ? "chaque profil" : "every profile"}
      description={
        isFr
          ? "De l'artisan à l'ETI, on calibre la profondeur de l'audit à votre taille et vos enjeux."
          : "From sole trader to mid-cap, we calibrate the audit depth to your size and challenges."
      }
    >
      <div className="grid gap-6 md:grid-cols-3">
        {CARDS.map((card) => (
          <article
            key={card.segment}
            className="border-border bg-paper shadow-subtle flex flex-col overflow-hidden rounded-2xl border"
          >
            <div className="relative aspect-[16/10] overflow-hidden">
              <Image
                src={card.image}
                alt={isFr ? card.imageAltFr : card.imageAltEn}
                fill
                loading="lazy"
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover"
              />
            </div>
            <div className="flex flex-1 flex-col p-6">
              <span className="text-terracotta-deep text-[12px] font-bold tracking-wide uppercase">
                {isFr ? card.sizeFr : card.sizeEn}
              </span>
              <h3 className="text-fg mt-2 text-lg leading-snug font-semibold tracking-tight">
                {isFr ? card.titleFr : card.titleEn}
              </h3>
              <p className="text-fg-soft mt-2 flex-1 text-[14px] leading-relaxed">
                {isFr ? card.bodyFr : card.bodyEn}
              </p>
              <p className="text-fg-muted mt-4 text-[13px] font-semibold tabular-nums">
                {isFr ? card.metaFr : card.metaEn}
              </p>
              <CardCtas card={card} isFr={isFr} />
            </div>
          </article>
        ))}
      </div>
    </Section>
  );
}
