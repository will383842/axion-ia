/**
 * Fiche produit d'un livre — `/fr/livres/[slug]`.
 *
 * FR uniquement, comme `/equipe/[slug]` : les livres du catalogue sont écrits en français,
 * et une fiche produit traduite pour un ouvrage qui n'existe pas dans cette langue serait
 * une promesse fausse.
 *
 * **Tant que le livre n'est pas achetable, la page est `noindex` et absente du sitemap.**
 * Elle existe, elle est complète, elle se relit — mais elle ne part pas en indexation. Une
 * fiche produit sans destination d'achat est une page mince : Google la classe comme telle,
 * et la faire indexer avant l'heure abîme le domaine pour un gain nul. Renseigner
 * `publication.amazonUrl` dans `content/livres.ts` bascule tout : index, sitemap, bouton
 * d'achat, `offers` du JSON-LD et `datePublished`.
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { buildProductMetadata } from "@/lib/seo";
import { BRAND } from "@/lib/brand";
import { LIVRES, estPublie, livreParSlug } from "@/content/livres";
import { buildLivreJsonLd } from "@/lib/seo/livre-jsonld";

// Le catalogue est un module statique : la page ne dépend d'aucune requête. ISR 24 h par
// cohérence avec les autres fiches d'autorité du site (`/equipe/[slug]`).
export const revalidate = 86400;
export const dynamicParams = false;

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export function generateStaticParams(): { slug: string }[] {
  return LIVRES.map((livre) => ({ slug: livre.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale) || locale !== "fr") return {};
  const livre = livreParSlug(slug);
  if (livre === undefined) return {};

  const base = await buildProductMetadata({
    locale,
    path: `/livres/${livre.slug}`,
    title: `${livre.title} — ${livre.subtitle} · ${livre.author.name}`,
    description: livre.summary[0] ?? livre.hook,
    alternates: { fr: `/livres/${livre.slug}` },
    // URL ABSOLUE : `buildProductMetadata` reprend `ogImage` tel quel, et un chemin relatif
    // en `og:image` n'est pas résolu par les crawlers sociaux.
    ogImage: `${BRAND.url}${livre.jackets.product.webp}`,
    ogType: "website",
  });

  // Pas encore en vente ⇒ hors index. Voir l'en-tête du fichier.
  return estPublie(livre) ? base : { ...base, robots: "noindex, follow" };
}

export default async function FicheLivrePage({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale) || locale !== "fr") notFound();
  setRequestLocale(locale as Locale);

  const livre = livreParSlug(slug);
  if (livre === undefined) notFound();

  const publie = estPublie(livre);

  return (
    <>
      <JsonLd data={buildLivreJsonLd(livre)} />
      <Container className="border-border border-b py-3">
        <Breadcrumbs
          items={[
            { href: "/livres", label: "Livres" },
            { href: `/livres/${livre.slug}`, label: livre.title },
          ]}
        />
      </Container>

      <Section>
        <Container>
          <div className="grid gap-10 md:grid-cols-[minmax(0,320px)_1fr]">
            <figure className="m-0">
              {/*
                `<picture>` plutôt que `next/image` : la jaquette est un fichier STATIQUE,
                déjà décliné en AVIF et WebP aux dimensions exactes par la chaîne de
                fabrication du livre. La repasser dans l'optimiseur la ré-encoderait pour
                rien, et ferait diverger la couverture du site de celle vendue sur Amazon.
                `width`/`height` sont les dimensions réelles du fichier : c'est ce qui tient
                le CLS à 0, budget interne du dépôt.
              */}
              <picture>
                <source srcSet={livre.jackets.product.avif} type="image/avif" />
                <img
                  src={livre.jackets.product.webp}
                  alt={livre.coverAlt}
                  width={livre.jackets.product.width}
                  height={livre.jackets.product.height}
                  fetchPriority="high"
                  decoding="async"
                  className="h-auto w-full rounded-lg"
                  sizes="(max-width: 768px) 100vw, 320px"
                />
              </picture>
            </figure>

            <div>
              <header className="mb-8">
                <h1 className="mb-2">{livre.title}</h1>
                <p className="text-lg">{livre.subtitle}</p>
                <p className="mt-4">
                  <strong>{livre.author.name}</strong>
                  {livre.author.url === null ? null : (
                    <>
                      {" — "}
                      <a href={livre.author.url}>fiche auteur</a>
                    </>
                  )}
                </p>
                <p className="text-sm">
                  {livre.publisher} · édition {livre.editionLabel}
                  {livre.pageCount === null ? null : ` · ${livre.pageCount} pages`}
                </p>
              </header>

              <p className="text-xl">{livre.hook}</p>

              {publie && livre.publication.amazonUrl !== null ? (
                <p className="mt-6">
                  <a
                    href={livre.publication.amazonUrl}
                    rel="nofollow noopener"
                    className="inline-block rounded px-5 py-3 font-semibold"
                    style={{ background: "var(--color-terracotta)", color: "white" }}
                  >
                    Voir le livre sur Amazon
                  </a>
                </p>
              ) : (
                /*
                 * Pas de bouton mort, pas de « bientôt disponible » sans date : les deux
                 * usent la confiance pour rien. On dit ce qui est vrai — la parution n'est
                 * pas encore fixée — et on ne demande rien au lecteur.
                 */
                <p className="mt-6 text-sm">
                  Cet ouvrage n&apos;est pas encore en vente. Sa date de parution sera annoncée ici.
                </p>
              )}

              <section className="mt-10">
                <h2>Ce que contient ce livre</h2>
                {livre.summary.map((paragraphe) => (
                  <p key={paragraphe.slice(0, 48)}>{paragraphe}</p>
                ))}
              </section>

              {livre.excerpts.map((extrait) => (
                <section key={extrait.title} className="mt-10">
                  <h2>{extrait.title}</h2>
                  {extrait.body.map((paragraphe) => (
                    <p key={paragraphe.slice(0, 48)}>{paragraphe}</p>
                  ))}
                </section>
              ))}

              <section className="mt-10">
                <h2>À propos de l&apos;auteur</h2>
                <p>{livre.authorBio}</p>
              </section>

              {livre.categories.length === 0 ? null : (
                <section className="mt-10">
                  <h2>Catégories</h2>
                  <ul>
                    {livre.categories.map((categorie) => (
                      <li key={categorie}>{categorie}</li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
