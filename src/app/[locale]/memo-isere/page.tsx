// Landing /memo-isere — recrutement commercial indépendant / apporteur d'affaires.
// Point d'entrée de l'annonce presse du Mémorial de l'Isère (hebdo du
// Sud-Grésivaudan), mais la zone proposée est TOUT LE CORRIDOR Grenoble ↔
// Valence ↔ Die ↔ Lyon : 474 communes officielles, petites incluses
// (13 EPCI, geo.api.gouv.fr — cf. content/recrutement/memo-isere-zone.ts).
// Le candidat CHOISIT sa zone tant qu'elle est disponible.
//
// Design : rythme de /fr/audit (retour Will 2026-08-12 « respecte la page
// audit ») — panneau sombre tôt, section terracotta pleine largeur, bandes CTA
// terracotta répétées, grille géographique par territoires — avec les
// composants partagés (HeroBadge, FeatureMediaCard, DarkTriadPanel, FaqBlock).
//
// ⚠️ CTA « J'envoie ma candidature » : ancre #postuler EN ATTENTE (décision
// Will 2026-08-12 — le formulaire arrive plus tard, aucun lien externe).
//
// 📷 Images : pool Unsplash déjà curé du site (revirement Will 2026-08-12 —
// remplacer les emplacements à créer par de vraies photos). Crédits affichés.

import type { Metadata } from "next";
import Image from "next/image";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import {
  BadgeEuro,
  GraduationCap,
  Handshake,
  LineChart,
  MapPin,
  Presentation,
  Rocket,
  ShieldCheck,
  Star,
  TrendingUp,
} from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { JsonLd } from "@/components/marketing/JsonLd";
import { HeroBadge } from "@/components/marketing/HeroBadge";
import { DarkTriadPanel } from "@/components/marketing/DarkTriadPanel";
import { FeatureMediaCard } from "@/components/marketing/FeatureMediaCard";
import { FaqBlock } from "@/components/sections/FaqBlock";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { Cta } from "@/components/marketing/Cta";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { UnsplashCredit } from "@/components/media/UnsplashCredit";
import { careerImage, CAREERS_HERO } from "@/content/careers/careers-images";
import { buildProductMetadata, buildWebPageJsonLd, SITE_URL, SITE_EDITORIAL_DATE } from "@/lib/seo";
import { getPublishedReviews, type PublicReview } from "@/server/reviews/queries";
import {
  MEMO_ZONE_CLUSTERS,
  MEMO_ZONE_PRINCIPALES,
  MEMO_ZONE_TOTAL,
} from "@/content/recrutement/memo-isere-zone";

export const revalidate = 3600;

// 📷 Images : pool Unsplash déjà CURÉ du site (décision Will 2026-08-12,
// « mets des images Unsplash à la place ») — jamais de nouvelles photos sans
// relecture en planche-contact (l'API ne filtre pas le N&B).
const IMG_HERO = careerImage("business-developer-ia"); // poignée de main B2B
const IMG_TERRAIN = careerImage("formateur-ia-itinerant"); // formation en salle
const IMG_EQUIPE = CAREERS_HERO; // équipe en collaboration

// Secteurs démarchés — le job = les PME QUEL QUE SOIT le secteur (Will
// 2026-08-12). Emojis assumés : ambiance fun/sympa demandée, même registre
// que les perks des pages carrières.
const SECTEURS = [
  { emoji: "🥖", label: "Boulangeries & commerces" },
  { emoji: "🔧", label: "Garages & artisans" },
  { emoji: "🏗️", label: "BTP & construction" },
  { emoji: "🏨", label: "Hôtels & restaurants" },
  { emoji: "🧾", label: "Experts-comptables" },
  { emoji: "⚖️", label: "Avocats & notaires" },
  { emoji: "🩺", label: "Santé & paramédical" },
  { emoji: "🏭", label: "Industrie & ateliers" },
  { emoji: "🚚", label: "Transport & logistique" },
  { emoji: "🌾", label: "Agriculture & viticulture" },
  { emoji: "🏠", label: "Immobilier" },
  { emoji: "💇", label: "Coiffure & bien-être" },
] as const;

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  const title = isFr
    ? "Devenez commercial IA indépendant, de Grenoble à Lyon · 500 €/jour vendu" /* price-exempt: commission commerciale de recrutement, pas un tarif client */
    : "Become an independent AI sales rep between Grenoble and Lyon";
  return {
    ...buildProductMetadata({
      locale,
      path: "/memo-isere",
      title,
      description: isFr
        ? "Axion-IA recrute des commerciaux indépendants et apporteurs d'affaires de Grenoble à Valence, Die et Lyon — 474 communes, vous choisissez votre zone. Vendez des formations IA finançables OPCO : 500 € par journée de formation vendue, revenus non plafonnés, démarrage septembre." /* price-exempt: commission commerciale de recrutement, pas un tarif client */
        : "Axion-IA is hiring independent sales reps between Grenoble, Valence, Die and Lyon — 474 towns, you pick your area. Sell OPCO-fundable AI trainings: €500 per training day sold, uncapped income, starting September." /* price-exempt: commission commerciale de recrutement, pas un tarif client */,
    }),
    title: { absolute: title },
  };
}

// Étoiles pleines d'un avis (rating 1..5) — rendu texte + aria, zéro JS.
function Stars({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating}/5`} className="text-terracotta inline-flex items-center gap-0.5">
      {Array.from({ length: rating }, (_, i) => (
        <Star key={i} aria-hidden="true" className="h-4 w-4 fill-current" />
      ))}
    </span>
  );
}

/** Carte d'avis — pep's 2026-08-12 : liseré terracotta, guillemet géant en
 *  filigrane, avatar-initiale, hover levé — les cartes plates « manquaient
 *  d'énergie » (retour Will). */
function ReviewCard({ r }: { r: PublicReview }) {
  const who = `${r.authorFirstName} ${r.authorLastInitial}`;
  const context = [r.companyName, r.cityName].filter(Boolean).join(" · ");
  return (
    <figure className="border-border bg-paper shadow-subtle hover:shadow-card relative flex h-full flex-col overflow-hidden rounded-2xl border p-6 pt-7 transition-all duration-300 hover:-translate-y-1">
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1.5"
        style={{
          background:
            "linear-gradient(90deg, var(--color-terracotta), var(--color-terracotta-deep))",
        }}
      />
      <span
        aria-hidden="true"
        className="text-terracotta/10 pointer-events-none absolute -top-3 right-3 font-serif text-[6rem] leading-none select-none"
      >
        »
      </span>
      <Stars rating={r.rating} />
      {r.title ? (
        <p className="mt-3 font-serif text-xl leading-snug font-semibold">{r.title}</p>
      ) : null}
      <blockquote className="text-fg-soft mt-2 line-clamp-5 leading-relaxed">
        {r.comment}
      </blockquote>
      <figcaption className="mt-auto flex items-center gap-3 pt-5">
        <span
          aria-hidden="true"
          className="bg-terracotta text-paper inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-serif text-lg font-semibold"
        >
          {r.authorFirstName.charAt(0)}
        </span>
        <span className="min-w-0 text-sm leading-tight">
          <span className="text-fg block font-semibold">
            {who}
            {r.isVerified ? (
              <span className="text-sage ml-2 inline-flex items-center gap-1 align-middle text-xs font-medium">
                <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />
                vérifié
              </span>
            ) : null}
          </span>
          {context ? <span className="text-fg-muted">{context}</span> : null}
        </span>
      </figcaption>
    </figure>
  );
}

/** Bande CTA terracotta pleine largeur — le pattern de /fr/audit (« On cadre
 *  votre audit IA, au bon niveau »), répété entre les grandes sections. */
function BandeCta({ title, track }: { title: string; track: string }) {
  return (
    <section
      className="py-12 sm:py-14"
      style={{
        background:
          "linear-gradient(135deg, var(--color-terracotta), var(--color-terracotta-deep))",
      }}
    >
      <Container className="flex flex-col items-center gap-6 text-center sm:flex-row sm:justify-between sm:text-left">
        <h2 className="max-w-xl font-serif text-2xl leading-snug font-semibold text-[color:var(--color-bg)] sm:text-3xl">
          {title}
        </h2>
        <Cta
          href="#postuler"
          size="lg"
          track={track}
          className="text-terracotta-deep shrink-0 bg-[color:var(--color-paper)] shadow-[0_8px_24px_-8px_rgba(0,0,0,0.35)] hover:bg-[color:var(--color-bg)]"
        >
          J’envoie ma candidature →
        </Cta>
      </Container>
    </section>
  );
}

/** CTA candidature — répété sur la page. Ancre #postuler EN ATTENTE du
 *  formulaire (décision Will 2026-08-12) : aucun lien externe pour l'instant. */
function CtaCandidature({ track }: { track: string }) {
  return (
    <Cta href="#postuler" size="lg" track={track}>
      J’envoie ma candidature →
    </Cta>
  );
}

export default async function MemoIserePage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  if (!isFr) notFound(); // page presse locale FR-only (EN 301 → FR au runtime)

  // Avis réels — priorité Isère (45 des 77 avis publiés), meilleurs d'abord.
  // Stub-aware : au build GH Actions la liste est vide → section masquée,
  // l'ISR la repeuple en prod sous 1 h.
  const { items: reviewsIsere, total: totalIsere } = await getPublishedReviews({
    departmentCode: "38",
    sort: "rating_desc",
    pageSize: 6,
  });
  const reviews = reviewsIsere.length >= 3 ? reviewsIsere : [];
  const { total: totalAll } = await getPublishedReviews({ pageSize: 1 });

  const villesPhares = [
    "Grenoble",
    "Voiron",
    "Saint-Marcellin",
    "Valence",
    "Romans-sur-Isère",
    "Vienne",
    "Bourgoin-Jallieu",
    "Die",
    "Lyon",
  ];

  const faqItems = [
    {
      id: "remuneration",
      question: "Combien gagne-t-on exactement ?",
      answer:
        "500 € par journée de formation vendue, sans plafond. Exemple de calcul : 5 journées vendues dans le mois = 2 500 €, 20 journées = 10 000 €. Les audits et intégrations IA rapportent en plus un pourcentage de la facture. C'est un exemple de calcul, pas une promesse : tes revenus dépendent de tes ventes." /* price-exempt: commission commerciale de recrutement, pas un tarif client */,
    },
    {
      id: "statut",
      question: "Quel statut faut-il ?",
      answer:
        "Indépendant : micro-entrepreneur, agent commercial, VRP multicartes ou apporteur d'affaires. Si tu n'as pas encore de statut, la micro-entreprise se crée en ligne en quelques jours et ne coûte rien — on t'oriente au démarrage.",
    },
    {
      id: "cumul",
      question: "Peut-on cumuler avec un emploi ou une retraite ?",
      answer:
        "Oui. L'activité est 100 % à la commission et sans quota horaire : tu prospectes quand tu veux, en complément d'un emploi salarié, d'une autre activité indépendante ou d'une retraite.",
    },
    {
      id: "zone",
      question: "Quelle est la zone exacte ? Puis-je choisir la mienne ?",
      answer: `Tout le corridor de Grenoble à Lyon, de Valence à Die : ${MEMO_ZONE_TOTAL} communes réparties sur 13 territoires (${villesPhares.join(", ")}… et toutes les communes entre, y compris les petites). Tu choisis ta zone : tant qu'elle est disponible, elle devient la tienne. Les petites communes sont un vrai atout — personne n'y démarche l'IA.`,
    },
    {
      id: "debutant",
      question: "Faut-il connaître l'IA ou avoir déjà vendu ?",
      answer:
        "Non. On te forme complètement à l'offre (formations, audits, financements) et on te fournit les supports et les argumentaires. Ce qui compte : l'aisance relationnelle et l'envie d'aller voir les entreprises de ta zone.",
    },
    {
      id: "quelles-entreprises",
      question: "Quelles entreprises est-ce que je démarche ?",
      answer:
        "Les PME et ETI de ta zone d'abord — plus il y a d'équipes à former, plus la vente rapporte — mais aussi les TPE, artisans, commerçants et professions libérales. Quel que soit le secteur d'activité : industrie, BTP, comptabilité, santé, hôtellerie-restauration, transport, agriculture, immobilier, commerce… L'obligation de formation de l'AI Act et le financement OPCO concernent tout le monde.",
    },
    {
      id: "pourquoi-ca-se-vend",
      question: "Pourquoi les entreprises achètent-elles ces formations ?",
      answer:
        "Trois raisons. L'AI Act européen impose désormais aux entreprises de former leurs équipes qui utilisent l'IA (article 4, en vigueur depuis février 2025). Les formations sont finançables par les OPCO, donc le coût réel pour le client est faible, voire nul. Et la demande explose : toutes les TPE-PME parlent d'IA, très peu ont été démarchées.",
    },
    {
      id: "demarrage",
      question: "Quand est-ce que ça démarre ?",
      answer:
        "Septembre. Les candidatures sont ouvertes dès maintenant : tu candidates en quelques minutes, on échange par téléphone, puis tu suis la formation à l'offre avant de démarrer sur ta zone.",
    },
    {
      id: "paiement",
      question: "Comment et quand suis-je payé ?",
      answer:
        "Tu factures ta commission en tant qu'indépendant dès que la vente est signée et facturée au client. 500 € par journée de formation vendue, pourcentage sur les audits et intégrations — le tableau de suivi te montre tes ventes et tes commissions en temps réel." /* price-exempt: commission commerciale de recrutement, pas un tarif client */,
    },
    {
      id: "engagement",
      question: "Y a-t-il un engagement ou une exclusivité ?",
      answer:
        "Aucune exclusivité imposée et aucun engagement de durée : tu restes indépendant. Ton portefeuille de clients reste le tien, et tu arrêtes quand tu veux.",
    },
    {
      id: "candidater",
      question: "Comment candidater ?",
      answer:
        "En quelques minutes, sans CV obligatoire : ce qui compte, c'est ta motivation et ta connaissance du territoire. Les candidatures ouvrent sur cette page — clique sur « J'envoie ma candidature ».",
    },
  ];

  // ── JSON-LD ────────────────────────────────────────────────────────────────
  // JobPosting Google for Jobs. 🔴 Pas de lieu dans `title` (règle Google) —
  // le géo vit dans jobLocation (47 communes officielles).
  const jobJsonLd = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: "Commercial indépendant IA (apporteur d'affaires)",
    description:
      "Axion-IA recrute des commerciaux indépendants et apporteurs d'affaires de Grenoble à Valence, Die et Lyon (474 communes, zone au choix selon disponibilité) pour promouvoir ses formations et audits IA auprès des PME, ETI, TPE et artisans locaux, quel que soit le secteur d'activité. L'AI Act impose la formation des équipes à l'IA et les formations sont finançables OPCO : la vente est facilitée. 500 € par journée de formation vendue, revenus non plafonnés, statut libre, démarrage en septembre. Débutants acceptés, formation à l'offre fournie." /* price-exempt: commission commerciale de recrutement, pas un tarif client */,
    datePosted: SITE_EDITORIAL_DATE,
    employmentType: "CONTRACTOR",
    occupationalCategory: "Commercial indépendant · Agent commercial · VRP · Apporteur d'affaires",
    industry: "Intelligence artificielle · Formation · Services aux entreprises",
    qualifications:
      "Aisance relationnelle et motivation. Débutants acceptés : formation complète à l'offre IA fournie.",
    responsibilities:
      "Prospecter les PME, ETI, TPE, artisans et commerçants de sa zone (choisie entre Grenoble, Valence, Die et Lyon), quel que soit leur secteur d'activité ; présenter les formations et audits IA ; suivre ses ventes et commissions sur un tableau de bord.",
    jobBenefits:
      "Statut indépendant, revenus non plafonnés, emploi du temps libre, territoire dédié, supports et argumentaires fournis, accompagnement au démarrage, poste évolutif (responsable de secteur).",
    incentiveCompensation:
      "Rémunération 100 % à la commission : 500 € par journée de formation vendue, sans plafond ; pourcentage de la facture sur les audits et intégrations IA." /* price-exempt: commission commerciale de recrutement, pas un tarif client */,
    hiringOrganization: {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Axion-IA",
      url: SITE_URL,
      sameAs: ["https://www.linkedin.com/company/axion-ia-france"],
    },
    jobLocation: MEMO_ZONE_PRINCIPALES.map((city) => ({
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: city,
        addressRegion: "Auvergne-Rhône-Alpes",
        addressCountry: "FR",
      },
    })),
    applicantLocationRequirements: { "@type": "Country", name: "France" },
    directApply: true,
    url: `${SITE_URL}/fr/memo-isere`,
  } as const;

  const webpageJsonLd = buildWebPageJsonLd({
    locale: loc,
    path: "/memo-isere",
    name: "Devenir commercial IA indépendant, de Grenoble à Lyon · Axion-IA",
    description:
      "Recrutement de commerciaux indépendants et apporteurs d'affaires IA sur 474 communes, de Grenoble à Valence, Die et Lyon — zone au choix.",
    speakable: { selectors: ["h1", "[data-speakable]"] },
  });

  return (
    <>
      <JsonLd data={jobJsonLd} scriptId="jsonld-memo-jobposting" />
      <JsonLd data={webpageJsonLd} scriptId="jsonld-memo-webpage" />

      <Container className="border-border border-b py-3">
        <Breadcrumbs items={[{ href: "/memo-isere", label: "Recrutement Sud-Grésivaudan" }]} />
      </Container>

      {/* 1 ── HERO conversion */}
      <Section tone="halo-warm">
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-14">
            <div>
              <HeroBadge className="mb-5 justify-start">
                <span
                  aria-hidden="true"
                  className="bg-terracotta inline-block h-1.5 w-1.5 rounded-full"
                />
                Vu dans Le Mémo de l’Isère · Démarrage septembre
              </HeroBadge>
              <h1 className="display-editorial text-fg">
                Devenez commercial IA indépendant{" "}
                <span
                  className="text-terracotta italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  sur votre territoire
                </span>
              </h1>
              <p data-speakable className="text-fg-soft mt-5 max-w-xl text-lg leading-relaxed">
                Le job : démarcher les <strong>PME et ETI</strong> de ta zone — du cabinet comptable
                au site industriel, en passant par la boulangerie…{" "}
                <strong>quel que soit le secteur</strong> — et leur proposer des formations IA que
                l’AI Act rend obligatoires et que l’OPCO finance. Toi, tu touches la commission. De
                Grenoble à Valence, de Die à Lyon : {MEMO_ZONE_TOTAL} communes, et tu choisis la
                tienne.
              </p>

              <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  {
                    label: "Par jour de formation vendu",
                    value: "500 €", // price-exempt: commission recrutement
                  } /* price-exempt: commission commerciale de recrutement, pas un tarif client */,
                  { label: "Plafond de revenus", value: "Aucun" },
                  { label: "Communes au choix", value: String(MEMO_ZONE_TOTAL) },
                ].map((f) => (
                  <div
                    key={f.label}
                    className="border-border bg-paper/80 shadow-subtle rounded-2xl border px-4 py-3"
                  >
                    <p className="text-terracotta-deep font-serif text-2xl leading-snug font-semibold">
                      {f.value}
                    </p>
                    <p className="text-fg-muted mt-1 text-[11px] font-semibold tracking-wide uppercase">
                      {f.label}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <CtaCandidature track="memo-hero-apply" />
                <p className="text-fg-muted text-sm">
                  2 minutes · CV optionnel · débutants bienvenus
                </p>
              </div>
            </div>

            <div>
              <div className="border-border shadow-card relative aspect-[4/5] overflow-hidden rounded-3xl border">
                <Image
                  src={IMG_HERO.url}
                  alt="Rendez-vous commercial B2B — poignée de main avec un dirigeant de PME"
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 45vw"
                  className="object-cover"
                />
              </div>
              <UnsplashCredit
                photographerName={IMG_HERO.byName}
                photographerUrl={IMG_HERO.byUrl}
                className="text-right"
              />
            </div>
          </div>
        </Container>
      </Section>

      {/* 2 ── Bande de réassurance */}
      <Section className="py-6 sm:py-8 lg:py-8">
        <Container>
          <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3" role="list">
            {[
              "Organisme certifié Qualiopi",
              "Formations finançables OPCO",
              "Statut libre : micro-entreprise, VRP, apporteur",
              "Cumulable avec un emploi",
            ].map((t) => (
              <li
                key={t}
                className="text-fg-soft inline-flex items-center gap-2 text-sm font-medium"
              >
                <ShieldCheck aria-hidden="true" className="text-sage h-4 w-4" />
                {t}
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      {/* 2bis ── Panneau sombre d'ouverture — le pattern « L'IA, tout le monde
          en parle » de /fr/audit : une déclaration franche + 3 chiffres. */}
      <Section className="py-10 sm:py-12 lg:py-14">
        <Container>
          <div className="bg-mocha relative overflow-hidden rounded-2xl px-7 py-9 sm:px-10 sm:py-11">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  "radial-gradient(90% 120% at 85% 0%, var(--color-terracotta) 0%, transparent 55%)",
              }}
            />
            <div className="relative grid items-center gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <h2 className="font-serif text-3xl leading-snug font-semibold text-[color:var(--color-bg)] sm:text-4xl">
                L’IA, tout le monde en parle.{" "}
                <span className="text-terracotta-soft italic">
                  Toi, tu vas être payé pour la vendre.
                </span>
              </h2>
              <dl className="grid grid-cols-3 gap-4">
                {[
                  {
                    v: "500 €", // price-exempt: commission recrutement
                    l: "par jour vendu",
                  } /* price-exempt: commission recrutement */,
                  { v: String(MEMO_ZONE_TOTAL), l: "communes au choix" },
                  { v: totalAll > 0 ? `${totalAll} avis` : "4,9/5", l: "clients conquis" },
                ].map((s) => (
                  <div key={s.l}>
                    <dt className="sr-only">{s.l}</dt>
                    <dd className="text-terracotta-soft font-serif text-2xl font-semibold sm:text-3xl">
                      {s.v}
                    </dd>
                    <dd className="mt-1 text-[11px] font-semibold tracking-wide text-[color:var(--color-bg)]/70 uppercase">
                      {s.l}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </Container>
      </Section>

      {/* 3 ── Pourquoi c'est si facile à vendre */}
      <Section
        tone="sand"
        eyebrow="L'opportunité"
        title="Pourquoi c'est si"
        titleEm="facile à vendre"
        description="Tu n'arrives pas avec un produit à pousser : tu arrives avec une obligation légale, un financement déjà prévu et une demande qui explose."
      >
        <Container>
          <ol className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {[
              {
                accent: "terracotta" as const,
                Icon: ShieldCheck,
                title: "La loi l'impose",
                description:
                  "L'AI Act européen oblige les entreprises à former leurs équipes qui utilisent l'IA (article 4, en vigueur). Le client ne se demande plus s'il doit se former, mais avec qui.",
                stat: { figure: "AI Act", label: "obligation de formation" },
              },
              {
                accent: "primary" as const,
                Icon: BadgeEuro,
                title: "L'OPCO paie",
                description:
                  "Les formations sont finançables par les OPCO : le coût réel pour le client est faible, souvent nul. L'objection prix disparaît de la conversation.",
                stat: { figure: "OPCO", label: "formation financée" },
              },
              {
                accent: "sage" as const,
                Icon: TrendingUp,
                title: "La demande explose",
                description:
                  "Toutes les PME et ETI parlent d'IA — et personne n'est venu les voir sur ta zone, surtout hors des grandes villes. Tu arrives premier.",
                stat: { figure: "1er", label: "sur ta zone" },
              },
              {
                accent: "plum" as const,
                Icon: Presentation,
                title: "Ça se démontre",
                description:
                  "On montre l'IA en direct sur les documents du client, pas sur des slides. La démonstration fait la vente à ta place.",
                stat: { figure: "Démo", label: "sur leurs dossiers" },
              },
            ].map((c, i) => (
              <li key={c.title} className="h-full">
                <FeatureMediaCard
                  index={i + 1}
                  accent={c.accent}
                  Icon={c.Icon}
                  title={c.title}
                  description={c.description}
                  stat={c.stat}
                />
              </li>
            ))}
          </ol>
          <div className="mt-8 text-center">
            <CtaCandidature track="memo-sell-apply" />
          </div>
        </Container>
      </Section>

      {/* 3bis ── Tes futurs clients — TOUS les secteurs (Will 2026-08-12 :
          « démarcher les PME quel que soit le secteur », ambiance fun). */}
      <Section
        className="py-14 sm:py-16 lg:py-20"
        eyebrow="Tes futurs clients"
        title="Ton prochain client ? La boulangerie"
        titleEm="d'en face"
        titleTail=" — ou l'usine d'à côté"
        description="PME, ETI, TPE, artisans, commerçants, professions libérales : l'AI Act ne fait pas de tri entre les secteurs, l'OPCO non plus. Des équipes à former, il y en a de 3 à 3 000 salariés — et tu connais déjà la moitié de ces gens."
      >
        <Container>
          <ul
            className="mx-auto grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
            role="list"
          >
            {SECTEURS.map((s) => (
              <li
                key={s.label}
                className="border-border bg-paper shadow-subtle hover:border-terracotta flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all duration-300 hover:-translate-y-0.5"
              >
                <span aria-hidden="true" className="text-2xl">
                  {s.emoji}
                </span>
                <span className="text-fg text-sm leading-snug font-medium">{s.label}</span>
              </li>
            ))}
          </ul>
          <p className="text-fg-muted mx-auto mt-5 max-w-2xl text-center text-sm">
            … et tous les autres : si une entreprise de ta zone a des équipes et des dossiers à
            traiter, elle est concernée.
          </p>
        </Container>
      </Section>

      {/* 4 ── Rémunération transparente */}
      <Section
        tone="sand"
        className="py-14 sm:py-16 lg:py-20"
        eyebrow="Rémunération"
        title="500 € par journée de formation" /* price-exempt: commission recrutement */
        titleEm="vendue"
        description="Sans plafond, sans quota, sans salaire fixe à mériter : chaque vente te paie. Les audits et intégrations IA rapportent en plus un pourcentage de la facture."
      >
        <Container>
          <div className="mx-auto grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              {
                jours: "5 jours vendus",
                mois: "2 500 €", // price-exempt: commission recrutement
              } /* price-exempt: commission commerciale de recrutement, pas un tarif client */,
              {
                jours: "10 jours vendus",
                mois: "5 000 €", // price-exempt: commission recrutement
              } /* price-exempt: commission commerciale de recrutement, pas un tarif client */,
              {
                jours: "20 jours vendus",
                mois: "10 000 €", // price-exempt: commission recrutement
              } /* price-exempt: commission commerciale de recrutement, pas un tarif client */,
            ].map((t, i) => (
              <div
                key={t.jours}
                className={[
                  "rounded-2xl border p-6 text-center",
                  i === 2
                    ? "border-terracotta bg-terracotta/5 shadow-card"
                    : "border-border bg-paper shadow-subtle",
                ].join(" ")}
              >
                <p className="text-fg-muted text-sm font-medium">{t.jours}</p>
                <p className="text-terracotta-deep mt-2 font-serif text-4xl font-semibold">
                  {t.mois}
                </p>
                <p className="text-fg-muted mt-1 text-xs">dans le mois</p>
              </div>
            ))}
          </div>
          <p className="text-fg-muted mx-auto mt-5 max-w-2xl text-center text-sm">
            {/* Chaîne JS unique + marqueur ATTACHÉS : prettier avait éclaté le
                texte JSX et déplacé le marqueur hors de la ligne du montant →
                garde-fou prix rouge en CI alors qu'il passait en local. */}
            {
              "Exemples de calcul (500 € × journées vendues) — pas une promesse de revenus : tes commissions dépendent de tes ventes." /* price-exempt: commission recrutement */
            }
          </p>
        </Container>
      </Section>

      {/* 5 ── Comment ça marche — section terracotta pleine largeur, le bloc
          signature de /fr/audit (« Un audit IA rigoureux et complet ») : les
          cartes blanches claquent sur le fond terracotta. */}
      <section
        className="py-16 sm:py-20"
        style={{
          background:
            "linear-gradient(150deg, var(--color-terracotta) 0%, var(--color-terracotta-deep) 100%)",
        }}
      >
        <Container>
          <p className="flex items-center gap-2 text-xs font-bold tracking-[0.14em] text-[color:var(--color-bg)]/80 uppercase">
            <span
              aria-hidden="true"
              className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--color-bg)]"
            />
            Le parcours
          </p>
          <h2 className="mt-3 font-serif text-3xl font-semibold text-[color:var(--color-bg)] sm:text-4xl">
            Comment ça{" "}
            <span className="text-sand italic" style={{ fontFamily: "var(--font-serif)" }}>
              marche
            </span>
          </h2>
          <div className="mt-10">
            <ol className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
              {[
                {
                  accent: "terracotta" as const,
                  Icon: Rocket,
                  title: "Tu candidates",
                  description:
                    "2 minutes, CV optionnel. On échange ensuite par téléphone pour valider que la zone et le rythme te conviennent.",
                  stat: { figure: "2 min", label: "pour candidater" },
                },
                {
                  accent: "primary" as const,
                  Icon: GraduationCap,
                  title: "On te forme à l'offre",
                  description:
                    "Formations, audits, financements OPCO : tu maîtrises l'offre et les argumentaires avant ton premier rendez-vous.",
                  stat: { figure: "Offre", label: "maîtrisée avant de vendre" },
                },
                {
                  accent: "sage" as const,
                  Icon: MapPin,
                  title: "Tu choisis TA zone",
                  description:
                    "De Grenoble à Lyon, de Valence à Die : tu prends la zone que tu connais — elle devient la tienne tant qu'elle est disponible.",
                  stat: { figure: "474", label: "communes au choix" },
                },
                {
                  accent: "plum" as const,
                  Icon: LineChart,
                  title: "Tu touches à chaque vente",
                  description:
                    "500 € par journée de formation vendue, % sur les audits. Ton tableau de bord suit tes ventes et commissions en temps réel." /* price-exempt: commission commerciale de recrutement, pas un tarif client */,
                  stat: {
                    figure: "500 €", // price-exempt: commission recrutement
                    label: "par jour vendu",
                  } /* price-exempt: commission commerciale de recrutement, pas un tarif client */,
                },
              ].map((c, i) => (
                <li key={c.title} className="h-full">
                  <FeatureMediaCard
                    index={i + 1}
                    accent={c.accent}
                    Icon={c.Icon}
                    title={c.title}
                    description={c.description}
                    stat={c.stat}
                  />
                </li>
              ))}
            </ol>
          </div>
        </Container>
      </section>

      {/* 6 ── Bandeau image terrain */}
      <Section className="py-14 sm:py-16 lg:py-20">
        <Container className="max-w-4xl">
          <div className="border-border shadow-card relative aspect-[16/9] overflow-hidden rounded-3xl border">
            <Image
              src={IMG_TERRAIN.url}
              alt="Présentation d'une formation IA devant une équipe en entreprise"
              fill
              sizes="(max-width: 1024px) 100vw, 896px"
              className="object-cover"
            />
          </div>
          <UnsplashCredit
            photographerName={IMG_TERRAIN.byName}
            photographerUrl={IMG_TERRAIN.byUrl}
            className="text-right"
          />
        </Container>
      </Section>

      {/* 7 ── Avis clients (preuve que le produit se vend) */}
      {reviews.length >= 3 ? (
        <Section
          tone="sand"
          className="py-14 sm:py-16 lg:py-20"
          eyebrow="La preuve"
          title="Le produit que tu vendras, nos clients le"
          titleEm="recommandent"
          description={
            totalAll > 0
              ? `${totalAll} avis clients publiés — dont ${totalIsere} en Isère. Voici ce qu'ils disent.`
              : undefined
          }
        >
          <Container>
            <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" role="list">
              {reviews.map((r) => (
                <li key={r.id} className="h-full">
                  <ReviewCard r={r} />
                </li>
              ))}
            </ul>
            <div className="mt-8 text-center">
              <CtaCandidature track="memo-reviews-apply" />
            </div>
          </Container>
        </Section>
      ) : null}

      {/* CTA band terracotta — pattern /fr/audit (entre avis et intégration) */}
      <BandeCta
        title="Septembre arrive vite — les zones partent une par une."
        track="memo-band-apply"
      />

      {/* 8 ── Intégration & aide au démarrage */}
      <Section
        className="py-14 sm:py-16 lg:py-20"
        eyebrow="Jamais seul"
        title="Intégration et aide au"
        titleEm="démarrage"
      >
        <Container>
          <DarkTriadPanel
            items={[
              {
                Icon: GraduationCap,
                eyebrow: "01",
                title: "Formation complète à l'offre",
                description:
                  "Produits, tarifs, financements OPCO, argumentaires : tu pars sur le terrain en sachant exactement quoi dire, à qui, et comment répondre aux objections.",
              },
              {
                Icon: Handshake,
                eyebrow: "02",
                title: "Outils fournis",
                description:
                  "Supports de présentation, plaquettes, démos prêtes à montrer et tableau de bord de tes ventes et commissions — tu n'as rien à créer.",
              },
              {
                Icon: Rocket,
                eyebrow: "03",
                title: "Accompagné au démarrage",
                description:
                  "Tes premiers rendez-vous se préparent ensemble, et tu as toujours quelqu'un à appeler. Jamais lâché seul dans le grand bain.",
              },
            ]}
          />
          <div className="mx-auto mt-8 max-w-3xl">
            <div className="border-border shadow-card relative aspect-[16/9] overflow-hidden rounded-3xl border">
              <Image
                src={IMG_EQUIPE.url}
                alt="L'équipe en préparation — supports, argumentaires et premiers rendez-vous"
                fill
                sizes="(max-width: 1024px) 100vw, 768px"
                className="object-cover"
              />
            </div>
            <UnsplashCredit
              photographerName={IMG_EQUIPE.byName}
              photographerUrl={IMG_EQUIPE.byUrl}
              className="text-right"
            />
          </div>
        </Container>
      </Section>

      {/* 9 ── Poste évolutif */}
      <Section
        tone="sand"
        className="py-14 sm:py-16 lg:py-20"
        eyebrow="La suite"
        title="Un poste qui"
        titleEm="évolue"
        description="Apporteur d'affaires aujourd'hui, responsable demain : les meilleurs commerciaux de chaque zone prennent l'animation de leur secteur, puis du réseau."
      >
        <Container>
          <ol className="mx-auto grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              {
                step: "Aujourd'hui",
                title: "Commercial indépendant",
                text: "Tu vends sur ta zone, tu encaisses tes commissions.",
              },
              {
                step: "Ensuite",
                title: "Responsable de secteur",
                text: "Tu animes les commerciaux de ton secteur et touches sur leurs ventes.",
              },
              {
                step: "Demain",
                title: "Responsable réseau",
                text: "Tu structures la force de vente sur plusieurs départements.",
              },
            ].map((s) => (
              <li
                key={s.title}
                className="border-border bg-paper shadow-subtle rounded-2xl border p-6"
              >
                <p className="text-terracotta text-xs font-semibold tracking-wide uppercase">
                  {s.step}
                </p>
                <p className="mt-1 font-serif text-lg font-semibold">{s.title}</p>
                <p className="text-fg-soft mt-2 text-sm leading-relaxed">{s.text}</p>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      {/* 10 ── Fondateur — bande mocha pleine largeur, même mise en page que le
          bandeau sombre de /fr/audit (retour Will 2026-08-12). */}
      <section className="bg-mocha-rich text-mocha-fg py-16 sm:py-20 lg:py-24">
        <Container>
          <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-mocha-fg/70 text-[13px] font-medium tracking-[0.16em] uppercase">
                Qui recrute
              </p>
              <h2 className="mt-4 text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.05] font-semibold tracking-tight">
                Le mot du{" "}
                <span
                  className="text-terracotta-soft italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  fondateur
                </span>
              </h2>
              <blockquote data-speakable className="text-mocha-fg/85 mt-5 text-lg leading-relaxed">
                « Les dirigeants me disent tous la même chose : ils veulent passer à l’IA, mais
                personne ne vient les voir. De Grenoble à Lyon, de Valence à Die, c’est chez nous —
                je cherche des gens du coin, qui connaissent leur territoire et qui veulent être
                payés à la hauteur de ce qu’ils apportent. »
              </blockquote>
              <p className="mt-5 font-semibold">Williams Jullin</p>
              <p className="text-mocha-fg/70 text-sm">Fondateur d’Axion-IA · Grenoble</p>
            </div>
            <div className="shrink-0">
              <Image
                src="/illustrations/william-fondateur-formateur-ia-axion-ia.png"
                alt="Williams Jullin, fondateur d'Axion-IA"
                width={224}
                height={224}
                className="h-44 w-44 rounded-3xl object-cover sm:h-56 sm:w-56"
              />
            </div>
          </div>
        </Container>
      </section>

      {/* 11 ── Profils recherchés */}
      <Section
        className="py-14 sm:py-16 lg:py-20"
        eyebrow="Les profils"
        title="Débutant ou routier de la vente :"
        titleEm="bienvenue"
        description="Ce qui compte, c'est l'aisance relationnelle et la connaissance du territoire — pas le diplôme."
      >
        <Container>
          <ul className="mx-auto flex max-w-3xl flex-wrap justify-center gap-2" role="list">
            {[
              "Commerciaux indépendants",
              "Apporteurs d'affaires",
              "VRP multicartes",
              "En reconversion",
              "Retraités actifs",
              "Bon carnet d'adresses local",
              "Débutants motivés",
              "En complément d'un emploi",
            ].map((p) => (
              <li
                key={p}
                className="border-border bg-paper text-fg-soft rounded-full border px-4 py-1.5 text-sm font-medium"
              >
                {p}
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      {/* 12 ── Zone couverte — 474 communes en 13 territoires. Accordéons
          <details> CSS-only : les 13 murs de texte étaient « visuellement
          catastrophiques » (Will) ; les villes principales restent visibles,
          la liste complète (SEO/GEO) se déplie. */}
      <Section
        tone="sand"
        className="py-14 sm:py-16 lg:py-20"
        eyebrow="Ton territoire"
        title={`${MEMO_ZONE_TOTAL} communes, de Grenoble à`}
        titleEm="Lyon, Valence et Die"
        description="En indépendant ou apporteur d'affaires, tu choisis ta zone parmi 13 territoires ; tant qu'elle est disponible, elle devient la tienne. Chaque commune — y compris la plus petite — compte des PME que personne n'a démarchées sur l'IA."
      >
        <Container className="max-w-4xl">
          <ul className="space-y-3" role="list">
            {MEMO_ZONE_CLUSTERS.map((cl) => (
              <li key={cl.label}>
                <details className="group border-border bg-paper shadow-subtle overflow-hidden rounded-2xl border">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
                    <span className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-serif text-lg leading-snug font-semibold">
                        {cl.label}
                      </span>
                      <span className="text-fg-muted hidden text-sm sm:inline">
                        {cl.principales.slice(0, 3).join(" · ")}
                        {cl.principales.length > 3 ? "…" : ""}
                      </span>
                    </span>
                    <span className="text-terracotta flex shrink-0 items-center gap-2 text-xs font-bold tracking-wide uppercase">
                      {cl.communes.length} communes
                      <span
                        aria-hidden="true"
                        className="transition-transform duration-200 group-open:rotate-90"
                      >
                        →
                      </span>
                    </span>
                  </summary>
                  <p className="text-fg-muted border-border border-t px-5 py-4 text-[13px] leading-relaxed">
                    {cl.communes.join(" · ")}
                  </p>
                </details>
              </li>
            ))}
          </ul>
          <p data-speakable className="text-fg-muted mt-6 max-w-2xl text-sm leading-relaxed">
            Ta commune n’est pas dans la liste mais tu es à proximité ? Candidate quand même — on
            regarde ensemble, la zone s’adapte.
          </p>
        </Container>
      </Section>

      {/* 13 ── FAQ AEO */}
      <FaqBlock
        tone="canvas"
        eyebrow="FAQ"
        title="Questions"
        titleEm="fréquentes"
        description="Rémunération, statut, zone, démarrage — les réponses avant de candidater."
        items={faqItems}
      />

      {/* 14 ── CTA final (ancre #postuler — formulaire à venir) */}
      <div id="postuler">
        <CtaBlock
          eyebrow="Démarrage septembre"
          title="Prêt à devenir le commercial IA de"
          titleEm="ta zone ?"
          description="Les candidatures sont ouvertes. 2 minutes, CV optionnel, débutants bienvenus — en indépendant ou apporteur d’affaires."
          cta={<CtaCandidature track="memo-final-apply" />}
        />
      </div>

      <StickyMobileCta href="#postuler" label="J'envoie ma candidature" track="memo-sticky-apply" />
    </>
  );
}
