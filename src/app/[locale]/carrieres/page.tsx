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
import { buildProductMetadata, buildItemListJsonLd, SITE_URL } from "@/lib/seo";
import { listPublishedJobOffers } from "@/lib/careers/job-offers";
import type { JobOffer } from "../../../../prisma/generated/client";

export const revalidate = 3600;

const CATEGORY_LABELS: Record<string, { fr: string; en: string }> = {
  tech: { fr: "Tech", en: "Tech" },
  commercial: { fr: "Commercial", en: "Sales" },
  marketing: { fr: "Marketing", en: "Marketing" },
  operations: { fr: "Opérations", en: "Operations" },
  design: { fr: "Design", en: "Design" },
  support: { fr: "Support", en: "Support" },
  autre: { fr: "Autre", en: "Other" },
};
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
  if (!o.salaryVisible) return isFr ? "Rémunération selon profil" : "Salary based on profile";
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
  searchParams: Promise<{ category?: string; workMode?: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const sp = await searchParams;

  const all = await listPublishedJobOffers();
  const offers = all.filter(
    (o) =>
      (!sp.category || o.category === sp.category) &&
      (!sp.workMode || o.workMode === sp.workMode),
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
    const q = new URLSearchParams();
    if (cat) q.set("category", cat);
    if (wm) q.set("workMode", wm);
    const s = q.toString();
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
            {isFr ? "Rejoindre l'aventure" : "Join the adventure"}
          </p>
          <h1 className="font-serif mt-2 text-4xl font-semibold sm:text-5xl">
            {isFr ? (
              <>
                Construisons l&apos;IA opérationnelle, <em className="text-terracotta italic">ensemble</em>
              </>
            ) : (
              <>
                Let&apos;s build operational AI, <em className="text-terracotta italic">together</em>
              </>
            )}
          </h1>
          <p
            data-speakable
            className="text-fg-muted mt-4 max-w-2xl text-lg"
          >
            {isFr
              ? "Axion-IA recrute partout en France. Des missions concrètes, une équipe qui avance, et un process de candidature simple — quelques minutes suffisent, CV optionnel."
              : "Axion-IA is hiring across France. Real-world missions, a team that moves fast, and a simple application — a few minutes, CV optional."}
          </p>
        </Container>
      </Section>

      <Section>
        <Container>
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
                  {CATEGORY_LABELS[c]?.[isFr ? "fr" : "en"] ?? c}
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
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" role="list">
              {offers.map((o) => {
                const sal = salaryLabel(o, isFr);
                return (
                  <li key={o.id}>
                    <Link
                      href={`/carrieres/${o.slug}`}
                      className="border-border hover:border-terracotta group flex h-full flex-col rounded-2xl border p-6 transition-colors"
                    >
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="bg-sand text-fg-muted rounded-full px-2.5 py-0.5 text-xs font-medium">
                          {CATEGORY_LABELS[o.category]?.[isFr ? "fr" : "en"] ?? o.category}
                        </span>
                        {isNew(o.datePosted) ? (
                          <span className="bg-terracotta/15 text-terracotta rounded-full px-2.5 py-0.5 text-xs font-semibold">
                            {isFr ? "Nouveau" : "New"}
                          </span>
                        ) : null}
                      </div>
                      <h2 className="font-serif text-xl font-semibold group-hover:underline">
                        {isFr ? o.titleFr : o.titleEn}
                      </h2>
                      <p className="text-fg-muted mt-2 line-clamp-3 text-sm">
                        {isFr ? o.summaryFr : o.summaryEn}
                      </p>
                      <div className="text-fg-muted mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        <span>📍 {o.city ?? WORKMODE_LABELS[o.workMode]?.[isFr ? "fr" : "en"]}</span>
                        {o.contractLabel ? <span>📄 {o.contractLabel}</span> : null}
                        {sal ? <span>💶 {sal}</span> : null}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
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
