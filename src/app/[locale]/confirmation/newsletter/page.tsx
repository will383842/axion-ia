// Page consommatrice de confirmToken — P0-4 fix (RFC 8058 double opt-in).
//
// Le template `newsletter-confirm-optin.tsx` envoie l'utilisateur ici via
// `${baseUrl}/${locale}/confirmation/newsletter?token=...`. Cette page :
//   1. Lit le token depuis searchParams
//   2. Appelle `confirmNewsletterAction(token)` côté server
//   3. Rend le résultat (succès, déjà confirmé, token expiré, désinscrit)
//
// noindex: true (page transactionnelle, jamais de signal SEO).

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { buildProductMetadata } from "@/lib/seo";
import { confirmNewsletterAction } from "@/features/newsletter/actions";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const meta = await buildProductMetadata({
    locale,
    path: "/confirmation/newsletter",
    title:
      locale === "fr" ? "Confirmation newsletter · Axion-IA" : "Newsletter confirmation · Axion-IA",
    description:
      locale === "fr"
        ? "Confirmation de votre inscription à la newsletter Axion-IA."
        : "Confirmation of your Axion-IA newsletter subscription.",
  });
  return { ...meta, robots: { index: false, follow: false } };
}

export default async function NewsletterConfirmPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const { token = null } = await searchParams;
  const result = await confirmNewsletterAction(token);

  const breadcrumbItems = [
    {
      href: isFr ? "/confirmation/newsletter" : "/confirmation/newsletter",
      label: isFr ? "Confirmation newsletter" : "Newsletter confirmation",
    },
  ];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      <Section>
        <Container>
          {result.ok ? (
            <Alert variant="success" role="status">
              <AlertTitle>
                {result.alreadyConfirmed
                  ? isFr
                    ? "Vous étiez déjà inscrit·e."
                    : "You were already subscribed."
                  : isFr
                    ? "Inscription confirmée."
                    : "Subscription confirmed."}
              </AlertTitle>
              <AlertDescription>
                {isFr
                  ? `Merci pour votre confiance. Vous recevrez nos prochaines lettres à l'adresse ${result.email}.`
                  : `Thanks for the trust. You'll receive our next letters at ${result.email}.`}
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="danger" role="alert">
              <AlertTitle>
                {result.error === "missing_token"
                  ? isFr
                    ? "Lien invalide."
                    : "Invalid link."
                  : result.error === "invalid_token"
                    ? isFr
                      ? "Lien expiré ou déjà utilisé."
                      : "Link expired or already used."
                    : result.error === "unsubscribed"
                      ? isFr
                        ? "Cet email s'est précédemment désinscrit."
                        : "This email previously unsubscribed."
                      : isFr
                        ? "Erreur interne — réessayez plus tard."
                        : "Internal error — please retry later."}
              </AlertTitle>
              <AlertDescription>
                {result.error === "invalid_token" && (
                  <span>
                    {isFr
                      ? "Si vous souhaitez vous inscrire à nouveau, "
                      : "If you wish to subscribe again, "}
                    <a className="underline" href={isFr ? "/fr#newsletter" : "/en#newsletter"}>
                      {isFr ? "remplissez le formulaire" : "use the signup form"}
                    </a>
                    .
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="mt-8">
            <Cta
              variant="primary"
              size="md"
              href={isFr ? "/fr" : "/en"}
              data-track="newsletter-confirm-back-home"
            >
              {isFr ? "Retour à l'accueil" : "Back to homepage"}
            </Cta>
          </div>
        </Container>
      </Section>
    </>
  );
}
