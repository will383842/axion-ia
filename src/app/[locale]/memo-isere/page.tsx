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
// 📷 Images : AUCUN Unsplash (décision Will). Emplacements `Illustration` avec
// nom de fichier cible ; en production un emplacement sans fichier est MASQUÉ
// (le cadre pointillé vide en prod a déjà été refusé le 2026-08-10) — dès que
// Will dépose l'image dans public/illustrations/, elle apparaît au build suivant.

import type { Metadata } from "next";
import Image from "next/image";
import { existsSync } from "node:fs";
import { join } from "node:path";
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
import { Illustration } from "@/components/visual/Illustration";
import { buildProductMetadata, buildWebPageJsonLd, SITE_URL, SITE_EDITORIAL_DATE } from "@/lib/seo";
import { getPublishedReviews, type PublicReview } from "@/server/reviews/queries";
import {
  MEMO_ZONE_CLUSTERS,
  MEMO_ZONE_PRINCIPALES,
  MEMO_ZONE_TOTAL,
} from "@/content/recrutement/memo-isere-zone";

export const revalidate = 3600;

/** Emplacement image : visible en dev (cadre + fichier cible), masqué en prod
 *  tant que le fichier n'existe pas — jamais de cadre vide en production. */
function illustrationReady(publicRelPath: string): boolean {
  return existsSync(join(process.cwd(), "public", publicRelPath));
}
function showIllustrationSlot(publicRelPath: string): boolean {
  return process.env.NODE_ENV !== "production" || illustrationReady(publicRelPath);
}

const HERO_IMG = "illustrations/memo-isere-hero.avif";
const TERRAIN_IMG = "illustrations/memo-isere-terrain.avif";

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
      "Axion-IA recrute des commerciaux indépendants et apporteurs d'affaires de Grenoble à Valence, Die et Lyon (474 communes, zone au choix selon disponibilité) pour promouvoir ses formations et audits IA auprès des entreprises locales. L'AI Act impose la formation des équipes à l'IA et les formations sont finançables OPCO : la vente est facilitée. 500 € par journée de formation vendue, revenus non plafonnés, statut libre, démarrage en septembre. Débutants acceptés, formation à l'offre fournie." /* price-exempt: commission commerciale de recrutement, pas un tarif client */,
    datePosted: SITE_EDITORIAL_DATE,
    employmentType: "CONTRACTOR",
    occupationalCategory: "Commercial indépendant · Agent commercial · VRP · Apporteur d'affaires",
    industry: "Intelligence artificielle · Formation · Services aux entreprises",
    qualifications:
      "Aisance relationnelle et motivation. Débutants acceptés : formation complète à l'offre IA fournie.",
    responsibilities:
      "Prospecter les entreprises de sa zone (choisie entre Grenoble, Valence, Die et Lyon), présenter les formations et audits IA, suivre ses ventes et commissions sur un tableau de bord.",
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

  const heroReady = illustrationReady(HERO_IMG);

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
                Devenez commercial IA{" "}
                <span
                  className="text-terracotta italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  sur votre territoire
                </span>
              </h1>
              <p data-speakable className="text-fg-soft mt-5 max-w-xl text-lg leading-relaxed">
                De Grenoble à Valence, de Die à Lyon : {MEMO_ZONE_TOTAL} communes — et vous
                choisissez votre zone, elle devient la vôtre tant qu’elle est disponible. L’AI Act
                rend la formation obligatoire, l’OPCO la finance — vous, vous touchez la commission.
              </p>

              <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  {
                    label: "Par jour de formation vendu",
                    value: "500 €",
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

            {showIllustrationSlot(HERO_IMG) ? (
              <Illustration
                slot="MEMO-01-hero"
                aspectRatio="4:5"
                filenameTarget={`public/${HERO_IMG}`}
                {...(heroReady ? { src: `/${HERO_IMG}`, priority: true } : {})}
                caption="Un indépendant en rendez-vous chez une entreprise locale"
                alt="Commercial indépendant Axion-IA en rendez-vous chez un artisan du Sud-Grésivaudan"
              />
            ) : null}
          </div>
        </Container>
      </Section>

      {/* 2 ── Bande de réassurance */}
      <Section className="py-8 sm:py-8">
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
      <Section className="pt-2 sm:pt-2">
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
                    v: "500 €",
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
                  "Toutes les TPE-PME parlent d'IA — et personne n'est venu les voir sur ta zone, surtout dans les petites communes. Tu arrives premier.",
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

      {/* 4 ── Rémunération transparente */}
      <Section
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
                mois: "2 500 €",
              } /* price-exempt: commission commerciale de recrutement, pas un tarif client */,
              {
                jours: "10 jours vendus",
                mois: "5 000 €",
              } /* price-exempt: commission commerciale de recrutement, pas un tarif client */,
              {
                jours: "20 jours vendus",
                mois: "10 000 €",
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

      {/* CTA band terracotta — pattern /fr/audit, 1er passage */}
      <BandeCta
        title="Ta zone t’attend — prends-la avant qu’un autre la choisisse."
        track="memo-band1-apply"
      />

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
                    figure: "500 €",
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
      {showIllustrationSlot(TERRAIN_IMG) ? (
        <Section>
          <Container className="max-w-4xl">
            <Illustration
              slot="MEMO-02-terrain"
              aspectRatio="16:9"
              filenameTarget={`public/${TERRAIN_IMG}`}
              {...(illustrationReady(TERRAIN_IMG) ? { src: `/${TERRAIN_IMG}` } : {})}
              caption="Le terrain : les entreprises du corridor, de la vallée de l'Isère au Rhône"
              alt="Rencontre commerciale dans une entreprise locale, entre Grenoble, Valence et Lyon"
            />
          </Container>
        </Section>
      ) : null}

      {/* 7 ── Avis clients (preuve que le produit se vend) */}
      {reviews.length >= 3 ? (
        <Section
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

      {/* 8 ── Intégration & aide au démarrage */}
      <Section tone="sand" eyebrow="Jamais seul" title="Intégration et aide au" titleEm="démarrage">
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
        </Container>
      </Section>

      {/* 9 ── Poste évolutif */}
      <Section
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

      {/* 10 ── Fondateur */}
      <Section tone="sand" eyebrow="Qui recrute" title="Le mot du" titleEm="fondateur">
        <Container>
          <div className="border-border bg-paper shadow-card mx-auto flex max-w-3xl flex-col items-center gap-6 rounded-3xl border p-8 sm:flex-row sm:items-start">
            <Image
              src="/illustrations/william-fondateur-formateur-ia-axion-ia.png"
              alt="Williams Jullin, fondateur d'Axion-IA"
              width={128}
              height={128}
              className="h-32 w-32 shrink-0 rounded-2xl object-cover"
            />
            <div>
              <blockquote className="text-fg-soft text-lg leading-relaxed">
                « Je forme moi-même les dirigeants et leurs équipes, et je vois la même chose
                partout : les entreprises veulent passer à l’IA mais personne ne vient les voir. De
                Grenoble à Lyon en passant par Valence et Die, c’est chez nous — je cherche des gens
                du coin qui connaissent leur territoire et qui veulent être payés à la hauteur de ce
                qu’ils apportent. »
              </blockquote>
              <p className="mt-4 font-semibold">Williams Jullin</p>
              <p className="text-fg-muted text-sm">Fondateur d’Axion-IA · Grenoble</p>
            </div>
          </div>
        </Container>
      </Section>

      {/* 11 ── Profils recherchés */}
      <Section
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

      {/* CTA band terracotta — pattern /fr/audit, 2e passage */}
      <BandeCta
        title="Septembre arrive vite — les zones partent une par une."
        track="memo-band2-apply"
      />

      {/* 12 ── Zone couverte — GEO : 474 communes officielles en 13 territoires,
          grille façon « L'audit IA disponible partout en France » de /fr/audit. */}
      <Section
        tone="sand"
        eyebrow="Ton territoire"
        title={`${MEMO_ZONE_TOTAL} communes, de Grenoble à`}
        titleEm="Lyon, Valence et Die"
        description="Tu choisis ta zone parmi 13 territoires ; tant qu'elle est disponible, elle devient la tienne. Chaque commune — y compris la plus petite — compte des artisans, des commerces et des PME que personne n'a démarchés sur l'IA."
      >
        <Container>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {MEMO_ZONE_CLUSTERS.map((cl) => (
              <div
                key={cl.label}
                className="border-border bg-paper shadow-subtle hover:shadow-card rounded-2xl border p-5 transition-all duration-300 hover:-translate-y-0.5"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-serif text-lg leading-snug font-semibold">{cl.label}</h3>
                  <span className="text-terracotta shrink-0 text-xs font-bold tracking-wide uppercase">
                    {cl.communes.length} communes
                  </span>
                </div>
                <p className="text-fg-muted mt-3 text-[13px] leading-relaxed">
                  {cl.communes.join(" · ")}
                </p>
              </div>
            ))}
          </div>
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
          description="Les candidatures sont ouvertes — le formulaire arrive ici très prochainement. 2 minutes, CV optionnel, débutants bienvenus."
          cta={<CtaCandidature track="memo-final-apply" />}
        />
      </div>

      <StickyMobileCta href="#postuler" label="J'envoie ma candidature" track="memo-sticky-apply" />
    </>
  );
}
