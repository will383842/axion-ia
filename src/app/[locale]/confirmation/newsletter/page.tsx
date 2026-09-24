// Page de confirmation de la LETTRE — double opt-in (P0-4, refondu au lot L2).
//
// 🔴 Lot L2 (2026-09-24) — cette page NE CONFIRME PLUS RIEN au rendu. Elle
// appelait `confirmNewsletterAction(token)` sur un simple GET : les scanneurs
// de liens des messageries d'entreprise (Safe Links, Mimecast) confirmaient à
// la place de la personne, qui arrivait ensuite sur « lien expiré ».
//
// Trois états, lus dans l'URL :
//   1. `?token=…` (le lien de l'e-mail, anciens liens compris) : un bouton
//      « Confirmer », qui POSTE vers `/api/newsletter/confirmer` ;
//   2. `?statut=ok|deja` : le résultat, après la redirection 303 du POST ;
//   3. `?statut=<erreur>` ou rien : l'explication, et une issue.
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
import { GUIDE_IA_CHEMIN, GUIDE_IA_PAGES } from "@/content/guide-ia";
import { CADENCE_LETTRE } from "@/content/guide-ia-formulaire";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string; statut?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const meta = await buildProductMetadata({
    locale,
    path: "/confirmation/newsletter",
    title:
      locale === "fr" ? "Confirmation de la lettre · Axion-IA" : "Letter confirmation · Axion-IA",
    description:
      locale === "fr"
        ? "Confirmation de votre inscription à la lettre IA d'Axion-IA."
        : "Confirmation of your Axion-IA AI letter subscription.",
  });
  return { ...meta, robots: { index: false, follow: false } };
}

const ERREURS = {
  missing_token: { fr: "Lien invalide.", en: "Invalid link." },
  invalid_token: { fr: "Lien expiré ou déjà utilisé.", en: "Link expired or already used." },
  unsubscribed: {
    fr: "Cette adresse s'est désinscrite de la lettre.",
    en: "This address has unsubscribed from the letter.",
  },
  internal: {
    fr: "Erreur interne — réessayez plus tard.",
    en: "Internal error — please retry later.",
  },
} as const;

type CodeErreur = keyof typeof ERREURS;

export default async function NewsletterConfirmPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const { token, statut } = await searchParams;
  const aConfirmer = typeof token === "string" && token.length > 0 && !statut;
  const reussi = statut === "ok" || statut === "deja";
  const erreur: CodeErreur | null =
    aConfirmer || reussi
      ? null
      : statut && statut in ERREURS
        ? (statut as CodeErreur)
        : "missing_token";

  const breadcrumbItems = [
    {
      href: "/confirmation/newsletter",
      label: isFr ? "Confirmation de la lettre" : "Letter confirmation",
    },
  ];
  const pageGuide = isFr ? "/fr/guide-ia" : "/en/ai-guide";

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      <Section>
        <Container>
          {aConfirmer ? (
            <div className="max-w-2xl space-y-5">
              <h1 className="text-fg text-2xl font-semibold">
                {isFr
                  ? "Confirmez votre inscription à la lettre"
                  : "Confirm your letter subscription"}
              </h1>
              <p className="text-fg-soft text-base leading-relaxed">
                {isFr
                  ? `La lettre IA d'Axion-IA : ${CADENCE_LETTRE.fr.charAt(0).toLowerCase()}${CADENCE_LETTRE.fr.slice(1)} Un clic sur le bouton ci-dessous, et c'est fait. Désinscription en un clic dans chaque e-mail.`
                  : `Axion-IA's AI letter: ${CADENCE_LETTRE.en.charAt(0).toLowerCase()}${CADENCE_LETTRE.en.slice(1)} One click on the button below and you are done. One-click unsubscribe in every email.`}
              </p>
              {/* 🔑 Un FORMULAIRE, pas un lien : seul un POST confirme. C'est ce
                  qui distingue la personne du scanneur qui a ouvert le lien. */}
              <form action="/api/newsletter/confirmer" method="POST">
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="locale" value={loc} />
                <button
                  type="submit"
                  className="bg-primary text-primary-fg cta-lift hover:bg-primary-hover focus-visible:ring-primary inline-flex min-h-11 items-center gap-2 rounded-md px-5 py-3 text-base font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  {isFr ? "Confirmer mon inscription" : "Confirm my subscription"} →
                </button>
              </form>
              <p className="text-fg-muted text-sm">
                {isFr
                  ? "Vous n'avez rien demandé ? Fermez simplement cette page : sans ce clic, votre adresse n'est pas inscrite."
                  : "Didn't ask for this? Just close this page: without this click, your address is not subscribed."}
              </p>
            </div>
          ) : reussi ? (
            <Alert variant="success" role="status">
              <AlertTitle>
                {statut === "deja"
                  ? isFr
                    ? "Vous étiez déjà inscrit·e."
                    : "You were already subscribed."
                  : isFr
                    ? "Inscription confirmée."
                    : "Subscription confirmed."}
              </AlertTitle>
              <AlertDescription>
                {isFr
                  ? `Merci. Vous recevrez nos prochaines lettres : ${CADENCE_LETTRE.fr.charAt(0).toLowerCase()}${CADENCE_LETTRE.fr.slice(1)}`
                  : `Thank you. You will receive our next letters: ${CADENCE_LETTRE.en.charAt(0).toLowerCase()}${CADENCE_LETTRE.en.slice(1)}`}
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="danger" role="alert">
              <AlertTitle>{ERREURS[erreur ?? "missing_token"][loc]}</AlertTitle>
              <AlertDescription>
                <span>
                  {isFr
                    ? "Vous veniez chercher le guide IA entreprise ? Il vous est envoyé par e-mail : "
                    : "Looking for the enterprise AI guide? It is sent to you by email: "}
                  {/* 🔴 Lot L2 — ce lien visait `/fr#newsletter`, une ancre qui
                      n'existe nulle part sur le site. */}
                  <a className="underline" href={pageGuide}>
                    {isFr
                      ? "faites la demande depuis la page du guide"
                      : "request it from the guide page"}
                  </a>
                  .
                </span>
              </AlertDescription>
            </Alert>
          )}

          {/* Le guide reste téléchargeable ici après une confirmation réussie :
              la personne qui arrive de l'e-mail l'a déjà, celle qui arrive
              d'un ancien e-mail de confirmation le trouve. */}
          {reussi ? (
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
