// Hub /carrieres — liste des offres publiées (DB-piloté, ISR). Server Component
// pur (0 JS : filtres par query-param server-side → INP préservé). Niveau /audit.

import type { Metadata } from "next";
import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Cta } from "@/components/marketing/Cta";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { CAREER_CATEGORIES, careerCategoryLabel } from "@/content/careers/categories";
import { EMPLOYER_BRAND } from "@/content/careers/employer-brand";
import { HUB_VILLES } from "@/content/recrutement/satellites";

// 41 villes affichées en badges (info, pas de pages thin) : Saint-Marcellin (siège)
// + les 40 hubs T1+T2 (population ≥ 100 000).
const CAREER_CITIES: ReadonlyArray<string> = [
  "Saint-Marcellin",
  ...HUB_VILLES.map((v) => v.nameFr),
];
import { buildProductMetadata, buildItemListJsonLd, SITE_URL } from "@/lib/seo";
import { listPublishedJobOffers } from "@/lib/careers/job-offers";
import type { JobOffer } from "../../../../prisma/generated/client";

export const revalidate = 3600;

const WORKMODE_LABELS: Record<string, { fr: string; en: string }> = {
  on_site: { fr: "Sur site", en: "On-site" },
  hybrid: { fr: "Hybride", en: "Hybrid" },
  remote: { fr: "Remote", en: "Remote" },
};

function isNew(datePosted: Date): boolean {
  return Date.now() - datePosted.getTime() < 14 * 24 * 3600 * 1000;
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  const base = buildProductMetadata({
    locale: locale as Locale,
    path: "/carrieres",
    title: isFr ? "Carrières · rejoindre Axion-IA" : "Careers · join Axion-IA",
    description: isFr
      ? "Rejoignez Axion-IA, le cabinet IA opérationnel. Découvrez nos offres d'emploi et postulez en quelques minutes — sur site, hybride ou remote, partout en France."
      : "Join Axion-IA, the operational AI firm. Browse our open positions and apply in minutes — on-site, hybrid or remote across France.",
  });
  const offers = await listPublishedJobOffers();
  if (offers.length === 0) return { ...base, robots: { index: false, follow: true } };
  return base;
}

export default async function CarrieresHubPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string; workMode?: string; q?: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const sp = await searchParams;

  const all = await listPublishedJobOffers();
  const q = (sp.q ?? "").trim().toLowerCase();
  const offers = all.filter(
    (o) =>
      (!sp.category || o.category === sp.category) &&
      (!sp.workMode || o.workMode === sp.workMode) &&
      (!q ||
        o.titleFr.toLowerCase().includes(q) ||
        o.titleEn.toLowerCase().includes(q) ||
        o.summaryFr.toLowerCase().includes(q) ||
        o.summaryEn.toLowerCase().includes(q)),
  );

  const itemList = buildItemListJsonLd({
    locale: loc,
    path: "/carrieres",
    name: isFr ? "Offres d'emploi Axion-IA" : "Axion-IA job openings",
    items: offers.map((o, i) => ({
      url: `${SITE_URL}/${loc}/carrieres/${o.slug}`,
      name: isFr ? o.titleFr : o.titleEn,
      position: i + 1,
      description: isFr ? o.summaryFr : o.summaryEn,
    })),
  });

  const activeCategories = Array.from(new Set(all.map((o) => o.category)));
  const activeWorkModes = Array.from(new Set(all.map((o) => o.workMode)));
  // Conserve les deux dimensions de filtre dans l'URL (0 JS, INP préservé).
  const filterHref = (cat?: string, wm?: string): string => {
    const query = new URLSearchParams();
    if (cat) query.set("category", cat);
    if (wm) query.set("workMode", wm);
    if (sp.q) query.set("q", sp.q);
    const s = query.toString();
    return s ? `/carrieres?${s}` : "/carrieres";
  };

  return (
    <>
      {offers.length > 0 ? <JsonLd data={itemList} scriptId="jsonld-carrieres-list" /> : null}
      <JsonLd
        scriptId="jsonld-carrieres-webpage"
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          "@id": `${SITE_URL}/${loc}/carrieres#webpage`,
          url: `${SITE_URL}/${loc}/carrieres`,
          name: isFr ? "Carrières · Axion-IA" : "Careers · Axion-IA",
          inLanguage: loc,
          speakable: {
            "@type": "SpeakableSpecification",
            cssSelector: ["h1", "[data-speakable]"],
          },
        }}
      />

      <Section tone="paper">
        <Container>
          <Breadcrumbs items={[{ href: "/carrieres", label: isFr ? "Carrières" : "Careers" }]} />
          <p className="text-terracotta mt-6 text-sm font-semibold tracking-wide uppercase">
            {isFr ? EMPLOYER_BRAND.eyebrowFr : EMPLOYER_BRAND.eyebrowEn}
          </p>
          <h1 className="font-serif mt-2 text-4xl font-semibold sm:text-5xl">
            {isFr ? (
              <>
                Viens construire l&apos;IA qui change{" "}
                <em className="text-terracotta italic">vraiment</em> le quotidien des boîtes
              </>
            ) : (
              <>
                Come build the AI that <em className="text-terracotta italic">actually</em> changes how
                companies work
              </>
            )}
          </h1>
          <p data-speakable className="text-fg-muted mt-4 max-w-2xl text-lg">
            {isFr ? EMPLOYER_BRAND.heroIntroFr : EMPLOYER_BRAND.heroIntroEn}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Cta href="#offres" track="careers-hero-see-offers">
              {isFr ? "Voir les offres" : "See open roles"}
            </Cta>
            <Cta href="/contact" track="careers-hero-spontaneous">
              {isFr ? "Candidature spontanée" : "Spontaneous application"}
            </Cta>
          </div>
        </Container>
      </Section>

      {/* Pourquoi nous rejoindre */}
      <Section>
        <Container>
          <h2 className="font-serif text-2xl font-semibold sm:text-3xl">
            {isFr ? "Pourquoi nous rejoindre ?" : "Why join us?"}
          </h2>
          <p className="text-fg-muted mt-3 max-w-3xl">
            {isFr ? EMPLOYER_BRAND.aboutFr : EMPLOYER_BRAND.aboutEn}
          </p>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4" role="list">
            {EMPLOYER_BRAND.whyJoin.map((card) => (
              <li key={card.icon} className="border-border rounded-2xl border p-5">
                <span className="text-2xl" aria-hidden>
                  {card.icon}
                </span>
                <h3 className="mt-2 font-medium">{isFr ? card.titleFr : card.titleEn}</h3>
                <p className="text-fg-muted mt-1 text-sm">{isFr ? card.textFr : card.textEn}</p>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      {/* Siège — Saint-Marcellin */}
      <Section tone="sand">
        <Container>
          <h2 className="font-serif text-2xl font-semibold">
            {isFr ? EMPLOYER_BRAND.hqTitleFr : EMPLOYER_BRAND.hqTitleEn}
          </h2>
          <p className="text-fg-muted mt-3 max-w-3xl">
            {isFr ? EMPLOYER_BRAND.hqTextFr : EMPLOYER_BRAND.hqTextEn}
          </p>
          <p className="text-fg-muted mt-3 max-w-3xl text-sm">
            {isFr
              ? "Chez Axion-IA, le recrutement est ouvert à toutes et tous — sans discrimination. Nos intitulés de poste sont neutres et nos process inclusifs."
              : "At Axion-IA, hiring is open to everyone — without discrimination. Our job titles are neutral and our process inclusive."}
          </p>
        </Container>
      </Section>

      <Section id="offres">
        <Container>
          <h2 className="font-serif mb-6 text-2xl font-semibold sm:text-3xl">
            {isFr ? "Nos offres" : "Open roles"}
          </h2>
          {/* Recherche — formulaire GET server-side (0 JS, INP préservé) */}
          <form method="get" className="mb-4 flex max-w-md gap-2">
            {sp.category ? <input type="hidden" name="category" value={sp.category} /> : null}
            {sp.workMode ? <input type="hidden" name="workMode" value={sp.workMode} /> : null}
            <input
              type="search"
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder={isFr ? "Rechercher un poste…" : "Search a role…"}
              className="border-border focus:border-terracotta w-full rounded-full border px-4 py-2 text-sm outline-none"
              aria-label={isFr ? "Rechercher une offre" : "Search a role"}
            />
            <button type="submit" className="bg-terracotta rounded-full px-4 py-2 text-sm text-white">
              {isFr ? "Chercher" : "Search"}
            </button>
          </form>
          {/* Filtres — liens server-side (0 JS, INP préservé), 2 dimensions */}
          {activeCategories.length > 1 ? (
            <nav
              aria-label={isFr ? "Filtrer par catégorie" : "Filter by category"}
              className="mb-3 flex flex-wrap gap-2"
            >
              <Link
                href={filterHref(undefined, sp.workMode)}
                className={`rounded-full border px-4 py-1.5 text-sm ${!sp.category ? "border-terracotta bg-terracotta/10 font-medium" : "border-border"}`}
              >
                {isFr ? "Toutes" : "All"}
              </Link>
              {activeCategories.map((c) => (
                <Link
                  key={c}
                  href={filterHref(c, sp.workMode)}
                  className={`rounded-full border px-4 py-1.5 text-sm ${sp.category === c ? "border-terracotta bg-terracotta/10 font-medium" : "border-border"}`}
                >
                  {careerCategoryLabel(c, isFr)}
                </Link>
              ))}
            </nav>
          ) : null}
          {activeWorkModes.length > 1 ? (
            <nav
              aria-label={isFr ? "Filtrer par mode de travail" : "Filter by work mode"}
              className="mb-8 flex flex-wrap gap-2"
            >
              <Link
                href={filterHref(sp.category, undefined)}
                className={`rounded-full border px-4 py-1.5 text-sm ${!sp.workMode ? "border-terracotta bg-terracotta/10 font-medium" : "border-border"}`}
              >
                {isFr ? "Tous lieux" : "All modes"}
              </Link>
              {activeWorkModes.map((w) => (
                <Link
                  key={w}
                  href={filterHref(sp.category, w)}
                  className={`rounded-full border px-4 py-1.5 text-sm ${sp.workMode === w ? "border-terracotta bg-terracotta/10 font-medium" : "border-border"}`}
                >
                  {WORKMODE_LABELS[w]?.[isFr ? "fr" : "en"] ?? w}
                </Link>
              ))}
            </nav>
          ) : null}

          {offers.length === 0 ? (
            <div className="border-border rounded-2xl border border-dashed p-12 text-center">
              <p className="text-fg-muted text-lg">
                {isFr
                  ? "Pas d'offre ouverte en ce moment — mais on grandit vite."
                  : "No open position right now — but we're growing fast."}
              </p>
              <div className="mt-6">
                <Cta href="/contact" track="careers-empty-contact">
                  {isFr ? "Candidature spontanée" : "Spontaneous application"}
                </Cta>
              </div>
            </div>
          ) : (
            <div className="space-y-10">
              {CAREER_CATEGORIES.filter((cat) => offers.some((o) => o.category === cat.slug)).map(
                (cat) => (
                  <div key={cat.slug}>
                    <h3 className="font-serif text-xl font-semibold">{isFr ? cat.fr : cat.en}</h3>
                    <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" role="list">
                      {offers
                        .filter((o) => o.category === cat.slug)
                        .map((o) => {
                          const sal = salaryLabel(o, isFr);
                          return (
                            <li key={o.id}>
                              <Link
                                href={`/carrieres/${o.slug}`}
                                className="border-border hover:border-terracotta group flex h-full flex-col rounded-2xl border p-6 transition-colors"
                              >
                                <div className="mb-3 flex flex-wrap items-center gap-2">
                                  {isNew(o.datePosted) ? (
                                    <span className="bg-terracotta/15 text-terracotta rounded-full px-2.5 py-0.5 text-xs font-semibold">
                                      {isFr ? "Nouveau" : "New"}
                                    </span>
                                  ) : null}
                                </div>
                                <h4 className="font-serif text-xl font-semibold group-hover:underline">
                                  {isFr ? o.titleFr : o.titleEn}
                                </h4>
                                <p className="text-fg-muted mt-2 line-clamp-3 text-sm">
                                  {isFr ? o.summaryFr : o.summaryEn}
                                </p>
                                <div className="text-fg-muted mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                                  <span>
                                    📍 {o.city ?? WORKMODE_LABELS[o.workMode]?.[isFr ? "fr" : "en"]}
                                  </span>
                                  {o.contractLabel ? <span>📄 {o.contractLabel}</span> : null}
                                  {sal ? <span>💶 {sal}</span> : null}
                                </div>
                              </Link>
                            </li>
                          );
                        })}
                    </ul>
                  </div>
                ),
              )}
            </div>
          )}
        </Container>
      </Section>

      <Section>
        <Container>
          <h2 className="font-serif text-2xl font-semibold">
            {isFr ? "On recrute partout en France 🇫🇷" : "We hire across France 🇫🇷"}
          </h2>
          <p className="text-fg-muted mt-3 max-w-3xl">
            {isFr
              ? "Notre siège est à Saint-Marcellin (Isère), et beaucoup de postes sont ouverts en remote ou hybride. On accueille des talents un peu partout :"
              : "Our HQ is in Saint-Marcellin (Isère), and many roles are open remote or hybrid. We welcome talent all over the place:"}
          </p>
          <ul className="mt-5 flex flex-wrap gap-2" role="list">
            {CAREER_CITIES.map((city) => (
              <li
                key={city}
                className={`rounded-full border px-3 py-1 text-sm ${city === "Saint-Marcellin" ? "border-terracotta bg-terracotta/10 font-medium" : "border-border text-fg-muted"}`}
              >
                {city === "Saint-Marcellin" ? `🏔️ ${city}` : city}
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <Section tone="sand">
        <Container>
          <h2 className="font-serif text-2xl font-semibold">
            {isFr ? "Questions fréquentes" : "Frequently asked questions"}
          </h2>
          <div className="mt-6 max-w-3xl">
            <FaqAccordion
              emitJsonLd
              items={(
                isFr
                  ? [
                      {
                        question: "Faut-il un CV pour postuler ?",
                        answer:
                          "Non, le CV est optionnel. Tu réponds à quelques questions et tu peux joindre un CV si tu en as un — l'essentiel pour nous, c'est ta motivation et ce que tu sais faire.",
                      },
                      {
                        question: "Comment se passe le recrutement ?",
                        answer:
                          "Tu postules en ligne en quelques minutes. On revient vers toi rapidement, puis on échange (visio ou téléphone) pour faire connaissance et te présenter le poste et l'équipe.",
                      },
                      {
                        question: "Le télétravail est-il possible ?",
                        answer:
                          "Ça dépend de l'offre : chaque annonce précise si le poste est sur site, hybride ou 100 % remote. Tu peux filtrer les offres par mode de travail.",
                      },
                      {
                        question: "Sous combien de temps avez-vous une réponse ?",
                        answer:
                          "On s'engage à revenir vers chaque candidature sous quelques jours ouvrés, que la réponse soit positive ou non.",
                      },
                      {
                        question: "Puis-je envoyer une candidature spontanée ?",
                        answer:
                          "Oui : si aucune offre ne correspond, écris-nous via la page contact en précisant le type de poste qui t'intéresse.",
                      },
                    ]
                  : [
                      {
                        question: "Do I need a CV to apply?",
                        answer:
                          "No, the CV is optional. You answer a few questions and can attach a CV if you have one — what matters to us is your motivation and skills.",
                      },
                      {
                        question: "What's the hiring process?",
                        answer:
                          "You apply online in a few minutes. We get back to you quickly, then we have a call (video or phone) to get to know each other and present the role and team.",
                      },
                      {
                        question: "Is remote work possible?",
                        answer:
                          "It depends on the role: each listing states whether it's on-site, hybrid or fully remote. You can filter offers by work mode.",
                      },
                      {
                        question: "How fast do you reply?",
                        answer:
                          "We commit to replying to every application within a few business days, whether the answer is positive or not.",
                      },
                      {
                        question: "Can I send a spontaneous application?",
                        answer:
                          "Yes: if no offer fits, reach out via the contact page stating the kind of role you're interested in.",
                      },
                    ]
              ).map((it, i) => ({ id: `faq-${i + 1}`, ...it }))}
            />
          </div>
        </Container>
      </Section>
    </>
  );
}
