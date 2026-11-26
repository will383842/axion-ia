// Baromètre 2027 : l'IA dans les TPE et PME françaises (FR uniquement).
//
// Server component statique, zéro JS client, aucune image. Tous les chiffres
// viennent de `src/content/barometre-2027/donnees.ts` (fichier unique).
// Tant que BAROMETRE_2027_PUBLIC n'est pas "true" : noindex, et hors sitemap
// (cf. `src/app/sitemap.ts`).

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
import { buildBarometreJsonLd } from "@/content/barometre-2027/jsonld";
import {
  AUTRES_ECARTS,
  BAROMETRE_DESCRIPTION,
  BAROMETRE_PATH,
  BAROMETRE_TITRE,
  BAROMETRE_DATE_CONSULTATION,
  CHIFFRES_CLES,
  ELEMENTS_FRANCAIS,
  ENSEIGNEMENTS,
  EUROSTAT,
  EVOLUTION,
  FREINS_LIMITE,
  FREINS_UE27,
  LECTURE_EUROPE,
  LIMITES,
  METHODOLOGIE,
  PAR_SECTEUR,
  PAR_TAILLE,
  PAYANT_IMPACT,
  SOURCES,
  USAGES,
  VOCABULAIRE,
  barometrePublic,
  type Tableau,
} from "@/content/barometre-2027/donnees";

interface Props {
  params: Promise<{ locale: string }>;
}

export const revalidate = 86400;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (locale !== "fr" || !hasLocale(routing.locales, locale)) return {};
  const meta = await buildProductMetadata({
    locale,
    path: BAROMETRE_PATH,
    title: `${BAROMETRE_TITRE} · Axion-IA`,
    description: BAROMETRE_DESCRIPTION,
    ogType: "article",
  });
  if (barometrePublic()) return meta;
  return {
    ...meta,
    robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  };
}

function TableauDonnees({ t }: { t: Tableau }) {
  return (
    <div className="my-6 overflow-x-auto">
      <table className="border-border w-full border-collapse border text-left text-sm">
        <caption className="text-fg mb-2 text-left font-semibold">{t.titre}</caption>
        <thead>
          <tr className="bg-surface">
            {t.entetes.map((h) => (
              <th key={h} scope="col" className="border-border border p-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {t.lignes.map((ligne) => (
            <tr key={ligne[0]}>
              {ligne.map((cellule, i) =>
                i === 0 ? (
                  <th key={cellule} scope="row" className="border-border border p-2 font-normal">
                    {cellule}
                  </th>
                ) : (
                  <td key={`${ligne[0]}-${i}`} className="border-border border p-2">
                    {cellule}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-fg-soft mt-2 text-xs">{t.source}</p>
    </div>
  );
}

export default async function BarometrePage({ params }: Props) {
  const { locale } = await params;
  if (locale !== "fr" || !hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const jsonLd = buildBarometreJsonLd(locale as Locale);
  const breadcrumbItems = [
    { href: "/ressources", label: "Ressources" },
    { href: BAROMETRE_PATH, label: "Baromètre 2027 IA TPE/PME" },
  ];

  return (
    <>
      <JsonLd data={jsonLd.article} />
      <JsonLd data={jsonLd.dataset} />
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      <Section
        titleAs="h1"
        eyebrow="Baromètre 2027"
        title="L'IA dans les"
        titleEm="TPE et PME"
        titleTail="françaises"
        description="Chiffres publics sourcés : adoption par taille et par secteur, usages, impact déclaré, comparaison avec l'Europe."
      >
        <Container className="max-w-3xl">
          <article className="text-fg space-y-10 leading-relaxed">
            <section aria-labelledby="chiffres-cles" data-aeo="tldr" className="tldr-answer">
              <h2 id="chiffres-cles" className="text-2xl font-semibold">
                Les 5 chiffres clés
              </h2>
              <ol className="mt-4 list-decimal space-y-4 pl-5">
                {CHIFFRES_CLES.map((c) => (
                  <li key={c.valeur}>
                    <p>{c.phrase}</p>
                    <p className="text-fg-soft text-sm">Source : {c.source}.</p>
                  </li>
                ))}
              </ol>
              <p className="text-fg-soft mt-4 text-sm">
                Données consultées le {BAROMETRE_DATE_CONSULTATION}. Repères : {VOCABULAIRE}
              </p>
            </section>

            <section aria-labelledby="adoption">
              <h2 id="adoption" className="text-2xl font-semibold">
                Adoption de l&apos;IA selon la taille et le secteur
              </h2>
              <TableauDonnees t={EVOLUTION} />
              <TableauDonnees t={PAR_TAILLE} />
              <TableauDonnees t={PAR_SECTEUR} />
              <h3 className="text-lg font-semibold">Autres écarts relevés en 2026</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {AUTRES_ECARTS.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="usages">
              <h2 id="usages" className="text-2xl font-semibold">
                Usages les plus fréquents
              </h2>
              <TableauDonnees t={USAGES} />
              <ul className="list-disc space-y-2 pl-5">
                {PAYANT_IMPACT.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="freins">
              <h2 id="freins" className="text-2xl font-semibold">
                Freins déclarés
              </h2>
              <p className="mt-2">{FREINS_LIMITE}</p>
              <TableauDonnees t={FREINS_UE27} />
              <h3 className="text-lg font-semibold">
                Éléments français voisins (Baromètre France Num 2026)
              </h3>
              <p className="text-fg-soft mt-1 text-sm">
                Ils ne sont pas des freins à l&apos;IA au sens strict.
              </p>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                {ELEMENTS_FRANCAIS.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="europe">
              <h2 id="europe" className="text-2xl font-semibold">
                France et Europe
              </h2>
              <TableauDonnees t={EUROSTAT} />
              <p>{LECTURE_EUROPE}</p>
            </section>

            <section aria-labelledby="enseignements">
              <h2 id="enseignements" className="text-2xl font-semibold">
                Ce que cela veut dire pour un dirigeant de TPE ou PME
              </h2>
              <p className="text-fg-soft mt-2 text-sm">
                Ces enseignements décrivent des tendances ; ils ne promettent aucun résultat.
              </p>
              <ol className="mt-3 list-decimal space-y-3 pl-5">
                {ENSEIGNEMENTS.map((e) => (
                  <li key={e.titre}>
                    <strong>{e.titre}</strong> {e.texte}
                  </li>
                ))}
              </ol>
            </section>

            <section aria-labelledby="methodologie">
              <h2 id="methodologie" className="text-2xl font-semibold">
                Méthodologie
              </h2>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                {METHODOLOGIE.map((m) => (
                  <li key={m.slice(0, 40)}>{m}</li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="sources">
              <h2 id="sources" className="text-2xl font-semibold">
                Sources et limites
              </h2>
              <div className="my-4 overflow-x-auto">
                <table className="border-border w-full border-collapse border text-left text-sm">
                  <caption className="sr-only">Sources du baromètre</caption>
                  <thead>
                    <tr className="bg-surface">
                      <th scope="col" className="border-border border p-2">
                        Source
                      </th>
                      <th scope="col" className="border-border border p-2">
                        Précisions
                      </th>
                      <th scope="col" className="border-border border p-2">
                        Lien
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {SOURCES.map((s) => (
                      <tr key={s.id}>
                        <th scope="row" className="border-border border p-2 font-normal">
                          {s.nom}
                        </th>
                        <td className="border-border border p-2">{s.detail}</td>
                        <td className="border-border border p-2">
                          <a
                            href={s.url}
                            rel="noopener noreferrer"
                            target="_blank"
                            className="text-primary underline"
                          >
                            Consulter la source
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>{LIMITES}</p>
            </section>
          </article>
        </Container>
      </Section>
    </>
  );
}
