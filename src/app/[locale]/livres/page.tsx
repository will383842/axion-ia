/**
 * Hub `/fr/livres` — le catalogue des ouvrages publiés par Axion-IA.
 *
 * **Le hub suit ses fiches.** Tant qu'aucun livre n'est en vente, il n'y a rien à indexer :
 * un hub qui n'annonce que des ouvrages introuvables est un silo vide, et Google en tire la
 * conclusion qui s'impose. La page reste consultable et complète — elle sort seulement de
 * l'index, exactement comme les fiches. Le premier livre publié la fait basculer, sans
 * qu'aucune ligne de code ne change.
 *
 * FR uniquement, comme les fiches qu'il liste.
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { buildProductMetadata } from "@/lib/seo";
import { LIVRES, estPublie, livresPublies } from "@/content/livres";

export const revalidate = 86400;

interface Props {
  params: Promise<{ locale: string }>;
}

const TITRE = "Livres · Axion-IA";
const DESCRIPTION =
  "Les ouvrages publiés par Axion-IA sur l'intelligence artificielle appliquée au travail des dirigeants de PME, ETI et grands groupes.";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale) || locale !== "fr") return {};

  const base = await buildProductMetadata({
    locale,
    path: "/livres",
    title: TITRE,
    description: DESCRIPTION,
    alternates: { fr: "/livres" },
  });

  return livresPublies().length > 0 ? base : { ...base, robots: "noindex, follow" };
}

export default async function HubLivresPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale) || locale !== "fr") notFound();
  setRequestLocale(locale as Locale);

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={[{ href: "/livres", label: "Livres" }]} />
      </Container>

      <Section>
        <Container>
          <header className="mb-10">
            <h1>Livres</h1>
            <p>{DESCRIPTION}</p>
          </header>

          <ul className="grid list-none gap-8 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {LIVRES.map((livre) => (
              <li key={livre.slug}>
                <Link
                  href={{ pathname: "/livres/[slug]", params: { slug: livre.slug } }}
                  className="block no-underline"
                >
                  <picture>
                    <source srcSet={livre.jackets.card.avif} type="image/avif" />
                    <img
                      src={livre.jackets.card.webp}
                      alt={livre.coverAlt}
                      width={livre.jackets.card.width}
                      height={livre.jackets.card.height}
                      loading="lazy"
                      decoding="async"
                      className="h-auto w-full rounded-lg"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  </picture>
                  <h2 className="mt-4 mb-1 text-xl">{livre.title}</h2>
                  <p className="m-0">{livre.subtitle}</p>
                  <p className="m-0 text-sm">
                    {livre.author.name}
                    {estPublie(livre) ? "" : " — à paraître"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </Section>
    </>
  );
}
