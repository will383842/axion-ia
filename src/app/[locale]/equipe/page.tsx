/**
 * Hub `/fr/equipe` — « L'équipe d'Axion-IA ».
 *
 * Liste les personnes par catégorie (une catégorie vide n'a pas de section) : Williams
 * (statique, toujours en tête de Direction) puis les collaborateurs publiés en base. La carte
 * de France reçoit les points `listMapPoints()` ; sur la base stub : Williams seul, sans carte.
 *
 * FR uniquement, comme les fiches qu'il liste. Server Component, aucun JS client.
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { JsonLdGraph } from "@/components/marketing/JsonLdGraph";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { CarteCollaborateur } from "@/components/equipe/CarteCollaborateur";
import { buildProductMetadata } from "@/lib/seo";
import { buildEquipeHubJsonLd } from "@/lib/seo/equipe-hub-jsonld";
import { SLUG_PLUME_IA } from "@/lib/seo/plume-ia";
import { CarteFrance } from "@/components/equipe/CarteFrance";
import { construireHubEquipe } from "@/lib/equipe/hub";
import { listMapPoints, listPublishedMembers } from "@/lib/equipe/collaborateurs";
import {
  HUB_APPORTEURS_LIEN,
  HUB_DATE_MAJ,
  HUB_FAQ,
  HUB_FAQ_TITRE,
  HUB_META_DESCRIPTION,
  HUB_META_TITRE,
  HUB_REJOINDRE_TEXTE,
  HUB_REJOINDRE_TITRE,
  HUB_REPONSE,
  HUB_TITRE,
  HUB_TRANSPARENCE_TEXTE,
  HUB_TRAVAIL_ETAPES,
  HUB_TRAVAIL_INTRO,
  HUB_TRAVAIL_TITRE,
} from "@/content/equipe/hub";

export const revalidate = 3600;

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale) || locale !== "fr") return {};
  return buildProductMetadata({
    locale,
    path: "/equipe",
    // Le titre porte la marque : pas de second « · Axion-IA » apposé.
    title: HUB_META_TITRE,
    description: HUB_META_DESCRIPTION,
    alternates: { fr: "/equipe" },
  });
}

const DATE_MAJ_LISIBLE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
}).format(new Date(`${HUB_DATE_MAJ}T00:00:00Z`));

export default async function HubEquipePage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale) || locale !== "fr") notFound();
  setRequestLocale(locale as Locale);

  // Lectures stub-aware : sur la base stub, `[]` sans appeler Prisma (Williams reste présent).
  const [membres, points] = await Promise.all([listPublishedMembers(), listMapPoints()]);
  const hub = construireHubEquipe(membres, points);
  const { sections, fichesCarte, indexables } = hub;

  return (
    <>
      <JsonLdGraph schemas={buildEquipeHubJsonLd(indexables)} />
      <Container className="border-border border-b py-3">
        {/* Le BreadcrumbList est déjà dans le `@graph` unique ci-dessus. */}
        <Breadcrumbs emitJsonLd={false} items={[{ href: "/equipe", label: "Équipe" }]} />
      </Container>

      <section className="bg-halo-warm py-12 sm:py-16">
        <Container className="max-w-3xl">
          <h1 className="text-fg text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.1] font-semibold tracking-tight">
            {HUB_TITRE}
          </h1>
          <p data-answer data-hub-reponse className="text-fg mt-5 text-lg leading-relaxed">
            {HUB_REPONSE}
          </p>
          <p className="text-fg-muted mt-3 text-sm">
            Mis à jour le <time dateTime={HUB_DATE_MAJ}>{DATE_MAJ_LISIBLE}</time>
          </p>
        </Container>
      </section>

      {fichesCarte.length > 0 ? (
        <section className="py-8 sm:py-10">
          <Container>
            <h2
              id="equipe-carte-titre"
              className="text-fg mx-auto max-w-3xl text-2xl font-semibold tracking-tight"
            >
              Où sont les collaborateurs d&apos;Axion-IA
            </h2>
            <div className="mt-5">
              <CarteFrance
                fiches={fichesCarte}
                idTitre="equipe-carte-titre"
                avecDirigeant={hub.williamsSurCarte}
                hrefFiche={(slug) => `/${locale}/equipe/${slug}`}
              />
            </div>
          </Container>
        </section>
      ) : null}

      {sections.map(({ categorie, fiches: groupe }) => (
        <section key={categorie.id} className="py-8 sm:py-10">
          <Container className="max-w-3xl">
            <h2 className="text-fg text-2xl font-semibold tracking-tight">
              {categorie.libellePluriel}
            </h2>
            <ul className="mt-5 grid list-none gap-4 p-0">
              {groupe.map((fiche) => (
                <li key={fiche.slug}>
                  <CarteCollaborateur
                    fiche={fiche}
                    href={`/${locale}/equipe/${fiche.slug}`}
                    niveauTitre="h3"
                  />
                </li>
              ))}
            </ul>
            {categorie.id === "apporteur" ? (
              <p className="mt-4">
                <Link
                  href={"/devenir-commercial-ia" as never}
                  className="text-terracotta underline"
                >
                  {HUB_APPORTEURS_LIEN}
                </Link>
              </p>
            ) : null}
          </Container>
        </section>
      ))}

      <section className="py-8 sm:py-10">
        <Container className="max-w-3xl">
          <h2 className="text-fg text-2xl font-semibold tracking-tight">{HUB_TRAVAIL_TITRE}</h2>
          <p className="text-fg-soft mt-4 leading-relaxed">{HUB_TRAVAIL_INTRO}</p>
          <ol className="text-fg-soft mt-4 list-decimal space-y-2 pl-6 leading-relaxed">
            {HUB_TRAVAIL_ETAPES.map((etape) => (
              <li key={etape.titre}>
                <strong className="text-fg">{etape.titre}</strong> : {etape.texte}
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section className="py-8 sm:py-10">
        <Container className="max-w-3xl">
          <h2 className="text-fg text-2xl font-semibold tracking-tight">{HUB_REJOINDRE_TITRE}</h2>
          <p className="text-fg-soft mt-4 leading-relaxed">{HUB_REJOINDRE_TEXTE}</p>
          <p className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
            <Link href={"/devenir-commercial-ia" as never} className="text-terracotta underline">
              {HUB_APPORTEURS_LIEN}
            </Link>
            <Link href="/carrieres" className="text-terracotta underline">
              Voir les offres de la page Carrières
            </Link>
          </p>
        </Container>
      </section>

      <section id="axion-faq" className="py-8 sm:py-10">
        <Container className="max-w-3xl">
          <h2 className="text-fg text-2xl font-semibold tracking-tight">{HUB_FAQ_TITRE}</h2>
          <div className="mt-6">
            {/* FAQPage déjà émis dans le `@graph` du hub. */}
            <FaqAccordion items={HUB_FAQ} emitJsonLd={false} questionAs="h3" />
          </div>
        </Container>
      </section>

      <aside className="pt-4 pb-16">
        <Container className="max-w-3xl">
          <p className="border-border bg-sand text-fg-soft rounded-2xl border p-4 text-sm leading-relaxed">
            {HUB_TRANSPARENCE_TEXTE}{" "}
            <Link
              href={{ pathname: "/equipe/[slug]", params: { slug: SLUG_PLUME_IA } }}
              className="text-terracotta underline"
            >
              Voir la fiche de Manon
            </Link>
            .
          </p>
        </Container>
      </aside>
    </>
  );
}
