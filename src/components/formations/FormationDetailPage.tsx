// Server Component — fiche détail d'UNE formation du catalogue V2.
//
// Mise en page CALQUÉE sur les pages détail un-à-un (`InterventionDetailPage`,
// ex. /interventions/dirigeant-vision-strategique) — décision Will 2026-06-12 :
// même grammaire visuelle (Hero halo-warm → Programme → Objectifs → 4 bénéfices
// → ContactBand → FAQ → CTA dark), mêmes sous-composants partagés
// (`InterventionSchedule`, `InterventionBenefitsGrid`, `InterventionFaqList`).
//
// Spécificités FORMATION conservées (que le un-à-un n'a pas) :
//   1. Programme MULTI-JOURS (une timeline par journée du `programme`).
//   2. Tranches de PRIX par effectif (un même programme, tarif dégressif).
//
// Alimentée par `FormationV2` (catalog-v2). Contenu 100 % FR. AUCUN prix en dur
// (matrice pricing.ts). ZÉRO mention Qualiopi côté public (décision Will 2026-06-11).

import type { ReactNode } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  GraduationCap,
  Mail,
  Phone,
  Sparkles,
  Target,
  Users,
} from "lucide-react";

import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { ContactBand } from "@/components/sections/ContactBand";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { LocalCoverageSection } from "@/components/sections/LocalCoverageSection";
import { RelatedKnowledge } from "@/components/services/RelatedKnowledge";
import {
  InterventionBenefitsGrid,
  type InterventionBenefit,
} from "@/components/sections/intervention-parts/InterventionBenefitsGrid";
import { InterventionFaqList } from "@/components/sections/intervention-parts/InterventionFaqList";
import {
  InterventionSchedule,
  type InterventionScheduleItem,
} from "@/components/sections/intervention-parts/InterventionSchedule";
import {
  type FormationV2,
  FORMATIONS_V2,
  getFormationV2Brackets,
  getFormationV2EntryPrice,
  getFormationV2Price,
} from "@/content/formations/catalog-v2";
import {
  formationDureeIso,
  getDureeMeta,
  getGammeMeta,
} from "@/content/formations/catalog-v2-meta";
import { findBookableBySlug } from "@/content/booking-catalog";
import { formatAmount, type FormationBracket } from "@/content/pricing";
import { buildCourseJsonLd, buildFaqJsonLd, buildHowToJsonLd, buildServiceJsonLd } from "@/lib/seo";

const TIGHT_X = "lg:px-6 xl:px-10";

/** « 2-15 » → « 2 à 15 personnes ». */
function bracketLabel(b: FormationBracket): string {
  const parts = b.split("-");
  const lo = parts[0] ?? "";
  const hi = parts[1] ?? "";
  return `${lo} à ${hi} personnes`;
}

interface Props {
  formation: FormationV2;
  locale: Locale;
}

export function FormationDetailPage({ formation: f, locale }: Props): ReactNode {
  const isFr = locale === "fr";
  const gamme = getGammeMeta(f.gamme);
  const duree = getDureeMeta(f.duree);
  const path = `/formations/${f.slugFr}`;
  const entryPrice = getFormationV2EntryPrice(f);
  const brackets = getFormationV2Brackets(f);

  // ── Réservabilité calendrier — dérivée du SSOT booking-catalog (même logique
  //    que les pages détail un-à-un). Les formations 4h/1j/2j sont réservables
  //    directement (deep-link `?intervention=<slug>` → calendrier pré-sélectionné) ;
  //    les 3 jours sont « sur devis » (bookable:false) → on bascule sur l'appel.
  const isBookable = Boolean(findBookableBySlug(f.slugFr));
  const reserveHref = `/reserver?intervention=${f.slugFr}`;

  // ── Bandeau prix + effectif (hero) ───────────────────────────────────────────
  const priceLabel =
    typeof entryPrice === "number"
      ? `À partir de ${formatAmount(entryPrice, "fr")} HT`
      : "Sur devis";
  const los = brackets
    .map((b) => Number.parseInt(b.split("-")[0] ?? "", 10))
    .filter((n) => Number.isFinite(n));
  const his = brackets
    .map((b) => Number.parseInt(b.split("-")[1] ?? "", 10))
    .filter((n) => Number.isFinite(n));
  const minLo = los.length ? Math.min(...los) : 0;
  const maxHi = his.length ? Math.max(...his) : 0;
  const groupSizeLabel =
    maxHi > 0 ? `${minLo} à ${maxHi} personnes · intra-entreprise` : "Intra-entreprise, sur site";

  // 3 chips ROI — vrais pour toutes les formations (parité hero un-à-un).
  const heroChips = [
    "Sur vos vrais outils",
    "Intra-entreprise, sur site",
    "Opérationnel·le dès le lendemain",
  ];

  // ── Bénéfices — 4 cartes dérivées des champs formation (parité « 4 bénéfices ») ─
  const benefits: ReadonlyArray<InterventionBenefit> = [
    {
      icon: Users,
      titleFr: "Pour qui",
      titleEn: "Who it's for",
      bodyFr: f.publicViseFr,
      bodyEn: f.publicViseFr,
    },
    {
      icon: Clock,
      titleFr: "Le temps que vous gagnez",
      titleEn: "Time you save",
      bodyFr: f.equationTempsFr,
      bodyEn: f.equationTempsFr,
    },
    {
      icon: Target,
      titleFr: "Le bénéfice direct",
      titleEn: "Direct benefit",
      bodyFr: f.beneficeDirigeantFr,
      bodyEn: f.beneficeDirigeantFr,
    },
    {
      icon: GraduationCap,
      titleFr: "Pré-requis",
      titleEn: "Prerequisites",
      bodyFr: f.prerequisFr ?? "Aucun — la formation démarre à votre niveau.",
      bodyEn: f.prerequisFr ?? "None — the training starts at your level.",
    },
  ];

  // ── FAQ — mappée au sous-composant partagé ───────────────────────────────────
  const faqItems = f.faqs.map((q) => ({
    qFr: q.question,
    qEn: q.question,
    aFr: q.reponse,
    aEn: q.reponse,
  }));

  // ── JSON-LD (inchangé — Course + Service + FAQ + HowTo) ───────────────────────
  const serviceJsonLd = buildServiceJsonLd({
    locale,
    path,
    name: `${f.titreFr} · Axion-IA`,
    description: f.accrocheFr,
    serviceType: "AI training",
    area: "Worldwide",
  });
  const courseJsonLd = buildCourseJsonLd({
    locale,
    path,
    name: f.titreFr,
    description: f.accrocheFr,
    courseMode: ["Onsite"],
    duration: formationDureeIso(f.duree),
    audienceType:
      "Équipes, dirigeants et collaborateurs opérationnels (TPE, PME, ETI, grandes entreprises)",
    about: "IA opérationnelle (ChatGPT, Claude, Mistral, Copilot, agents IA, automatisations)",
    ...(typeof entryPrice === "number" ? { priceEurHt: entryPrice } : {}),
  });
  const faqJsonLd = buildFaqJsonLd({
    items: f.faqs.map((q) => ({ question: q.question, answer: q.reponse })),
  });
  const programmeSteps = f.programme.flatMap((s) => s.steps).filter((st) => st.titre !== "Pause");
  const howToJsonLd =
    programmeSteps.length > 0
      ? buildHowToJsonLd({
          locale,
          path,
          name: `Comment se déroule ${f.titreFr}`,
          description: f.accrocheFr,
          steps: programmeSteps.map((st) => ({ name: st.titre, text: st.titre })),
        })
      : null;

  // ── Maillage — formations sœurs (même gamme, puis même durée) ────────────────
  const siblings = FORMATIONS_V2.filter(
    (x) => x.id !== f.id && (x.gamme === f.gamme || x.duree === f.duree),
  ).slice(0, 4);

  const breadcrumbItems = [
    { href: "/formations", label: "Formations IA" },
    { href: `/formations/duree/${duree.slug}`, label: duree.labelFr },
    { href: path, label: f.titreFr },
  ];

  const multiDay = f.programme.length > 1;

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      {/* HERO — calqué sur InterventionDetailPage (halo-warm, prix chip, chips ROI). */}
      <section className="bg-halo-warm relative overflow-hidden py-12 sm:py-16 lg:py-20">
        <Container className={cn("relative", TIGHT_X)}>
          <div className="max-w-3xl">
            <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
              <span
                aria-hidden="true"
                className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
              />
              {gamme.labelFr} · {duree.heuresFr}
            </p>

            <h1 className="display-editorial text-fg mt-5">{f.h1Fr}</h1>

            <p className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
              {f.accrocheFr}
            </p>

            {/* Bandeau prix + effectif */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <span className="bg-terracotta text-mocha-fg rounded-full px-4 py-1.5 text-base font-bold tracking-tight tabular-nums shadow-[0_4px_12px_-4px_rgba(0,0,0,0.15)]">
                {priceLabel}
              </span>
              <span className="text-fg-soft text-[13px]">{groupSizeLabel}</span>
            </div>

            {/* 3 chips bénéfice ROI */}
            <ul className="mt-5 flex flex-wrap gap-2">
              {heroChips.map((chip) => (
                <li
                  key={chip}
                  className="bg-terracotta-soft text-terracotta-deep border-terracotta/25 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold tracking-tight"
                >
                  <ArrowRight aria-hidden="true" className="h-3 w-3" strokeWidth={3} />
                  {chip}
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              {isBookable ? (
                <>
                  <Cta
                    href={reserveHref}
                    size="lg"
                    className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep shadow-cta-terracotta"
                  >
                    <CalendarDays aria-hidden="true" className="h-4 w-4" />
                    Poser une option sur le calendrier
                  </Cta>
                  <Cta href="/appel" variant="outline" size="lg">
                    <Phone aria-hidden="true" className="h-4 w-4" />
                    Réserver un appel
                  </Cta>
                </>
              ) : (
                <>
                  <Cta
                    href="/appel"
                    size="lg"
                    className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep shadow-cta-terracotta"
                  >
                    <Phone aria-hidden="true" className="h-4 w-4" />
                    Réserver un appel
                  </Cta>
                  <Cta href="/contact" variant="outline" size="lg">
                    <Mail aria-hidden="true" className="h-4 w-4" />
                    Nous écrire
                  </Cta>
                </>
              )}
            </div>
          </div>
        </Container>
      </section>

      {/* PROGRAMME — juste après le hero (parité un-à-un). Multi-jours : une
          timeline par journée. */}
      <Section
        tone="paper"
        eyebrow={multiDay ? `Programme · ${duree.heuresFr}` : `Programme type · ${duree.heuresFr}`}
        title={multiDay ? "Le programme" : "Le détail"}
        titleEm={multiDay ? "de la formation" : "de votre journée"}
        description="Programme cadré en amont par appel. La trame reste celle-ci, le contenu s'adapte à vos outils, votre secteur et vos cas réels."
        contentClassName={TIGHT_X}
      >
        <div className="space-y-12">
          {f.programme.map((sectionDay, idx) => {
            const items: ReadonlyArray<InterventionScheduleItem> = sectionDay.steps.map((s) => ({
              time: s.temps ?? "",
              titleFr: s.titre,
              titleEn: s.titre,
            }));
            return (
              <div key={idx}>
                {multiDay ? (
                  <p className="text-terracotta-deep mb-5 text-center text-[13px] font-bold tracking-[0.16em] uppercase">
                    {sectionDay.titreFr}
                  </p>
                ) : null}
                <InterventionSchedule items={items} isFr={isFr} />
              </div>
            );
          })}
        </div>
      </Section>

      {/* OBJECTIFS PÉDAGOGIQUES — checklist (cœur formation, valeur SEO/pédago). */}
      {f.objectifsFr.length > 0 ? (
        <Section
          eyebrow="Ce que vous obtenez"
          title="Ce que chacun"
          titleEm="saura faire"
          description="À l'issue de la formation, voici les compétences acquises et pratiquées en séance."
          contentClassName={TIGHT_X}
        >
          <ul className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2">
            {f.objectifsFr.map((o) => (
              <li key={o} className="flex items-start gap-3">
                <CheckCircle2
                  aria-hidden="true"
                  className="text-terracotta mt-0.5 h-5 w-5 shrink-0"
                  strokeWidth={2}
                />
                <span className="text-fg-soft text-[15px] leading-relaxed">{o}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* 4 BÉNÉFICES — grille partagée un-à-un. */}
      <Section
        tone="sand"
        eyebrow="Pour vous, concrètement"
        title="4 bénéfices"
        titleEm="concrets"
        description="Pourquoi cette formation, et pour qui — en clair."
        contentClassName={TIGHT_X}
      >
        <InterventionBenefitsGrid items={benefits} isFr={isFr} />
      </Section>

      {/* TRANCHES DE PRIX — spécificité formation : un programme, tarif par effectif. */}
      {brackets.length > 0 ? (
        <Section
          tone="paper"
          eyebrow="Choisissez votre tranche"
          title={brackets.length > 1 ? "Un tarif selon" : "Tarif pour"}
          titleEm={brackets.length > 1 ? "votre effectif" : "votre équipe"}
          description="Programme identique quelle que soit la tranche. Le prix dépend uniquement du nombre de participants présents. Intra-entreprise, dans vos locaux."
        >
          <Container className="max-w-5xl">
            <ul className="grid gap-5 sm:gap-6 lg:grid-cols-2">
              {brackets.map((b, i) => {
                const price = getFormationV2Price(f, b);
                if (typeof price !== "number") return null;
                return (
                  <li key={b} className="relative">
                    {i === 0 && brackets.length > 1 ? (
                      <span className="bg-terracotta text-mocha-fg shadow-subtle absolute -top-3 left-6 z-10 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold tracking-wide uppercase">
                        <Sparkles aria-hidden="true" className="h-3 w-3" />★ Le plus choisi
                      </span>
                    ) : null}
                    <article
                      className={`bg-paper hover:shadow-card relative flex h-full flex-col rounded-3xl border-2 p-7 transition-all lg:p-8 ${
                        i === 0 && brackets.length > 1
                          ? "border-terracotta shadow-card"
                          : "border-border-strong hover:border-terracotta"
                      }`}
                    >
                      <p className="text-fg-muted text-[12px] font-bold tracking-[0.16em] uppercase">
                        {bracketLabel(b)}
                      </p>
                      <p
                        className="text-fg mt-4 text-[clamp(2.5rem,5vw,3.5rem)] leading-none font-medium tracking-tight tabular-nums"
                        style={{ fontFamily: "var(--font-serif)" }}
                      >
                        {formatAmount(price, "fr")}
                      </p>
                      <p className="text-fg-muted mt-1 text-xs">HT</p>
                      <p className="text-fg-soft mt-4 text-base leading-relaxed">
                        {duree.heuresFr} sur site, dans vos locaux. {f.accrocheFr}
                      </p>
                      <div className="mt-auto pt-6">
                        <Cta
                          href={isBookable ? reserveHref : "/appel"}
                          size="lg"
                          className="w-full justify-center"
                        >
                          {isBookable ? "Poser une option" : "Réserver un appel"}
                          <ArrowRight aria-hidden="true" className="h-4 w-4" />
                        </Cta>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          </Container>
        </Section>
      ) : null}

      {/* BANDEAU CONTACT — orientation (parité un-à-un). */}
      <ContactBand
        isFr={isFr}
        eyebrow="Une question sur cette formation ?"
        title="On vous oriente,"
        titleEm="à votre rythme"
        description="Un échange pour comprendre vos équipes et vos objectifs, et vous dire le format qui vous correspond. Sans engagement."
        track="-formation-detail"
      />

      {/* FAQ — accordion partagé un-à-un. */}
      {faqItems.length > 0 ? (
        <Section
          tone="sand"
          eyebrow="FAQ"
          title="Questions"
          titleEm="fréquentes"
          contentClassName={TIGHT_X}
        >
          <InterventionFaqList items={faqItems} isFr={isFr} />
        </Section>
      ) : null}

      {/* MAILLAGE — autres formations. */}
      {siblings.length > 0 ? (
        <Section tone="paper" eyebrow="Autres formations" title="Pour aller" titleEm="plus loin">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {siblings.map((s) => (
              <Link
                key={s.id}
                href={`/formations/${s.slugFr}` as never}
                className="border-border bg-bg hover:border-terracotta hover:shadow-card focus-visible:ring-terracotta flex h-full flex-col rounded-2xl border p-6 transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <p className="text-fg text-[15px] leading-snug font-semibold">{s.titreFr}</p>
                <p className="text-fg-soft mt-2 line-clamp-2 flex-1 text-sm leading-relaxed">
                  {s.accrocheFr}
                </p>
                <span className="text-terracotta-deep mt-4 inline-flex items-center gap-1 text-[13px] font-medium">
                  Découvrir
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
        </Section>
      ) : null}

      {/* COUVERTURE FRANCE + KB — maillage national. */}
      <LocalCoverageSection
        isFr={isFr}
        serviceLabelFr={`La formation « ${f.titreFr} »`}
        serviceLabelEn={`The « ${f.titreFr} » training`}
        serviceSlug="interventions"
        tone="sand"
      />

      <RelatedKnowledge service="interventions-formations" />

      {/* CTA FINAL — bandeau dark (parité un-à-un). */}
      <CtaBlock
        eyebrow="Démarrer"
        title="Former vos équipes"
        titleEm="à l'IA"
        description="Un formateur IA expert intervient sur votre site, sur vos vrais outils. Vos équipes gagnent des heures dès la première session. Aucun engagement avant signature."
        cta={
          <Cta
            href={isBookable ? reserveHref : "/appel"}
            size="lg"
            className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep shadow-cta-terracotta"
          >
            {isBookable ? (
              <CalendarDays aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Phone aria-hidden="true" className="h-4 w-4" />
            )}
            {isBookable ? "Poser une option sur le calendrier" : "Réserver un appel"}
          </Cta>
        }
        tone="dark"
      />

      <JsonLd data={serviceJsonLd} />
      <JsonLd data={courseJsonLd} />
      <JsonLd data={faqJsonLd} />
      {howToJsonLd ? <JsonLd data={howToJsonLd} /> : null}
    </>
  );
}
