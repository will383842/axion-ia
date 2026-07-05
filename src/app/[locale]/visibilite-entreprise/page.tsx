// Landing « La visibilité de votre entreprise, offerte » (2026-07-05).
//
// Message : devenir client Axion-IA = gagner énormément en visibilité — valable
// pour TOUS les services (formations, 1-to-1, audits, implémentations, sites web
// & SaaS augmentés à l'IA). Server Component pur (Web Vitals) ; seul
// StickyMobileCta porte du JS. Parité image/texte forte, mots-clés sémantiques
// (autorité SEO, backlink dofollow, notoriété, preuve sociale, marque employeur).

import type { Metadata } from "next";
import Image from "next/image";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Code2,
  Cpu,
  GraduationCap,
  Link2,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { ClientLogosMarqueeBand } from "@/components/services/audit/ClientLogosMarqueeBand";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { VisibiliteBenefits } from "@/components/visibilite/VisibiliteBenefits";
import { SERVICES, serviceOfficial, type ServiceId } from "@/content/services";
import { CLIENT_SECTORS } from "@/content/sectors";
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

const PATH = "/visibilite-entreprise";

export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  const title = isFr
    ? "La visibilité de votre entreprise, offerte | Axion-IA"
    : "Your company's visibility, offered | Axion-IA";
  const description = isFr
    ? "Devenez client Axion-IA et gagnez en visibilité : podcast dirigeant, interviews de vos équipes, page dédiée sur axion-ia.com, backlink dofollow (autorité SEO) et relais LinkedIn — offerts avec chaque formation, audit, implémentation ou site web IA."
    : "Become an Axion-IA client and gain visibility: executive podcast, team interviews, dedicated page on axion-ia.com, dofollow backlink (SEO authority) and LinkedIn share — included with every training, audit, implementation or AI website.";
  return {
    ...buildProductMetadata({ locale, path: PATH, title, description }),
    title: { absolute: title },
  };
}

export default async function VisibiliteClient({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const heroImage = getPageImages(PATH).find((i) => i.slot === "hero");

  const breadcrumbItems = [
    { href: PATH, label: isFr ? "Visibilité entreprise" : "Company visibility" },
  ];

  // ── JSON-LD ────────────────────────────────────────────────────────────────
  const primaryImage = buildPrimaryImageOfPage(PATH);
  const collectionPageJsonLd = buildCollectionPageJsonLd({
    locale: loc,
    path: PATH,
    name: isFr
      ? "La visibilité de votre entreprise, offerte par Axion-IA"
      : "Your company's visibility, offered by Axion-IA",
    description: isFr
      ? "Les 5 leviers de visibilité offerts aux clients Axion-IA : podcast, interviews, page dédiée, backlink dofollow, LinkedIn — avec chaque service."
      : "The 5 visibility levers offered to Axion-IA clients: podcast, interviews, dedicated page, dofollow backlink, LinkedIn — with every service.",
    speakable: true,
    ...(primaryImage ? { extra: { primaryImageOfPage: primaryImage } } : {}),
  });

  const benefitList = isFr
    ? [
        { name: "Podcast dirigeant ou collaborateur", desc: "Un échange diffusé sur nos canaux." },
        { name: "Interviews des participants", desc: "Témoignages vidéo de vos équipes." },
        {
          name: "Page dédiée sur axion-ia.com",
          desc: "Une page entreprise optimisée SEO sur un domaine à forte autorité.",
        },
        {
          name: "Backlink dofollow",
          desc: "Un lien qui transmet de l'autorité SEO à votre site.",
        },
        { name: "Relais LinkedIn", desc: "Diffusion auprès de notre audience B2B." },
      ]
    : [
        { name: "Executive or employee podcast", desc: "A conversation shared on our channels." },
        { name: "Participant interviews", desc: "Video testimonials from your teams." },
        {
          name: "Dedicated page on axion-ia.com",
          desc: "An SEO-optimised company page on a high-authority domain.",
        },
        { name: "Dofollow backlink", desc: "A link passing SEO authority to your site." },
        { name: "LinkedIn share", desc: "Distribution to our B2B audience." },
      ];

  const itemListJsonLd = buildItemListJsonLd({
    locale: loc,
    path: PATH,
    name: isFr
      ? "Leviers de visibilité offerts aux clients Axion-IA"
      : "Visibility levers offered to Axion-IA clients",
    items: benefitList.map((b, i) => ({
      position: i + 1,
      name: b.name,
      url: `${SITE_URL}/${loc}${PATH}#levier-${i + 1}`,
      description: b.desc,
    })),
  });

  const imageGraphJsonLd = buildPageImageGraphJsonLd({ locale: loc, path: PATH });

  // ── Contenu ────────────────────────────────────────────────────────────────
  const heroChips: ReadonlyArray<{ icon: typeof Sparkles; label: string }> = [
    { icon: Sparkles, label: isFr ? "5 leviers de visibilité" : "5 visibility levers" },
    { icon: Link2, label: isFr ? "Backlink dofollow" : "Dofollow backlink" },
    { icon: TrendingUp, label: isFr ? "Autorité SEO" : "SEO authority" },
    { icon: Users, label: isFr ? "Preuve sociale" : "Social proof" },
  ];

  const serviceIcons: Record<ServiceId, typeof GraduationCap> = {
    formations: GraduationCap,
    unAUn: Users,
    audit: Search,
    implementation: Cpu,
    sitesWeb: Code2,
  };

  const valeurs: ReadonlyArray<{ icon: typeof TrendingUp; title: string; body: string }> = [
    {
      icon: TrendingUp,
      title: isFr ? "Une autorité SEO durable" : "Durable SEO authority",
      body: isFr
        ? "Le backlink dofollow et votre page dédiée renforcent le référencement naturel de votre site : plus de trafic organique, un actif qui travaille pour vous des années."
        : "The dofollow backlink and your dedicated page strengthen your site's ranking: more organic traffic, an asset that works for years.",
    },
    {
      icon: MapPin,
      title: isFr ? "Notoriété locale & nationale" : "Local & national awareness",
      body: isFr
        ? "Podcast, page et LinkedIn diffusent votre nom bien au-delà de vos clients actuels — dans votre ville, votre secteur, et à l'échelle nationale."
        : "Podcast, page and LinkedIn spread your name far beyond your current clients — in your city, your sector, and nationwide.",
    },
    {
      icon: ShieldCheck,
      title: isFr ? "Preuve sociale & confiance" : "Social proof & trust",
      body: isFr
        ? "Les témoignages de vos équipes et votre association à une démarche IA innovante rassurent vos prospects et crédibilisent votre entreprise."
        : "Your teams' testimonials and your association with an innovative AI approach reassure prospects and boost credibility.",
    },
    {
      icon: Users,
      title: isFr ? "Marque employeur & recrutement" : "Employer brand & hiring",
      body: isFr
        ? "Valoriser vos collaborateurs et montrer une entreprise tournée vers l'IA renforce votre attractivité auprès des talents."
        : "Showcasing your employees and an AI-forward company boosts your appeal to talent.",
    },
  ];

  const steps: ReadonlyArray<{ n: string; title: string; body: string }> = [
    {
      n: "01",
      title: isFr ? "Vous devenez client" : "You become a client",
      body: isFr
        ? "Formation, 1-to-1, audit, implémentation ou site web IA — la visibilité est offerte avec toutes nos prestations."
        : "Training, 1-to-1, audit, implementation or AI website — visibility comes with all our services.",
    },
    {
      n: "02",
      title: isFr ? "On cadre ensemble" : "We frame it together",
      body: isFr
        ? "On choisit les formats qui vous mettent le mieux en valeur : angle du podcast, participants à interviewer, contenu de votre page."
        : "We pick the formats that showcase you best: podcast angle, participants to interview, your page content.",
    },
    {
      n: "03",
      title: isFr ? "On produit le contenu" : "We produce the content",
      body: isFr
        ? "Enregistrement, montage, rédaction et optimisation SEO — on s'occupe de tout, vous validez."
        : "Recording, editing, copywriting and SEO optimisation — we handle everything, you approve.",
    },
    {
      n: "04",
      title: isFr ? "On publie et on relaie" : "We publish and share",
      body: isFr
        ? "Page en ligne + backlink dofollow + relais LinkedIn : votre visibilité est lancée, durablement."
        : "Page live + dofollow backlink + LinkedIn share: your visibility is launched, for the long run.",
    },
  ];

  const faqItems: ReadonlyArray<{ id: string; question: string; answer: string }> = [
    {
      id: "definition",
      question: isFr
        ? "En quoi consiste la visibilité offerte par Axion-IA ?"
        : "What is the visibility offered by Axion-IA?",
      answer: isFr
        ? "En devenant client Axion-IA (formation, 1-to-1, audit, implémentation ou site web IA), votre entreprise bénéficie gratuitement de 5 leviers de visibilité : un podcast avec votre dirigeant ou un collaborateur, des interviews de vos participants, une page dédiée à votre entreprise sur axion-ia.com, un backlink dofollow vers votre site (autorité SEO) et un relais sur LinkedIn."
        : "By becoming an Axion-IA client (training, 1-to-1, audit, implementation or AI website), your company gets 5 visibility levers for free: a podcast with your executive or an employee, interviews of your participants, a dedicated page about your company on axion-ia.com, a dofollow backlink to your site (SEO authority) and a LinkedIn share.",
    },
    {
      id: "gratuit",
      question: isFr
        ? "Est-ce vraiment inclus, sans surcoût ?"
        : "Is it really included, at no extra cost?",
      answer: isFr
        ? "Oui. La visibilité est un bonus offert avec chacune de nos prestations, sans surcoût. C'est notre façon de créer une vraie relation gagnant-gagnant : vous montez en compétence sur l'IA, et votre entreprise gagne en notoriété."
        : "Yes. Visibility is a bonus included with each of our services, at no extra cost. It's how we build a real win-win relationship: you upskill on AI, and your company gains awareness.",
    },
    {
      id: "dofollow",
      question: isFr ? "Le backlink est-il bien en dofollow ?" : "Is the backlink really dofollow?",
      answer: isFr
        ? "Oui, le lien depuis votre page dédiée vers votre site est en dofollow : il transmet de l'autorité de domaine et améliore réellement votre référencement Google. C'est un actif SEO rare que la plupart des prestataires ne proposent pas."
        : "Yes, the link from your dedicated page to your site is dofollow: it passes domain authority and genuinely improves your Google ranking. It's a rare SEO asset most providers don't offer.",
    },
    {
      id: "qui-decide",
      question: isFr
        ? "Qui décide du contenu (podcast, page, interviews) ?"
        : "Who decides the content (podcast, page, interviews)?",
      answer: isFr
        ? "Vous. Tout est co-construit et validé par vos soins avant publication : l'angle du podcast, les participants interviewés, le contenu de votre page. Rien n'est publié sans votre accord."
        : "You do. Everything is co-built and approved by you before publication: the podcast angle, interviewed participants, your page content. Nothing is published without your consent.",
    },
    {
      id: "tous-services",
      question: isFr
        ? "Cela vaut pour tous les services Axion-IA ?"
        : "Does it apply to all Axion-IA services?",
      answer: isFr
        ? "Oui : formations IA, accompagnement 1-to-1, audits IA, implémentations & intégrations, et sites web & SaaS augmentés à l'IA. Quel que soit le service choisi, votre visibilité est offerte."
        : "Yes: AI training, 1-to-1 coaching, AI audits, implementations & integrations, and AI-augmented websites & SaaS. Whatever service you choose, your visibility is included.",
    },
  ];

  const heroCtas = (
    <>
      <Cta href="/appel" variant="primary" size="lg" track="visibilite-hero-appel">
        {isFr ? "Réserver un appel" : "Book a call"}
        <ArrowRight aria-hidden="true" className="h-4 w-4" />
      </Cta>
      <Cta href="/contact" variant="outline" size="lg" track="visibilite-hero-contact">
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
        eyebrow={isFr ? "Le bonus Axion-IA · valable pour tous nos services" : "The Axion-IA bonus"}
        title={isFr ? "La visibilité de votre entreprise," : "Your company's visibility,"}
        titleEm={isFr ? "offerte" : "offered"}
        description={
          isFr
            ? "Chez Axion-IA, on ne fait pas que vous accompagner sur l'IA : on met votre entreprise en lumière. Podcast, interviews, page dédiée, backlink dofollow et LinkedIn — offerts avec chaque prestation. Un vrai coup de projecteur, local ou national."
            : "At Axion-IA, we don't just help you with AI: we put your company in the spotlight. Podcast, interviews, dedicated page, dofollow backlink and LinkedIn — included with every service. Real exposure, local or national."
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

      {/* ── LES 5 LEVIERS (bandeaux image/texte) ─────────────────────────── */}
      <Section
        id="leviers"
        eyebrow={isFr ? "5 leviers, 1 objectif" : "5 levers, 1 goal"}
        title={isFr ? "On met votre entreprise" : "We put your company"}
        titleEm={isFr ? "en lumière" : "in the spotlight"}
        description={
          isFr
            ? "Cinq façons concrètes de gagner en visibilité, en notoriété et en autorité — offertes avec votre prestation."
            : "Five concrete ways to gain visibility, awareness and authority — included with your service."
        }
      >
        <VisibiliteBenefits isFr={isFr} />
      </Section>

      {/* ── AVEC TOUS NOS SERVICES ───────────────────────────────────────── */}
      <Section
        id="services"
        tone="paper"
        eyebrow={isFr ? "Valable partout" : "Everywhere"}
        title={isFr ? "Offert avec" : "Included with"}
        titleEm={isFr ? "tous nos services" : "all our services"}
        description={
          isFr
            ? "Quelle que soit la prestation que vous choisissez chez Axion-IA, la visibilité de votre entreprise est offerte."
            : "Whichever service you choose at Axion-IA, your company's visibility is included."
        }
      >
        <ul role="list" className="xs:grid-cols-2 grid grid-cols-1 gap-4 lg:grid-cols-5">
          {SERVICES.map((s) => {
            const Icon = serviceIcons[s.id];
            return (
              <li key={s.id}>
                <Link
                  href={s.href as never}
                  className="shadow-subtle hover:shadow-elevated group bg-bg flex h-full flex-col gap-3 rounded-2xl p-5 transition hover:-translate-y-0.5"
                >
                  <span className="bg-terracotta-soft text-terracotta-deep inline-flex h-11 w-11 items-center justify-center rounded-xl">
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <span className="text-fg text-sm font-semibold tracking-tight">
                    {serviceOfficial(s, isFr)}
                  </span>
                  <span className="text-terracotta mt-auto text-[13px] font-medium">
                    {isFr ? "Découvrir →" : "Discover →"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Section>

      {/* ── LA VALEUR / ROI ──────────────────────────────────────────────── */}
      <Section
        eyebrow={isFr ? "Pourquoi ça compte" : "Why it matters"}
        title={isFr ? "Une valeur qui" : "Value that"}
        titleEm={isFr ? "vous survit" : "outlasts you"}
        description={
          isFr
            ? "La visibilité n'est pas un gadget : c'est un actif marketing durable pour votre entreprise — référencement, notoriété, confiance, recrutement."
            : "Visibility isn't a gimmick: it's a durable marketing asset — ranking, awareness, trust, hiring."
        }
      >
        <div className="xs:grid-cols-2 grid grid-cols-1 gap-x-8 gap-y-9 lg:grid-cols-4">
          {valeurs.map((v) => (
            <div key={v.title} className="flex flex-col gap-3">
              <span className="bg-terracotta-soft text-terracotta-deep inline-flex h-11 w-11 items-center justify-center rounded-xl">
                <v.icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <h3 className="text-fg text-base font-semibold tracking-tight">{v.title}</h3>
              <p data-speakable className="text-fg-soft text-sm leading-relaxed">
                {v.body}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── COMMENT ÇA SE PASSE ──────────────────────────────────────────── */}
      <Section
        tone="paper"
        eyebrow={isFr ? "Simple et clé en main" : "Simple and turnkey"}
        title={isFr ? "Comment ça" : "How it"}
        titleEm={isFr ? "se passe" : "works"}
      >
        <ol className="xs:grid-cols-2 grid grid-cols-1 gap-5 lg:grid-cols-4">
          {steps.map((step) => (
            <li key={step.n} className="border-border bg-bg flex flex-col rounded-2xl border p-6">
              <span
                className="text-terracotta/40 block text-3xl font-semibold"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {step.n}
              </span>
              <h3 className="text-fg mt-3 text-base font-semibold tracking-tight">{step.title}</h3>
              <p className="text-fg-soft mt-2 text-sm leading-relaxed">{step.body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8 flex flex-wrap gap-3">{heroCtas}</div>
      </Section>

      {/* ── SECTEURS ─────────────────────────────────────────────────────── */}
      <Section
        id="secteurs"
        eyebrow={isFr ? "Tous secteurs" : "Every sector"}
        title={isFr ? "Une mise en lumière pour" : "A spotlight for"}
        titleEm={isFr ? "votre secteur" : "your sector"}
        description={
          isFr
            ? "Quel que soit votre domaine, votre page dédiée et votre podcast sont pensés pour votre secteur d'activité."
            : "Whatever your field, your dedicated page and podcast are tailored to your sector."
        }
      >
        <ul role="list" className="flex flex-wrap gap-2">
          {CLIENT_SECTORS.map((s) => (
            <li key={s.slug}>
              <Link
                href={`/secteurs/${s.slug}` as never}
                className="text-fg bg-bg border-border hover:border-terracotta hover:text-terracotta inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition"
              >
                <span aria-hidden="true">{s.emoji}</span>
                {s.labelFr}
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <Section
        id="faq"
        eyebrow={isFr ? "Questions fréquentes" : "Frequently asked"}
        title={isFr ? "Vos questions sur la" : "Your questions about the"}
        titleEm={isFr ? "visibilité offerte" : "free visibility"}
      >
        <div className="max-w-3xl">
          <FaqAccordion items={faqItems} />
        </div>
      </Section>

      {/* ── CTA FINAL ────────────────────────────────────────────────────── */}
      <CtaBlock
        tone="mocha"
        eyebrow={isFr ? "Gagnant-gagnant" : "Win-win"}
        title={isFr ? "Devenez client," : "Become a client,"}
        titleEm={isFr ? "et brillez" : "and shine"}
        description={
          isFr
            ? "Choisissez une prestation Axion-IA et repartez avec bien plus qu'un service : une vraie longueur d'avance en visibilité."
            : "Pick an Axion-IA service and leave with far more than a service: a real head start in visibility."
        }
        cta={
          <>
            <Cta href="/appel" variant="primary" size="xl" track="visibilite-final-appel">
              {isFr ? "Réserver un appel" : "Book a call"}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Cta>
            <Cta href="/contact" variant="outline" size="xl" track="visibilite-final-contact">
              {isFr ? "Écrire un message" : "Send a message"}
            </Cta>
          </>
        }
      />

      <StickyMobileCta
        href="/appel"
        label={isFr ? "Réserver un appel" : "Book a call"}
        track="visibilite-sticky"
      />
    </>
  );
}
