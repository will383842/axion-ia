/**
 * Page /corrections (FR + EN — slug identique)
 *
 * City Domination 2026-05-18 P1-21 (audit cross-cut 14 EEAT 2026).
 *
 * Page corrections publique — EEAT trust signal + couverture juridique
 * (atténuation risque diffamation/erreur factuelle si process documenté).
 *
 * Process documenté :
 *   - Email dédié : corrections@axion-ia.com
 *   - Délai engagement : 48 h ouvrées
 *   - Workflow : signalement → vérification → correction → mention « Mis à jour le YYYY-MM-DD »
 *   - Sources externes : si erreur citation, vérification source + correction OU retrait
 *
 * Server component, ISR 1j. JSON-LD WebPage. Cohérent avec /charte-editoriale
 * et /transparence.
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { Mail, Clock, FileCheck, AlertTriangle } from "lucide-react";
import { routing } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { Link } from "@/i18n/navigation";
import { buildProductMetadata, SITE_URL } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export const revalidate = 86400;

const LAST_REVIEWED = "2026-05-18";
const CORRECTIONS_EMAIL = "corrections@axion-ia.com";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  return buildProductMetadata({
    locale,
    path: "/corrections",
    title: isFr
      ? "Corrections & signalement d'erreur — Axion-IA"
      : "Corrections & error reporting — Axion-IA",
    description: isFr
      ? "Comment signaler une erreur factuelle, un chiffre obsolète ou un lien cassé sur axion-ia.com. Engagement 48 h ouvrées. Email dédié corrections@axion-ia.com."
      : "How to flag a factual error, outdated figure, or broken link on axion-ia.com. 48-business-hour commitment. Dedicated email corrections@axion-ia.com.",
    alternates: { fr: "/corrections", en: "/corrections" },
  });
}

export default async function CorrectionsPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const isFr = locale === "fr";
  const url = `${SITE_URL}/${locale}/corrections`;

  const webPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: isFr ? "Corrections — Axion-IA" : "Corrections — Axion-IA",
    description: isFr
      ? "Page corrections publique d'Axion-IA — process de signalement et engagement délai."
      : "Axion-IA public corrections page — flagging process and time commitment.",
    inLanguage: isFr ? "fr-FR" : "en-US",
    isPartOf: { "@id": `${SITE_URL}/#website` },
    publisher: { "@id": `${SITE_URL}/#organization` },
    datePublished: "2026-05-18",
    dateModified: LAST_REVIEWED,
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: [".tldr-answer", '[data-aeo="tldr"]'],
    },
  } as const;

  const breadcrumbItems = [{ href: "/corrections", label: isFr ? "Corrections" : "Corrections" }];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      <Section
        titleAs="h1"
        eyebrow={isFr ? "EEAT & qualité" : "EEAT & quality"}
        title={isFr ? "Corrections" : "Corrections"}
        titleEm={isFr ? "& signalement d'erreur" : "& error reporting"}
        description={
          isFr
            ? "Si vous repérez une erreur factuelle, un chiffre obsolète, une citation mal attribuée ou un lien cassé, signalez-le-nous. Nous corrigeons sous 48 h ouvrées."
            : "If you spot a factual error, an outdated figure, a misattributed citation, or a broken link, please flag it to us. We correct within 48 business hours."
        }
      >
        <Container className="text-fg-muted mt-6 max-w-3xl text-sm">
          <div className="border-border bg-sand-50 flex items-center gap-2 rounded-md border px-3 py-2">
            <FileCheck aria-hidden="true" className="text-terracotta-deep h-4 w-4 shrink-0" />
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
        eyebrow={isFr ? "TL;DR" : "TL;DR"}
        title={isFr ? "Comment signaler une erreur" : "How to report an error"}
      >
        <Container className="text-fg max-w-3xl space-y-5 text-lg leading-relaxed">
          <p data-aeo="tldr" className="tldr-answer">
            {isFr
              ? `Envoyez un email à ${CORRECTIONS_EMAIL} avec l'URL de l'article concerné, la phrase ou le chiffre incorrect, et la source vérifiable (lien, document, témoignage). Nous accusons réception sous 24 h ouvrées et corrigeons sous 48 h ouvrées.`
              : `Send an email to ${CORRECTIONS_EMAIL} with the URL of the relevant article, the incorrect sentence or figure, and a verifiable source (link, document, testimony). We acknowledge receipt within 24 business hours and correct within 48 business hours.`}
          </p>
        </Container>
      </Section>

      <Section
        eyebrow={isFr ? "Process" : "Process"}
        title={isFr ? "Notre workflow correction" : "Our correction workflow"}
        tone="sand"
      >
        <Container className="max-w-3xl">
          <ol className="text-fg list-decimal space-y-4 pl-6 text-lg leading-relaxed">
            <li>
              <strong>{isFr ? "Signalement" : "Flagging"}</strong>{" "}
              {isFr
                ? `— vous envoyez un email à ${CORRECTIONS_EMAIL} avec URL + extrait fautif + source vérifiable.`
                : `— you send an email to ${CORRECTIONS_EMAIL} with URL + faulty excerpt + verifiable source.`}
            </li>
            <li>
              <strong>{isFr ? "Accusé de réception" : "Acknowledgement"}</strong>{" "}
              {isFr
                ? "— sous 24 h ouvrées, nous confirmons la prise en compte et indiquons si correction immédiate ou vérification nécessaire."
                : "— within 24 business hours, we confirm receipt and indicate immediate correction or pending verification."}
            </li>
            <li>
              <strong>{isFr ? "Vérification" : "Verification"}</strong>{" "}
              {isFr
                ? "— nous croisons votre signalement avec nos sources internes (Knowledge Base) et les sources externes citées (Légifrance, INSEE, MIT, etc.)."
                : "— we cross-check your flag against our internal sources (Knowledge Base) and the external sources cited (Légifrance, INSEE, MIT, etc.)."}
            </li>
            <li>
              <strong>{isFr ? "Correction" : "Correction"}</strong>{" "}
              {isFr
                ? "— sous 48 h ouvrées, l'article est mis à jour et la mention « Mis à jour le YYYY-MM-DD » est visible. Le `dateModified` JSON-LD reflète la révision."
                : '— within 48 business hours, the article is updated and the "Updated YYYY-MM-DD" mention is visible. The `dateModified` JSON-LD reflects the revision.'}
            </li>
            <li>
              <strong>{isFr ? "Réponse" : "Reply"}</strong>{" "}
              {isFr
                ? "— nous vous notifions par email de la correction publiée (ou de la raison du refus si la vérification invalide le signalement)."
                : "— we notify you by email of the published correction (or the reason for rejection if verification invalidates the flag)."}
            </li>
          </ol>
        </Container>
      </Section>

      <Section
        eyebrow={isFr ? "Cas particuliers" : "Edge cases"}
        title={isFr ? "Ce qui n'est PAS une correction" : "What is NOT a correction"}
      >
        <Container className="text-fg max-w-3xl space-y-5 text-lg leading-relaxed">
          <div className="border-border bg-sand-50 flex gap-3 rounded-md border p-4">
            <AlertTriangle
              aria-hidden="true"
              className="text-terracotta-deep mt-0.5 h-5 w-5 shrink-0"
            />
            <div className="space-y-3">
              <p>
                {isFr
                  ? "Le process corrections couvre les erreurs factuelles, chiffrées et de citation. Il NE COUVRE PAS :"
                  : "The corrections process covers factual, numerical, and citation errors. It DOES NOT COVER:"}
              </p>
              <ul className="list-disc space-y-1 pl-6">
                <li>
                  {isFr
                    ? "Désaccords d'opinion ou de positionnement éditorial (cf. /charte-editoriale)"
                    : "Disagreements of opinion or editorial positioning (cf. /editorial-policy)"}
                </li>
                <li>
                  {isFr
                    ? "Demandes de suppression d'avis client ou de témoignage tiers (cf. RGPD art. 17 → /mes-donnees)"
                    : "Removal requests for customer reviews or third-party testimonials (cf. GDPR art. 17 → /my-data)"}
                </li>
                <li>
                  {isFr
                    ? "Suggestions de sujets éditoriaux ou d'angles à traiter (→ /contact général)"
                    : "Suggestions of editorial topics or angles to cover (→ general /contact)"}
                </li>
              </ul>
            </div>
          </div>
        </Container>
      </Section>

      <Section
        eyebrow={isFr ? "Contacts" : "Contacts"}
        title={isFr ? "Pour signaler une erreur" : "To report an error"}
        tone="sand"
      >
        <Container className="text-fg max-w-3xl space-y-5 text-lg leading-relaxed">
          <div className="border-border bg-bg flex flex-col gap-4 rounded-md border p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Mail aria-hidden="true" className="text-terracotta-deep mt-1 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">
                  {isFr ? "Email dédié corrections" : "Dedicated corrections email"}
                </p>
                <p className="text-fg-muted text-sm">
                  <a
                    href={`mailto:${CORRECTIONS_EMAIL}`}
                    className="text-terracotta-deep hover:text-terracotta underline underline-offset-4"
                  >
                    {CORRECTIONS_EMAIL}
                  </a>
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 sm:items-center">
              <Clock
                aria-hidden="true"
                className="text-terracotta-deep mt-1 h-5 w-5 shrink-0 sm:mt-0"
              />
              <p className="text-sm">
                <strong>{isFr ? "Engagement délai : " : "Time commitment: "}</strong>
                {isFr ? "48 h ouvrées" : "48 business hours"}
              </p>
            </div>
          </div>
          <p className="text-fg-muted text-sm">
            {isFr
              ? "Pour les questions non liées à une erreur factuelle (commerciales, éditoriales, presse), utilisez le contact général."
              : "For questions unrelated to a factual error (commercial, editorial, press), use the general contact."}
          </p>
          <p>
            <Link
              href="/contact"
              className="text-terracotta-deep hover:text-terracotta underline underline-offset-4"
            >
              {isFr ? "→ Contact général" : "→ General contact"}
            </Link>{" "}
            ·{" "}
            <Link
              href={"/charte-editoriale" as never}
              className="text-terracotta-deep hover:text-terracotta underline underline-offset-4"
            >
              {isFr ? "→ Charte éditoriale" : "→ Editorial policy"}
            </Link>{" "}
            ·{" "}
            <Link
              href="/transparence"
              className="text-terracotta-deep hover:text-terracotta underline underline-offset-4"
            >
              {isFr ? "→ Transparence IA Act" : "→ AI Act transparency"}
            </Link>
          </p>
        </Container>
      </Section>

      <Section>
        <Container className="max-w-3xl">
          <Cta href={`mailto:${CORRECTIONS_EMAIL}` as never} size="lg">
            {isFr ? "Signaler une erreur" : "Report an error"}
          </Cta>
        </Container>
      </Section>

      <JsonLd data={webPageJsonLd} />
    </>
  );
}
