// Server Component — fiche détail d'UNE formation du catalogue V2.
// Rend le MÊME design que les anciennes fiches collectives (essentielle…) :
// ProductPageTemplate (hero + déroulé + bénéfices + process + métriques + FAQ),
// + DetailHeroSchema (visuel hero), + section tranches de prix, + FormationContactBand,
// + maillage (formations sœurs + couverture nationale + KB).
//
// Alimentée par `FormationV2` (catalog-v2). Contenu 100 % FR. AUCUN prix en dur
// (matrice pricing.ts). ZÉRO mention Qualiopi côté public (décision Will 2026-06-11).

import type { ReactNode } from "react";
import { ArrowRight, Compass, FlaskConical, Lightbulb, Sparkles } from "lucide-react";

import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { DetailHeroSchema } from "@/components/sections/DetailHeroSchema";
import { ProductPageTemplate } from "@/components/sections/ProductPageTemplate";
import { FormationContactBand } from "@/components/services/formation/FormationContactBand";
import { LocalCoverageSection } from "@/components/sections/LocalCoverageSection";
import { RelatedKnowledge } from "@/components/services/RelatedKnowledge";
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
import { formatAmount, type FormationBracket } from "@/content/pricing";
import { buildCourseJsonLd, buildFaqJsonLd, buildHowToJsonLd, buildServiceJsonLd } from "@/lib/seo";

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

  // ── Déroulé (timeline) — dérivé du programme structuré du catalogue ──────────
  const daySchedule = {
    title: f.programme.length > 1 ? "Le programme de la formation" : "Le déroulé de la formation",
    days: f.programme.map((section) => ({
      label: section.titreFr,
      items: section.steps.map((s) => ({
        time: s.temps ?? "",
        title: s.titre,
      })),
    })),
    logisticsNote:
      "Frais de déplacement, hébergement et repas facturés en sus, au forfait selon distance et durée. Devis transparent avant signature.",
  };

  // ── Bénéfices — « ce que chacun saura faire » (objectifs pédagogiques) ───────
  const benefits = f.objectifsFr.map((o) => ({ title: o, description: "" }));

  // ── Métriques — 3 chiffres parlants, vrais pour toutes les formations ────────
  const groupMax =
    brackets
      .map((b) => Number.parseInt(b.split("-")[1] ?? "", 10))
      .filter((n) => Number.isFinite(n))
      .reduce((a, b) => Math.max(a, b), 0) || 0;
  const metrics = [
    {
      number: String(f.objectifsFr.length),
      suffix: "",
      label: "compétences clés acquises et pratiquées en séance",
    },
    {
      number: groupMax > 0 ? String(groupMax) : "—",
      suffix: groupMax > 0 ? " pers." : "",
      label: "par session maximum, tarif dégressif selon l'effectif",
    },
    { number: "J+1", suffix: "", label: "vos équipes opérationnelles dès le lendemain" },
  ];

  // ── Copy ProductPageTemplate ─────────────────────────────────────────────────
  const copy = {
    eyebrow: `${gamme.labelFr} · ${duree.heuresFr}`,
    title: f.h1Fr,
    answer: f.accrocheFr,
    ...(typeof entryPrice === "number" ? { priceEur: entryPrice } : {}),
    ctaPrimary: "Réserver un appel",
    ctaSecondary: "Nous écrire",
    benefitsTitle: "Ce que chacun saura faire",
    benefits,
    processTitle: "Comment réserver votre formation",
    processEyebrow: "Réservation",
    processSteps: [
      {
        title: "Vous nous contactez",
        description:
          "Par appel ou message : on comprend votre contexte, vos équipes et vos objectifs.",
      },
      {
        title: "On prépare votre journée",
        description:
          "Programme calibré sur votre secteur, vos outils et vos cas réels — pas de scénario théorique.",
      },
      {
        title: "Intervention sur site",
        description:
          "Le formateur intervient le jour J dans vos locaux. Vos équipes produisent dès la séance.",
      },
    ],
    metricsTitle: "Le retour sur investissement",
    metricsEyebrow: "Bénéfices",
    metrics,
    faqTitle: "Questions fréquentes",
    faqs: f.faqs.map((q, i) => ({ id: `faq-${i}`, question: q.question, answer: q.reponse })),
    ctaBlockTitle: "Former vos équipes à l'IA",
    ctaBlockDescription:
      "Un formateur IA expert intervient sur votre site, sur vos vrais outils. Vos équipes gagnent des heures dès la première session.",
    daySchedule,
    why: {
      title: "Pour vous,",
      titleEm: "concrètement",
      intro: f.beneficeDirigeantFr,
      points: [
        { title: "Public visé", description: f.publicViseFr },
        { title: "L'équation temps", description: f.equationTempsFr },
        ...(f.prerequisFr
          ? [{ title: "Pré-requis", description: f.prerequisFr }]
          : [{ title: "Pré-requis", description: "Aucun — la formation démarre à votre niveau." }]),
      ],
    },
  };

  // ── Hero schema — 3 blocs thématiques (parité visuelle fiches collectives) ───
  const heroSchema = (
    <DetailHeroSchema
      eyebrow="Comment ça se passe"
      title={`Une formation ${duree.shortFr}, sur vos cas réels`}
      accent="primary"
      blocks={[
        {
          icon: Compass,
          prefix: "Avant",
          label: "On cadre avec vous",
          detail:
            "Objectifs, niveau de l'équipe et cas réels à traiter — défini ensemble en amont.",
        },
        {
          icon: FlaskConical,
          prefix: "Pendant",
          label: "Atelier pratique",
          detail:
            "Chaque participant produit sur ses propres tâches, pas sur des exemples théoriques.",
        },
        {
          icon: Lightbulb,
          prefix: "Après",
          label: "Repartez équipé·e",
          detail: "Des usages applicables et un livrable terminé, opérationnels dès le lendemain.",
        },
      ]}
      ariaLabel={`Schéma : déroulé d'une formation ${duree.labelFr} Axion-IA — cadrage en amont, atelier pratique sur vos cas, usages applicables dès le lendemain.`}
    />
  );

  // ── JSON-LD ──────────────────────────────────────────────────────────────────
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
  // HowTo JSON-LD — signal AEO « comment se déroule cette formation » dérivé du
  // programme (distinct par formation → pas de duplicate). Speakable + Breadcrumb
  // sont déjà émis (buildServiceJsonLd/buildFaqJsonLd + <Breadcrumbs>).
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

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      <ProductPageTemplate
        isFr={isFr}
        accent="primary"
        copy={copy}
        ctaPrimaryHref="/appel"
        ctaSecondaryHref="/contact"
        heroSchema={heroSchema}
        midBand={<FormationContactBand isFr={isFr} />}
        jsonLd={[serviceJsonLd, courseJsonLd, faqJsonLd, ...(howToJsonLd ? [howToJsonLd] : [])]}
        hideReserveCta
      />

      {/* Tranches de prix — un même programme, tarif selon l'effectif. */}
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
                        <Cta href="/appel" size="lg" className="w-full justify-center">
                          Réserver un appel
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

      {/* Maillage — autres formations + couverture nationale + KB. */}
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

      <LocalCoverageSection
        isFr={isFr}
        serviceLabelFr={`La formation « ${f.titreFr} »`}
        serviceLabelEn={`The « ${f.titreFr} » training`}
        serviceSlug="interventions"
        tone="sand"
      />

      <RelatedKnowledge service="interventions-formations" />
    </>
  );
}
