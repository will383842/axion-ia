// Landing flagship « Toutes nos formations IA en entreprise » (2026-07-05).
//
// Objectif : LA page qui capte « formation IA entreprise » / « meilleures
// formations IA entreprise France ». Catalogue À PLAT du SSOT FORMATIONS_V2 (durée =
// badge par carte, PAS d'axe de tri — décision Will), chaque carte cliquable →
// fiche détail. Aucun prix en dur (matrice pricing.ts). Financement/Qualiopi
// gatés par `OF_PUBLIC_DISCLOSURE_ENABLED` (Phase B) via composants auto-gatés.
// Server Component pur (budget Web Vitals) : seuls StickyMobileCta (client), le
// méga-menu header et le marquee CSS logos portent du JS/CSS. CTA « Réserver un
// appel » / « Écrire un message » répétés à chaque étape du parcours.
//
// Ordre (Will 2026-07-05) : héro → catalogue → logos (marquee) → comment
// réserver → pourquoi → les plus (visibilité) → financement → secteurs → images
// → villes → FAQ → CTA.

import type { Metadata } from "next";
import Image from "next/image";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarClock,
  Check,
  FileText,
  Globe,
  GraduationCap,
  MapPin,
  MessageCircle,
  Mic,
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
import { ClientLogosMarqueeBand } from "@/components/services/audit/ClientLogosMarqueeBand";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { FinancingBadges } from "@/components/qualiopi/FinancingBadges";
import {
  FormationsCatalogueFilterable,
  type SlimFormation,
} from "@/components/formations/FormationsCatalogueFilterable";
import { FormationsLesPlus } from "@/components/formations/FormationsLesPlus";
import { CLIENT_SECTORS } from "@/content/sectors";
import { getVillesCoreIndexableNow } from "@/content/villes/core";
import { FORMATIONS_V2, getFormationV2EntryPrice } from "@/content/formations/catalog-v2";
import {
  FORMATION_DUREE_FACTS,
  getFormationImage,
  getFormationImageCredit,
} from "@/content/formations/catalog-v2-facts";
import { formatAmount, getFormationCatalogPriceRange } from "@/content/pricing";
import { isQualiopiCertificationObtenue } from "@/server/qualiopi/config/flag";
import {
  buildProductMetadata,
  buildCollectionPageJsonLd,
  buildCourseJsonLd,
  buildServiceJsonLd,
  buildHowToJsonLd,
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
  // formatAmount renvoie déjà « … € HT » — ne jamais ré-ajouter « HT ».
  // Compteur dérivé du SSOT : ajouter/retirer une formation dans FORMATIONS_V2
  // met à jour tous les libellés (titre, meta, JSON-LD, chips…) automatiquement.
  const total = FORMATIONS_V2.length;
  const ofPublic = isQualiopiCertificationObtenue();
  const finBit = ofPublic
    ? isFr
      ? " Certifié Qualiopi, finançable OPCO."
      : " Qualiopi-certified, OPCO-fundable."
    : "";
  const title = isFr
    ? `Formations IA en entreprise — nos ${total} formations sur mesure | Axion-IA`
    : `Corporate AI training — our ${total} tailored trainings | Axion-IA`;
  const description = isFr
    ? `Le catalogue complet des formations IA en entreprise Axion-IA : ${total} formations opérationnelles — offres générales, par métier, par secteur d'activité — partout en France.${finBit} Prix publics par groupe (2 à 15 pers.).`
    : `The full catalogue of Axion-IA corporate AI trainings: ${total} operational trainings — general, role-specific, industry-specific — across France.${finBit} Public prices per group (2-15 people).`;
  return {
    ...(await buildProductMetadata({ locale, path: PATH, title, description })),
    title: { absolute: title },
  };
}

export default async function FormationsEntreprise({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const ofPublic = isQualiopiCertificationObtenue();

  // Compteur dérivé du SSOT (auto-maj si on ajoute/retire une formation).
  const total = FORMATIONS_V2.length;
  const images = getPageImages(PATH);
  const heroImage = images.find((i) => i.slot === "hero");
  const reserveImage = images.find((i) => i.slot === "inline");

  const breadcrumbItems = [
    { href: "/formations", label: isFr ? "Formations IA" : "AI training" },
    { href: PATH, label: isFr ? "Formations entreprise" : "Corporate training" },
  ];

  // ── JSON-LD ────────────────────────────────────────────────────────────────
  const primaryImage = buildPrimaryImageOfPage(PATH);
  const collectionPageJsonLd = buildCollectionPageJsonLd({
    locale: loc,
    path: PATH,
    name: isFr ? "Toutes nos formations IA en entreprise" : "All our corporate AI trainings",
    description: isFr
      ? `Catalogue complet des ${total} formations IA en entreprise Axion-IA, sur site ou à distance partout en France — offres générales, par métier, par secteur, prix publics par groupe (jamais par personne).`
      : `Full catalogue of the ${total} Axion-IA corporate AI trainings, on site or remote across France — general, role and industry offers, public prices per group (never per person).`,
    speakable: true,
    ...(primaryImage ? { extra: { primaryImageOfPage: primaryImage } } : {}),
  });

  // Carrousel de formations (Course carousel — rich result 2026). ItemList dont
  // chaque item est un Course RÉFÉRENÇANT sa fiche détail (même @id `…#course` que
  // la page canonique → pas de doublon, c'est le pattern « summary page » de Google).
  // provider + hasCourseInstance + offers (prix SSOT `getFormationV2EntryPrice`)
  // rendent le carrousel éligible.
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: isFr ? "Catalogue des formations IA en entreprise" : "Corporate AI training catalogue",
    url: `${SITE_URL}/${loc}${PATH}`,
    numberOfItems: FORMATIONS_V2.length,
    itemListElement: FORMATIONS_V2.map((f, i) => {
      const p = getFormationV2EntryPrice(f);
      const { "@context": _ctx, ...course } = buildCourseJsonLd({
        locale: loc,
        path: `/formations/${f.slugFr}`,
        name: f.titreFr,
        description: f.accrocheFr,
        courseMode: ["Onsite", "Online"],
        audienceType: isFr ? "Entreprises" : "Businesses",
        ...(typeof p === "number" ? { priceEurHt: p } : {}),
      });
      return { "@type": "ListItem", position: i + 1, item: course };
    }),
  } as const;

  const serviceJsonLd = buildServiceJsonLd({
    locale: loc,
    path: PATH,
    name: isFr
      ? "Formations IA en entreprise · sur site · Axion-IA"
      : "Corporate AI training · on site · Axion-IA",
    description: isFr
      ? `${total} formations IA opérationnelles pour vos équipes, animées dans vos locaux partout en France — prix publics par groupe (2 à 15 participants), jamais par personne.`
      : `${total} operational AI trainings for your teams, delivered on site across France — public prices per group (2-15 people), never per person.`,
    serviceType: "AI training",
    areasServed: buildServiceAreasServed(loc),
  });

  const imageGraphJsonLd = buildPageImageGraphJsonLd({ locale: loc, path: PATH });

  // NB : PAS de Course JSON-LD ici. Le schéma Course est émis à sa place
  // CANONIQUE — par formation sur `/formations/[slug]` (FormationDetailPage) et
  // par durée sur `/formations/duree/[duree]` (FormationDurationListing). Cette
  // page de listing porte l'`ItemList` (les 17 formations → fiches), qui est le
  // bon schéma pour un catalogue. On évite ainsi de tripler les mêmes `@id`.

  // ── Données de contenu ─────────────────────────────────────────────────────
  const heroChips: ReadonlyArray<{ icon: typeof Sparkles; label: string; on: boolean }> = [
    { icon: Sparkles, label: isFr ? `${total} formations` : `${total} trainings`, on: true },
    {
      icon: Building2,
      label: isFr ? "Sur site (présentiel) ou à distance" : "On site or remote",
      on: true,
    },
    { icon: MapPin, label: isFr ? "Partout en France" : "Across France", on: true },
    {
      icon: Users,
      label: isFr ? "Tous secteurs, tous métiers" : "Every sector, every role",
      on: true,
    },
    { icon: ShieldCheck, label: isFr ? "Certifié Qualiopi" : "Qualiopi-certified", on: ofPublic },
    { icon: Wallet, label: isFr ? "Finançable OPCO" : "OPCO-fundable", on: ofPublic },
  ];

  // Liens crawlables vers les listings par catégorie (refonte 2026-07-19 — les
  // listings durée /formations/duree/* sont supprimés, 301 → hub).
  const categorieChips: ReadonlyArray<{ href: string; label: string }> = [
    { href: "/formations/metiers", label: isFr ? "Par métier" : "By role" },
    {
      href: "/formations/secteurs",
      label: isFr ? "Par secteur d'activité" : "By industry",
    },
    { href: "/formations/tarifs", label: isFr ? "Tous les tarifs" : "All prices" },
  ];

  // « Comment réserver » — 7 étapes COMPACTES (icône + titre + 1 ligne). Les
  // étapes financement (3-4) sont gatées Phase B ; hors Phase B, wording neutre.
  const reserveSteps: ReadonlyArray<{ icon: typeof Mic; title: string; body: string }> = [
    {
      icon: MessageCircle,
      title: isFr ? "Contactez-nous" : "Contact us",
      body: isFr ? "Appel ou message, on répond vite." : "Call or message, we reply fast.",
    },
    {
      icon: CalendarClock,
      title: isFr ? "Échange de 30 min" : "30-min call",
      body: isFr
        ? `Vos objectifs, vos équipes, votre date${ofPublic ? ", votre OPCO" : ""}.`
        : `Your goals, teams and date${ofPublic ? ", your OPCO" : ""}.`,
    },
    {
      icon: FileText,
      title: ofPublic
        ? isFr
          ? "Dossier OPCO"
          : "OPCO file"
        : isFr
          ? "Devis & cadrage"
          : "Quote & scope",
      body: ofPublic
        ? isFr
          ? "On monte votre prise en charge."
          : "We build your funding file."
        : isFr
          ? "Programme et devis validés."
          : "Programme and quote agreed.",
    },
    {
      icon: BadgeCheck,
      title: ofPublic
        ? isFr
          ? "Accord de financement"
          : "Funding approval"
        : isFr
          ? "Validation"
          : "Confirmation",
      body: ofPublic
        ? isFr
          ? "Votre OPCO valide la prise en charge."
          : "Your OPCO approves the funding."
        : isFr
          ? "Vous validez devis et date."
          : "You confirm quote and date.",
    },
    {
      icon: GraduationCap,
      title: isFr ? "On intervient" : "We deliver",
      body: isFr ? "Sur votre site, ou à distance." : "At your site, or remotely.",
    },
    {
      icon: Mic,
      title: isFr ? "Interviews & podcast" : "Interviews & podcast",
      body: isFr ? "On valorise vos participants." : "We spotlight your participants.",
    },
    {
      icon: Globe,
      title: isFr ? "Votre page + backlink" : "Your page + backlink",
      body: isFr ? "Page dédiée + lien dofollow." : "Dedicated page + dofollow link.",
    },
  ];

  // HowTo JSON-LD — les 7 étapes « Comment réserver » (dérivées de reserveSteps).
  // Signal GEO fort : cité par les moteurs génératifs pour « comment réserver /
  // organiser une formation IA en entreprise » (dossier OPCO inclus).
  const howToJsonLd = buildHowToJsonLd({
    locale: loc,
    path: PATH,
    name: isFr
      ? "Comment réserver votre formation IA en entreprise"
      : "How to book your corporate AI training",
    description: isFr
      ? "De la prise de contact à la visibilité offerte : les 7 étapes pour réserver et organiser votre formation IA en entreprise, dossier de financement OPCO inclus."
      : "From first contact to the free visibility bonus: the 7 steps to book and organise your corporate AI training, OPCO funding file included.",
    steps: reserveSteps.map((s) => ({ name: s.title, text: s.body })),
  });

  // Métiers → formation la plus pertinente (maillage interne vers les fiches,
  // dérivé du catalogue refonte 2026-07-19 — slugs actuels uniquement).
  const metiersLinks: ReadonlyArray<{ href: string; label: string }> = [
    {
      href: "/formations/ia-pour-bien-commencer",
      label: isFr ? "Tous les collaborateurs" : "All employees",
    },
    {
      href: "/formations/ia-pour-les-commerciaux",
      label: isFr ? "Commerciaux & ADV" : "Sales & order desk",
    },
    {
      href: "/formations/ia-pour-la-relation-client",
      label: isFr ? "Support & relation client" : "Support & customer service",
    },
    {
      href: "/formations/ia-pour-les-rh",
      label: isFr ? "RH & recrutement" : "HR & recruitment",
    },
    {
      href: "/formations/ia-pour-le-marketing",
      label: isFr ? "Marketing & communication" : "Marketing & communication",
    },
    {
      href: "/formations/ia-pour-la-finance",
      label: isFr ? "Finance & gestion" : "Finance & controlling",
    },
    {
      href: "/formations/ia-pour-le-juridique",
      label: isFr ? "Juridique" : "Legal",
    },
  ];

  const features: ReadonlyArray<{ icon: typeof Target; title: string; body: string }> = [
    {
      icon: Target,
      title: isFr ? "Une formation par métier" : "One training per role",
      body: isFr
        ? "RH, vente, marketing, finance, assistanat : des cas d'usage propres à chaque métier, jamais abstraits."
        : "HR, sales, marketing, finance, office support: use cases specific to each role, never abstract.",
    },
    {
      icon: MapPin,
      title: isFr ? "Sur site, partout en France" : "On site, across France",
      body: isFr
        ? "Le formateur se déplace dans vos locaux, de la PME au grand groupe."
        : "The trainer comes to your premises, from micro-business to large accounts.",
    },
    {
      icon: Users,
      title: isFr ? "Formateurs IA experts" : "Expert AI trainers",
      body: isFr
        ? "Des formateurs opérationnels, à jour des derniers outils (ChatGPT, Claude, Gemini…)."
        : "Operational trainers, up to date with the latest tools (ChatGPT, Claude, Gemini…).",
    },
    {
      icon: TrendingUp,
      title: isFr ? "Résultats mesurables" : "Measurable results",
      body: isFr
        ? "Chaque participant repart avec un livrable terminé et des gains de temps immédiats."
        : "Every participant leaves with a finished deliverable and immediate time savings.",
    },
  ];

  const stats: ReadonlyArray<{ value: string; label: string }> = [
    { value: String(total), label: isFr ? "formations au catalogue" : "trainings in catalogue" },
    { value: isFr ? "Tous" : "All", label: isFr ? "secteurs couverts" : "sectors covered" },
    { value: "30 min à 2 h", label: isFr ? "gagnées par jour" : "saved per day" },
    {
      value: isFr ? "Prix publics" : "Public prices",
      label: isFr ? "par groupe de 2 à 15" : "per group of 2-15",
    },
  ];

  const villes = getVillesCoreIndexableNow().slice(0, 60);

  // Données slim du catalogue passées au filtre client (prix déjà formaté côté
  // serveur → catalog-v2 reste hors bundle client). Refonte 2026-07-19 : filtre
  // par CATÉGORIE (générales / métiers / secteurs / séminaire), durée en badge.
  const slimFormations: readonly SlimFormation[] = FORMATIONS_V2.map((f) => {
    const p = getFormationV2EntryPrice(f);
    const facts = FORMATION_DUREE_FACTS[f.duree];
    const dureeBase = f.duree === "4h" ? facts.heuresLabelFr : facts.joursLabelFr;
    const image = getFormationImage(f);
    const credit = getFormationImageCredit(f);
    return {
      slugFr: f.slugFr,
      titreFr: f.titreFr,
      accrocheFr: f.accrocheFr,
      categorie: f.seminaire ? ("seminaire" as const) : (f.categorie ?? ("generale" as const)),
      ...(f.axeLabelFr ? { axeLabel: f.axeLabelFr } : {}),
      dureeLabel: f.scindable ? `${dureeBase} · scindable 2×1j` : dureeBase,
      featured: f.featured ?? false,
      priceLabel: p !== undefined ? formatAmount(p, loc) : isFr ? "Sur devis" : "On quote",
      fixedPrice: p !== undefined,
      imageSrc: image.src,
      imageAlt: image.altFr,
      ...(credit ? { creditName: credit.name, creditUrl: credit.url } : {}),
    };
  });

  const faqItems: ReadonlyArray<{ id: string; question: string; answer: string }> = [
    {
      // Réponse-définition concise (40-60 mots) → cible le featured snippet
      // (position 0) sur la requête informationnelle large.
      id: "definition",
      question: isFr
        ? "Qu'est-ce qu'une formation IA en entreprise ?"
        : "What is a corporate AI training?",
      answer: isFr
        ? `Une formation IA en entreprise est une session courte (de 4 heures à 2 jours) qui apprend à vos équipes à utiliser l'intelligence artificielle (ChatGPT, Claude, Gemini) sur leurs tâches réelles. Chez Axion-IA, elle a lieu dans vos locaux ou à distance${ofPublic ? ", est certifiée Qualiopi et finançable OPCO" : ""}, à prix public par groupe (2 à 15 participants, jamais par personne).`
        : `A corporate AI training is a short session (4 hours to 2 days) that teaches your teams to use artificial intelligence (ChatGPT, Claude, Gemini) on their real tasks. At Axion-IA it takes place on site or remotely${ofPublic ? ", is Qualiopi-certified and OPCO-fundable" : ""}, at a public price per group (2-15 people, never per person).`,
    },
    {
      id: "combien-coute",
      question: isFr
        ? "Combien coûte une formation IA en entreprise ?"
        : "How much does a corporate AI training cost?",
      answer: isFr
        ? `Nos prix sont publics et forfaitaires par groupe (2 à 15 participants), jamais par personne : de ${formatAmount(getFormationCatalogPriceRange().minEur, "fr")} (offre générale 4 h) à ${formatAmount(getFormationCatalogPriceRange().maxEur, "fr")} (formation sectorielle 2 jours). Plus le groupe est nombreux, plus le coût par participant baisse. La grille complète est sur la page tarifs ; le séminaire (jusqu'à 50 personnes) est sur devis.`
        : "Our prices are public and set per group (2-15 participants), never per person. The larger the group, the lower the cost per participant. The full grid is on the pricing page; the company seminar (up to 50 people) is on quote.",
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
      id: "visibilite",
      question: isFr
        ? "Qu'est-ce que la visibilité offerte après la formation ?"
        : "What is the free visibility after the training?",
      answer: isFr
        ? "En plus de la montée en compétence, nous mettons votre entreprise en avant : podcast du dirigeant ou d'un collaborateur, interviews des participants, une page dédiée à votre entreprise et votre secteur sur axion-ia.com avec un lien dofollow vers votre site, et un relais LinkedIn. Un vrai coup de projecteur, local ou national."
        : "Beyond upskilling, we spotlight your company: an executive or employee podcast, participant interviews, a dedicated page about your company and sector on axion-ia.com with a dofollow link to your site, and a LinkedIn share. Real exposure, local or national.",
    },
    {
      id: "sur-site",
      question: isFr
        ? "La formation a-t-elle lieu dans nos locaux ?"
        : "Is the training held at our premises?",
      answer: isFr
        ? "Oui, nos formations sont animées en présentiel dans vos locaux, partout en France (ou à distance si vous préférez). Le formateur se déplace ; vos équipes s'entraînent sur leurs propres outils et dossiers."
        : "Yes, our trainings are delivered in person at your premises, anywhere in France (or remotely if you prefer). The trainer travels to you; your teams practise on their own tools and files.",
    },
    {
      id: "nombre-participants",
      question: isFr ? "Combien de personnes peut-on former ?" : "How many people can be trained?",
      answer: isFr
        ? "De 2 à 15 personnes selon la formation (les gammes Agents & Automatisations et Claude sont en groupes limités à 12 pour garder un atelier efficace). Le tarif étant par session, former plus de personnes optimise le coût par participant."
        : "From 2 to 15 people depending on the training (the Agents & Automation and Claude ranges are capped at 12 for an effective workshop). As the price is per session, training more people optimises the cost per participant.",
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
        ? "Vous pratiquez ChatGPT, Claude et Gemini — les trois assistants les plus utilisés en entreprise — et vous créez vos propres assistants IA. Le reste du paysage (Copilot, Mistral, Perplexity…) est situé en panorama, sans être pratiqué en séance."
        : "You practise ChatGPT, Claude and Gemini — the three most widely used business assistants — and build your own AI assistants. The rest of the landscape (Copilot, Mistral, Perplexity…) is mapped out, not practised in session.",
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
        // 🔴 SEUL emplacement de cette page qui affirmait la certification SANS
        // consulter le drapeau. Trouvé le 2026-08-21 par
        // `tests/e2e/qualiopi/public-routes.spec.ts`, à sa toute première
        // exécution réelle — la suite ne tournait pas jusque-là (cf.
        // `tests/unit/ci/harnais-e2e-mesure-vraiment.spec.ts`).
        //
        // Le fichier applique pourtant `ofPublic` SIX fois autour : description de
        // metadata (l. 102), badge filtré par `.filter((c) => c.on)` (l. 210),
        // réponse FAQ « définition » (l. 416), les deux entrées FAQ dédiées
        // enveloppées par `...(ofPublic ? [ … ] : [])`, et jusqu'au visuel du héros
        // qui bascule sur la photo d'équipe. Aucune relecture ne pouvait voir
        // celui-ci : il fallait rendre la page drapeau baissé et lire la sortie.
        //
        // Aucun changement visible en production : le drapeau y vaut `true`.
        eyebrow={
          isFr
            ? `Formations IA en entreprise${ofPublic ? " · Certifié Qualiopi" : ""} · Toute la France`
            : `Corporate AI training${ofPublic ? " · Qualiopi-certified" : ""} · Across France`
        }
        title={isFr ? "Formations IA" : "Corporate AI"}
        titleEm={isFr ? "en entreprise" : "training"}
        description={
          isFr
            ? `${total} formations opérationnelles, animées sur site partout en France, pour que vos équipes produisent avec l'IA dès le lendemain. De la PME au grand groupe, tous secteurs, tous métiers.`
            : `${total} operational trainings, delivered on site across France, so your teams produce with AI from the very next day. From micro-business to large accounts, every sector, every role.`
        }
        media={
          // Phase B : visuel héro = logo Qualiopi officiel (mention incluse) sur
          // fond blanc (règle d'usage de la marque). Servi via next/image (optimisé,
          // sans déformation → conforme) pour préserver le LCP. Phase A : repli sur
          // la photo d'équipe (aucune mention Qualiopi tant que non certifié).
          ofPublic ? (
            <div className="flex aspect-[3/2] w-full items-center justify-center">
              <Image
                src="/qualiopi/axion-ia-qualiopi.png"
                alt={
                  isFr
                    ? "Organisme de formation certifié Qualiopi — Axion-IA (catégorie : actions de formation)"
                    : "Qualiopi-certified training provider — Axion-IA (category: training actions)"
                }
                width={480}
                height={320}
                priority
                quality={90}
                sizes="(max-width: 1024px) 88vw, 44vw"
                className="h-auto w-full max-w-[480px] object-contain"
              />
            </div>
          ) : heroImage ? (
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

      {/* ── BARRE D'ANCRES intra-page (collante sous le header) ──────────── */}
      <div className="bg-bg/90 border-border sticky top-[80px] z-30 border-b backdrop-blur">
        <Container>
          <nav
            aria-label={isFr ? "Sections de la page" : "Page sections"}
            className="flex flex-wrap gap-1 py-2.5"
          >
            {[
              { href: "#catalogue", label: isFr ? "Les formations" : "Trainings", on: true },
              { href: "#financement", label: isFr ? "Financement" : "Funding", on: ofPublic },
              { href: "#secteurs", label: isFr ? "Secteurs" : "Sectors", on: true },
              { href: "#faq", label: "FAQ", on: true },
            ]
              .filter((a) => a.on)
              .map((a) => (
                <a
                  key={a.href}
                  href={a.href}
                  className="text-fg-soft hover:bg-sand hover:text-terracotta shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition"
                >
                  {a.label}
                </a>
              ))}
          </nav>
        </Container>
      </div>

      {/* ── CATALOGUE (toutes les formations FORMATIONS_V2, à plat) ───────── */}
      <Section
        id="catalogue"
        className="pt-10 sm:pt-12 lg:pt-16"
        eyebrow={isFr ? "Le catalogue" : "The catalogue"}
        title={isFr ? `Nos ${total} formations IA` : `Our ${total} AI trainings`}
        titleEm={isFr ? "en entreprise" : "for companies"}
        description={
          isFr
            ? `${ofPublic ? "Organisme certifié Qualiopi. " : ""}Filtrez par catégorie : offres générales, par métier, par secteur d'activité. La durée et le prix sont sur chaque carte — cliquez pour voir le programme et le public visé.`
            : `${ofPublic ? "Qualiopi-certified provider. " : ""}Filter by category: general offers, by role, by industry. Duration and price are on each card — click to see the programme and target audience.`
        }
      >
        <FormationsCatalogueFilterable items={slimFormations} isFr={isFr} />

        {/* Liens catégorie crawlables (SEO / maillage vers les listings) */}
        <p className="text-fg-muted mt-8 text-[13px]">
          {isFr ? "Parcourir : " : "Browse: "}
          {categorieChips.map((d, i) => (
            <span key={d.href}>
              {i > 0 ? " · " : ""}
              <Link
                href={d.href as never}
                className="hover:text-terracotta underline underline-offset-2"
              >
                {d.label}
              </Link>
            </span>
          ))}
        </p>
        <p className="text-fg-soft mt-2 text-sm">
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

      {/* ── LOGOS CLIENTS (marquee défilant, sans titre) ─────────────────── */}
      <ClientLogosMarqueeBand isFr={isFr} />

      {/* ── RÉASSURANCE : atouts + chiffres (léger, sans boîtes) ─────────── */}
      <Section
        eyebrow={isFr ? "Pourquoi Axion-IA" : "Why Axion-IA"}
        title={isFr ? "Des formations IA" : "AI training"}
        titleEm={isFr ? "pensées pour l'entreprise" : "built for companies"}
      >
        <div className="xs:grid-cols-2 grid grid-cols-1 gap-x-8 gap-y-9 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="flex flex-col gap-3">
              <span className="bg-terracotta-soft text-terracotta-deep inline-flex h-11 w-11 items-center justify-center rounded-xl">
                <f.icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <h3 className="text-fg text-base font-semibold tracking-tight">{f.title}</h3>
              <p className="text-fg-soft text-sm leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
        <dl className="border-border mt-14 grid grid-cols-2 gap-6 border-t pt-10 lg:grid-cols-4">
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

      {/* ── COMMENT RÉSERVER (7 étapes) ──────────────────────────────────── */}
      {/* Desktop : infographie pleine largeur (titre + étapes intégrés). Mobile :
          en-tête + stepper HTML accessible (l'infographie large serait illisible).
          L'en-tête reste dans le DOM (crawlable) même masqué en CSS sur desktop. */}
      <Section id="comment-reserver" tone="paper">
        {/* En-tête : visible mobile ; sur desktop le titre est dans l'infographie,
            mais le h2 reste dans l'arbre a11y + DOM (md:sr-only, pas md:hidden) pour
            la structure de titres (lecteurs d'écran + crawlers), sans doublon visuel. */}
        <header className="mb-10 max-w-3xl md:mb-0">
          <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase md:hidden">
            <span
              aria-hidden="true"
              className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
            />
            {isFr ? "Simple et accompagné" : "Simple and guided"}
          </p>
          <h2 className="text-fg mt-5 text-[clamp(2rem,7vw,2.75rem)] leading-[1.05] font-semibold tracking-tight md:sr-only md:mt-0">
            {isFr ? "Comment réserver votre formation" : "How to book your training"}
          </h2>
          <p className="text-fg-soft mt-4 text-lg leading-relaxed md:hidden">
            {isFr
              ? "De la prise de contact au coup de projecteur sur votre entreprise : on s'occupe de tout, y compris du dossier de financement."
              : "From first contact to the spotlight on your company: we handle everything, including the funding file."}
          </p>
        </header>

        {/* Infographie pleine largeur — desktop uniquement */}
        {reserveImage ? (
          <Image
            src={reserveImage.src}
            alt={isFr ? reserveImage.altFr : reserveImage.altEn}
            width={reserveImage.width}
            height={reserveImage.height}
            sizes="(max-width: 1366px) 100vw, 1366px"
            className="border-border hidden h-auto w-full rounded-2xl border md:block"
          />
        ) : null}

        {/* Stepper HTML accessible — mobile uniquement */}
        <ol className="xs:grid-cols-2 grid grid-cols-1 gap-4 md:hidden">
          {reserveSteps.map((step, i) => (
            <li
              key={step.title}
              className="border-border bg-bg flex flex-col items-start rounded-2xl border p-4"
            >
              <div className="relative mb-3">
                <span className="bg-terracotta-soft text-terracotta-deep inline-flex h-11 w-11 items-center justify-center rounded-xl">
                  <step.icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <span className="bg-terracotta text-mocha-fg absolute -top-1.5 -right-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold">
                  {i + 1}
                </span>
              </div>
              <h3 className="text-fg text-sm font-semibold tracking-tight">{step.title}</h3>
              <p className="text-fg-soft mt-1 text-[13px] leading-snug">{step.body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8 flex flex-wrap gap-3">
          <Cta
            href="/appel"
            variant="primary"
            size="lg"
            track="formations-entreprise-reserver-appel"
          >
            {isFr ? "Réserver un appel" : "Book a call"}
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Cta>
          <Cta
            href="/contact"
            variant="outline"
            size="lg"
            track="formations-entreprise-reserver-contact"
          >
            {isFr ? "Écrire un message" : "Send a message"}
          </Cta>
        </div>
      </Section>

      {/* ── FINANCEMENT / QUALIOPI (gaté Phase B) ────────────────────────── */}
      {ofPublic ? (
        <Section
          id="financement"
          tone="sand"
          eyebrow={isFr ? "Financement" : "Funding"}
          title={isFr ? "Jusqu'à 0 € de reste à charge," : "Down to €0 out of pocket,"} // price-exempt: reste à charge (mention financement, pas un tarif produit)
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

      {/* ── LES PLUS (léger : 3 avantages + infographie visibilité) ──────── */}
      <FormationsLesPlus isFr={isFr} ofPublic={ofPublic} />

      {/* ── SECTEURS + MÉTIERS ───────────────────────────────────────────── */}
      <Section
        id="secteurs"
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
                    alt={isFr ? `Formation IA pour ${s.fullFr}` : `AI training for ${s.fullFr}`}
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
                    {isFr ? "Voir les cas d'usage →" : "See use cases →"}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-10">
          <p className="text-fg-muted mb-3 text-[13px] font-semibold tracking-[0.16em] uppercase">
            {isFr ? "Par métier" : "By role"}
          </p>
          <ul role="list" className="flex flex-wrap gap-2">
            {metiersLinks.map((m) => (
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
        id="faq"
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
