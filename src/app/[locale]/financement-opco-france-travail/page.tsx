// Landing « Vos formations IA financées avec OPCO et France Travail » (2026-07-05).
//
// But : montrer que les formations IA Axion-IA sont finançables (OPCO pour les
// salariés, France Travail pour les demandeurs d'emploi) et rassurer sur le montage
// du dossier. Server Component pur (Web Vitals) ; seul StickyMobileCta porte du JS.
//
// ⚠️ CONFORMITÉ (doctrine financement, cf. financing.ts + doctrine-check) :
//   - Page PHASE B UNIQUEMENT → `notFound()` tant que `OF_PUBLIC_DISCLOSURE_ENABLED`
//     ≠ "true" (afficher OPCO/financement avant l'agrément OF est illégal). Sitemap gaté.
//   - JAMAIS de LOGO OPCO / France Travail (mentions TEXTE uniquement).
//   - JAMAIS « CPF », JAMAIS « 100 % financé / gratuit / automatique », AUCUN numéro.
//   - Formulations autorisées : « en tout ou partie », « selon votre situation »,
//     « prise en charge possible/étudiée ». Badges via <FinancingBadges> (auto-gaté).

import type { Metadata } from "next";
import Image from "next/image";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Check,
  FileCheck2,
  GraduationCap,
  Quote,
  ShieldCheck,
  Sparkles,
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
import { isQualiopiPublicDisclosureEnabled } from "@/server/qualiopi/config/flag";
import { CLIENT_SECTORS } from "@/content/sectors";
import { getVillesIndexableNow } from "@/content/villes";
import {
  buildProductMetadata,
  buildCollectionPageJsonLd,
  buildItemListJsonLd,
  buildHowToJsonLd,
  buildPageImageGraphJsonLd,
  buildPrimaryImageOfPage,
  SITE_URL,
} from "@/lib/seo";
import { getPageImages } from "@/lib/seo/page-images";

interface Props {
  params: Promise<{ locale: string }>;
}

const PATH = "/financement-opco-france-travail";

export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  if (!isQualiopiPublicDisclosureEnabled()) return {};
  const isFr = locale === "fr";
  const title = isFr
    ? "Formations IA financées : OPCO & France Travail · Axion-IA"
    : "Funded AI trainings: OPCO & France Travail · Axion-IA";
  const description = isFr
    ? "Financez vos formations IA avec l'OPCO (salariés) ou France Travail (demandeurs d'emploi). Organisme certifié Qualiopi, Axion-IA étudie votre prise en charge — en tout ou partie selon votre situation — et monte le dossier avec vous, partout en France."
    : "Fund your AI trainings with OPCO (employees) or France Travail (jobseekers). As a Qualiopi-certified provider, Axion-IA studies your coverage — in whole or in part depending on your situation — and builds the file with you, across France.";
  return {
    ...buildProductMetadata({ locale, path: PATH, title, description }),
    title: { absolute: title },
  };
}

export default async function FinancementPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // Garde PRIMAIRE Phase A : aucune surface publique financement tant que non certifié.
  if (!isQualiopiPublicDisclosureEnabled()) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const pageImages = getPageImages(PATH);
  const heroImage = pageImages.find((i) => i.slot === "hero");
  const bannerImage = pageImages.find((i) => i.slot === "banner");
  const inlinePhotos = pageImages.filter((i) => i.slot === "inline");
  const gridImages = pageImages.filter((i) => i.slot === "grid");
  const portraitImage = pageImages.find((i) => i.slot === "portrait");
  const villes = getVillesIndexableNow().slice(0, 60);

  // Attribution photographe Unsplash (CGU §6).
  const UNSPLASH_CREDITS: Record<string, { name: string; url: string }> = {
    "/illustrations/financement/dossier-financement-formation-opco-france-travail-axion-ia.webp": {
      name: "Jakub Żerdzicki",
      url: "https://unsplash.com/@jakubzerdzicki",
    },
    "/illustrations/financement/accompagnement-financement-formation-ia-axion-ia.webp": {
      name: "Amy Hirschi",
      url: "https://unsplash.com/@amyhirschi",
    },
  };

  const breadcrumbItems = [
    {
      href: PATH,
      label: isFr ? "Financement OPCO / France Travail" : "OPCO / France Travail funding",
    },
  ];

  // ── Parcours de financement (5 étapes) — HowTo (AEO) ────────────────────────
  const steps: ReadonlyArray<{ icon: typeof Users; title: string; body: string }> = isFr
    ? [
        {
          icon: Users,
          title: "Votre besoin en formation",
          body: "On cadre ensemble vos objectifs, vos équipes et le format adapté.",
        },
        {
          icon: FileCheck2,
          title: "Dossier pris en charge",
          body: "Nous montons le dossier de financement (OPCO ou France Travail) avec vous.",
        },
        {
          icon: Wallet,
          title: "Financement validé",
          body: "Une fois l'accord obtenu, la prise en charge est confirmée.",
        },
        {
          icon: GraduationCap,
          title: "Formation réalisée",
          body: "Nous intervenons sur site ou à distance, partout en France.",
        },
        {
          icon: TrendingUp,
          title: "Compétences et performance",
          body: "Vos équipes montent en compétences ; les acquis sont évalués.",
        },
      ]
    : [
        {
          icon: Users,
          title: "Your training need",
          body: "We scope your objectives, your teams and the right format together.",
        },
        {
          icon: FileCheck2,
          title: "Funded file",
          body: "We build the funding file (OPCO or France Travail) with you.",
        },
        {
          icon: Wallet,
          title: "Funding approved",
          body: "Once approved, the coverage is confirmed.",
        },
        {
          icon: GraduationCap,
          title: "Training delivered",
          body: "We run it on site or remotely, across France.",
        },
        {
          icon: TrendingUp,
          title: "Skills and performance",
          body: "Your teams upskill; learning outcomes are assessed.",
        },
      ];

  // ── JSON-LD ─────────────────────────────────────────────────────────────────
  const primaryImage = buildPrimaryImageOfPage(PATH);
  const collectionPageJsonLd = buildCollectionPageJsonLd({
    locale: loc,
    path: PATH,
    name: isFr
      ? "Formations IA financées avec OPCO et France Travail — Axion-IA"
      : "AI trainings funded with OPCO and France Travail — Axion-IA",
    description: isFr
      ? "Comment financer vos formations IA : dispositifs OPCO (salariés) et France Travail (demandeurs d'emploi), montage du dossier et prise en charge, avec Axion-IA (organisme certifié Qualiopi)."
      : "How to fund your AI trainings: OPCO (employees) and France Travail (jobseekers) schemes, file building and coverage, with Axion-IA (Qualiopi-certified provider).",
    speakable: true,
    extra: {
      about: { "@id": `${SITE_URL}/#organization` },
      ...(primaryImage ? { primaryImageOfPage: primaryImage } : {}),
    },
  });

  const dispositifs = isFr
    ? [
        {
          name: "Financement OPCO",
          desc: "Pour les entreprises et leurs salariés : prise en charge de la formation professionnelle selon votre branche.",
        },
        {
          name: "France Travail",
          desc: "Pour les demandeurs d'emploi : dispositifs (AIF, POEI…) pour favoriser la formation et le retour à l'emploi.",
        },
      ]
    : [
        {
          name: "OPCO funding",
          desc: "For companies and their employees: coverage of professional training depending on your branch.",
        },
        {
          name: "France Travail",
          desc: "For jobseekers: schemes (AIF, POEI…) to support training and return to work.",
        },
      ];

  const itemListJsonLd = buildItemListJsonLd({
    locale: loc,
    path: PATH,
    name: isFr ? "Dispositifs de financement des formations IA" : "AI training funding schemes",
    items: dispositifs.map((d, i) => ({
      position: i + 1,
      name: d.name,
      url: `${SITE_URL}/${loc}${PATH}#dispositifs`,
      description: d.desc,
    })),
  });

  const howToJsonLd = buildHowToJsonLd({
    locale: loc,
    path: PATH,
    name: isFr
      ? "Comment financer votre formation IA (OPCO ou France Travail)"
      : "How to fund your AI training (OPCO or France Travail)",
    description: isFr
      ? "Les 5 étapes pour faire financer votre formation IA avec Axion-IA, de la définition du besoin à la montée en compétences."
      : "The 5 steps to get your AI training funded with Axion-IA, from defining the need to upskilling.",
    steps: steps.map((s) => ({ name: s.title, text: s.body })),
  });

  const imageGraphJsonLd = buildPageImageGraphJsonLd({ locale: loc, path: PATH });

  // ── Contenu ─────────────────────────────────────────────────────────────────
  const heroChips: ReadonlyArray<{ icon: typeof Sparkles; label: string }> = [
    { icon: Building2, label: isFr ? "Financement OPCO" : "OPCO funding" },
    { icon: Users, label: "France Travail" },
    { icon: Wallet, label: isFr ? "En tout ou partie" : "In whole or in part" },
    { icon: ShieldCheck, label: isFr ? "Certifié Qualiopi" : "Qualiopi-certified" },
  ];

  const avantages: ReadonlyArray<{ icon: typeof FileCheck2; title: string; body: string }> = isFr
    ? [
        {
          icon: FileCheck2,
          title: "Prise en charge simplifiée",
          body: "Nous montons le dossier de financement avec vous, du début à la fin.",
        },
        {
          icon: Wallet,
          title: "Solutions adaptées",
          body: "Un financement pensé pour votre entreprise, votre branche et votre situation.",
        },
        {
          icon: Users,
          title: "Accompagnement de A à Z",
          body: "Un suivi personnalisé à chaque étape, pour vous et vos équipes.",
        },
        {
          icon: ShieldCheck,
          title: "Dispositifs officiels",
          body: "Des financements sécurisés (OPCO, France Travail), rendus éligibles par notre certification Qualiopi.",
        },
      ]
    : [
        {
          icon: FileCheck2,
          title: "Simplified coverage",
          body: "We build the funding file with you, from start to finish.",
        },
        {
          icon: Wallet,
          title: "Tailored solutions",
          body: "Funding designed for your company, your branch and your situation.",
        },
        {
          icon: Users,
          title: "End-to-end support",
          body: "Personalised follow-up at every step, for you and your teams.",
        },
        {
          icon: ShieldCheck,
          title: "Official schemes",
          body: "Secure funding (OPCO, France Travail), made eligible by our Qualiopi certification.",
        },
      ];

  const faqItems = isFr
    ? [
        {
          id: "finançables",
          question: "Mes formations IA sont-elles finançables ?",
          answer:
            "Oui, en tout ou partie selon votre situation. Pour les salariés, la prise en charge passe par votre OPCO ; pour les demandeurs d'emploi, par France Travail. Nous étudions votre éligibilité et montons le dossier avec vous.",
        },
        {
          id: "opco",
          question: "Qu'est-ce qu'un OPCO ?",
          answer:
            "Un OPCO (opérateur de compétences) finance la formation professionnelle des salariés d'une entreprise, selon les règles de sa branche. C'est le principal canal de financement d'une formation IA pour vos équipes.",
        },
        {
          id: "demandeur-emploi",
          question: "Et pour un demandeur d'emploi ?",
          answer:
            "France Travail propose des dispositifs (comme l'AIF ou la POEI) pour financer une formation qui s'inscrit dans un projet de retour à l'emploi ou de reconversion. L'accompagnement est étudié au cas par cas.",
        },
        {
          id: "reste-a-charge",
          question: "Combien reste-t-il à ma charge ?",
          answer:
            "Cela dépend de votre situation, de votre branche et du dispositif mobilisé. La prise en charge peut couvrir tout ou partie du coût de la formation ; nous l'étudions précisément avec vous avant tout engagement.",
        },
        {
          id: "qualiopi",
          question: "Faut-il être certifié Qualiopi pour être financé ?",
          answer:
            "Oui : seuls les organismes certifiés Qualiopi rendent leurs formations éligibles aux financements de la formation professionnelle. Axion-IA est un organisme de formation certifié Qualiopi.",
        },
        {
          id: "delais",
          question: "Combien de temps faut-il pour monter le dossier ?",
          answer:
            "Le délai dépend de l'OPCO ou du dispositif concerné. Nous anticipons la demande avec vous pour respecter les délais et sécuriser la prise en charge avant le démarrage de la formation.",
        },
      ]
    : [
        {
          id: "finançables",
          question: "Can my AI trainings be funded?",
          answer:
            "Yes, in whole or in part depending on your situation. For employees, coverage goes through your OPCO; for jobseekers, through France Travail. We check your eligibility and build the file with you.",
        },
        {
          id: "opco",
          question: "What is an OPCO?",
          answer:
            "An OPCO (skills operator) funds the professional training of a company's employees, per its branch rules. It's the main funding channel for an AI training for your teams.",
        },
        {
          id: "demandeur-emploi",
          question: "And for a jobseeker?",
          answer:
            "France Travail offers schemes (such as AIF or POEI) to fund a training that fits a return-to-work or retraining project. Support is studied case by case.",
        },
        {
          id: "reste-a-charge",
          question: "How much is left for me to pay?",
          answer:
            "It depends on your situation, your branch and the scheme used. Coverage can span all or part of the training cost; we study it precisely with you before any commitment.",
        },
        {
          id: "qualiopi",
          question: "Do you need Qualiopi certification to be funded?",
          answer:
            "Yes: only Qualiopi-certified providers make their trainings eligible for professional training funding. Axion-IA is a Qualiopi-certified training provider.",
        },
        {
          id: "delais",
          question: "How long does building the file take?",
          answer:
            "It depends on the OPCO or scheme. We anticipate the request with you to meet deadlines and secure coverage before the training starts.",
        },
      ];

  const heroCtas = (
    <>
      <Cta href="/appel" variant="primary" size="lg" track="financement-hero-appel">
        {isFr ? "Étudier ma prise en charge" : "Study my funding"}
        <ArrowRight aria-hidden="true" className="h-4 w-4" />
      </Cta>
      <Cta href="/contact" variant="outline" size="lg" track="financement-hero-contact">
        {isFr ? "Écrire un message" : "Send a message"}
      </Cta>
    </>
  );

  return (
    <>
      <JsonLd data={collectionPageJsonLd} />
      <JsonLd data={itemListJsonLd} />
      <JsonLd data={howToJsonLd} />
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
            ? "Financement OPCO · France Travail · Toute la France"
            : "OPCO · France Travail funding · Across France"
        }
        title={isFr ? "Vos formations IA," : "Your AI trainings,"}
        titleEm={isFr ? "financées" : "funded"}
        description={
          isFr
            ? "OPCO pour vos salariés, France Travail pour les demandeurs d'emploi : nos formations IA sont finançables, en tout ou partie selon votre situation. Organisme certifié Qualiopi, nous montons le dossier avec vous, de A à Z."
            : "OPCO for your employees, France Travail for jobseekers: our AI trainings can be funded, in whole or in part depending on your situation. As a Qualiopi-certified provider, we build the file with you, end to end."
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

      {/* ── BANDEAU (visuel fort) ────────────────────────────────────────── */}
      {bannerImage ? (
        <Container className="pt-4 md:pt-6">
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

      {/* ── PREUVE SOCIALE (logos défilants) ─────────────────────────────── */}
      <ClientLogosMarqueeBand isFr={isFr} />

      {/* ── LES 2 DISPOSITIFS ────────────────────────────────────────────── */}
      <Section
        id="dispositifs"
        tone="paper"
        eyebrow={isFr ? "Deux dispositifs" : "Two schemes"}
        title={isFr ? "OPCO ou France Travail," : "OPCO or France Travail,"}
        titleEm={isFr ? "selon votre profil" : "depending on your profile"}
        description={
          isFr
            ? "Salarié ou demandeur d'emploi : il existe un dispositif pour financer votre formation IA. Nous vous orientons vers le bon."
            : "Employee or jobseeker: there's a scheme to fund your AI training. We guide you to the right one."
        }
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {[
            {
              icon: Building2,
              tag: isFr ? "Entreprises & salariés" : "Companies & employees",
              title: isFr ? "Financement OPCO" : "OPCO funding",
              body: isFr
                ? "Les OPCO financent la formation professionnelle de vos salariés selon votre branche. Nous vérifions votre éligibilité et montons le dossier de prise en charge."
                : "OPCOs fund your employees' professional training per your branch. We check eligibility and build the funding file.",
            },
            {
              icon: Users,
              tag: isFr ? "Demandeurs d'emploi" : "Jobseekers",
              title: "France Travail",
              body: isFr
                ? "Des dispositifs (AIF, POEI…) favorisent la formation et le retour à l'emploi. Un accompagnement personnalisé, étudié pour chaque projet."
                : "Schemes (AIF, POEI…) support training and return to work. Personalised support, studied for each project.",
            },
          ].map((d) => (
            <div
              key={d.title}
              className="border-border bg-canvas shadow-subtle flex h-full flex-col gap-3 rounded-2xl border p-6"
            >
              <span className="bg-terracotta/10 text-terracotta inline-flex h-11 w-11 items-center justify-center rounded-xl">
                <d.icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <span className="text-terracotta text-[13px] font-semibold tracking-wide uppercase">
                {d.tag}
              </span>
              <h2 className="text-fg text-lg font-semibold tracking-tight">{d.title}</h2>
              <p className="text-fg-soft text-sm leading-relaxed" data-speakable>
                {d.body}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── FINANCEMENT (badges neutres, auto-gaté) ──────────────────────── */}
      <Section
        id="financement"
        tone="sand"
        eyebrow={isFr ? "Prise en charge" : "Coverage"}
        title={isFr ? "Ce que nous mobilisons" : "What we mobilise"}
        titleEm={isFr ? "pour vous" : "for you"}
        description={
          isFr
            ? "Nous étudions votre prise en charge et préparons le dossier — sans que vous ayez à vous perdre dans les démarches."
            : "We study your coverage and prepare the file — without you getting lost in the paperwork."
        }
      >
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.2fr_1fr]">
          <FinancingBadges seed="financement-opco-france-travail" />
          <ul role="list" className="flex flex-col gap-3">
            {(isFr
              ? [
                  "Éligibilité vérifiée selon votre branche et votre OPCO",
                  "Montage du dossier de prise en charge (OPCO, France Travail)",
                  "Prise en charge possible en tout ou partie, selon votre situation",
                  "Convention, émargement et attestation conformes",
                ]
              : [
                  "Eligibility checked with your branch and OPCO",
                  "Funding file built (OPCO, France Travail)",
                  "Coverage possible in whole or in part, depending on your situation",
                  "Compliant agreement, attendance sheet and certificate",
                ]
            ).map((item) => (
              <li key={item} className="text-fg flex items-start gap-2.5 text-sm leading-relaxed">
                <Check aria-hidden="true" className="text-terracotta mt-0.5 h-4 w-4 shrink-0" />
                {item}
              </li>
            ))}
            <li className="mt-2">
              <Cta href="/appel" variant="primary" size="md" track="financement-badges-appel">
                {isFr ? "Étudier ma prise en charge" : "Study my funding"}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Cta>
            </li>
          </ul>
        </div>
      </Section>

      {/* ── COMMENT ÇA MARCHE (5 étapes, HowTo) ──────────────────────────── */}
      <Section
        id="etapes"
        eyebrow={isFr ? "Comment ça marche" : "How it works"}
        title={isFr ? "Votre financement," : "Your funding,"}
        titleEm={isFr ? "en 5 étapes" : "in 5 steps"}
        description={
          isFr
            ? "De la définition du besoin à la montée en compétences, nous gérons le financement avec vous."
            : "From defining the need to upskilling, we handle the funding with you."
        }
      >
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <ol role="list" className="flex flex-col gap-3">
            {steps.map((s, i) => (
              <li
                key={s.title}
                id={`etape-${i + 1}`}
                className="border-border bg-canvas shadow-subtle flex items-start gap-4 rounded-2xl border p-4"
              >
                <span className="bg-terracotta/10 text-terracotta inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-semibold">
                  {i + 1}
                </span>
                <div className="flex flex-col gap-0.5">
                  <h3 className="text-fg flex items-center gap-2 text-[15px] font-semibold tracking-tight">
                    <s.icon aria-hidden="true" className="text-terracotta h-4 w-4" />
                    {s.title}
                  </h3>
                  <p className="text-fg-soft text-sm leading-relaxed">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="flex flex-col gap-4">
            {inlinePhotos.map((img) => {
              const credit = UNSPLASH_CREDITS[img.src];
              return (
                <figure key={img.src} className="flex flex-col gap-1.5">
                  <div className="border-border shadow-subtle relative aspect-[3/2] overflow-hidden rounded-2xl border">
                    <Image
                      src={img.src}
                      alt={isFr ? img.altFr : img.altEn}
                      fill
                      sizes="(min-width: 1024px) 34vw, 100vw"
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
        </div>
      </Section>

      {/* ── AVANTAGES ────────────────────────────────────────────────────── */}
      <Section
        id="avantages"
        tone="paper"
        eyebrow={isFr ? "Pourquoi Axion-IA" : "Why Axion-IA"}
        title={isFr ? "Un financement" : "Funding"}
        titleEm={isFr ? "sans casse-tête" : "without the headache"}
        description={
          isFr
            ? "Nous transformons la complexité administrative en un parcours simple, sécurisé et rapide."
            : "We turn administrative complexity into a simple, secure and fast journey."
        }
      >
        <ul role="list" className="xs:grid-cols-2 grid grid-cols-1 gap-5 lg:grid-cols-4">
          {avantages.map((a) => (
            <li
              key={a.title}
              className="border-border bg-canvas shadow-subtle flex h-full flex-col gap-3 rounded-2xl border p-6"
            >
              <span className="bg-terracotta/10 text-terracotta inline-flex h-11 w-11 items-center justify-center rounded-xl">
                <a.icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <h3 className="text-fg text-base font-semibold tracking-tight">{a.title}</h3>
              <p className="text-fg-soft text-sm leading-relaxed">{a.body}</p>
            </li>
          ))}
        </ul>
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
                  ? "« Le financement ne doit jamais être un frein. On s'occupe du dossier de A à Z pour que vos équipes se concentrent sur l'essentiel : monter en compétences sur l'IA. »"
                  : "“Funding should never be a barrier. We handle the file end to end so your teams focus on what matters: building real AI skills.”"}
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

      {/* ── PREUVE (photos formation) ────────────────────────────────────── */}
      <Section
        id="preuve"
        eyebrow={isFr ? "Une fois financée" : "Once funded"}
        title={isFr ? "La formation," : "The training,"}
        titleEm={isFr ? "concrètement" : "in practice"}
        description={
          isFr
            ? "Après validation du financement, place à l'opérationnel : des formations IA concrètes, sur vos vrais cas d'usage."
            : "Once funding is approved, it's all operational: concrete AI trainings on your real use cases."
        }
      >
        <ul role="list" className="xs:grid-cols-2 grid grid-cols-1 gap-4 lg:grid-cols-3">
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
                  sizes="(min-width: 1024px) 33vw, (min-width: 479px) 50vw, 100vw"
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

      {/* ── SECTEURS ─────────────────────────────────────────────────────── */}
      <Section
        id="secteurs"
        tone="paper"
        eyebrow={isFr ? "Tous secteurs" : "Every sector"}
        title={isFr ? "Un financement pour" : "Funding for"}
        titleEm={isFr ? "votre secteur" : "your sector"}
        description={
          isFr
            ? "Quel que soit votre domaine, nous identifions le bon dispositif pour financer votre formation IA."
            : "Whatever your field, we identify the right scheme to fund your AI training."
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
                className="shadow-subtle hover:shadow-elevated group bg-canvas flex h-full flex-col overflow-hidden rounded-2xl transition hover:-translate-y-0.5"
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  <Image
                    src={`/illustrations/secteurs/${s.slug}.avif`}
                    alt={
                      isFr
                        ? `Formation IA financée (OPCO / France Travail) pour ${s.fullFr} — Axion-IA`
                        : `Funded AI training (OPCO / France Travail) for ${s.fullFr} — Axion-IA`
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
        title={isFr ? "Des formations financées," : "Funded trainings,"}
        titleEm={isFr ? "près de chez vous" : "near you"}
        description={
          isFr
            ? "Nous intervenons dans toute la France, en présentiel dans vos locaux. Trouvez votre ville :"
            : "We operate across France, on site at your premises. Find your city:"
        }
      >
        <ul role="list" className="flex flex-wrap gap-x-2 gap-y-2.5">
          {villes.map((v) => (
            <li key={v.slug}>
              <Link
                href={`/formations/par-ville/${v.slug}` as never}
                className="text-fg-soft bg-canvas border-border hover:border-terracotta hover:text-terracotta inline-flex items-center rounded-full border px-3 py-1.5 text-[13px] font-medium transition"
              >
                {isFr ? `Formation IA financée ${v.nameFr}` : `Funded AI training ${v.nameFr}`}
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <Section
        id="faq"
        eyebrow={isFr ? "Questions fréquentes" : "Frequently asked"}
        title={isFr ? "Vos questions sur le" : "Your questions about"}
        titleEm={isFr ? "financement" : "funding"}
      >
        <div className="max-w-3xl">
          <FaqAccordion items={faqItems} />
        </div>
      </Section>

      {/* ── CTA FINAL ────────────────────────────────────────────────────── */}
      <CtaBlock
        tone="mocha"
        eyebrow={isFr ? "Passons à l'action" : "Let's get started"}
        title={isFr ? "Faites financer" : "Get funded"}
        titleEm={isFr ? "votre formation IA" : "for your AI training"}
        description={
          isFr
            ? "Réservez un appel : nous étudions votre prise en charge (OPCO ou France Travail) et montons le dossier avec vous."
            : "Book a call: we study your coverage (OPCO or France Travail) and build the file with you."
        }
        cta={
          <>
            <Cta href="/appel" variant="primary" size="xl" track="financement-final-appel">
              {isFr ? "Étudier ma prise en charge" : "Study my funding"}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Cta>
            <Cta
              href="/certification-qualiopi"
              variant="outline"
              size="xl"
              track="financement-final-qualiopi"
            >
              {isFr ? "Notre certification Qualiopi" : "Our Qualiopi certification"}
            </Cta>
          </>
        }
      />

      <StickyMobileCta
        href="/appel"
        label={isFr ? "Étudier ma prise en charge" : "Study my funding"}
        track="financement-sticky-appel"
      />
    </>
  );
}
