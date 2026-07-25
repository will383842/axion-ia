// Landing « Organisme de formation IA certifié Qualiopi » (2026-07-05).
//
// But : réassurance — mettre en avant l'agrément Qualiopi d'Axion-IA, la qualité
// et le sérieux des formations IA, et tout ce que la certification apporte. Server
// Component pur (Web Vitals) ; seul StickyMobileCta porte du JS. Parité image/texte
// forte, mots-clés sémantiques (organisme certifié, Référentiel National Qualité,
// démarche qualité, financement OPCO).
//
// ⚠️ CONFORMITÉ (doctrine OF, cf. flag.ts) :
//   - Page PHASE B UNIQUEMENT → `notFound()` tant que `OF_PUBLIC_DISCLOSURE_ENABLED`
//     ≠ "true" (afficher Qualiopi avant certification est illégal). Sitemap gaté idem.
//   - Le NUMÉRO de certificat n'est JAMAIS affiché (décision Will, cf. QualiopiBadge).
//   - Le logo Qualiopi est TOUJOURS accompagné de la mention de marque obligatoire
//     (`formatMentionMarqueQualiopi`) + « ne vaut pas agrément de l'État ».
//   - AUCUNE mention CPF (verrou doctrinal). Financement via <FinancingBadges> (auto-gaté).

import type { Metadata } from "next";
import Image from "next/image";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Award,
  BadgeCheck,
  Check,
  Globe2,
  GraduationCap,
  Info,
  MessageSquareQuote,
  Quote,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { ClientLogosMarqueeBand } from "@/components/services/audit/ClientLogosMarqueeBand";
import { UnsplashCredit } from "@/components/media/UnsplashCredit";
import { FinancingBadges } from "@/components/qualiopi/FinancingBadges";
import { IndicateursResultatsPublic } from "@/components/qualiopi/IndicateursResultatsPublic";
import { getIndicateurs } from "@/server/qualiopi/indicateurs/service";
import {
  isQualiopiPublicDisclosureEnabled,
  isQualiopiCertificationObtenue,
} from "@/server/qualiopi/config/flag";
import {
  formatMentionMarqueQualiopi,
  LEGAL_MENTIONS,
} from "@/server/qualiopi/legal/legal-mentions";
import { CLIENT_SECTORS } from "@/content/sectors";
import { getVillesIndexableNow } from "@/content/villes";
import {
  buildProductMetadata,
  buildCollectionPageJsonLd,
  buildItemListJsonLd,
  buildPageImageGraphJsonLd,
  buildPrimaryImageOfPage,
  SITE_URL,
} from "@/lib/seo";
import { getPageImages } from "@/lib/seo/page-images";

interface Props {
  params: Promise<{ locale: string }>;
}

const PATH = "/certification-qualiopi";

export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  // Phase A : la page n'existe pas publiquement → pas de metadata indexable.
  if (!isQualiopiPublicDisclosureEnabled() || !isQualiopiCertificationObtenue()) return {};
  const isFr = locale === "fr";
  const title = isFr
    ? "Organisme de formation IA certifié Qualiopi | Axion-IA"
    : "Qualiopi-certified AI training provider | Axion-IA";
  const description = isFr
    ? "Axion-IA est un organisme de formation certifié Qualiopi au titre des actions de formation. Découvrez ce que la certification garantit : qualité, sérieux, conformité au Référentiel National Qualité et formations IA finançables (OPCO, France Travail selon votre situation)."
    : "Axion-IA is a Qualiopi-certified training provider for training actions. Discover what the certification guarantees: quality, seriousness, compliance with the National Quality Framework and AI trainings that can be funded (OPCO, France Travail depending on your situation).";
  return {
    ...buildProductMetadata({ locale, path: PATH, title, description }),
    title: { absolute: title },
  };
}

export default async function CertificationQualiopiPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // Garde PRIMAIRE Phase A : aucune surface publique Qualiopi tant que non certifié.
  // Audit F13 (2026-07-25) : Page entierement consacree a l'affirmation de certification.
  // Elle exige donc la certification REELLE, pas seulement la visibilite des pages.
  if (!isQualiopiPublicDisclosureEnabled() || !isQualiopiCertificationObtenue()) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const pageImages = getPageImages(PATH);
  const heroImage = pageImages.find((i) => i.slot === "hero");
  const bannerImage = pageImages.find((i) => i.slot === "banner");
  const agrementPhotos = pageImages.filter((i) => i.slot === "inline");
  const gridImages = pageImages.filter((i) => i.slot === "grid");
  const portraitImage = pageImages.find((i) => i.slot === "portrait");
  const villes = getVillesIndexableNow().slice(0, 60);

  // Indicateur RNQ 2 : diffusion publique des indicateurs de résultats.
  //   Stub-aware (build) → « en cours de constitution » ; repeuplé à l'ISR.
  const indicateursResultats = await getIndicateurs(new Date().getFullYear());

  // Attribution photographe Unsplash (CGU §6) pour les photos de la section agrément.
  const UNSPLASH_CREDITS: Record<string, { name: string; url: string }> = {
    "/illustrations/qualiopi/audit-documentaire-processus-qualite-certification-qualiopi-axion-ia.webp":
      { name: "Markus Winkler", url: "https://unsplash.com/@markuswinkler" },
    "/illustrations/qualiopi/confiance-accord-organisme-formation-certifie-qualiopi-axion-ia.webp":
      {
        name: "Radission US",
        url: "https://unsplash.com/@radission",
      },
  };

  // Mention de marque OBLIGATOIRE (règles d'usage officielles). Catégorie par défaut
  // du registre : « Actions de formation ».
  const mentionMarque = formatMentionMarqueQualiopi("Actions de formation");

  const breadcrumbItems = [
    { href: PATH, label: isFr ? "Certification Qualiopi" : "Qualiopi certification" },
  ];

  // ── JSON-LD ────────────────────────────────────────────────────────────────
  const primaryImage = buildPrimaryImageOfPage(PATH);
  const collectionPageJsonLd = buildCollectionPageJsonLd({
    locale: loc,
    path: PATH,
    name: isFr
      ? "Axion-IA, organisme de formation IA certifié Qualiopi"
      : "Axion-IA, Qualiopi-certified AI training provider",
    description: isFr
      ? "Ce que garantit la certification Qualiopi d'Axion-IA : qualité des formations IA, sérieux, conformité au Référentiel National Qualité et financement facilité."
      : "What Axion-IA's Qualiopi certification guarantees: AI training quality, seriousness, compliance with the National Quality Framework and easier funding.",
    speakable: true,
    extra: {
      // Rattache la page à l'entité #organization (site-wide) qui porte déjà le
      // credential EducationalOccupationalCredential Qualiopi en Phase B.
      about: { "@id": `${SITE_URL}/#organization` },
      ...(primaryImage ? { primaryImageOfPage: primaryImage } : {}),
    },
  });

  // Les 7 critères du Référentiel National Qualité (RNQ) — signal AEO/structuré.
  const criteres: ReadonlyArray<{ icon: typeof Info; title: string; body: string }> = isFr
    ? [
        {
          icon: Info,
          title: "1. Information du public",
          body: "Une information claire et vérifiable sur nos formations : objectifs, prérequis, durée, tarifs, modalités et résultats.",
        },
        {
          icon: Target,
          title: "2. Objectifs adaptés",
          body: "Des objectifs pédagogiques précis, définis avec vous et adaptés à vos équipes et à vos cas d'usage réels.",
        },
        {
          icon: Users,
          title: "3. Adaptation aux publics",
          body: "Un positionnement en amont, un accueil et un accompagnement adaptés à chaque bénéficiaire, y compris en situation de handicap.",
        },
        {
          icon: Settings2,
          title: "4. Moyens adaptés",
          body: "Des moyens pédagogiques, techniques et d'encadrement en phase avec les prestations et les objectifs visés.",
        },
        {
          icon: GraduationCap,
          title: "5. Compétences des formateurs",
          body: "Des formateurs IA experts, dont la qualification et la montée en compétence sont suivies et documentées.",
        },
        {
          icon: Globe2,
          title: "6. Environnement professionnel",
          body: "Une veille active sur l'évolution des compétences, des métiers, du cadre légal et des innovations en intelligence artificielle.",
        },
        {
          icon: MessageSquareQuote,
          title: "7. Amélioration continue",
          body: "Le recueil des appréciations et des réclamations, analysé pour améliorer en continu la qualité de nos formations.",
        },
      ]
    : [
        {
          icon: Info,
          title: "1. Public information",
          body: "Clear, verifiable information about our trainings: objectives, prerequisites, duration, prices, terms and results.",
        },
        {
          icon: Target,
          title: "2. Tailored objectives",
          body: "Precise learning objectives, defined with you and tailored to your teams and real use cases.",
        },
        {
          icon: Users,
          title: "3. Audience adaptation",
          body: "Upfront positioning, reception and support tailored to each beneficiary, including those with disabilities.",
        },
        {
          icon: Settings2,
          title: "4. Adequate means",
          body: "Pedagogical, technical and supervisory means aligned with the services and objectives.",
        },
        {
          icon: GraduationCap,
          title: "5. Trainer skills",
          body: "Expert AI trainers whose qualification and upskilling are tracked and documented.",
        },
        {
          icon: Globe2,
          title: "6. Professional environment",
          body: "Active monitoring of evolving skills, roles, legal framework and AI innovations.",
        },
        {
          icon: MessageSquareQuote,
          title: "7. Continuous improvement",
          body: "Collection of feedback and complaints, analysed to continuously improve our training quality.",
        },
      ];

  const itemListJsonLd = buildItemListJsonLd({
    locale: loc,
    path: PATH,
    name: isFr
      ? "Les 7 critères du Référentiel National Qualité (Qualiopi)"
      : "The 7 criteria of the National Quality Framework (Qualiopi)",
    items: criteres.map((c, i) => ({
      position: i + 1,
      name: c.title,
      url: `${SITE_URL}/${loc}${PATH}#critere-${i + 1}`,
      description: c.body,
    })),
  });

  const imageGraphJsonLd = buildPageImageGraphJsonLd({ locale: loc, path: PATH });

  // ── Contenu ────────────────────────────────────────────────────────────────
  const heroChips: ReadonlyArray<{ icon: typeof Sparkles; label: string }> = [
    {
      icon: ShieldCheck,
      label: isFr ? "Processus certifié Qualiopi" : "Qualiopi-certified process",
    },
    { icon: Award, label: isFr ? "Référentiel National Qualité" : "National Quality Framework" },
    { icon: BadgeCheck, label: isFr ? "Actions de formation" : "Training actions" },
    { icon: Wallet, label: isFr ? "Finançable OPCO" : "OPCO-fundable" },
  ];

  const garanties: ReadonlyArray<{ icon: typeof ShieldCheck; title: string; body: string }> = isFr
    ? [
        {
          icon: BadgeCheck,
          title: "Une qualité vérifiée",
          body: "La certification est délivrée après un audit indépendant de nos processus. C'est une preuve extérieure, pas une simple déclaration.",
        },
        {
          icon: ShieldCheck,
          title: "Sérieux & conformité",
          body: "Conventions, positionnement, émargement, évaluations et attestations conformes au Code du travail : un cadre solide et traçable.",
        },
        {
          icon: Wallet,
          title: "Un financement facilité",
          body: "En tant qu'organisme certifié, nos formations IA sont éligibles aux financements de la formation professionnelle — nous montons le dossier avec vous.",
        },
        {
          icon: TrendingUp,
          title: "Amélioration continue",
          body: "Vos retours sont recueillis et analysés. La qualité de nos formations progresse à chaque session.",
        },
      ]
    : [
        {
          icon: BadgeCheck,
          title: "Verified quality",
          body: "The certification is granted after an independent audit of our processes. It's external proof, not a mere claim.",
        },
        {
          icon: ShieldCheck,
          title: "Seriousness & compliance",
          body: "Agreements, positioning, attendance, assessments and certificates compliant with the Labour Code: a solid, traceable framework.",
        },
        {
          icon: Wallet,
          title: "Easier funding",
          body: "As a certified provider, our AI trainings are eligible for professional training funding — we build the file with you.",
        },
        {
          icon: TrendingUp,
          title: "Continuous improvement",
          body: "Your feedback is collected and analysed. Our training quality improves with every session.",
        },
      ];

  const faqItems = isFr
    ? [
        {
          id: "quest-ce-que-qualiopi",
          question: "Qu'est-ce que la certification Qualiopi ?",
          answer:
            "Qualiopi est la certification qualité nationale des organismes de formation, délivrée après audit par un organisme accréditté au titre du Référentiel National Qualité. Elle atteste que le prestataire respecte 7 critères de qualité sur l'ensemble de son processus de formation.",
        },
        {
          id: "axion-ia-certifie",
          question: "Axion-IA est-il réellement certifié Qualiopi ?",
          answer: `Oui. Axion-IA est un organisme de formation dont le processus est certifié Qualiopi au titre des actions de formation. ${mentionMarque}`,
        },
        {
          id: "qualite",
          question: "Qu'est-ce que Qualiopi change pour la qualité de vos formations IA ?",
          answer:
            "La certification impose un cadre exigeant : objectifs clairs, formateurs qualifiés, moyens adaptés, évaluation des acquis et amélioration continue. Concrètement, vous bénéficiez d'un dispositif structuré et traçable, du positionnement initial au bilan final.",
        },
        {
          id: "financement",
          question: "Vos formations IA sont-elles finançables ?",
          answer:
            "Oui, en tout ou partie selon votre situation. En tant qu'organisme certifié Qualiopi, nos formations sont éligibles aux dispositifs de financement de la formation professionnelle (OPCO, France Travail). Nous étudions votre prise en charge et montons le dossier avec vous.",
        },
        {
          id: "garantie-resultat",
          question: "La certification garantit-elle un résultat ?",
          answer:
            "Qualiopi certifie la qualité du processus de formation, pas un résultat individuel. Elle garantit un cadre sérieux et une démarche d'amélioration continue. Nos formations restent orientées vers des compétences opérationnelles, utilisables dès le lendemain.",
        },
        {
          id: "ou-intervenez-vous",
          question: "Où intervenez-vous ?",
          answer:
            "Dans toute la France, en présentiel dans vos locaux ou à distance. Notre certification et notre démarche qualité s'appliquent à l'ensemble de nos formations, quel que soit votre secteur ou votre ville.",
        },
      ]
    : [
        {
          id: "quest-ce-que-qualiopi",
          question: "What is the Qualiopi certification?",
          answer:
            "Qualiopi is the national quality certification for training providers, granted after an audit by an accredited body under the National Quality Framework. It attests that the provider meets 7 quality criteria across its whole training process.",
        },
        {
          id: "axion-ia-certifie",
          question: "Is Axion-IA really Qualiopi-certified?",
          answer: `Yes. Axion-IA is a training provider whose process is Qualiopi-certified for training actions. ${mentionMarque}`,
        },
        {
          id: "qualite",
          question: "What does Qualiopi change for the quality of your AI trainings?",
          answer:
            "The certification enforces a demanding framework: clear objectives, qualified trainers, adequate means, assessment of learning and continuous improvement. In practice, you get a structured, traceable setup, from initial positioning to final review.",
        },
        {
          id: "financement",
          question: "Can your AI trainings be funded?",
          answer:
            "Yes, in whole or in part depending on your situation. As a Qualiopi-certified provider, our trainings are eligible for professional training funding schemes (OPCO, France Travail). We study your funding and build the file with you.",
        },
        {
          id: "garantie-resultat",
          question: "Does the certification guarantee a result?",
          answer:
            "Qualiopi certifies the quality of the training process, not an individual result. It guarantees a serious framework and a continuous-improvement approach. Our trainings stay focused on operational skills, usable the very next day.",
        },
        {
          id: "ou-intervenez-vous",
          question: "Where do you operate?",
          answer:
            "Across France, on site at your premises or remotely. Our certification and quality approach apply to all our trainings, whatever your sector or city.",
        },
      ];

  const heroCtas = (
    <>
      <Cta href="/appel" variant="primary" size="lg" track="qualiopi-hero-appel">
        {isFr ? "Réserver un appel" : "Book a call"}
        <ArrowRight aria-hidden="true" className="h-4 w-4" />
      </Cta>
      <Cta href="/contact" variant="outline" size="lg" track="qualiopi-hero-contact">
        {isFr ? "Écrire un message" : "Send a message"}
      </Cta>
    </>
  );

  return (
    <>
      <JsonLd data={collectionPageJsonLd} />
      <JsonLd data={itemListJsonLd} />
      {imageGraphJsonLd ? <JsonLd data={imageGraphJsonLd} /> : null}

      <div className="bg-halo-warm">
        <Container className="pt-6">
          <Breadcrumbs items={breadcrumbItems} />
        </Container>
      </div>

      {/* ── HÉRO ─────────────────────────────────────────────────────────── */}
      <Section
        titleAs="h1"
        eyebrow={
          isFr
            ? "Organisme de formation certifié Qualiopi · République française"
            : "Qualiopi-certified training provider · French Republic"
        }
        title={isFr ? "La qualité de nos formations IA," : "The quality of our AI trainings,"}
        titleEm={isFr ? "certifiée Qualiopi" : "certified by Qualiopi"}
        description={
          isFr
            ? "Axion-IA est un organisme de formation certifié Qualiopi au titre des actions de formation. Un gage de sérieux, de conformité et de qualité — et l'assurance de formations IA finançables pour vos équipes, partout en France."
            : "Axion-IA is a Qualiopi-certified training provider for training actions. A mark of seriousness, compliance and quality — and the assurance of fundable AI trainings for your teams, across France."
        }
        media={
          heroImage ? (
            <Image
              src={heroImage.src}
              alt={isFr ? heroImage.altFr : heroImage.altEn}
              width={heroImage.width}
              height={heroImage.height}
              priority
              sizes="(max-width: 1024px) 100vw, 48vw"
              className="mx-auto h-auto w-full max-w-[520px] rounded-2xl"
            />
          ) : undefined
        }
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap gap-3">{heroCtas}</div>
          <ul role="list" className="flex flex-wrap gap-2">
            {heroChips.map((c) => (
              <li
                key={c.label}
                className="text-fg bg-paper/70 border-border inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium"
              >
                <c.icon aria-hidden="true" className="text-terracotta h-3.5 w-3.5" />
                {c.label}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* ── PREUVE SOCIALE (logos défilants) ─────────────────────────────── */}
      <ClientLogosMarqueeBand isFr={isFr} />

      {/* ── BANDEAU QUALIOPI (visuel fort — badge + mention + repères) ────── */}
      {bannerImage ? (
        <Container className="pt-12 md:pt-16">
          <Image
            src={bannerImage.src}
            alt={isFr ? bannerImage.altFr : bannerImage.altEn}
            width={bannerImage.width}
            height={bannerImage.height}
            sizes="(max-width: 1366px) 100vw, 1366px"
            className="shadow-card h-auto w-full rounded-2xl"
          />
        </Container>
      ) : null}

      {/* ── L'AGRÉMENT + MENTION OBLIGATOIRE (aéré par photos) ────────────── */}
      <Section
        id="agrement"
        tone="paper"
        eyebrow={isFr ? "L'agrément" : "The certification"}
        title={isFr ? "Un processus" : "A"}
        titleEm={isFr ? "officiellement certifié" : "officially certified process"}
        description={
          isFr
            ? "La certification Qualiopi est délivrée par un organisme indépendant, au titre du Référentiel National Qualité. Elle atteste, preuve à l'appui, de la qualité de notre démarche de formation."
            : "The Qualiopi certification is granted by an independent body under the National Quality Framework. It provides external proof of the quality of our training approach."
        }
      >
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2">
          <div className="xs:grid-cols-2 grid grid-cols-1 gap-4">
            {agrementPhotos.map((img) => {
              const credit = UNSPLASH_CREDITS[img.src];
              return (
                <figure key={img.src} className="flex flex-col gap-1.5">
                  <div className="border-border shadow-subtle relative aspect-[3/2] overflow-hidden rounded-2xl border">
                    <Image
                      src={img.src}
                      alt={isFr ? img.altFr : img.altEn}
                      fill
                      sizes="(min-width: 1024px) 22vw, (min-width: 479px) 40vw, 100vw"
                      loading="lazy"
                      className="object-cover"
                    />
                  </div>
                  {credit ? (
                    <UnsplashCredit
                      photographerName={credit.name}
                      photographerUrl={credit.url}
                      className="text-[11px]"
                    />
                  ) : null}
                </figure>
              );
            })}
          </div>
          <div className="flex flex-col gap-4">
            <p className="text-fg text-lg leading-relaxed font-medium" data-speakable data-answer>
              {mentionMarque}
            </p>
            <p className="text-fg-soft text-sm leading-relaxed">
              {LEGAL_MENTIONS.declarationActivite}
            </p>
            <ul role="list" className="mt-1 flex flex-col gap-2.5">
              {(isFr
                ? [
                    "Audit indépendant de nos processus qualité",
                    "Conformité au Code du travail (conventions, émargement, attestations)",
                    "Démarche d'amélioration continue documentée",
                  ]
                : [
                    "Independent audit of our quality processes",
                    "Labour Code compliance (agreements, attendance, certificates)",
                    "Documented continuous-improvement approach",
                  ]
              ).map((item) => (
                <li key={item} className="text-fg flex items-start gap-2.5 text-sm leading-relaxed">
                  <Check aria-hidden="true" className="text-terracotta mt-0.5 h-4 w-4 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* ── FINANCEMENT (auto-gaté, Phase B — juste après l'agrément) ─────── */}
      <Section
        id="financement"
        tone="sand"
        eyebrow={isFr ? "Financement" : "Funding"}
        title={isFr ? "Une certification qui" : "A certification that"}
        titleEm={isFr ? "ouvre le financement" : "unlocks funding"}
        description={
          isFr
            ? "Parce que nous sommes certifiés Qualiopi, nos formations IA sont éligibles aux financements de la formation professionnelle. Nous étudions votre prise en charge et montons le dossier avec vous."
            : "Because we are Qualiopi-certified, our AI trainings are eligible for professional training funding. We study your funding and build the file with you."
        }
      >
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.2fr_1fr]">
          <FinancingBadges seed="certification-qualiopi" />
          <ul role="list" className="flex flex-col gap-3">
            {(isFr
              ? [
                  "Éligibilité vérifiée selon votre branche et votre OPCO",
                  "Aide au montage du dossier de prise en charge (OPCO, France Travail)",
                  "Prise en charge possible en tout ou partie, selon votre situation",
                ]
              : [
                  "Eligibility checked with your branch and OPCO",
                  "Help building the funding file (OPCO, France Travail)",
                  "Funding possible in whole or in part, depending on your situation",
                ]
            ).map((item) => (
              <li key={item} className="text-fg flex items-start gap-2.5 text-sm leading-relaxed">
                <Check aria-hidden="true" className="text-terracotta mt-0.5 h-4 w-4 shrink-0" />
                {item}
              </li>
            ))}
            <li className="mt-2">
              <Cta href="/appel" variant="primary" size="md" track="qualiopi-financement-appel">
                {isFr ? "Étudier ma prise en charge" : "Study my funding"}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Cta>
            </li>
          </ul>
        </div>
      </Section>

      {/* ── CE QUE ÇA GARANTIT ───────────────────────────────────────────── */}
      <Section
        id="garanties"
        eyebrow={isFr ? "Vos garanties" : "Your guarantees"}
        title={isFr ? "Ce que la certification" : "What the certification"}
        titleEm={isFr ? "vous apporte" : "brings you"}
        description={
          isFr
            ? "Choisir un organisme certifié Qualiopi, ce n'est pas qu'une formalité : c'est une vraie différence pour vos équipes et votre budget formation."
            : "Choosing a Qualiopi-certified provider isn't just a formality: it's a real difference for your teams and your training budget."
        }
      >
        <ul role="list" className="xs:grid-cols-2 grid grid-cols-1 gap-5 lg:grid-cols-4">
          {garanties.map((g) => (
            <li
              key={g.title}
              className="border-border bg-paper shadow-subtle flex h-full flex-col gap-3 rounded-2xl border p-6"
            >
              <span className="bg-terracotta/10 text-terracotta inline-flex h-11 w-11 items-center justify-center rounded-xl">
                <g.icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <h3 className="text-fg text-base font-semibold tracking-tight">{g.title}</h3>
              <p className="text-fg-soft text-sm leading-relaxed">{g.body}</p>
            </li>
          ))}
        </ul>
      </Section>

      {/* ── LES 7 CRITÈRES (RNQ) ─────────────────────────────────────────── */}
      <Section
        id="criteres"
        tone="sand"
        eyebrow={isFr ? "Référentiel National Qualité" : "National Quality Framework"}
        title={isFr ? "Les 7 critères que nous" : "The 7 criteria we"}
        titleEm={isFr ? "respectons" : "meet"}
        description={
          isFr
            ? "La certification Qualiopi repose sur 7 critères qualité, audités sur l'ensemble de notre processus de formation."
            : "The Qualiopi certification rests on 7 quality criteria, audited across our whole training process."
        }
      >
        <ol role="list" className="xs:grid-cols-2 grid grid-cols-1 gap-3 lg:grid-cols-4">
          {criteres.map((c, i) => (
            <li
              key={c.title}
              id={`critere-${i + 1}`}
              className="border-border bg-canvas shadow-subtle flex h-full flex-col gap-2 rounded-xl border p-4"
            >
              <div className="flex items-center gap-2.5">
                <span className="bg-terracotta/10 text-terracotta inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                  <c.icon aria-hidden="true" className="h-4 w-4" />
                </span>
                <h3 className="text-fg text-sm leading-tight font-semibold tracking-tight">
                  {c.title}
                </h3>
              </div>
              <p className="text-fg-soft text-[13px] leading-relaxed">{c.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* ── LA PREUVE PAR LA QUALITÉ (photos) ────────────────────────────── */}
      <Section
        id="preuve"
        tone="paper"
        eyebrow={isFr ? "La preuve par la qualité" : "Proof through quality"}
        title={isFr ? "Une exigence visible à" : "A standard visible at"}
        titleEm={isFr ? "chaque étape" : "every step"}
        description={
          isFr
            ? "Du cadrage au bilan, chaque formation IA Axion-IA applique les exigences du Référentiel National Qualité."
            : "From scoping to review, every Axion-IA AI training applies the requirements of the National Quality Framework."
        }
      >
        <ul role="list" className="xs:grid-cols-2 grid grid-cols-1 gap-4 lg:grid-cols-4">
          {gridImages.map((img) => (
            <li
              key={img.src}
              className="border-border bg-canvas shadow-subtle overflow-hidden rounded-2xl border"
            >
              <div className="relative aspect-[3/2] overflow-hidden">
                <Image
                  src={img.src}
                  alt={isFr ? img.altFr : img.altEn}
                  fill
                  sizes="(min-width: 1024px) 25vw, (min-width: 479px) 50vw, 100vw"
                  loading="lazy"
                  className="object-cover"
                />
              </div>
              <p className="text-fg-soft p-3 text-[13px] leading-snug">
                {isFr ? img.nameFr : img.nameEn}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      {/* ── INDICATEURS DE RÉSULTATS (RNQ ind. 2) ────────────────────────── */}
      <Section
        id="indicateurs-resultats"
        tone="canvas"
        eyebrow={isFr ? "Transparence des résultats" : "Results transparency"}
        title={isFr ? "Nos indicateurs de" : "Our results"}
        titleEm={isFr ? "résultats" : "indicators"}
        description={
          isFr
            ? "Conformément au Référentiel National Qualité (indicateur 2), nous publions nos indicateurs de résultats, avec leur méthode de calcul. Les valeurs non encore représentatives sont signalées « en cours de constitution »."
            : "In line with the National Quality Framework (indicator 2), we publish our results indicators and their calculation method. Values that are not yet representative are marked as “being compiled.”"
        }
      >
        <IndicateursResultatsPublic result={indicateursResultats} isFr={isFr} />
      </Section>

      {/* ── ENGAGEMENT FONDATEUR ─────────────────────────────────────────── */}
      {portraitImage ? (
        <Section id="engagement" tone="mocha">
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[0.8fr_1.2fr]">
            <Image
              src={portraitImage.src}
              alt={isFr ? portraitImage.altFr : portraitImage.altEn}
              width={portraitImage.width}
              height={portraitImage.height}
              sizes="(max-width: 1024px) 60vw, 30vw"
              loading="lazy"
              className="mx-auto h-auto w-full max-w-[280px] rounded-2xl object-cover"
            />
            <figure className="flex flex-col gap-4">
              <Quote aria-hidden="true" className="text-terracotta h-8 w-8" />
              <blockquote
                className="text-mocha-fg text-lg leading-relaxed font-medium md:text-xl"
                data-speakable
              >
                {isFr
                  ? "« La certification Qualiopi, ce n'est pas un logo : c'est l'engagement que chaque équipe que nous formons bénéficie d'un dispositif rigoureux, évalué et amélioré en continu. »"
                  : "“Qualiopi certification isn't a logo: it's the commitment that every team we train benefits from a rigorous setup, assessed and continuously improved.”"}
              </blockquote>
              <figcaption className="text-mocha-fg/80 text-sm">
                {isFr
                  ? "Williams — Fondateur d'Axion-IA, organisme certifié Qualiopi"
                  : "Williams — Founder of Axion-IA, Qualiopi-certified provider"}
              </figcaption>
            </figure>
          </div>
        </Section>
      ) : null}

      {/* ── SECTEURS ─────────────────────────────────────────────────────── */}
      <Section
        id="secteurs"
        eyebrow={isFr ? "Tous secteurs" : "Every sector"}
        title={isFr ? "Une qualité certifiée pour" : "Certified quality for"}
        titleEm={isFr ? "votre secteur" : "your sector"}
        description={
          isFr
            ? "Nos formations IA certifiées Qualiopi s'adaptent à votre domaine d'activité et à vos métiers."
            : "Our Qualiopi-certified AI trainings adapt to your field and your roles."
        }
      >
        <ul
          role="list"
          className="xs:grid-cols-2 grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5"
        >
          {CLIENT_SECTORS.map((s) => (
            <li key={s.slug}>
              <Link
                href={`/secteurs/${s.slug}` as never}
                className="shadow-subtle hover:shadow-elevated group bg-paper flex h-full flex-col overflow-hidden rounded-2xl transition hover:-translate-y-0.5"
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  <Image
                    src={`/illustrations/secteurs/${s.slug}.avif`}
                    alt={
                      isFr
                        ? `Formation IA certifiée Qualiopi pour ${s.fullFr} — Axion-IA`
                        : `Qualiopi-certified AI training for ${s.fullFr} — Axion-IA`
                    }
                    fill
                    sizes="(min-width: 1024px) 20vw, (min-width: 768px) 33vw, (min-width: 479px) 50vw, 100vw"
                    loading="lazy"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <span
                    aria-hidden="true"
                    className="bg-paper/90 shadow-subtle absolute top-2.5 left-2.5 inline-flex h-8 w-8 items-center justify-center rounded-lg text-base"
                  >
                    {s.emoji}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-1 p-4">
                  <span className="text-fg text-sm font-semibold tracking-tight">{s.labelFr}</span>
                  <span className="text-terracotta mt-auto text-[13px] font-medium">
                    {isFr ? "Voir →" : "See →"}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      {/* ── VILLES (GEO / maillage) ──────────────────────────────────────── */}
      <Section
        id="villes"
        tone="sand"
        eyebrow={isFr ? "Partout en France" : "Across France"}
        title={isFr ? "Un organisme certifié," : "A certified provider,"}
        titleEm={isFr ? "près de chez vous" : "near you"}
        description={
          isFr
            ? "Nous formons vos équipes en présentiel dans toute la France. Trouvez votre ville :"
            : "We train your teams in person across France. Find your city:"
        }
      >
        <ul role="list" className="flex flex-wrap gap-x-2 gap-y-2.5">
          {villes.map((v) => (
            <li key={v.slug}>
              <Link
                href={`/formations/par-ville/${v.slug}` as never}
                className="text-fg-soft bg-canvas border-border hover:border-terracotta hover:text-terracotta inline-flex items-center rounded-full border px-3 py-1.5 text-[13px] font-medium transition"
              >
                {isFr ? `Formation IA Qualiopi ${v.nameFr}` : `Qualiopi AI training ${v.nameFr}`}
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <Section
        id="faq"
        eyebrow={isFr ? "Questions fréquentes" : "Frequently asked"}
        title={isFr ? "Vos questions sur" : "Your questions about"}
        titleEm={isFr ? "la certification Qualiopi" : "the Qualiopi certification"}
      >
        <div className="max-w-3xl">
          <FaqAccordion items={faqItems} />
        </div>
      </Section>

      {/* ── CTA FINAL ────────────────────────────────────────────────────── */}
      <CtaBlock
        tone="mocha"
        eyebrow={isFr ? "Un partenaire de confiance" : "A trusted partner"}
        title={isFr ? "Formez vos équipes avec un" : "Train your teams with a"}
        titleEm={isFr ? "organisme certifié" : "certified provider"}
        description={
          isFr
            ? "Réservez un appel : nous étudions vos besoins, votre financement, et préparons une formation IA sur mesure — dans un cadre certifié Qualiopi."
            : "Book a call: we study your needs, your funding, and prepare a tailored AI training — within a Qualiopi-certified framework."
        }
        cta={
          <>
            <Cta href="/appel" variant="primary" size="xl" track="qualiopi-final-appel">
              {isFr ? "Réserver un appel" : "Book a call"}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Cta>
            <Cta href="/contact" variant="outline" size="xl" track="qualiopi-final-contact">
              {isFr ? "Écrire un message" : "Send a message"}
            </Cta>
          </>
        }
      />

      <StickyMobileCta
        href="/appel"
        label={isFr ? "Réserver un appel" : "Book a call"}
        track="qualiopi-sticky-appel"
      />
    </>
  );
}
