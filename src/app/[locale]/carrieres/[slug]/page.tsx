// Page détail d'une offre /carrieres/[slug] — niveau /audit. Server Component.
// JobPosting + breadcrumb + WebPage/speakable ; corps HTML sanitizé (anti VIS-01) ;
// noindex si draft/pourvue/expirée/non-tier1 ; offres suggérées ; CTA postuler.

import type { Metadata } from "next";
// Link next-intl (et NON `next/link`) : sinon le retour hub, les offres
// similaires et les liens verticales sortent locale-less → un 301 par lien
// (audit GEO/AEO 2026-08-14, GEO-080).
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { JsonLd } from "@/components/marketing/JsonLd";
import { HeroBadge } from "@/components/marketing/HeroBadge";
import { DarkTriadPanel } from "@/components/marketing/DarkTriadPanel";
import { FaqBlock } from "@/components/sections/FaqBlock";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { GraduationCap, Handshake, MessagesSquare } from "lucide-react";
import { Cta } from "@/components/marketing/Cta";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { buildProductMetadata, buildWebPageJsonLd } from "@/lib/seo";
import { buildJobPostingJsonLd } from "@/lib/seo/job-posting";
import { CAREER_VERTICALS } from "@/content/careers/categories";
import { EMPLOYER_BRAND } from "@/content/careers/employer-brand";
import { careerImage, CAREERS_HERO } from "@/content/careers/careers-images";
import { UnsplashCredit } from "@/components/media/UnsplashCredit";
import { sanitizeContentGenHtml } from "@/server/content-gen/shared/html-sanitizer";
import {
  applicantCountryLabel,
  contractTypeLabel,
  normalizeApplicantCountries,
} from "@/lib/careers/format";
import {
  getJobOfferBySlug,
  isJobOfferIndexable,
  listIndexableJobOfferSlugs,
  listSuggestedOffers,
} from "@/lib/careers/job-offers";
import type { JobOffer } from "../../../../../prisma/generated/client";
import { prefixerLiensInternes } from "@/lib/content/liens-internes";

export const revalidate = 3600;

const WORKMODE_LABELS: Record<string, { fr: string; en: string }> = {
  on_site: { fr: "Sur site", en: "On-site" },
  hybrid: { fr: "Hybride", en: "Hybrid" },
  remote: { fr: "Remote", en: "Remote" },
};

interface PerkItem {
  labelFr?: string;
  labelEn?: string;
  icon?: string;
}

/** Offre clôturée = non publiée, pourvue OU expirée (Date.now isolé hors render). */
function isOfferClosed(o: Pick<JobOffer, "status" | "filledAt" | "validThrough">): boolean {
  if (o.status !== "published") return true;
  if (o.filledAt) return true;
  if (o.validThrough && o.validThrough.getTime() < Date.now()) return true;
  return false;
}

function salaryLabel(o: JobOffer, isFr: boolean): string | null {
  if (o.isCommission) return isFr ? "Commission déplafonnée" : "Uncapped commission";
  if (!o.salaryVisible) return null; // masqué → on n'affiche RIEN (jamais de mention vague, directive UE 2023/970)
  if (o.salaryMin == null && o.salaryMax == null) return null;
  const k = (n: number) => `${Math.round(n / 1000)}k`;
  const per =
    o.salaryPeriod === "YEAR"
      ? isFr
        ? "/an"
        : "/yr"
      : o.salaryPeriod === "MONTH"
        ? isFr
          ? "/mois"
          : "/mo"
        : "/h";
  const range =
    o.salaryMin != null && o.salaryMax != null
      ? `${k(o.salaryMin)}–${k(o.salaryMax)}`
      : k((o.salaryMin ?? o.salaryMax) as number);
  return `${range} ${o.salaryCurrency} ${per}`;
}

// FAQ par offre (AEO / AI Overviews) : questions/réponses FACTUELLES dérivées des
// données réelles de l'offre (mode de travail, contrat, salaire, candidature) →
// unique par offre (anti-thin/anti-doorway), rien d'inventé. Rendu via FaqAccordion
// (CSS-only, 0 JS) qui émet le JSON-LD FAQPage.
function buildOfferFaq(
  o: JobOffer,
  title: string,
  isFr: boolean,
): Array<{ id: string; question: string; answer: string }> {
  const items: Array<{ id: string; question: string; answer: string }> = [];
  const cityPart = o.city ? (isFr ? ` à ${o.city}` : ` in ${o.city}`) : "";

  // Pays éligibles calculés AVANT la réponse télétravail : quand une offre à
  // distance est ouverte hors de France (`applicant_countries`), dire « ouvert
  // partout en France » contredit la réponse « pays » trois questions plus bas —
  // et c'est la phrase que reprend un moteur de réponse.
  const countries = normalizeApplicantCountries(o.applicantCountries);
  const countryNames = countries.map((c) => applicantCountryLabel(c, isFr));

  // Villes du poste (multi-lieux) : un poste à zone nationale ne doit pas
  // répondre « en présentiel à Grenoble » — c'est la question n°1 d'un candidat
  // hors Isère, et la réponse que reprennent les moteurs de réponse.
  const faqCities = Array.isArray(o.jobLocations)
    ? (o.jobLocations as Array<{ city?: string }>)
        .map((l) => l.city)
        .filter((c): c is string => Boolean(c))
    : [];

  const remoteScope =
    countries.length > 1
      ? isFr
        ? `ouvert depuis ${countries.length} pays francophones (${countryNames.slice(0, 5).join(", ")}…)`
        : `open from ${countries.length} French-speaking countries (${countryNames.slice(0, 5).join(", ")}…)`
      : isFr
        ? "ouvert partout en France"
        : "open across France";
  const modeAnswer =
    faqCities.length > 1
      ? isFr
        ? `Le poste couvre toute la France — interventions organisées par secteurs autour de ${faqCities.length} villes (${faqCities.slice(0, 5).join(", ")}…)${o.city ? `, avec un rattachement à ${o.city}` : ""}.`
        : `The role covers all of France — organised by sector around ${faqCities.length} cities (${faqCities.slice(0, 5).join(", ")}…)${o.city ? `, with a home base in ${o.city}` : ""}.`
      : o.workMode === "remote"
        ? isFr
          ? `Oui, ce poste est en télétravail (à distance), ${remoteScope}.`
          : `Yes, this role is fully remote, ${remoteScope}.`
        : o.workMode === "hybrid"
          ? isFr
            ? `Ce poste est en hybride : une partie en présentiel${cityPart} et une partie en télétravail.`
            : `This role is hybrid: partly on-site${cityPart} and partly remote.`
          : isFr
            ? `Ce poste est en présentiel${cityPart}.`
            : `This role is on-site${cityPart}.`;
  items.push({
    id: "teletravail",
    question:
      faqCities.length > 1
        ? isFr
          ? `Où s'exerce le poste de ${title} ?`
          : `Where is the ${title} role based?`
        : isFr
          ? `Le poste de ${title} est-il en télétravail ?`
          : `Is the ${title} role remote?`,
    answer: modeAnswer,
  });

  // Libellé traduit (SSOT `format.ts`) : sans lui, l'enum schema.org brut
  // fuitait en façade (« Il s'agit d'un poste en CONTRACTOR »). `null` si le
  // type est inconnu → on n'émet pas la question plutôt que d'afficher un code.
  const contract = contractTypeLabel(o, isFr);
  if (contract) {
    items.push({
      id: "contrat",
      question: isFr ? "Quel est le type de contrat ?" : "What type of contract is it?",
      answer: isFr ? `Il s'agit d'un poste en ${contract}.` : `This is a ${contract} position.`,
    });
  }

  // Pays éligibles (AEO) : « Puis-je postuler depuis le Maroc ? » est LA question
  // d'un candidat francophone hors de France devant une offre à distance.
  if (countries.length > 1) {
    const names = countryNames;
    const listed = isFr
      ? `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`
      : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
    items.push({
      id: "pays",
      question: isFr
        ? "Depuis quels pays peut-on postuler à cette offre ?"
        : "Which countries can I apply from?",
      answer: isFr
        ? `Les candidatures sont ouvertes depuis ${listed}. Le travail se fait intégralement à distance, en français.`
        : `Applications are open from ${listed}. The role is fully remote and works in French.`,
    });
  }

  const sal = salaryLabel(o, isFr);
  if (sal) {
    items.push({
      id: "remuneration",
      question: isFr ? "Quelle est la rémunération ?" : "What is the salary?",
      answer: isFr
        ? `La rémunération proposée est de ${sal}, selon ton profil et ton expérience.`
        : `The offered pay is ${sal}, depending on your profile and experience.`,
    });
  }

  items.push({
    id: "candidature",
    question: isFr ? "Comment postuler à cette offre ?" : "How do I apply?",
    answer: isFr
      ? "Tu postules en ligne en quelques minutes via le bouton « Postuler ». Le CV est optionnel : ce qui compte, c'est ta motivation et ce que tu sais faire."
      : "Apply online in a few minutes via the « Apply » button. A CV is optional — what matters is your motivation and skills.",
  });

  return items;
}

export async function generateStaticParams() {
  const slugs = await listIndexableJobOfferSlugs();
  // FR-only : on ne pré-rend que le FR (EN désactivé → 301 vers FR au runtime).
  return slugs.map((slug) => ({ locale: "fr", slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const offer = await getJobOfferBySlug(slug);
  if (!offer) return { robots: { index: false, follow: false }, alternates: {} };

  const isFr = locale === "fr";
  // FR-only : EN désactivé → noindex explicite (ceinture + bretelles avec le 301).
  if (!isFr) {
    return {
      ...(await buildProductMetadata({
        locale: locale as Locale,
        path: `/carrieres/${slug}`,
        title: offer.metaTitle ?? `${offer.titleEn} · Axion-IA.com`,
        description: (offer.metaDescription ?? offer.summaryEn).slice(0, 160),
      })),
      robots: { index: false, follow: true },
    };
  }
  const base = await buildProductMetadata({
    locale: locale as Locale,
    path: `/carrieres/${slug}`,
    title: offer.metaTitle ?? `${isFr ? offer.titleFr : offer.titleEn} · Axion-IA.com`,
    description: (offer.metaDescription ?? (isFr ? offer.summaryFr : offer.summaryEn)).slice(
      0,
      160,
    ),
    ...(offer.ogImagePath ? { ogImage: offer.ogImagePath } : {}),
  });
  // Offre ouverte à plusieurs pays francophones → `og:locale:alternate` fr_XX.
  // Le site reste mono-URL (une seule page, pas de duplicata par pays) : on ne
  // touche donc PAS aux hreflang (qui exigent des URLs distinctes), on se
  // contente de déclarer les variantes régionales du même contenu français.
  const countries = normalizeApplicantCountries(offer.applicantCountries);
  const withOg: Metadata =
    countries.length > 1
      ? {
          ...base,
          openGraph: {
            ...base.openGraph,
            alternateLocale: countries.filter((c) => c !== "FR").map((c) => `fr_${c}`),
          },
        }
      : base;
  if (!isJobOfferIndexable(offer)) {
    return { ...withOg, robots: { index: false, follow: true } };
  }
  return withOg;
}

export default async function JobOfferDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const offer = await getJobOfferBySlug(slug);
  if (!offer) notFound();

  const title = isFr ? offer.titleFr : offer.titleEn;
  const summary = isFr ? offer.summaryFr : offer.summaryEn;
  // GEO-079/081 — reecriture des liens internes au rendu (cf. le module dedie).
  const bodyHtml = prefixerLiensInternes(
    sanitizeContentGenHtml(isFr ? offer.bodyFr : offer.bodyEn),
    loc,
  );
  const sal = salaryLabel(offer, isFr);
  const applyHref = `/carrieres/${offer.slug}/postuler`;
  const isClosed = isOfferClosed(offer);

  const perks: PerkItem[] = Array.isArray(offer.perks) ? (offer.perks as PerkItem[]) : [];
  const suggested = await listSuggestedOffers(offer, 4);
  // Zone d'emploi multi-villes (postes itinérants/territoriaux).
  const eligibleCountries = normalizeApplicantCountries(offer.applicantCountries);
  const jobCities = Array.isArray(offer.jobLocations)
    ? (offer.jobLocations as Array<{ city?: string }>)
        .map((l) => l.city)
        .filter((c): c is string => Boolean(c))
    : [];
  const img = careerImage(offer.slug);

  // Faits-clés du poste, en cartes (refonte 2026-08-12, réf. /methodologie) :
  // l'ancienne ligne « 📄 CDI · 💶 41k–85k · 👥 » se perdait dans le texte.
  const zoneLabel =
    jobCities.length > 0
      ? isFr
        ? `France entière · ${jobCities.length} villes`
        : `France-wide · ${jobCities.length} cities`
      : offer.workMode === "remote"
        ? isFr
          ? "100 % à distance"
          : "Fully remote"
        : `${WORKMODE_LABELS[offer.workMode]?.[isFr ? "fr" : "en"] ?? ""}${offer.city ? ` · ${offer.city}` : ""}`;
  // Contrat : libellé libre admin si présent, sinon dérivé de l'enum (SSOT
  // contractTypeLabel) — sans repli, la carte manquait sur la moitié des offres.
  const contractFact = offer.contractLabel ?? contractTypeLabel(offer, isFr);
  const heroFacts = [
    sal ? { label: isFr ? "Rémunération" : "Pay", value: sal } : null,
    contractFact ? { label: isFr ? "Contrat" : "Contract", value: contractFact } : null,
    { label: isFr ? "Zone" : "Area", value: zoneLabel },
    offer.startDate
      ? {
          label: isFr ? "Démarrage" : "Start",
          value: `${isFr ? "Dès le" : "From"} ${offer.startDate.toISOString().slice(0, 10)}`,
        }
      : null,
  ].filter((f): f is { label: string; value: string } => f !== null);

  const jobPosting = buildJobPostingJsonLd(offer, loc);
  const webPage = buildWebPageJsonLd({
    locale: loc,
    path: `/carrieres/${offer.slug}`,
    name: title,
    description: summary,
    // Signaux de fraîcheur (E-E-A-T / AI Overviews) : datés depuis la DB.
    datePublished: (offer.publishedAt ?? offer.datePosted).toISOString(),
    dateModified: offer.updatedAt.toISOString(),
    speakable: { selectors: ["h1", "[data-speakable]"] },
    // Image représentative de la page (lien page↔image pour Google/Images).
    extra: {
      primaryImageOfPage: {
        "@type": "ImageObject",
        url: img.url,
        contentUrl: img.url,
        caption: `${title} — Axion-IA`,
      },
    },
  });

  return (
    <>
      {jobPosting ? <JsonLd data={jobPosting} scriptId="jsonld-jobposting" /> : null}
      <JsonLd data={webPage} scriptId="jsonld-webpage" />

      <Section tone="halo-warm">
        <Container>
          <Breadcrumbs
            items={[
              { href: "/carrieres", label: isFr ? "Carrières" : "Careers" },
              { href: applyHref.replace("/postuler", ""), label: title },
            ]}
          />

          {isClosed ? (
            <p className="bg-sand text-fg-muted mt-6 rounded-lg px-4 py-3 text-sm">
              {offer.filledAt
                ? isFr
                  ? "Cette offre est pourvue. Merci de votre intérêt — d'autres postes vous attendent."
                  : "This position has been filled. Thanks for your interest — other roles are open."
                : isFr
                  ? "Cette offre est clôturée."
                  : "This position is closed."}
            </p>
          ) : null}

          <div className="mt-6 grid items-start gap-8 lg:grid-cols-[1fr_0.85fr] lg:gap-12">
            {/* Colonne gauche — texte. Refonte 2026-08-12 (réf. /methodologie) :
                pastille d'eyebrow, titre display, faits-clés en cartes serif —
                l'ancien rendu (« Sur site · Grenoble » + ligne d'emojis) faisait
                vieillot et trop textuel (retour Will). */}
            <div>
              <HeroBadge className="mb-5 justify-start">
                <span
                  aria-hidden="true"
                  className="bg-terracotta inline-block h-1.5 w-1.5 rounded-full"
                />
                {isFr ? "On recrute" : "We're hiring"}
                <span aria-hidden="true" className="text-fg-muted">
                  ·
                </span>
                {jobCities.length > 0
                  ? isFr
                    ? `France entière${offer.city ? ` · basé à ${offer.city}` : ""}`
                    : `France-wide${offer.city ? ` · based in ${offer.city}` : ""}`
                  : `${WORKMODE_LABELS[offer.workMode]?.[isFr ? "fr" : "en"] ?? ""}${offer.city ? ` · ${offer.city}` : ""}`}
              </HeroBadge>
              <h1 className="display-editorial text-fg">{title}</h1>

              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {heroFacts.map((f) => (
                  <div
                    key={f.label}
                    className="border-border bg-paper/80 shadow-subtle rounded-2xl border px-4 py-3"
                  >
                    <p className="text-fg-muted text-[11px] font-semibold tracking-wide uppercase">
                      {f.label}
                    </p>
                    <p className="text-terracotta-deep mt-1 font-serif text-lg leading-snug font-semibold">
                      {f.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* En bref — direct answer AEO / speakable */}
              <p data-speakable className="mt-5 text-lg">
                {summary}
              </p>

              {/* Pays éligibles — l'information que cherche un candidat hors de
                  France sur une offre à distance. Texte brut (pas de JS) : lu
                  aussi bien par les moteurs de réponse que par les humains. */}
              {eligibleCountries.length > 1 ? (
                <p data-speakable className="text-fg-muted mt-3 text-sm">
                  {isFr ? "Candidatures ouvertes depuis " : "Open to applicants from "}
                  <strong>
                    {eligibleCountries.map((c) => applicantCountryLabel(c, isFr)).join(" · ")}
                  </strong>
                </p>
              ) : null}

              {!isClosed ? (
                <div className="mt-6">
                  <Cta href={applyHref} track="career-apply-hero">
                    {isFr ? "Postuler" : "Apply"}
                  </Cta>
                </div>
              ) : null}
            </div>

            {/* Colonne droite — photo */}
            <div>
              <div className="border-border shadow-card relative aspect-[4/3] overflow-hidden rounded-3xl border">
                <Image
                  src={img.url}
                  alt={`${title} — offre d'emploi chez Axion-IA`}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 40vw"
                  className="object-cover"
                />
              </div>
              <UnsplashCredit
                photographerName={img.byName}
                photographerUrl={img.byUrl}
                className="text-right"
              />
            </div>
          </div>
        </Container>
      </Section>

      <Section>
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1fr_18rem]">
            <article
              className={[
                "prose prose-lg prose-neutral max-w-none",
                // H2 : titres de section terracotta serif, bien détachés (anti gros-bloc).
                "[&_h2]:text-terracotta-deep [&_h2]:mt-14 [&_h2]:mb-5 [&_h2]:font-serif [&_h2]:text-3xl [&_h2]:leading-tight [&_h2]:font-semibold sm:[&_h2]:text-4xl",
                // H3 : sous-titres serif noir.
                "[&_h3]:text-fg [&_h3]:mt-8 [&_h3]:mb-3 [&_h3]:font-serif [&_h3]:text-xl [&_h3]:font-semibold",
                // Listes : puces terracotta, aérées.
                // Listes : puces terracotta, à puces explicites + aérées (sans dépendre de prose).
                "[&_li]:marker:text-terracotta [&_ul]:my-5 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5",
                // Paragraphes : espacés (mb-5), lisibles, gris doux ; gras en noir franc.
                "[&_p]:text-fg-soft [&_strong]:text-fg [&_p]:mb-5 [&_p]:leading-relaxed [&_strong]:font-semibold",
              ].join(" ")}
              // Corps riche déjà sanitizé (whitelist) — anti VIS-01 (jamais affiché en texte).
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />

            <aside className="space-y-6">
              {perks.length > 0 ? (
                <div className="border-border rounded-2xl border p-5">
                  <h2 className="font-serif text-lg font-semibold">
                    {isFr ? "Ce qu'on offre" : "What we offer"}
                  </h2>
                  <ul className="mt-3 space-y-2 text-sm" role="list">
                    {perks.map((p, i) => (
                      <li key={i} className="flex gap-2">
                        <span aria-hidden>{p.icon ?? "✅"}</span>
                        <span>{(isFr ? p.labelFr : p.labelEn) ?? p.labelFr ?? p.labelEn}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {!isClosed ? (
                <div className="border-terracotta/30 bg-terracotta/5 rounded-2xl border p-5">
                  <p className="text-sm">
                    {isFr
                      ? "Prêt·e à nous rejoindre ? La candidature prend quelques minutes."
                      : "Ready to join? Applying takes a few minutes."}
                  </p>
                  <div className="mt-3">
                    <Cta href={applyHref} track="career-apply-aside">
                      {isFr ? "Postuler maintenant" : "Apply now"}
                    </Cta>
                  </div>
                </div>
              ) : null}

              <div className="border-border rounded-2xl border p-5">
                <h2 className="font-serif text-lg font-semibold">
                  {isFr ? "Nos expertises IA" : "Our AI expertise"}
                </h2>
                <ul className="mt-3 space-y-1.5 text-sm" role="list">
                  {CAREER_VERTICALS.map((v) => (
                    <li key={v.href}>
                      <Link
                        // `CAREER_VERTICALS.href` est un `string` : même
                        // échappatoire de typage que `Cta.tsx`.
                        href={v.href as never}
                        className="text-terracotta hover:text-terracotta-deep inline-flex items-center gap-1 underline underline-offset-2"
                      >
                        {isFr ? v.fr : v.en} →
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border-border rounded-2xl border p-5">
                <h2 className="font-serif text-lg font-semibold">
                  {isFr ? "Qui est Axion-IA.com ?" : "Who is Axion-IA.com?"}
                </h2>
                <p className="text-fg-muted mt-2 text-sm">
                  {isFr ? EMPLOYER_BRAND.shortAboutFr : EMPLOYER_BRAND.shortAboutEn}
                </p>
                <Link
                  href="/carrieres"
                  className="text-terracotta mt-2 inline-block text-sm underline"
                >
                  {isFr ? "Découvrir l'entreprise →" : "Discover the company →"}
                </Link>
              </div>
            </aside>
          </div>
        </Container>
      </Section>

      {/* Parité images/texte (demande Will 2026-08-12) : entre la photo du hero
          et les vignettes du bas, le corps (~2 500 c.) ne portait AUCUNE image.
          Deux scènes d'équipe déjà curées du pool carrières — jamais la photo
          de l'offre elle-même (filtre sur l'URL). */}
      <Section tone="sand">
        <Container>
          <div className="grid gap-5 sm:grid-cols-2">
            {[
              {
                ...CAREERS_HERO,
                altFr: "Travail d'équipe chez Axion-IA — collaboration sur ordinateurs portables",
              },
              {
                ...careerImage("consultant-ia-generative"),
                altFr: "Réunion d'équipe autour d'une table, ordinateurs ouverts",
              },
              {
                ...careerImage("formateur-ia-itinerant"),
                altFr: "Présentation devant une équipe en atelier",
              },
            ]
              .filter((b) => b.url !== img.url)
              .slice(0, 2)
              .map((b) => (
                <figure key={b.url}>
                  <div className="border-border shadow-card relative aspect-[3/2] overflow-hidden rounded-3xl border">
                    <Image
                      src={b.url}
                      alt={isFr ? b.altFr : b.alt}
                      fill
                      sizes="(max-width: 640px) 100vw, 50vw"
                      className="object-cover"
                    />
                  </div>
                  <UnsplashCredit
                    photographerName={b.byName}
                    photographerUrl={b.byUrl}
                    className="text-right"
                  />
                </figure>
              ))}
          </div>
        </Container>
      </Section>

      {/* Où ce poste est ouvert — multi-villes (sous l'offre, plus dans le hero) */}
      {jobCities.length > 0 ? (
        <Section
          tone="sand"
          eyebrow={isFr ? "Zone d'action" : "Coverage"}
          title={isFr ? "Où ce poste est" : "Where this role is"}
          titleEm={isFr ? "ouvert" : "open"}
          description={
            isFr
              ? "Poste itinérant, organisé par secteurs : tu interviens chez nos clients partout en France — dans ces villes et leurs alentours."
              : "Itinerant role, organised by sector: you work at our clients across France — in these cities and surroundings."
          }
        >
          <Container>
            <ul className="flex flex-wrap gap-2" role="list">
              {jobCities.map((c) => (
                <li
                  key={c}
                  className="border-border text-fg-muted bg-paper rounded-full border px-3 py-1 text-sm"
                >
                  {c}
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      ) : null}

      {/* Accompagnement — panneau mocha (réf. /methodologie « Notre parti pris ») :
          les 2 cartes blanches plates manquaient d'énergie (retour Will 2026-08-12). */}
      <Section
        eyebrow={isFr ? "Accompagnement" : "Support"}
        title={isFr ? "Comment on t'" : "How we"}
        titleEm={isFr ? "accompagne" : "support you"}
      >
        <Container>
          <DarkTriadPanel
            items={[
              {
                Icon: GraduationCap,
                eyebrow: "01",
                title: isFr ? "Ta formation" : "Your training",
                description: isFr ? EMPLOYER_BRAND.formationFr : EMPLOYER_BRAND.formationEn,
              },
              {
                Icon: Handshake,
                eyebrow: "02",
                title: isFr ? "Ton intégration" : "Your onboarding",
                description: isFr ? EMPLOYER_BRAND.integrationFr : EMPLOYER_BRAND.integrationEn,
              },
              {
                Icon: MessagesSquare,
                eyebrow: "03",
                title: isFr ? "Autonomie + franchise" : "Autonomy + straight talk",
                description: isFr
                  ? "Peu de réunions, beaucoup de confiance. On dit ce qui marche, ce qui ne marchera pas, et on livre."
                  : "Few meetings, lots of trust. We say what works, what won't, and we ship.",
              },
            ]}
          />
          {offer.category === "conseil" ? (
            <p className="border-terracotta text-fg-soft mx-auto mt-6 max-w-3xl border-l-4 pl-4 leading-relaxed">
              {isFr ? EMPLOYER_BRAND.formateurOnboardingFr : EMPLOYER_BRAND.formateurOnboardingEn}
            </p>
          ) : null}
        </Container>
      </Section>

      <FaqBlock
        tone="canvas"
        eyebrow="FAQ"
        title={isFr ? "Questions" : "Common"}
        titleEm={isFr ? "fréquentes" : "questions"}
        items={buildOfferFaq(offer, title, isFr)}
      />

      {suggested.length >= 2 ? (
        <Section
          tone="sand"
          eyebrow={isFr ? "Et aussi" : "Also"}
          title={isFr ? "D'autres offres qui pourraient te" : "Other roles you might"}
          titleEm={isFr ? "plaire" : "like"}
        >
          <Container>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2" role="list">
              {suggested.map((s) => {
                const sImg = careerImage(s.slug);
                return (
                  <li key={s.id}>
                    <Link
                      href={{ pathname: "/carrieres/[slug]", params: { slug: s.slug } }}
                      className="border-border hover:border-terracotta shadow-subtle hover:shadow-card flex items-center gap-4 rounded-xl border bg-white p-3 transition"
                    >
                      <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg">
                        <Image
                          src={sImg.url}
                          alt={`${isFr ? s.titleFr : s.titleEn} — Axion-IA`}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate font-medium">{isFr ? s.titleFr : s.titleEn}</h3>
                        <p className="text-fg-muted mt-0.5 text-xs">
                          {s.city ?? WORKMODE_LABELS[s.workMode]?.[isFr ? "fr" : "en"]}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Container>
        </Section>
      ) : null}

      {/* CTA final — bande mocha (réf. /methodologie « Prêt à démarrer ? ») :
          la page se terminait sur les offres suggérées, sans dernier appel. */}
      {!isClosed ? (
        <CtaBlock
          title={isFr ? "Prêt·e à nous" : "Ready to"}
          titleEm={isFr ? "rejoindre ?" : "join us?"}
          description={
            isFr
              ? "La candidature prend quelques minutes. Le CV est optionnel : ce qui compte, c'est ta motivation et ce que tu sais faire."
              : "Applying takes a few minutes. A CV is optional — what matters is your motivation and skills."
          }
          cta={
            <Cta href={applyHref} size="lg" track="career-apply-footer">
              {isFr ? "Postuler maintenant" : "Apply now"} →
            </Cta>
          }
        />
      ) : null}

      {!isClosed ? (
        <StickyMobileCta
          href={applyHref}
          label={isFr ? "Postuler" : "Apply"}
          track="career-apply-sticky"
        />
      ) : null}
    </>
  );
}
