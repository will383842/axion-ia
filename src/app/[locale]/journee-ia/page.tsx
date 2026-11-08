// La Journée IA — offre phare d'Axion-IA (audit d'harmonie du 08/11/2026, A03).
//
// Page statique, serveur seulement (aucun « use client », aucune base) : tout le texte vient de
// `contenu.ts`, le prix de `pricing.ts` (JOURNEE_IA_TIER). Prochaine étape unique : le rendez-vous
// gratuit de 45 minutes (/appel). Aucune modalité d'argent hors le prix de la journée, aucun
// prix de formation (décisions de Williams, Brain d4 / d6).
//
// La langue anglaise est désactivée (proxy 301) : toute autre locale part vers /fr/journee-ia.

import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";

import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { JOURNEE_IA_TIER } from "@/content/pricing";
import {
  buildFaqJsonLd,
  buildProductMetadata,
  buildServiceJsonLd,
  buildWebPageJsonLd,
} from "@/lib/seo";

import { CONTENU } from "./contenu";
import { prixDeLaJournee, remplacerLePrix } from "./prix";

export const revalidate = 3600;

const PATH = "/journee-ia";

/** Le format, en une ligne : un seul chiffre, le plafond de personnes (décision n°11, Williams). */
const FORMAT = "Une journée dans votre entreprise, jusqu’à 15 personnes.";

interface Props {
  params: Promise<{ locale: string }>;
}

const DESCRIPTION =
  "Une journée chez vous : nous chiffrons le temps perdu et formons vos équipes. Pour les TPE et PME. Rendez-vous gratuit de 45 minutes.";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: PATH,
    title: `La Journée IA pour les PME · ${prixDeLaJournee("fr")} · Axion-IA`,
    description: DESCRIPTION,
    alternates: { fr: PATH, en: PATH },
  });
}

/** Le titre de la page, avec ses mots mis en couleur. */
function Titre() {
  const { titre, titreAccent } = CONTENU.accroche;
  const [avant, apres] = titre.split(titreAccent);
  return (
    <>
      {avant}
      <span className="text-terracotta">{titreAccent}</span>
      {apres}
    </>
  );
}

export default async function JourneeIaPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  if (locale !== "fr") permanentRedirect("/fr/journee-ia");
  setRequestLocale(locale);
  const loc = locale as Locale;

  const { accroche, questions, deroule, livrables, intervenant, rendezVous } = CONTENU;

  const serviceJsonLd = buildServiceJsonLd({
    locale: loc,
    path: PATH,
    name: "La Journée IA",
    description: DESCRIPTION,
    ...(JOURNEE_IA_TIER.priceFlat !== undefined ? { priceEur: JOURNEE_IA_TIER.priceFlat } : {}),
    serviceType: "Audit et formation à l'IA en entreprise",
    areasServed: [{ type: "Country", name: "France" }],
  });
  // Montant HT : précisé en toutes lettres pour les moteurs de réponse.
  const serviceAvecPrix = {
    ...serviceJsonLd,
    ...("offers" in serviceJsonLd && serviceJsonLd.offers
      ? {
          offers: {
            ...serviceJsonLd.offers,
            priceSpecification: {
              "@type": "PriceSpecification",
              price: String(JOURNEE_IA_TIER.priceFlat),
              priceCurrency: "EUR",
              valueAddedTaxIncluded: false,
            },
          },
        }
      : {}),
  };
  const faqJsonLd = buildFaqJsonLd({
    items: rendezVous.faq.map((f) => ({ question: f.question, answer: f.reponse })),
    speakable: false,
  });
  const webPageJsonLd = buildWebPageJsonLd({
    locale: loc,
    path: PATH,
    name: `La Journée IA · ${prixDeLaJournee("fr")} · Axion-IA`,
    description: DESCRIPTION,
  });

  // `rdv=diagnostic` : le Diagnostic IA gratuit de 45 minutes, seul rendez-vous (Brain r10, lot R5b).
  const lien = (depuis: string) => `/appel?rdv=diagnostic&depuis=${depuis}`;

  return (
    <>
      {/* 1. ACCROCHE */}
      <section
        aria-labelledby="journee-ia-titre"
        className="bg-halo-warm text-fg py-14 sm:py-16 lg:py-20"
      >
        <Container>
          <Breadcrumbs items={[{ href: PATH, label: "La Journée IA" }]} />
          <div className="mt-8 max-w-3xl">
            <p className="text-fg-muted text-sm font-semibold tracking-[0.14em] uppercase">
              {accroche.surtitre}
            </p>
            <h1 id="journee-ia-titre" className="display-editorial text-fg mt-4">
              <Titre />
            </h1>
            <p className="text-fg-soft mt-5 max-w-2xl text-lg leading-relaxed sm:text-xl">
              {accroche.phrase}
            </p>
            <div className="mt-8">
              <Cta href={lien("journee-ia-haut")} size="lg" track="journee-ia-haut">
                {accroche.cta}
              </Cta>
            </div>
            <p className="text-fg-muted mt-4 text-[15px]">{accroche.microTexte}</p>
          </div>
        </Container>
      </section>

      {/* 2. LES QUESTIONS */}
      <section aria-labelledby="journee-ia-questions" className="bg-sand text-fg py-14 sm:py-16">
        <Container>
          <h2
            id="journee-ia-questions"
            className="text-fg text-2xl font-semibold tracking-tight sm:text-3xl"
          >
            {questions.titre}
          </h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-3">
            {questions.cartes.map((q) => (
              <li
                key={q}
                className="bg-paper border-border rounded-2xl border p-6 text-lg font-medium"
              >
                {q}
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* 3. LE DÉROULÉ */}
      <section aria-labelledby="journee-ia-deroule" className="bg-bg text-fg py-14 sm:py-16">
        <Container>
          <h2
            id="journee-ia-deroule"
            className="text-fg text-2xl font-semibold tracking-tight sm:text-3xl"
          >
            {deroule.titre}
          </h2>
          <p className="text-fg-soft mt-3 text-[16px]">{FORMAT}</p>
          <ol className="mt-8 grid gap-6 sm:grid-cols-3">
            {deroule.etapes.map((e, i) => (
              <li key={e.moment} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="text-terracotta text-3xl leading-none font-semibold tabular-nums"
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-fg text-lg font-semibold">{e.moment}</h3>
                  <p className="text-fg-soft mt-2 text-[15px] leading-relaxed">{e.texte}</p>
                </div>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* 4. CE QUE VOUS REPARTEZ AVEC — le seul bloc sombre */}
      <section aria-labelledby="journee-ia-livrables" className="bg-bg py-6 sm:py-10">
        <Container>
          <div className="bg-mocha-rich text-mocha-fg rounded-3xl p-6 sm:p-10">
            <h2
              id="journee-ia-livrables"
              className="text-2xl font-semibold tracking-tight sm:text-3xl"
            >
              {livrables.titre}
            </h2>
            <ul className="mt-8 grid gap-6 sm:grid-cols-3">
              {livrables.elements.map((el) => (
                <li key={el.titre}>
                  <h3 className="text-terracotta-on-mocha text-lg font-semibold">{el.titre}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed opacity-80">{el.legende}</p>
                </li>
              ))}
            </ul>
            <p className="mt-8 text-lg font-semibold">{remplacerLePrix(livrables.derniereLigne)}</p>
          </div>
        </Container>
      </section>

      {/* 5. QUI INTERVIENT, ET LA GARANTIE */}
      <section aria-labelledby="journee-ia-garantie" className="bg-sand text-fg py-14 sm:py-16">
        <Container>
          <h2
            id="journee-ia-garantie"
            className="text-fg text-2xl font-semibold tracking-tight sm:text-3xl"
          >
            {intervenant.titre}
          </h2>
          <div className="mt-6 max-w-3xl space-y-4 text-[16px] leading-relaxed">
            <p className="font-medium">{intervenant.presentation}</p>
            <p className="text-fg-soft">{intervenant.declaration}</p>
            <p>{intervenant.garantie}</p>
            <p className="text-fg-soft">{intervenant.condition}</p>
          </div>
        </Container>
      </section>

      {/* 6. QUESTIONS ET RENDEZ-VOUS */}
      <section aria-labelledby="journee-ia-rdv" className="bg-bg text-fg py-14 sm:py-16">
        <Container>
          <h2
            id="journee-ia-rdv"
            className="text-fg text-2xl font-semibold tracking-tight sm:text-3xl"
          >
            {rendezVous.titre}
          </h2>
          <div className="divide-border mt-6 max-w-3xl divide-y">
            {rendezVous.faq.map((f) => (
              <details key={f.question} className="group py-4">
                <summary className="text-fg cursor-pointer text-lg font-medium">
                  {f.question}
                </summary>
                <p className="text-fg-soft mt-2 text-[16px] leading-relaxed">{f.reponse}</p>
              </details>
            ))}
          </div>
          <div className="mt-12 max-w-2xl">
            <p className="text-fg text-2xl font-semibold tracking-tight">{rendezVous.titreFinal}</p>
            <p className="text-fg-soft mt-2 text-lg">{rendezVous.phrase}</p>
            <div className="mt-6">
              <Cta href={lien("journee-ia-bas")} size="lg" track="journee-ia-bas">
                {rendezVous.cta}
              </Cta>
            </div>
          </div>
        </Container>
      </section>

      <JsonLd data={serviceAvecPrix} />
      <JsonLd data={faqJsonLd} />
      <JsonLd data={webPageJsonLd} />
    </>
  );
}
