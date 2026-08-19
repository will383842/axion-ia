import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { buildProductMetadata } from "@/lib/seo";

// Unsubscribe landing — RFC 8058 (List-Unsubscribe) + RGPD compliance.
// Public, no-index — accessed via signed token in email footers.
// Sprint 17 wires the actual server action that consumes the token.

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    token?: string;
    status?: "ok" | "fail";
    already?: string;
    reason?: string;
  }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const meta = await buildProductMetadata({
    locale,
    path: "/desabonnement",
    title: locale === "fr" ? "Désabonnement · Axion-IA" : "Unsubscribe · Axion-IA",
    description:
      locale === "fr"
        ? "Confirmer votre désabonnement de la newsletter ou des emails Axion-IA."
        : "Confirm unsubscription from the Axion-IA newsletter or emails.",
    alternates: { fr: "/desabonnement", en: "/unsubscribe" },
  });
  // Don't index unsubscribe pages.
  return { ...meta, robots: { index: false, follow: false } };
}

export default async function DesabonnementPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { token, status, already, reason } = await searchParams;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  // Bandeau résultat après /api/unsubscribe (P0-5 fix). Affiché AVANT le form
  // pour confirmer ou expliquer l'échec à l'utilisateur. Idempotent : si
  // l'utilisateur reload après confirm, il voit "déjà désinscrit".
  const resultBanner =
    status === "ok"
      ? {
          ok: true as const,
          title:
            already === "1"
              ? isFr
                ? "Vous étiez déjà désinscrit·e."
                : "You were already unsubscribed."
              : isFr
                ? "Désabonnement confirmé."
                : "Unsubscribe confirmed.",
          desc: isFr
            ? "Vous ne recevrez plus nos communications. Conservez ce lien comme preuve si nécessaire."
            : "You won't receive any further communications. Keep this link as proof if needed.",
        }
      : status === "fail"
        ? {
            ok: false as const,
            title:
              reason === "missing_token"
                ? isFr
                  ? "Lien invalide."
                  : "Invalid link."
                : reason === "invalid_token"
                  ? isFr
                    ? "Lien expiré ou inconnu."
                    : "Link expired or unknown."
                  : isFr
                    ? "Erreur interne."
                    : "Internal error.",
            desc: isFr
              ? "Vous pouvez nous écrire à contact@axion-ia.com pour exercer manuellement vos droits RGPD."
              : "Email us at contact@axion-ia.com to exercise your GDPR rights manually.",
          }
        : null;

  // Breadcrumb visuel + JSON-LD intégré (composant unique). L'item "Accueil"
  // est ajouté automatiquement par le composant.
  const breadcrumbItems = [
    { href: "/desabonnement", label: isFr ? "Désabonnement" : "Unsubscribe" },
  ];

  const hasToken = typeof token === "string" && token.length > 0;

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      <Section
        titleAs="h1"
        eyebrow={isFr ? "RGPD · RFC 8058" : "GDPR · RFC 8058"}
        title={isFr ? "Confirmer le" : "Confirm"}
        titleEm={isFr ? "désabonnement" : "unsubscribe"}
        description={
          isFr
            ? "Conformément au RGPD et à la RFC 8058 (List-Unsubscribe en un clic), vous pouvez retirer votre consentement à tout moment."
            : "In accordance with GDPR and RFC 8058 (One-Click List-Unsubscribe), you can withdraw your consent at any time."
        }
      />

      <Section>
        <Container className="text-fg-soft max-w-2xl space-y-6 text-base leading-relaxed">
          {resultBanner ? (
            <div
              role={resultBanner.ok ? "status" : "alert"}
              className={
                resultBanner.ok
                  ? "border-sage/40 bg-sage/10 rounded-xl border-2 p-5"
                  : "border-accent-red/40 bg-accent-red/10 rounded-xl border-2 p-5"
              }
            >
              <p className="text-fg text-base font-semibold">{resultBanner.title}</p>
              <p className="text-fg-soft mt-2 text-sm leading-relaxed">{resultBanner.desc}</p>
            </div>
          ) : null}
          {hasToken && status !== "ok" ? (
            <>
              <p>
                {isFr
                  ? "Cliquez sur le bouton ci-dessous pour confirmer votre désabonnement. Le traitement est instantané et définitif pour la liste concernée."
                  : "Click the button below to confirm your unsubscription. Processing is instant and final for the relevant list."}
              </p>
              <form
                action="/api/unsubscribe"
                method="POST"
                className="flex flex-wrap items-center gap-3"
              >
                <input type="hidden" name="token" value={token} />
                <button
                  type="submit"
                  className="bg-primary text-primary-fg cta-lift hover:bg-primary-hover focus-visible:ring-primary inline-flex items-center gap-2 rounded-md px-5 py-3 text-base font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  {isFr ? "Confirmer le désabonnement" : "Confirm unsubscribe"} →
                </button>
                <Cta href="/" variant="outline">
                  {isFr ? "Annuler" : "Cancel"}
                </Cta>
              </form>
              <p className="text-fg-muted text-xs">
                {isFr
                  ? "Vous pouvez toujours nous écrire à contact@axion-ia.com pour exercer vos droits RGPD (accès, rectification, effacement, portabilité, opposition)."
                  : "You can always email contact@axion-ia.com to exercise your GDPR rights (access, rectification, erasure, portability, objection)."}
              </p>
            </>
          ) : (
            <>
              <p>
                {isFr
                  ? "Cette page nécessite un lien de désabonnement présent dans nos emails. Sans ce lien, nous ne pouvons pas identifier votre adresse."
                  : "This page requires the unsubscribe link from our emails. Without it, we can't identify your address."}
              </p>
              <p>
                {isFr
                  ? "Pour exercer vos droits RGPD ou demander un retrait manuel, écrivez-nous à"
                  : "To exercise your GDPR rights or request a manual removal, email us at"}{" "}
                <a className="text-primary hover:underline" href="mailto:contact@axion-ia.com">
                  contact@axion-ia.com
                </a>
                .
              </p>
              <Cta href="/" size="lg">
                {isFr ? "Retour à l'accueil" : "Back to home"} →
              </Cta>
            </>
          )}
        </Container>
      </Section>
    </>
  );
}
