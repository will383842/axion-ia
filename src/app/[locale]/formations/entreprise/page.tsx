// Landing flagship « Toutes nos formations IA en entreprise » (2026-07-05).
//
// Objectif : LA page qui capte « formation IA entreprise » / « meilleures
// formations IA entreprise France ». Catalogue À PLAT du SSOT FORMATIONS_V2 (durée =
// badge par carte, PAS d'axe de tri — décision Will), chaque carte cliquable →
// fiche détail. Aucun prix en dur (matrice pricing.ts). Financement/Qualiopi
// gatés par `OF_PUBLIC_DISCLOSURE_ENABLED` (Phase B) via composants auto-gatés.
// Server Component pur (budget Web Vitals) : seuls StickyMobileCta (client) et le
// méga-menu header portent du JS. CTA « Réserver un appel » / « Écrire un
// message » répétés à chaque étape du parcours.

import type { Metadata } from "next";
import Image from "next/image";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Check,
  Clock,
  MapPin,
  ShieldCheck,
  Sparkles,
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
import { ClientLogosBand } from "@/components/sections/ClientLogosBand";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { FinancingBadges } from "@/components/qualiopi/FinancingBadges";
import { FormationsCatalogueGrid } from "@/components/formations/FormationsCatalogueGrid";
import { CLIENT_SECTORS } from "@/content/sectors";
import { getVillesIndexableNow } from "@/content/villes";
import { FORMATIONS_V2 } from "@/content/formations/catalog-v2";
import { formatAmount, getFormationCatalogPriceRange } from "@/content/pricing";
import { isQualiopiPublicDisclosureEnabled } from "@/server/qualiopi/config/flag";
import {
  buildProductMetadata,
  buildCollectionPageJsonLd,
  buildItemListJsonLd,
  buildServiceJsonLd,
  buildPageImageGraphJsonLd,
  buildPrimaryImageOfPage,
  SITE_URL,
} from "@/lib/seo";
import { getPageImages } from "@/lib/seo/page-images";
import { buildServiceAreasServed } from "@/lib/service-coverage";

interface Props {
  params: Promise<{ locale: string }>;
}

const PATH = "/formations/entreprise";

// ISR — la page dérive du catalogue + du flag Phase B (financement/Qualiopi).
// 1h repeuple le financement gaté une fois la Phase B active, sans rebuild.
export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const loc: "fr" | "en" = locale === "fr" ? "fr" : "en";
  const isFr = loc === "fr";
  const entryPrice = formatAmount(getFormationCatalogPriceRange().minEur, loc);
  // Compteur dérivé du SSOT : ajouter/retirer une formation dans FORMATIONS_V2
  // met à jour tous les libellés (titre, meta, JSON-LD, chips…) automatiquement.
  const total = FORMATIONS_V2.length;
  const ofPublic = isQualiopiPublicDisclosureEnabled();
  const finBit = ofPublic
    ? isFr
      ? " Certifié Qualiopi, finançable OPCO."
      : " Qualiopi-certified, OPCO-fundable."
    : "";
  const title = isFr
    ? `Formations IA en entreprise — nos ${total} formations sur mesure | Axion-IA`
    : `Corporate AI training — our ${total} tailored trainings | Axion-IA`;
  const description = isFr
    ? `Le catalogue complet des formations IA en entreprise Axion-IA : ${total} formations opérationnelles sur site, de 4 h à 3 jours, tous secteurs, partout en France.${finBit} Dès ${entryPrice} HT.`
    : `The full catalogue of Axion-IA corporate AI trainings: ${total} operational on-site trainings, from 4 h to 3 days, every sector, across France.${finBit} From ${entryPrice} excl. VAT.`;
  return {
    ...buildProductMetadata({ locale, path: PATH, title, description }),
    title: { absolute: title },
  };
}

export default async function FormationsEntreprise({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const ofPublic = isQualiopiPublicDisclosureEnabled();

  const entryPrice = formatAmount(getFormationCatalogPriceRange().minEur, loc);
  // Compteur dérivé du SSOT (auto-maj si on ajoute/retire une formation).
  const total = FORMATIONS_V2.length;
  const images = getPageImages(PATH);
  const heroImage = images.find((i) => i.slot === "hero");
  const bannerImage = images.find((i) => i.slot === "banner");
  const portraitImage = images.find((i) => i.slot === "portrait");

  const breadcrumbItems = [
    { href: "/formations", label: isFr ? "Formations IA" : "AI training" },
    { href: PATH, label: isFr ? "Formations entreprise" : "Corporate training" },
  ];

  // ── JSON-LD ────────────────────────────────────────────────────────────────
  const collectionPageJsonLd = buildCollectionPageJsonLd({
    locale: loc,
    path: PATH,
    name: isFr ? "Toutes nos formations IA en entreprise" : "All our corporate AI trainings",
    description: isFr
      ? `Catalogue complet des ${total} formations IA en entreprise Axion-IA, sur site partout en France, de 4 h à 3 jours, dès ${entryPrice} HT.`
      : `Full catalogue of the ${total} Axion-IA corporate AI trainings, on site across France, from 4 h to 3 days, from ${entryPrice} excl. VAT.`,
    speakable: true,
    ...(buildPrimaryImageOfPage(PATH)
      ? { extra: { primaryImageOfPage: buildPrimaryImageOfPage(PATH) } }
      : {}),
  });

  const itemListJsonLd = buildItemListJsonLd({
    locale: loc,
    path: PATH,
    name: isFr ? "Catalogue des formations IA en entreprise" : "Corporate AI training catalogue",
    items: FORMATIONS_V2.map((f, i) => ({
      position: i + 1,
      name: f.titreFr,
      url: `${SITE_URL}/${loc}/formations/${f.slugFr}`,
      description: f.accrocheFr,
    })),
  });

  const serviceJsonLd = buildServiceJsonLd({
    locale: loc,
    path: PATH,
    name: isFr
      ? "Formations IA en entreprise · sur site · Axion-IA"
      : "Corporate AI training · on site · Axion-IA",
    description: isFr
      ? `${total} formations IA opérationnelles pour vos équipes, animées dans vos locaux partout en France, dès ${entryPrice} HT.`
      : `${total} operational AI trainings for your teams, delivered on site across France, from ${entryPrice} excl. VAT.`,
    serviceType: "AI training",
    priceEur: getFormationCatalogPriceRange().minEur,
    areasServed: buildServiceAreasServed(loc),
  });

  const imageGraphJsonLd = buildPageImageGraphJsonLd({ locale: loc, path: PATH });

  // ── Contenu ──────────────────────────────────────────────────────────────
  const heroChips: ReadonlyArray<{ icon: typeof Sparkles; label: string; on: boolean }> = [
    { icon: Sparkles, label: isFr ? `${total} formations` : `${total} trainings`, on: true },
    { icon: Building2, label: isFr ? "Dans vos locaux" : "At your premises", on: true },
    { icon: MapPin, label: isFr ? "Partout en France" : "Across France", on: true },
    {
      icon: Users,
      label: isFr ? "Tous secteurs, tous métiers" : "Every sector, every role",
      on: true,
    },
    { icon: ShieldCheck, label: isFr ? "Certifié Qualiopi" : "Qualiopi-certified", on: ofPublic },
    { icon: Wallet, label: isFr ? "Finançable OPCO" : "OPCO-fundable", on: ofPublic },
  ];

  const features: ReadonlyArray<{ title: string; body: string }> = [
    {
      title: isFr ? "Sur mesure, par métier" : "Tailored, by role",
      body: isFr
        ? "Chaque formation est adaptée à vos outils, vos vrais dossiers et votre secteur. Vos équipes s'entraînent sur leur quotidien, pas sur des exemples abstraits."
        : "Every training is tailored to your tools, your real files and your sector. Teams practise on their day-to-day, not abstract examples.",
    },
    {
      title: isFr ? "Sur site, partout en France" : "On site, across France",
      body: isFr
        ? "Le formateur se déplace dans vos locaux — de la TPE au grand compte, en présentiel, sans désorganiser votre activité."
        : "The trainer comes to your premises — from micro-business to large accounts, in person, without disrupting your operations.",
    },
    {
      title: isFr ? "Formateurs IA experts" : "Expert AI trainers",
      body: isFr
        ? "Une équipe de formateurs opérationnels, cas d'usage métier chiffrés, à jour des derniers outils (ChatGPT, Claude, Mistral, agents IA)."
        : "A team of operational trainers, quantified business use cases, up to date with the latest tools (ChatGPT, Claude, Mistral, AI agents).",
    },
    {
      title: isFr ? "Résultats mesurables" : "Measurable results",
      body: isFr
        ? "Chaque participant repart avec un livrable terminé et des gains de temps immédiats — pas seulement des notes."
        : "Every participant leaves with a finished deliverable and immediate time savings — not just notes.",
    },
  ];

  const stats: ReadonlyArray<{ value: string; label: string }> = [
    { value: String(total), label: isFr ? "formations au catalogue" : "trainings in catalogue" },
    { value: "10", label: isFr ? "secteurs couverts" : "sectors covered" },
    { value: isFr ? "30-60 min" : "30-60 min", label: isFr ? "gagnées par jour" : "saved per day" },
    { value: `${entryPrice}`, label: isFr ? "à partir de, HT" : "starting from, excl. VAT" },
  ];

  const dureeChips: ReadonlyArray<{ href: string; label: string }> = [
    { href: "/formations/duree/4-heures", label: isFr ? "4 heures" : "4 hours" },
    { href: "/formations/duree/1-jour", label: isFr ? "1 jour" : "1 day" },
    { href: "/formations/duree/2-jours", label: isFr ? "2 jours" : "2 days" },
    { href: "/formations/duree/3-jours", label: isFr ? "3 jours et +" : "3 days and +" },
  ];

  // Métiers → formation la plus pertinente (maillage interne vers les fiches).
  const metiers: ReadonlyArray<{ href: string; label: string }> = [
    { href: "/formations/ia-express", label: isFr ? "Tous les collaborateurs" : "All employees" },
    { href: "/formations/ia-commercial", label: isFr ? "Commerciaux & ADV" : "Sales & order desk" },
    {
      href: "/formations/ia-au-bureau",
      label: isFr ? "Fonctions support & bureau" : "Support & office",
    },
    { href: "/formations/ia-sur-le-terrain", label: isFr ? "Équipes terrain" : "Field teams" },
    {
      href: "/formations/ia-transformation-equipe",
      label: isFr ? "Dirigeants & managers" : "Executives & managers",
    },
    {
      href: "/formations/ia-conformite",
      label: isFr ? "Conformité & juridique" : "Compliance & legal",
    },
    { href: "/formations/ia-securite", label: isFr ? "Sécurité des données" : "Data security" },
    {
      href: "/formations/agents-automatisations",
      label: isFr ? "Ops & automatisations" : "Ops & automation",
    },
  ];

  const steps: ReadonlyArray<{ n: string; title: string; body: string }> = [
    {
      n: "01",
      title: isFr ? "Vous réservez" : "You book",
      body: isFr
        ? "Un appel ou un message : on cadre ensemble vos objectifs, vos équipes et le format le plus adapté."
        : "A call or a message: we frame your goals, teams and the best-suited format together.",
    },
    {
      n: "02",
      title: isFr ? "On prépare votre journée" : "We prepare your day",
      body: isFr
        ? "Programme adapté à vos outils, votre secteur et vos vrais cas d'usage. Rien d'improvisé."
        : "Programme tailored to your tools, sector and real use cases. Nothing improvised.",
    },
    {
      n: "03",
      title: isFr ? "Le formateur intervient sur site" : "The trainer delivers on site",
      body: isFr
        ? "Formation pratique dans vos locaux, livrables terminés, et un suivi pour ancrer les acquis."
        : "Hands-on training at your premises, finished deliverables, and follow-up to embed the skills.",
    },
  ];

  const villes = getVillesIndexableNow().slice(0, 60);

  const faqItems: ReadonlyArray<{ id: string; question: string; answer: string }> = [
    {
      id: "combien-coute",
      question: isFr
        ? "Combien coûte une formation IA en entreprise ?"
        : "How much does a corporate AI training cost?",
      answer: isFr
        ? `Nos formations intra-entreprise démarrent à ${entryPrice} HT pour un groupe (et non par personne), selon la durée (4 h à 3 jours) et le format. Le tarif est forfaitaire par session : plus le groupe est nombreux, plus le coût par participant baisse.`
        : `Our in-company trainings start at ${entryPrice} excl. VAT for a group (not per person), depending on duration (4 h to 3 days) and format. The price is per session: the larger the group, the lower the cost per participant.`,
    },
    ...(ofPublic
      ? [
          {
            id: "financement-opco",
            question: isFr
              ? "Vos formations sont-elles finançables par un OPCO ?"
              : "Are your trainings OPCO-fundable?",
            answer: isFr
              ? "Oui. En tant qu'organisme certifié Qualiopi, nos formations sont éligibles à une prise en charge par votre OPCO, en tout ou partie, dans le cadre du plan de développement des compétences. Selon votre situation, votre reste à charge peut être fortement réduit, voire nul. Nous préparons le dossier avec vous."
              : "Yes. As a Qualiopi-certified provider, our trainings are eligible for OPCO funding, in full or in part, within the skills development plan. Depending on your situation, your remaining cost can be significantly reduced, or nil. We prepare the file with you.",
          },
          {
            id: "qualiopi",
            question: isFr ? "Êtes-vous certifié Qualiopi ?" : "Are you Qualiopi-certified?",
            answer: isFr
              ? "Oui, Axion-IA est un organisme de formation certifié Qualiopi. C'est la condition d'accès aux financements mutualisés (OPCO) et publics (France Travail : AIF, POEI)."
              : "Yes, Axion-IA is a Qualiopi-certified training provider. It is the condition for accessing mutualised (OPCO) and public (France Travail: AIF, POEI) funding.",
          },
        ]
      : []),
    {
      id: "sur-site",
      question: isFr
        ? "La formation a-t-elle lieu dans nos locaux ?"
        : "Is the training held at our premises?",
      answer: isFr
        ? "Oui, nos formations sont animées en présentiel dans vos locaux, partout en France. Le formateur se déplace ; vos équipes s'entraînent sur leurs propres outils et dossiers."
        : "Yes, our trainings are delivered in person at your premises, anywhere in France. The trainer travels to you; your teams practise on their own tools and files.",
    },
    {
      id: "nombre-participants",
      question: isFr ? "Combien de personnes peut-on former ?" : "How many people can be trained?",
      answer: isFr
        ? "De 2 à 30 personnes selon la formation (les gammes Agents & Automatisations et Claude sont en groupes limités à 12 pour garder un atelier efficace). Le tarif étant par session, former plus de personnes optimise le coût par participant."
        : "From 2 to 30 people depending on the training (the Agents & Automation and Claude ranges are capped at 12 for an effective workshop). As the price is per session, training more people optimises the cost per participant.",
    },
    {
      id: "prerequis",
      question: isFr
        ? "Faut-il des prérequis ou connaître l'IA ?"
        : "Are prerequisites or prior AI knowledge needed?",
      answer: isFr
        ? "Non pour la plupart de nos formations : elles sont conçues pour des débutants complets, tous postes mélangés. Un smartphone ou un ordinateur suffit. Les formats avancés indiquent leurs prérequis sur leur fiche."
        : "No for most of our trainings: they are designed for complete beginners, all roles mixed. A smartphone or computer is enough. Advanced formats state their prerequisites on their page.",
    },
    {
      id: "outils",
      question: isFr ? "Quels outils IA sont abordés ?" : "Which AI tools are covered?",
      answer: isFr
        ? "ChatGPT, Claude, Mistral, Copilot et les agents / automatisations métier, selon vos usages. Nous formons sur les outils que vous utilisez déjà (ou choisissons ensemble les plus adaptés)."
        : "ChatGPT, Claude, Mistral, Copilot and business agents / automations, depending on your usage. We train on the tools you already use (or pick the most relevant ones together).",
    },
    {
      id: "partout-france",
      question: isFr ? "Intervenez-vous partout en France ?" : "Do you deliver across France?",
      answer: isFr
        ? "Oui, dans toutes les régions et toutes les villes, en présentiel. Nous avons des pages dédiées par ville pour organiser au plus près de vous."
        : "Yes, in every region and city, in person. We have dedicated city pages to organise as close to you as possible.",
    },
  ];

  return (
    <>
      <JsonLd data={collectionPageJsonLd} />
      <JsonLd data={itemListJsonLd} />
      <JsonLd data={serviceJsonLd} />
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
            ? "N°1 des formations IA en entreprise · France"
            : "France's leading corporate AI training"
        }
        title={isFr ? "Formations IA" : "Corporate AI"}
        titleEm={isFr ? "en entreprise" : "training"}
        description={
          isFr
            ? `${total} formations opérationnelles, animées sur site partout en France, pour que vos équipes produisent avec l'IA dès le lendemain. De la TPE au grand compte, tous secteurs, tous métiers.`
            : `${total} operational trainings, delivered on site across France, so your teams produce with AI from the very next day. From micro-business to large accounts, every sector, every role.`
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
              className="shadow-card aspect-[3/2] h-auto w-full rounded-2xl object-cover"
            />
          ) : undefined
        }
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap gap-3">
            <Cta href="/appel" variant="primary" size="lg" track="formations-entreprise-hero-appel">
              {isFr ? "Réserver un appel" : "Book a call"}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Cta>
            <Cta
              href="/contact"
              variant="outline"
              size="lg"
              track="formations-entreprise-hero-contact"
            >
              {isFr ? "Écrire un message" : "Send a message"}
            </Cta>
          </div>
          <ul role="list" className="flex flex-wrap gap-2">
            {heroChips
              .filter((c) => c.on)
              .map((c) => (
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

      {/* ── LOGOS CLIENTS ────────────────────────────────────────────────── */}
      <div className="bg-bg">
        <Container className="pt-16 pb-2 text-center">
          <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
            {isFr
              ? "Ils forment déjà leurs équipes à l'IA avec Axion-IA"
              : "They already train their teams with Axion-IA"}
          </p>
        </Container>
      </div>
      <ClientLogosBand isFr={isFr} />

      {/* ── POURQUOI NOUS + STATS ────────────────────────────────────────── */}
      <Section
        tone="paper"
        eyebrow={isFr ? "Pourquoi Axion-IA" : "Why Axion-IA"}
        title={isFr ? "Les meilleures formations IA" : "The best AI trainings"}
        titleEm={isFr ? "pour vos équipes" : "for your teams"}
        description={
          isFr
            ? "Une approche concrète, sur mesure et mesurable — pensée pour l'entreprise française, de la TPE au grand compte."
            : "A concrete, tailored and measurable approach — designed for French companies, from micro-business to large accounts."
        }
      >
        <div className="xs:grid-cols-2 grid grid-cols-1 gap-5 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="border-border bg-bg rounded-2xl border p-6">
              <div className="bg-terracotta-soft text-terracotta-deep mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl">
                <Check aria-hidden="true" className="h-5 w-5" />
              </div>
              <h3 className="text-fg text-base font-semibold tracking-tight">{f.title}</h3>
              <p className="text-fg-soft mt-2 text-sm leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
        <dl className="border-border mt-10 grid grid-cols-2 gap-6 border-t pt-10 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label}>
              <dt className="sr-only">{s.label}</dt>
              <dd>
                <span
                  className="text-terracotta block text-3xl font-semibold tracking-tight lg:text-4xl"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {s.value}
                </span>
                <span className="text-fg-soft mt-1 block text-sm">{s.label}</span>
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* ── BANDEAU IMAGE ────────────────────────────────────────────────── */}
      {bannerImage ? (
        <div className="bg-bg">
          <Container>
            <Image
              src={bannerImage.src}
              alt={isFr ? bannerImage.altFr : bannerImage.altEn}
              width={bannerImage.width}
              height={bannerImage.height}
              sizes="(max-width: 1366px) 100vw, 1366px"
              className="aspect-[3/1] h-auto w-full rounded-3xl object-cover"
            />
          </Container>
        </div>
      ) : null}

      {/* ── CATALOGUE (toutes les formations FORMATIONS_V2, à plat) ───────── */}
      <Section
        id="catalogue"
        eyebrow={isFr ? "Le catalogue" : "The catalogue"}
        title={isFr ? `Nos ${total} formations IA` : `Our ${total} AI trainings`}
        titleEm={isFr ? "en entreprise" : "for companies"}
        description={
          isFr
            ? "La durée est indiquée sur chaque carte. Cliquez une formation pour voir le programme détaillé, le public visé et le tarif."
            : "The duration is shown on each card. Click a training to see the detailed programme, target audience and price."
        }
      >
        {/* Raccourcis par durée (maillage vers les listings) */}
        <div className="mb-8 flex flex-wrap gap-2">
          <span className="text-fg-muted mr-1 self-center text-[13px] font-medium">
            {isFr ? "Filtrer par durée :" : "Filter by duration:"}
          </span>
          {dureeChips.map((d) => (
            <Link
              key={d.href}
              href={d.href as never}
              className="text-fg border-border hover:border-terracotta hover:text-terracotta inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition"
            >
              <Clock aria-hidden="true" className="h-3.5 w-3.5" />
              {d.label}
            </Link>
          ))}
        </div>

        <FormationsCatalogueGrid locale={loc} />

        <p className="text-fg-soft mt-8 text-sm">
          {isFr
            ? "Vous ne trouvez pas exactement votre besoin ? "
            : "Can't find exactly what you need? "}
          <Link href="/contact" className="text-terracotta font-semibold hover:underline">
            {isFr
              ? "Demandez une formation 100 % sur mesure →"
              : "Ask for a 100% tailored training →"}
          </Link>
        </p>
      </Section>

      {/* ── CTA #1 ───────────────────────────────────────────────────────── */}
      <CtaBlock
        tone="terracotta"
        eyebrow={isFr ? "On vous aide à choisir" : "We help you choose"}
        title={isFr ? "Vous hésitez sur la" : "Not sure which"}
        titleEm={isFr ? "formation idéale" : "training fits"}
        titleTail={isFr ? " ?" : "?"}
        description={
          isFr
            ? "Un échange de 20 minutes suffit pour identifier la formation la plus utile à vos équipes — et étudier votre prise en charge."
            : "A 20-minute chat is enough to identify the most useful training for your teams — and study your funding."
        }
        cta={
          <>
            <Cta
              href="/appel"
              variant="secondary"
              size="lg"
              track="formations-entreprise-cta1-appel"
            >
              {isFr ? "Réserver un appel" : "Book a call"}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Cta>
            <Cta
              href="/contact"
              variant="outline"
              size="lg"
              track="formations-entreprise-cta1-contact"
            >
              {isFr ? "Écrire un message" : "Send a message"}
            </Cta>
          </>
        }
      />

      {/* ── FINANCEMENT / QUALIOPI / 0 € (gaté Phase B) ──────────────────── */}
      {ofPublic ? (
        <Section
          tone="sand"
          eyebrow={isFr ? "Financement" : "Funding"}
          title={isFr ? "Jusqu'à 0 € de reste à charge," : "Down to €0 out of pocket,"}
          titleEm={isFr ? "selon votre OPCO" : "with your OPCO"}
          description={
            isFr
              ? "Organisme certifié Qualiopi, nous rendons nos formations éligibles aux financements de la formation professionnelle. Nous montons le dossier avec vous."
              : "As a Qualiopi-certified provider, our trainings are eligible for professional training funding. We build the file with you."
          }
        >
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.2fr_1fr]">
            <FinancingBadges seed="formations-entreprise" />
            <ul role="list" className="flex flex-col gap-3">
              {[
                isFr
                  ? "Éligibilité vérifiée selon votre branche et votre OPCO"
                  : "Eligibility checked with your branch and OPCO",
                isFr
                  ? "Aide au montage du dossier de prise en charge (OPCO, France Travail)"
                  : "Help building the funding file (OPCO, France Travail)",
                isFr
                  ? "Convention, émargement et attestation conformes"
                  : "Compliant agreement, attendance sheet and certificate",
              ].map((item) => (
                <li key={item} className="text-fg flex items-start gap-2.5 text-sm leading-relaxed">
                  <Check aria-hidden="true" className="text-terracotta mt-0.5 h-4 w-4 shrink-0" />
                  {item}
                </li>
              ))}
              <li className="mt-2">
                <Cta
                  href="/appel"
                  variant="primary"
                  size="md"
                  track="formations-entreprise-financement-appel"
                >
                  {isFr ? "Étudier ma prise en charge" : "Study my funding"}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Cta>
              </li>
            </ul>
          </div>
        </Section>
      ) : null}

      {/* ── SECTEURS + MÉTIERS ───────────────────────────────────────────── */}
      <Section
        tone="paper"
        eyebrow={isFr ? "Tous secteurs, tous métiers" : "Every sector, every role"}
        title={isFr ? "Une formation IA pour" : "An AI training for"}
        titleEm={isFr ? "votre secteur" : "your sector"}
        description={
          isFr
            ? "Nous formons dans tous les secteurs d'activité et pour tous les métiers — avec des cas d'usage concrets adaptés à votre réalité."
            : "We train in every sector and for every role — with concrete use cases fitted to your reality."
        }
      >
        <ul role="list" className="xs:grid-cols-2 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {CLIENT_SECTORS.map((s) => (
            <li key={s.slug}>
              <Link
                href={`/secteurs/${s.slug}` as never}
                className="border-border hover:border-terracotta hover:shadow-card group bg-bg flex h-full items-center gap-3 rounded-2xl border p-4 transition"
              >
                <span
                  aria-hidden="true"
                  className="bg-sand flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
                >
                  {s.emoji}
                </span>
                <span className="min-w-0">
                  <span className="text-fg block text-sm font-semibold tracking-tight">
                    {s.labelFr}
                  </span>
                  <span className="text-terracotta text-[13px] font-medium">
                    {isFr ? "Voir les cas d'usage →" : "See use cases →"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-10">
          <p className="text-fg-muted mb-3 text-[13px] font-semibold tracking-[0.16em] uppercase">
            {isFr ? "Par métier" : "By role"}
          </p>
          <ul role="list" className="flex flex-wrap gap-2">
            {metiers.map((m) => (
              <li key={m.href}>
                <Link
                  href={m.href as never}
                  className="text-fg bg-bg border-border hover:border-terracotta hover:text-terracotta inline-flex items-center rounded-full border px-3.5 py-2 text-sm font-medium transition"
                >
                  {m.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* ── PROCESS ──────────────────────────────────────────────────────── */}
      <Section
        eyebrow={isFr ? "Comment ça se passe" : "How it works"}
        title={isFr ? "Votre formation en" : "Your training in"}
        titleEm={isFr ? "3 étapes" : "3 steps"}
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-center">
          <ol className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {steps.map((step) => (
              <li key={step.n} className="border-border bg-paper rounded-2xl border p-6">
                <span
                  className="text-terracotta/40 block text-4xl font-semibold"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {step.n}
                </span>
                <h3 className="text-fg mt-3 text-base font-semibold tracking-tight">
                  {step.title}
                </h3>
                <p className="text-fg-soft mt-2 text-sm leading-relaxed">{step.body}</p>
              </li>
            ))}
          </ol>
          {portraitImage ? (
            <Image
              src={portraitImage.src}
              alt={isFr ? portraitImage.altFr : portraitImage.altEn}
              width={portraitImage.width}
              height={portraitImage.height}
              sizes="(max-width: 1024px) 100vw, 33vw"
              className="aspect-[4/5] h-auto w-full rounded-3xl object-cover"
            />
          ) : null}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Cta
            href="/appel"
            variant="primary"
            size="lg"
            track="formations-entreprise-process-appel"
          >
            {isFr ? "Réserver un appel" : "Book a call"}
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Cta>
          <Cta
            href="/contact"
            variant="ghost"
            size="lg"
            track="formations-entreprise-process-contact"
          >
            {isFr ? "Écrire un message" : "Send a message"}
          </Cta>
        </div>
      </Section>

      {/* ── VILLES (maillage) ────────────────────────────────────────────── */}
      <Section
        tone="paper"
        eyebrow={isFr ? "Partout en France" : "Across France"}
        title={isFr ? "Formations IA près de" : "AI training near"}
        titleEm={isFr ? "chez vous" : "you"}
        description={
          isFr
            ? "Nous intervenons dans toutes les régions, en présentiel dans vos locaux. Trouvez votre ville :"
            : "We operate in every region, in person at your premises. Find your city:"
        }
      >
        <ul role="list" className="flex flex-wrap gap-x-2 gap-y-2.5">
          {villes.map((v) => (
            <li key={v.slug}>
              <Link
                href={`/formations/par-ville/${v.slug}` as never}
                className="text-fg-soft bg-bg border-border hover:border-terracotta hover:text-terracotta inline-flex items-center rounded-full border px-3 py-1.5 text-[13px] font-medium transition"
              >
                {isFr ? `Formation IA ${v.nameFr}` : `AI training ${v.nameFr}`}
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <Section
        eyebrow={isFr ? "Questions fréquentes" : "Frequently asked"}
        title={isFr ? "Vos questions sur nos" : "Your questions about our"}
        titleEm={isFr ? "formations IA" : "AI trainings"}
      >
        <div className="max-w-3xl">
          <FaqAccordion items={faqItems} />
        </div>
      </Section>

      {/* ── CTA FINAL ────────────────────────────────────────────────────── */}
      <CtaBlock
        tone="mocha"
        eyebrow={isFr ? "Prêt à démarrer ?" : "Ready to start?"}
        title={isFr ? "Formez vos équipes à l'IA," : "Train your teams on AI,"}
        titleEm={isFr ? "dès ce mois-ci" : "this month"}
        description={
          isFr
            ? "Choisissez votre formation, réservez votre date, et laissez-nous préparer une journée sur mesure pour vos équipes."
            : "Pick your training, book your date, and let us prepare a tailored day for your teams."
        }
        cta={
          <>
            <Cta
              href="/appel"
              variant="primary"
              size="xl"
              track="formations-entreprise-final-appel"
            >
              {isFr ? "Réserver un appel" : "Book a call"}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Cta>
            <Cta
              href="/contact"
              variant="outline"
              size="xl"
              track="formations-entreprise-final-contact"
            >
              {isFr ? "Écrire un message" : "Send a message"}
            </Cta>
          </>
        }
      />

      <StickyMobileCta
        href="/appel"
        label={isFr ? "Réserver un appel" : "Book a call"}
        track="formations-entreprise-sticky"
      />
    </>
  );
}
