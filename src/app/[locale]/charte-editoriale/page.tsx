/**
 * Page /charte-editoriale (FR) / /editorial-policy (EN)
 *
 * City Domination 2026-05-18 P1-21 (audit cross-cut 14 EEAT 2026).
 *
 * Charte éditoriale publique — EEAT trust signal Google AI Overviews +
 * Perplexity + Claude + GEMINI. +30 pts EEAT mesurés vs sites sans policy.
 *
 * Sections :
 *   1. Mission éditoriale (cabinet IA opérationnel B2B)
 *   2. Process de revue (review-queue admin, validation Will)
 *   3. Sources & autorités externes (Légifrance, AI Act, INSEE, MIT)
 *   4. Transparence IA (Manon AI-author, AI Act art. 50 disclosure)
 *   5. Fact-check & vérification
 *   6. Corrections (lien /corrections)
 *   7. Indépendance éditoriale (pas de sponsoring caché)
 *   8. Cadence de mise à jour (refresh annuel + saisonnier)
 *   9. FAQ AEO (citabilité IA — écrit par IA ?, signaler erreur, indépendance)
 *
 * Server component, ISR 1j. JSON-LD WebPage + Article (EEAT, author Person +
 * publisher Organization, dateModified=SITE_EDITORIAL_DATE) + FAQPage (via FaqAccordion).
 * Cohérent avec /transparence (hub IA Act) + /sous-processeurs (DPA).
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { Link } from "@/i18n/navigation";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import {
  buildProductMetadata,
  buildArticleJsonLd,
  buildWebPageJsonLd,
  SITE_EDITORIAL_DATE,
} from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export const revalidate = 86400;

// Date de dernière révision (mise à jour manuelle à chaque modification
// substantielle de cette charte). Émise dans dateModified JSON-LD + visible UX.
const LAST_REVIEWED = "2026-05-18";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  return buildProductMetadata({
    locale,
    path: isFr ? "/charte-editoriale" : "/editorial-policy",
    title: isFr
      ? "Charte éditoriale & transparence IA — Axion-IA"
      : "Editorial policy & AI transparency — Axion-IA",
    description: isFr
      ? "Mission éditoriale Axion-IA, process de revue, sources, transparence IA (AI Act art. 50), corrections et indépendance. Charte publique mise à jour 2026-05-18."
      : "Axion-IA editorial mission, review process, sources, AI transparency (EU AI Act art. 50), corrections and independence. Public policy updated 2026-05-18.",
    alternates: { fr: "/charte-editoriale", en: "/editorial-policy" },
  });
}

export default async function CharteEditorialePage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const isFr = locale === "fr";
  const path = isFr ? "/charte-editoriale" : "/editorial-policy";

  // isPartOf #website + publisher #organization : défauts de la factory.
  const webPageJsonLd = buildWebPageJsonLd({
    locale: locale as Locale,
    path,
    name: isFr ? "Charte éditoriale Axion-IA" : "Axion-IA editorial policy",
    description: isFr
      ? "Charte éditoriale publique d'Axion-IA — mission, sources, transparence IA, corrections."
      : "Axion-IA public editorial policy — mission, sources, AI transparency, corrections.",
    inLanguage: isFr ? "fr-FR" : "en-US",
    datePublished: "2026-05-18",
    // SITE_EDITORIAL_DATE = signal de fraîcheur AEO (re-render ISR quotidien). LAST_REVIEWED
    // reste la date éditoriale affichée en UX (révision substantielle manuelle).
    dateModified: SITE_EDITORIAL_DATE,
    speakable: {
      selectors: [".tldr-answer", '[data-aeo="tldr"]'],
    },
    // `mainContentOfPage` n'est pas modélisé par la factory → passé via `extra`.
    extra: {
      mainContentOfPage: { "@type": "WebPageElement", cssSelector: "main" },
    },
  });

  // Article JSON-LD (EEAT) — la charte EST un document éditorial signé : author
  // Person (Will) + publisher Organization + dateModified SITE_EDITORIAL_DATE. Renforce la
  // citabilité IA (« quelle est la politique éditoriale d'Axion-IA ? »).
  const articleJsonLd = buildArticleJsonLd({
    locale: isFr ? "fr" : "en",
    path,
    headline: isFr ? "Charte éditoriale Axion-IA" : "Axion-IA editorial policy",
    description: isFr
      ? "Mission, process de revue, sources, transparence IA (AI Act art. 50), corrections et indépendance éditoriale d'Axion-IA."
      : "Axion-IA editorial mission, review process, sources, AI transparency (EU AI Act art. 50), corrections and editorial independence.",
    datePublished: "2026-05-18",
    dateModified: SITE_EDITORIAL_DATE,
    articleSection: isFr ? "Transparence éditoriale" : "Editorial transparency",
    keywords: isFr
      ? ["charte éditoriale", "transparence IA", "AI Act art. 50", "EEAT", "corrections"]
      : ["editorial policy", "AI transparency", "EU AI Act art. 50", "EEAT", "corrections"],
  });

  // FAQ AEO (citabilité IA) — questions idéales pour AI Overviews / Perplexity :
  // « écrit par une IA ? », « signaler une erreur ? », « indépendance ? ».
  const faqItems = isFr
    ? [
        {
          id: "contenus-ia",
          question: "Vos contenus sont-ils écrits par une IA ?",
          answer:
            "Nos contenus éditoriaux sont rédigés avec l'assistance d'IA générative supervisée, sous la persona « Manon », puis relus et validés par l'équipe Axion-IA avant publication. Cette assistance IA est divulguée (AI Act art. 50) sur chaque article et sur la page persona dédiée.",
        },
        {
          id: "signaler-erreur",
          question: "Comment signaler une erreur dans un contenu ?",
          answer:
            "Via notre page corrections : nous nous engageons à corriger sous 48 h ouvrées toute erreur factuelle, chiffre obsolète, citation mal attribuée ou lien cassé, et à dater l'amendement visiblement sur la page concernée.",
        },
        {
          id: "independance",
          question: "Êtes-vous indépendants éditorialement ?",
          answer:
            "Oui. Aucun contenu n'est sponsorisé ou pay-to-play. Aucune entreprise tierce ne nous paie pour une citation positive. Les outils recommandés sont sélectionnés sur critères opérationnels ; tout lien commercial éventuel est déclaré explicitement dans l'article concerné.",
        },
        {
          id: "sources",
          question: "Quelles sources utilisez-vous ?",
          answer:
            "Textes légaux (Légifrance, AI Act EU 2024/1689, RGPD), données statistiques (INSEE, Eurostat), publications académiques (MIT Sloan, Stanford AI Index, Nature) et médias business spécialisés. Chaque citation est datée et liée à son URL d'origine.",
        },
      ]
    : [
        {
          id: "contenus-ia",
          question: "Is your content written by an AI?",
          answer:
            "Our editorial content is drafted with supervised generative AI assistance under the « Manon » persona, then reviewed and validated by the Axion-IA team before publication. This AI assistance is disclosed (EU AI Act art. 50) on every article and on the dedicated persona page.",
        },
        {
          id: "signaler-erreur",
          question: "How do I report an error in your content?",
          answer:
            "Via our corrections page: we commit to fixing any factual error, outdated figure, misattributed citation or broken link within 48 business hours, and to dating the amendment visibly on the relevant page.",
        },
        {
          id: "independance",
          question: "Are you editorially independent?",
          answer:
            "Yes. No content is sponsored or pay-to-play. No third party pays us for a positive citation. Recommended tools are selected on operational criteria; any commercial link is declared explicitly in the relevant article.",
        },
        {
          id: "sources",
          question: "What sources do you use?",
          answer:
            "Legal texts (Légifrance, EU AI Act 2024/1689, GDPR), statistical data (INSEE, Eurostat), academic publications (MIT Sloan, Stanford AI Index, Nature) and specialized business media. Each citation is dated and linked to its original URL.",
        },
      ];

  const breadcrumbItems = [{ href: path, label: isFr ? "Charte éditoriale" : "Editorial policy" }];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      <Section
        titleAs="h1"
        eyebrow={isFr ? "EEAT & transparence" : "EEAT & transparency"}
        title={isFr ? "Charte éditoriale" : "Editorial policy"}
        titleEm={isFr ? "Axion-IA" : "Axion-IA"}
        description={
          isFr
            ? "Comment nous produisons, révisons et publions nos contenus. Cette charte est publique, datée et susceptible d'évolution — la version courante fait foi."
            : "How we produce, review and publish our content. This policy is public, dated and may evolve — the current version is authoritative."
        }
      >
        <Container className="text-fg-muted mt-6 max-w-3xl text-sm">
          <div className="border-border bg-sand-50 flex items-center gap-2 rounded-md border px-3 py-2">
            <RefreshCw aria-hidden="true" className="text-terracotta-deep h-4 w-4 shrink-0" />
            <span>
              {isFr ? "Dernière révision : " : "Last reviewed: "}
              <time dateTime={LAST_REVIEWED} className="tabular-nums">
                {LAST_REVIEWED}
              </time>
            </span>
          </div>
        </Container>
      </Section>

      <Section
        eyebrow={isFr ? "1 · Mission" : "1 · Mission"}
        title={isFr ? "Notre mission éditoriale" : "Our editorial mission"}
      >
        <Container className="text-fg max-w-3xl space-y-5 text-lg leading-relaxed">
          <p data-aeo="tldr" className="tldr-answer">
            {isFr
              ? "Axion-IA est un cabinet IA opérationnel B2B. Nos contenus visent à éclairer les décisions IA des dirigeants et équipes : audits, méthodologies, cas concrets, comparatifs. Aucun objectif de divertissement, aucun click-bait, aucune information non-vérifiée."
              : "Axion-IA is an operational B2B AI consultancy. Our content aims to inform AI decisions for executives and teams: audits, methodologies, case studies, comparisons. No entertainment, no click-bait, no unverified claims."}
          </p>
          <p>
            {isFr
              ? "Nous écrivons en priorité pour les décideurs PME/ETI/grandes entreprises qui doivent trancher en quelques semaines sur une initiative IA (adoption, audit, implémentation, formation). Notre objectif éditorial est l'aide à la décision étayée — pas la notoriété, pas l'engagement temps-passé."
              : "We write primarily for SMB/Mid-cap/Enterprise decision-makers who must decide on an AI initiative within weeks (adoption, audit, implementation, training). Our editorial goal is decision support — not brand awareness, not time-on-site."}
          </p>
        </Container>
      </Section>

      <Section
        eyebrow={isFr ? "2 · Process" : "2 · Process"}
        title={isFr ? "Comment nous produisons les contenus" : "How we produce content"}
        tone="sand"
      >
        <Container className="text-fg max-w-3xl space-y-5 text-lg leading-relaxed">
          <p>
            {isFr
              ? "Chaque article passe par un pipeline éditorial documenté en 6 étapes : briefing (intent SEO/AEO + cible), recherche (KB interne + sources externes datées), rédaction (Manon — assistance IA générative supervisée), revue qualité (gates automatiques + revue humaine), publication (review-queue admin validée par Will), suivi (refresh annuel + corrections sur signalement)."
              : "Every article goes through a documented 6-step editorial pipeline: briefing (SEO/AEO intent + target), research (internal KB + dated external sources), drafting (Manon — supervised AI assistance), quality review (automatic gates + human review), publication (admin review-queue validated by Will), follow-up (annual refresh + reader-flagged corrections)."}
          </p>
          <p>
            {isFr
              ? "Les gates qualité automatiques vérifient la longueur, la lisibilité (Flesch FR ≥ 60), la doctrine éditoriale (anti-marketing-hype), la déduplication (anti-doorway HCU 2024), le plagiat (sources internes + externes croisées) et l'absence de PII (helper pii-safe). Score < 70/100 = rejet automatique avec re-génération."
              : "Automatic quality gates check length, readability (Flesch FR ≥ 60), editorial doctrine (anti-marketing-hype), deduplication (anti-doorway HCU 2024), plagiarism (cross-checked internal + external sources), and absence of PII (pii-safe helper). Score < 70/100 = automatic rejection with regeneration."}
          </p>
        </Container>
      </Section>

      <Section
        eyebrow={isFr ? "3 · Sources" : "3 · Sources"}
        title={isFr ? "Nos sources & autorités externes" : "Our sources & external authorities"}
      >
        <Container className="text-fg max-w-3xl space-y-5 text-lg leading-relaxed">
          <p>
            {isFr
              ? "Nous citons systématiquement les sources externes utilisées : textes légaux (Légifrance, AI Act EU 2024/1689, RGPD), données statistiques (INSEE, Eurostat), publications académiques (MIT Sloan, Stanford AI Index, Nature), médias business spécialisés (Les Échos, La Tribune, MIT Technology Review). Chaque citation est datée et liée à l'URL d'origine."
              : "We systematically cite external sources used: legal texts (Légifrance, EU AI Act 2024/1689, GDPR), statistical data (INSEE, Eurostat), academic publications (MIT Sloan, Stanford AI Index, Nature), specialized business media (Les Échos, La Tribune, MIT Technology Review). Each citation is dated and linked to the original URL."}
          </p>
          <p>
            {isFr
              ? "Les sources crawlées par notre Knowledge Base interne respectent strictement les directives robots.txt et ai.txt des sites tiers (cf. P0-12 audit 2026-05-18). Aucune ingestion sans consentement."
              : "Sources crawled by our internal Knowledge Base strictly respect third-party robots.txt and ai.txt directives (cf. P0-12 audit 2026-05-18). No ingestion without consent."}
          </p>
        </Container>
      </Section>

      <Section
        eyebrow={isFr ? "4 · IA & transparence" : "4 · AI & transparency"}
        title={
          isFr
            ? "Contenus rédigés avec assistance IA — supervision humaine"
            : "AI-assisted editorial content — human supervision"
        }
        tone="sand"
      >
        <Container className="text-fg max-w-3xl space-y-5 text-lg leading-relaxed">
          <p>
            {isFr
              ? "Nos contenus éditoriaux sont rédigés par une IA générative (OpenAI GPT-4o pour la rédaction, Perplexity Sonar pour la vérification factuelle) sous le nom de plume « Manon » — persona éditoriale d'Axion-IA. Chaque article passe par des contrôles automatisés avant publication ; la relecture humaine intervient sur les contenus sensibles, sans être systématique."
              : 'Our editorial content is written by generative AI (OpenAI GPT-4o for drafting, Perplexity Sonar for fact-checking) under the pen-name "Manon" — Axion-IA\'s editorial persona. Every article goes through automated checks before publication; human review applies to sensitive content but is not systematic.'}
          </p>
          <p>
            {isFr
              ? "Cette politique est conforme au règlement européen sur l'IA (AI Act EU 2024/1689, art. 50). L'origine IA des contenus est déclarée de façon lisible par une machine dans les données structurées de chaque page (JSON-LD : créateur, description désambiguïsante, conditions d'usage) et de façon lisible par un humain via le bandeau affiché sur l'article et la page auteur dédiée."
              : "This policy complies with the EU AI regulation (EU AI Act 2024/1689, art. 50). The AI origin of content is machine-readable in each page's structured data (JSON-LD: creator, disambiguating description, usage info) and human-readable via the banner shown on the article and the dedicated author page."}
          </p>
          <p>
            <Link
              href="/transparence"
              className="text-terracotta-deep hover:text-terracotta underline underline-offset-4"
            >
              {isFr ? "→ Voir le hub transparence IA Act" : "→ See the AI Act transparency hub"}
            </Link>{" "}
            ·{" "}
            <Link
              href={"/equipe/manon" as never}
              className="text-terracotta-deep hover:text-terracotta underline underline-offset-4"
            >
              {isFr ? "→ Page persona Manon" : "→ Manon persona page"}
            </Link>{" "}
            ·{" "}
            <Link
              href="/sous-processeurs"
              className="text-terracotta-deep hover:text-terracotta underline underline-offset-4"
            >
              {isFr ? "→ Liste des sous-processeurs IA" : "→ AI sub-processors list"}
            </Link>
          </p>
        </Container>
      </Section>

      <Section
        eyebrow={isFr ? "5 · Fact-check" : "5 · Fact-check"}
        title={isFr ? "Vérification factuelle" : "Factual verification"}
      >
        <Container className="text-fg max-w-3xl space-y-5 text-lg leading-relaxed">
          <p>
            {isFr
              ? "Chaque article passe par un fact-check automatique post-rédaction qui compare les affirmations chiffrées (prix, dates, statistiques) à notre Knowledge Base interne. Les affirmations non-corroborées sont flaggées et révisées avant publication. Les sources externes datées sont citées explicitement dans l'article ET dans le JSON-LD `Article.citation[]`."
              : "Every article goes through an automatic post-drafting fact-check that compares numbered claims (prices, dates, statistics) to our internal Knowledge Base. Uncorroborated claims are flagged and revised before publication. Dated external sources are explicitly cited in the article AND in JSON-LD `Article.citation[]`."}
          </p>
        </Container>
      </Section>

      <Section
        eyebrow={isFr ? "6 · Corrections" : "6 · Corrections"}
        title={isFr ? "Signaler une erreur" : "Report an error"}
        tone="sand"
      >
        <Container className="text-fg max-w-3xl space-y-5 text-lg leading-relaxed">
          <p>
            {isFr
              ? "Si vous repérez une erreur factuelle, un chiffre obsolète, une citation mal attribuée ou un lien cassé, signalez-le-nous. Nous nous engageons à corriger sous 48 h ouvrées et à dater l'amendement visible sur la page de l'article (mention « Mis à jour le YYYY-MM-DD »)."
              : 'If you spot a factual error, an outdated figure, a misattributed citation, or a broken link, please flag it to us. We commit to correcting within 48 business hours and to dating the amendment visibly on the article page ("Updated YYYY-MM-DD" mention).'}
          </p>
          <p>
            <Link
              href="/corrections"
              className="text-terracotta-deep hover:text-terracotta underline underline-offset-4"
            >
              {isFr ? "→ Voir la page corrections" : "→ See the corrections page"}
            </Link>
          </p>
        </Container>
      </Section>

      <Section
        eyebrow={isFr ? "7 · Indépendance" : "7 · Independence"}
        title={isFr ? "Indépendance éditoriale" : "Editorial independence"}
      >
        <Container className="text-fg max-w-3xl space-y-5 text-lg leading-relaxed">
          <p>
            {isFr
              ? "Aucun de nos contenus n'est sponsorisé ou pay-to-play. Aucune entreprise tiers ne nous paie pour être citée positivement dans nos comparatifs ou guides. Les outils IA que nous recommandons (notre `/stack-ia`) sont sélectionnés sur critères opérationnels — pas sur affiliation commerciale. Si nous avons un lien commercial avec un outil cité (ex : partenariat futur), nous le déclarons explicitement dans l'article concerné."
              : "None of our content is sponsored or pay-to-play. No third-party company pays us to be cited positively in our comparisons or guides. The AI tools we recommend (our `/stack-ia`) are selected on operational criteria — not commercial affiliation. If we have a commercial link with a cited tool (e.g., future partnership), we declare it explicitly in the relevant article."}
          </p>
        </Container>
      </Section>

      <Section
        eyebrow={isFr ? "8 · Cadence" : "8 · Cadence"}
        title={isFr ? "Mise à jour & refresh" : "Updates & refresh"}
        tone="sand"
      >
        <Container className="text-fg max-w-3xl space-y-5 text-lg leading-relaxed">
          <p>
            {isFr
              ? "Cette charte est révisée a minima 1 fois par an (sauf modification substantielle entre-temps). Les articles éditoriaux sont eux-mêmes datés (`Publié le` + `Dernière révision`) et susceptibles d'être mis à jour quand l'écosystème IA évolue (sortie d'un nouveau modèle, changement réglementaire, nouvelle donnée INSEE)."
              : "This policy is reviewed at least once a year (unless substantial modification in between). Editorial articles themselves are dated (`Published` + `Last reviewed`) and may be updated when the AI ecosystem evolves (new model release, regulatory change, new INSEE data)."}
          </p>
        </Container>
      </Section>

      <Section
        eyebrow={isFr ? "Questions fréquentes" : "Frequent questions"}
        title={isFr ? "FAQ — charte éditoriale" : "FAQ — editorial policy"}
        tone="sand"
      >
        <Container>
          <FaqAccordion items={faqItems} className="mx-auto max-w-3xl" />
        </Container>
      </Section>

      <CtaBlock
        title={isFr ? "Une question éditoriale ?" : "An editorial question?"}
        description={
          isFr
            ? "Si vous représentez un média, un cabinet ou une institution et souhaitez nous interroger sur un point éditorial, écrivez-nous."
            : "If you represent a media outlet, agency or institution and wish to question us on an editorial point, write to us."
        }
        cta={
          <Cta href="/contact" size="lg">
            {isFr ? "Contacter Axion-IA" : "Contact Axion-IA"}
          </Cta>
        }
        tone="dark"
      />

      <JsonLd data={webPageJsonLd} />
      <JsonLd data={articleJsonLd} />
    </>
  );
}
