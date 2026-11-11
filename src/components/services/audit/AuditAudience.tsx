/**
 * AuditAudience — « À qui s'adressent nos audits IA ? » : 3 cartes par taille
 * d'entreprise (TPE/artisans, PME, ETI/grandes). Server Component.
 *
 * Refonte 2026-05-31 (Will) — 3 cartes (TPE / PME / ETI & grandes) avec, pour
 * chacune : un visuel, le profil, ce que l'IA change, et des CTAs d'action.
 *
 * CTAs (Will 2026-07-07) — deux CTA uniquement partout, plus aucun
 * « Pré-réserver » :
 *   - Les 3 cartes : « Réserver un appel » (/appel) + « Nous écrire » (/contact).
 *   - Les 3 : « Plus d'infos sur le déroulement » → page détail du tier
 *     (/journee-ia, /audit/strategique-pme, /audit/strategique-eti).
 *
 * Server Component pur, zéro JS. Prix via SSOT (jamais en dur). FR canonique —
 * EN = miroir (locale 301→FR, règle Will 2026-05-16).
 */

import type { ReactNode } from "react";
import { ArrowRight, Phone, Mail } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { Link } from "@/i18n/navigation";
import { JOURNEE_IA_TIER, formatTierPrice } from "@/content/pricing";

interface AudienceCard {
  readonly segment: string;
  readonly sizeFr: string;
  readonly sizeEn: string;
  readonly titleFr: string;
  readonly titleEn: string;
  readonly bodyFr: string;
  readonly bodyEn: string;
  /** Métadonnée prix/format affichée au-dessus des CTAs. */
  readonly metaFr: string;
  readonly metaEn: string;
  /** Page détail du tier — « plus d'infos sur le déroulement ». */
  readonly detailHref: string;
}

// R5a (08/11/2026, décision n°7) : la carte TPE présente La Journée IA (prix lu dans
// pricing.ts) ; les audits PME et ETI sont sur devis, sans montant.
const TARIF_JOURNEE = formatTierPrice(JOURNEE_IA_TIER, "fr", { compact: true });
const TARIF_JOURNEE_EN = formatTierPrice(JOURNEE_IA_TIER, "en", { compact: true });

const CARDS: ReadonlyArray<AudienceCard> = [
  {
    segment: "TPE",
    sizeFr: "TPE, artisans & commerçants",
    sizeEn: "Small businesses, artisans & retailers",
    titleFr: "La Journée IA : par où commencer",
    titleEn: "The AI Day: where to start",
    bodyFr:
      "Nous venons chez vous, nous chiffrons avec vos équipes le temps perdu sur les tâches qui reviennent, et nous les formons sur leurs propres dossiers.",
    bodyEn:
      "We come to your company, work out with your teams the time lost on recurring tasks, and train them on their own files.",
    metaFr: `${TARIF_JOURNEE} HT · 1 journée dans votre entreprise`,
    metaEn: `${TARIF_JOURNEE_EN} excl. VAT · 1 day in your company`,
    detailHref: "/journee-ia",
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
    metaFr: "Sur devis",
    metaEn: "On quote",
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
    metaFr: "Sur devis",
    metaEn: "On quote",
    detailHref: "/audit/strategique-eti",
  },
];

function CardCtas({ card, isFr }: { card: AudienceCard; isFr: boolean }): ReactNode {
  return (
    <div className="mt-6 flex flex-col gap-2.5">
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
            <span aria-hidden="true" className="bg-terracotta block h-1.5 w-full shrink-0" />
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
