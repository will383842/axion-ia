// La Journée IA — page de vente (fiche V5-04).
//
// Composant serveur uniquement : aucun « use client », aucun module client
// nouveau. Tout le texte vient de `contenu.ts` ; le seul montant vient de
// `pricing.ts` (JOURNEE_IA_TIER). Aucun style local en dur : classes de jetons.
import type { Metadata } from "next";
import Image from "next/image";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound, permanentRedirect } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { JsonLd } from "@/components/marketing/JsonLd";
import { JOURNEE_IA_TIER, formatAmount } from "@/content/pricing";
import { FOUNDER_PERSON_ID } from "@/lib/brand";
import { routing } from "@/i18n/routing";
import {
  SITE_URL,
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
  buildProductMetadata,
  buildServiceJsonLd,
  buildWebPageJsonLd,
} from "@/lib/seo";
import { CONTENU, JETON_PRIX } from "./contenu";
import { DESCRIPTION, prixJourneeIa, titrePage } from "./meta";

export const revalidate = 3600;

interface Props {
  params: Promise<{ locale: string }>;
}

const PATH = "/journee-ia";
const IMAGE_PARTAGE =
  "/images/axion-ia-intervention-une-journee-ia-sur-site-entreprise-equipe.webp";
const PORTRAIT = "/illustrations/william-fondateur-formateur-ia-axion-ia.webp";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: PATH,
    title: titrePage(),
    description: DESCRIPTION,
    ogImage: `${SITE_URL}${IMAGE_PARTAGE}`,
    ogImageWidth: 1254,
    ogImageHeight: 1254,
  });
}

/** Titre avec les mots d'accent en terracotta. */
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

  const { accroche, questions, deroule, livrables, intervenant, rendezVous } = CONTENU;
  const [avantPrix, apresPrix] = livrables.derniereLigne.split(JETON_PRIX);
  const montant = prixJourneeIa(JOURNEE_IA_TIER.priceFlat);
  const lienHaut = "/appel?rdv=diagnostic&depuis=journee-ia-haut";
  const lienBas = "/appel?rdv=diagnostic&depuis=journee-ia-bas";

  const service = buildServiceJsonLd({
    locale,
    path: PATH,
    name: "La Journée IA",
    description: DESCRIPTION,
    priceEur: montant,
    serviceType: "Formation et audit IA sur site",
  });
  const serviceAvecPrix = {
    ...service,
    offers: {
      ...("offers" in service ? service.offers : {}),
      priceSpecification: {
        "@type": "PriceSpecification",
        price: montant.toString(),
        priceCurrency: "EUR",
        valueAddedTaxIncluded: false,
      },
    },
  };
  const jsonLd = [
    serviceAvecPrix,
    buildFaqJsonLd({
      items: rendezVous.faq.map((f) => ({ question: f.question, answer: f.reponse })),
      // Page portée par le fondateur (vraie personne), pas par la persona éditoriale.
      authorId: FOUNDER_PERSON_ID,
    }),
    buildBreadcrumbJsonLd({
      locale,
      items: [
        { name: "Accueil", href: "/" },
        { name: "La Journée IA", href: PATH },
      ],
    }),
    buildWebPageJsonLd({ locale, path: PATH, name: titrePage(), description: DESCRIPTION }),
  ];

  return (
    <>
      {jsonLd.map((data, i) => (
        <JsonLd key={i} data={data} />
      ))}

      {/* 1. Accroche */}
      <section aria-labelledby="ji-titre" className="bg-bg py-16 sm:py-24">
        <Container>
          <p className="text-fg-soft text-sm font-semibold">{accroche.surtitre}</p>
          <h1 id="ji-titre" className="text-fg mt-4 max-w-3xl text-4xl font-semibold sm:text-6xl">
            <Titre />
          </h1>
          <p className="text-fg mt-6 max-w-2xl text-lg">{accroche.phrase}</p>
          <div className="mt-8">
            <Cta href={lienHaut} track="journee-ia-haut" variant="terracotta" size="lg">
              {accroche.cta}
            </Cta>
          </div>
          <p className="text-fg-soft mt-4 text-sm">{accroche.microTexte}</p>
        </Container>
      </section>

      {/* 2. Les questions */}
      <section aria-labelledby="ji-questions" className="bg-sand py-16">
        <Container>
          <h2 id="ji-questions" className="text-fg text-3xl font-semibold">
            {questions.titre}
          </h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-3">
            {questions.cartes.map((q) => (
              <li key={q} className="bg-paper text-fg rounded-2xl p-6 text-lg font-semibold">
                {q}
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* 3. Le déroulé */}
      <section aria-labelledby="ji-deroule" className="bg-bg py-16">
        <Container>
          <h2 id="ji-deroule" className="text-fg text-3xl font-semibold">
            {deroule.titre}
          </h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-3">
            {deroule.etapes.map((e, i) => (
              <li key={e.moment}>
                <span aria-hidden="true" className="text-terracotta text-4xl font-semibold">
                  {i + 1}
                </span>
                <p className="text-fg mt-2 text-lg font-semibold">{e.moment}</p>
                <p className="text-fg mt-2">{e.texte}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* 4. Ce que vous repartez avec : l'unique bloc sombre, jamais pleine largeur */}
      <section aria-labelledby="ji-livrables" className="bg-bg px-6 py-8 sm:px-8">
        <Container>
          <div className="bg-mocha text-mocha-fg rounded-3xl p-6 sm:p-8">
            <h2 id="ji-livrables" className="text-mocha-fg text-3xl font-semibold">
              {livrables.titre}
            </h2>
            <ul className="mt-6 grid gap-6 sm:grid-cols-3">
              {livrables.elements.map((el) => (
                <li key={el.titre}>
                  <p className="text-terracotta-on-mocha text-xl font-semibold">{el.titre}</p>
                  <p className="text-mocha-fg-muted mt-1">{el.legende}</p>
                </li>
              ))}
            </ul>
            <p className="text-mocha-fg mt-8 text-xl font-semibold">
              {avantPrix}
              {formatAmount(montant, "fr", { compact: true })} <abbr title="hors taxes">HT</abbr>
              {apresPrix}
            </p>
          </div>
        </Container>
      </section>

      {/* 5. Qui intervient, et la garantie */}
      <section aria-labelledby="ji-intervenant" className="bg-sand py-16">
        <Container className="grid items-start gap-8 sm:grid-cols-[240px_1fr]">
          <Image
            src={PORTRAIT}
            alt="Williams Jullin, fondateur d’Axion-IA, formateur en intelligence artificielle"
            width={240}
            height={320}
            loading="lazy"
            className="rounded-2xl"
          />
          <div>
            <h2 id="ji-intervenant" className="text-fg text-3xl font-semibold">
              {intervenant.titre}
            </h2>
            <p className="text-fg mt-4 text-lg font-semibold">{intervenant.presentation}</p>
            <p className="text-fg mt-2">{intervenant.declaration}</p>
            <p className="text-fg mt-6">{intervenant.garantie}</p>
            <p className="text-fg-soft mt-2 text-sm">{intervenant.condition}</p>
          </div>
        </Container>
      </section>

      {/* 6. Questions et rendez-vous */}
      <section aria-labelledby="ji-rdv" className="bg-bg py-16">
        <Container>
          <h2 id="ji-rdv" className="text-fg text-3xl font-semibold">
            {rendezVous.titre}
          </h2>
          <div className="mt-6 max-w-2xl divide-y">
            {rendezVous.faq.map((f) => (
              <details key={f.question}>
                <summary
                  data-faq-q
                  className="text-fg flex min-h-12 cursor-pointer items-center text-lg font-semibold"
                >
                  {f.question}
                </summary>
                <p data-faq-a className="text-fg pb-4">
                  {f.reponse}
                </p>
              </details>
            ))}
          </div>
          <p className="text-fg mt-12 text-2xl font-semibold">{rendezVous.titreFinal}</p>
          <p className="text-fg mt-2">{rendezVous.phrase}</p>
          <div className="mt-6">
            <Cta href={lienBas} track="journee-ia-bas" variant="terracotta" size="lg">
              {rendezVous.cta}
            </Cta>
          </div>
        </Container>
      </section>
    </>
  );
}
