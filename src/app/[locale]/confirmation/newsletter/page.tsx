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
import { GUIDE_IA_CHEMIN, GUIDE_IA_PAGES } from "@/content/guide-ia";

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
                    .{" "}
                    {/* Les filtres de messagerie d'entreprise (Safe Links, Mimecast)
                        ouvrent le lien avant la personne et le consomment : elle
                        arrive ici sans le bouton du guide promis par l'e-mail.
                        Refaire la demande repasse par la branche « déjà inscrit »,
                        qui affiche le téléchargement. */}
                    {isFr
                      ? "Vous veniez chercher le guide IA entreprise ? Votre messagerie a peut-être déjà ouvert ce lien : "
                      : "Looking for the enterprise AI guide? Your mail filter may have opened this link already: "}
                    <a className="underline" href={isFr ? "/fr/guide-ia" : "/en/ai-guide"}>
                      {isFr
                        ? "refaites la demande depuis la page du guide"
                        : "request it again from the guide page"}
                    </a>
                    .
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* 🔑 LA PROMESSE DE /guide-ia EST TENUE ICI (2026-09-23).
              La page du guide promettait un PDF « après inscription » ; il
              n'existait pas, et cette page n'en disait rien. Le guide se
              télécharge désormais APRÈS la confirmation de l'adresse — c'est ce
              que la page du guide annonce, et ce que l'e-mail de double opt-in
              dit. Affiché aussi à qui était déjà inscrit : il n'a pas à se
              désinscrire pour l'obtenir. */}
          {result.ok ? (
            <section
              aria-labelledby="guide-ia-titre"
              className="border-border mt-8 rounded-2xl border p-6"
            >
              <h2 id="guide-ia-titre" className="text-fg text-xl font-semibold">
                {isFr ? "Votre guide IA entreprise" : "Your enterprise AI guide"}
              </h2>
              <p className="text-fg-soft mt-2 text-base leading-relaxed">
                {isFr
                  ? `${GUIDE_IA_PAGES} pages au format PDF : usages concrets, coûts réels, retour sur investissement, gouvernance et écueils à éviter. Commencez par la page 5, l'essentiel en une page.`
                  : `${GUIDE_IA_PAGES} pages, PDF, in French: concrete use cases, real costs, return on investment, governance and pitfalls to avoid. Start with page 5, the essentials on one page.`}
              </p>
              <a
                href={`/${GUIDE_IA_CHEMIN}`}
                download
                data-track="newsletter-confirm-guide-ia"
                className="bg-primary text-primary-fg hover:bg-primary-hover shadow-subtle mt-5 inline-flex w-fit items-center gap-2 rounded-full px-6 py-3 text-base font-semibold"
              >
                {isFr ? "Télécharger le guide (PDF)" : "Download the guide (PDF)"}
              </a>
            </section>
          ) : null}

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
