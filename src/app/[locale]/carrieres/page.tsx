// Hub /carrieres — liste des offres publiées (DB-piloté, ISR). Server Component
// pur (0 JS : filtres par query-param server-side → INP préservé). Niveau /audit.

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
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
import {
  CAREER_CATEGORIES,
  careerCategoryLabel,
  CAREER_VERTICALS,
} from "@/content/careers/categories";
import { EMPLOYER_BRAND } from "@/content/careers/employer-brand";
import { careerImage } from "@/content/careers/careers-images";
import { UnsplashCredit } from "@/components/media/UnsplashCredit";
import { ServiceHero } from "@/components/sections/ServiceHero";
import { HUB_VILLES } from "@/content/recrutement/satellites";

// 40 villes affichées en badges (info, pas de pages thin) : les 40 hubs T1+T2
// (population ≥ 100 000), Grenoble (siège) inclus.
const CAREER_CITIES: ReadonlyArray<string> = [...HUB_VILLES.map((v) => v.nameFr)];
import {
  buildProductMetadata,
  buildItemListJsonLd,
  buildCollectionPageJsonLd,
  SITE_URL,
} from "@/lib/seo";
import { listPublishedJobOffers } from "@/lib/careers/job-offers";
import { WORKMODE_LABELS, isNew, salaryLabel } from "@/lib/careers/format";
import { OffersEmbedPromo } from "@/components/careers/OffersEmbedPromo";

export const revalidate = 3600;

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
    title: isFr ? "Carrières · rejoindre Axion-IA.com" : "Careers · join Axion-IA.com",
    description: isFr
      ? "Rejoignez Axion-IA.com, le cabinet IA opérationnel. Découvrez nos offres d'emploi et postulez en quelques minutes — sur site, hybride ou remote, partout en France."
      : "Join Axion-IA.com, the operational AI firm. Browse our open positions and apply in minutes — on-site, hybrid or remote across France.",
  });
  // FR-only : EN désactivé → noindex explicite (ceinture + bretelles avec le 301).
  if (!isFr) return { ...base, robots: { index: false, follow: true } };
  // Anti-yoyo (audit indexation 2026-06-17) : au build GH Actions
  // (DATABASE_URL=stub.invalid), `listPublishedJobOffers()` renvoie [] → on figerait
  // un `noindex` dans la page pré-rendue (exposé à Googlebot 0-1h post-deploy avant
  // l'ISR). Fail-OPEN : on garde `index` au build stub ; l'ISR recalcule en prod.
  if (process.env.DATABASE_URL?.includes("stub.invalid")) return base;
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
    name: isFr ? "Offres d'emploi Axion-IA.com" : "Axion-IA.com job openings",
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
        data={buildCollectionPageJsonLd({
          locale: loc,
          path: "/carrieres",
          id: `${SITE_URL}/${loc}/carrieres#webpage`,
          name: isFr ? "Carrières · Axion-IA.com" : "Careers · Axion-IA.com",
          speakable: { selectors: ["h1", "[data-speakable]"] },
        })}
      />

      <Container className="border-border border-b py-3">
        <Breadcrumbs items={[{ href: "/carrieres", label: isFr ? "Carrières" : "Careers" }]} />
      </Container>
      <ServiceHero
        eyebrow={
          isFr
            ? `Offres d'emploi · ${all.length} poste${all.length > 1 ? "s" : ""} ouvert${all.length > 1 ? "s" : ""} 🚀`
            : `Job openings · ${all.length} open role${all.length > 1 ? "s" : ""} 🚀`
        }
        title={
          isFr
            ? "On recrute — viens construire l'IA qui change"
            : "We're hiring — build the AI that"
        }
        titleEm={isFr ? "vraiment le quotidien des boîtes" : "actually changes how companies work"}
        description={isFr ? EMPLOYER_BRAND.heroIntroFr : EMPLOYER_BRAND.heroIntroEn}
        ctas={
          <>
            <Cta href="#offres" track="careers-hero-see-offers">
              {isFr ? "Voir les offres" : "See open roles"}
            </Cta>
            <Cta href="/contact" variant="outline" track="careers-hero-spontaneous">
              {isFr ? "Candidature spontanée" : "Spontaneous application"}
            </Cta>
          </>
        }
        schemaCenterLabel={isFr ? "Ton poste" : "Your role"}
        schemaAriaLabel={
          isFr
            ? "Les domaines où Axion-IA.com recrute : développement, IA, data, design, produit, marketing, conseil, support."
            : "Domains where Axion-IA.com hires: development, AI, data, design, product, marketing, consulting, support."
        }
        schemaNodes={[
          {
            label: isFr ? "Développement" : "Development",
            benefit: isFr ? "Du code en prod" : "Code in prod",
            accent: "terracotta",
          },
          {
            label: "IA & ML",
            benefit: isFr ? "Modèles & agents" : "Models & agents",
            accent: "primary",
          },
          {
            label: "Data",
            benefit: isFr ? "Pipelines & analyse" : "Pipelines & analysis",
            accent: "sage",
          },
          {
            label: "Design",
            benefit: isFr ? "UX & produit" : "UX & product",
            accent: "mocha",
          },
          {
            label: isFr ? "Produit" : "Product",
            benefit: isFr ? "Vision & roadmap" : "Vision & roadmap",
            accent: "primary",
          },
          {
            label: "Marketing",
            benefit: isFr ? "Growth & contenu" : "Growth & content",
            accent: "terracotta",
          },
          {
            label: isFr ? "Conseil" : "Consulting",
            benefit: isFr ? "Audit & stratégie" : "Audit & strategy",
            accent: "sage",
          },
          {
            label: "Support",
            benefit: isFr ? "Relation client" : "Customer care",
            accent: "mocha",
          },
        ]}
      />

      {/* Pourquoi nous rejoindre */}
      <Section tone="paper">
        <Container>
          <h2 className="font-serif text-3xl font-semibold sm:text-4xl">
            {isFr ? (
              <>
                Pourquoi nous <em className="text-terracotta italic">rejoindre</em> ?
              </>
            ) : (
              <>
                Why <em className="text-terracotta italic">join</em> us?
              </>
            )}
          </h2>
          <p className="text-fg-muted mt-3 max-w-3xl text-lg">
            {isFr ? EMPLOYER_BRAND.aboutFr : EMPLOYER_BRAND.aboutEn}
          </p>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4" role="list">
            {EMPLOYER_BRAND.whyJoin.map((card) => (
              <li
                key={card.icon}
                className="border-border bg-bg hover:border-terracotta shadow-subtle rounded-2xl border p-6 transition"
              >
                <span
                  className="bg-terracotta/10 flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
                  aria-hidden
                >
                  {card.icon}
                </span>
                <h3 className="mt-4 font-serif text-lg font-semibold">
                  {isFr ? card.titleFr : card.titleEn}
                </h3>
                <p className="text-fg-muted mt-2 text-sm">{isFr ? card.textFr : card.textEn}</p>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      {/* Ancrage — siège et bureaux à Grenoble */}
      <Section tone="sand">
        <Container>
          <p className="text-terracotta text-sm font-semibold tracking-wide uppercase">
            {isFr ? "Notre ancrage" : "Where we're rooted"}
          </p>
          <h2 className="mt-2 font-serif text-3xl font-semibold sm:text-4xl">
            {isFr ? EMPLOYER_BRAND.hqTitleFr : EMPLOYER_BRAND.hqTitleEn}
          </h2>
          <p className="text-fg-muted mt-3 max-w-3xl">
            {isFr ? EMPLOYER_BRAND.hqTextFr : EMPLOYER_BRAND.hqTextEn}
          </p>
          <p className="text-fg-muted mt-3 max-w-3xl text-sm">
            {isFr
              ? "Chez Axion-IA.com, le recrutement est ouvert à toutes et tous — sans discrimination. Nos intitulés de poste sont neutres et nos process inclusifs."
              : "At Axion-IA.com, hiring is open to everyone — without discrimination. Our job titles are neutral and our process inclusive."}
          </p>
        </Container>
      </Section>

      <Section id="offres">
        <Container>
          <h2 className="mb-6 font-serif text-3xl font-semibold sm:text-4xl">
            {isFr ? (
              <>
                Nos <em className="text-terracotta italic">offres</em>
              </>
            ) : (
              <>
                Open <em className="text-terracotta italic">roles</em>
              </>
            )}
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
            <button
              type="submit"
              className="bg-terracotta rounded-full px-4 py-2 text-sm text-white"
            >
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
                    <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" role="list">
                      {offers
                        .filter((o) => o.category === cat.slug)
                        .map((o) => {
                          const sal = salaryLabel(o, isFr);
                          const img = careerImage(o.slug);
                          return (
                            <li key={o.id}>
                              <Link
                                href={`/carrieres/${o.slug}`}
                                className="border-border hover:border-terracotta bg-paper shadow-subtle hover:shadow-card group flex h-full flex-col overflow-hidden rounded-2xl border transition"
                              >
                                <div className="relative aspect-[16/7] overflow-hidden">
                                  <Image
                                    src={img.url}
                                    alt={img.alt}
                                    fill
                                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                                    className="object-cover transition duration-300 group-hover:scale-105"
                                  />
                                  {isNew(o.datePosted) ? (
                                    <span className="bg-terracotta absolute top-3 left-3 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white shadow">
                                      {isFr ? "Nouveau" : "New"}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="flex flex-1 flex-col p-5">
                                  <h4 className="group-hover:text-terracotta font-serif text-lg font-semibold transition-colors">
                                    {isFr ? o.titleFr : o.titleEn}
                                  </h4>
                                  <p className="text-fg-muted mt-2 line-clamp-2 text-sm">
                                    {isFr ? o.summaryFr : o.summaryEn}
                                  </p>
                                  <div className="text-fg-muted mt-4 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                                    <span>
                                      📍{" "}
                                      {o.city ?? WORKMODE_LABELS[o.workMode]?.[isFr ? "fr" : "en"]}
                                    </span>
                                    {o.contractLabel ? <span>📄 {o.contractLabel}</span> : null}
                                    {sal ? <span>💶 {sal}</span> : null}
                                  </div>
                                </div>
                              </Link>
                              <UnsplashCredit
                                photographerName={img.byName}
                                photographerUrl={img.byUrl}
                                className="px-1"
                              />
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

      <Section tone="halo-cool">
        <Container>
          <h2 className="font-serif text-3xl font-semibold sm:text-4xl">
            {isFr ? (
              <>
                On recrute <em className="text-terracotta italic">partout en France</em> 🇫🇷
              </>
            ) : (
              <>
                We hire <em className="text-terracotta italic">across France</em> 🇫🇷
              </>
            )}
          </h2>
          <p className="text-fg-muted mt-3 max-w-3xl">
            {isFr
              ? "Notre siège et nos bureaux sont à Grenoble (Isère) ; beaucoup de postes sont en remote ou hybride, et nos formateurs interviennent par secteur partout en France. On accueille des talents un peu partout :"
              : "Our head office and offices are in Grenoble (Isère); many roles are remote or hybrid, and our trainers work by sector across France. We welcome talent all over:"}
          </p>
          <ul className="mt-5 flex flex-wrap gap-2" role="list">
            {CAREER_CITIES.map((city) => {
              const isHq = city === "Grenoble";
              return (
                <li
                  key={city}
                  className={`rounded-full border px-3 py-1 text-sm ${isHq ? "border-terracotta bg-terracotta/10 font-medium" : "border-border text-fg-muted"}`}
                >
                  {isHq ? `🏔️ ${city}` : city}
                </li>
              );
            })}
          </ul>
        </Container>
      </Section>

      <Section tone="sand">
        <Container>
          <h2 className="font-serif text-3xl font-semibold sm:text-4xl">
            {isFr ? (
              <>
                <em className="text-terracotta italic">Questions</em> fréquentes
              </>
            ) : (
              <>
                <em className="text-terracotta italic">Frequently</em> asked questions
              </>
            )}
          </h2>
          <div className="mt-6 max-w-3xl">
            <FaqAccordion
              emitJsonLd
              items={(isFr
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

      {/* Intègre nos offres — promo du widget embarquable (partenaires/médias) */}
      <OffersEmbedPromo locale={locale} tone="canvas" />

      {/* Maillage SEO (verticales) + réseaux sociaux à droite */}
      <Section tone="mocha">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-start lg:gap-16">
            {/* Gauche — verticales */}
            <div>
              <h2 className="font-serif text-3xl font-semibold sm:text-4xl">
                {isFr ? (
                  <>
                    Découvrir <em className="text-terracotta italic">Axion-IA.com</em>
                  </>
                ) : (
                  <>
                    Discover <em className="text-terracotta italic">Axion-IA.com</em>
                  </>
                )}
              </h2>
              <p className="mt-3 max-w-2xl opacity-80">
                {isFr
                  ? "Les expertises sur lesquelles tu travailleras chez nous :"
                  : "The expertise you'll work on with us:"}
              </p>
              <ul className="mt-6 flex flex-wrap gap-3" role="list">
                {CAREER_VERTICALS.map((v) => (
                  <li key={v.href}>
                    <Link
                      href={v.href}
                      className="border-mocha-fg/25 hover:border-terracotta inline-block rounded-full border px-4 py-2 text-sm transition-colors"
                    >
                      {isFr ? v.fr : v.en} →
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Droite — réseaux sociaux */}
            <div className="lg:min-w-[16rem] lg:text-right">
              <h3 className="font-serif text-xl font-semibold">
                {isFr ? "Suis l'aventure" : "Follow the journey"}
              </h3>
              <p className="mt-2 text-sm opacity-80">
                {isFr
                  ? "Nos coulisses, nos offres et notre équipe."
                  : "Behind the scenes, our jobs and our team."}
              </p>
              <div className="mt-4 flex gap-3 lg:justify-end">
                <a
                  href="https://www.linkedin.com/company/axion-ia-france/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn Axion-IA.com"
                  className="border-mocha-fg/25 hover:border-terracotta hover:text-terracotta inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
                    <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
                  </svg>
                  LinkedIn
                </a>
                <a
                  href="https://x.com/AxionIAFrance"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="X (Twitter) Axion-IA.com"
                  className="border-mocha-fg/25 hover:border-terracotta hover:text-terracotta inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
                    <path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.64 7.58H.46l8.6-9.83L0 1.15h7.6l5.24 6.93 6.06-6.93zm-1.29 19.5h2.04L6.49 3.24H4.3L17.61 20.65z" />
                  </svg>
                  X
                </a>
              </div>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
