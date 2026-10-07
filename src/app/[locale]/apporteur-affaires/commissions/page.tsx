// GRILLE DE RÉFÉRENCE des commissions — `/fr/apporteur-affaires/commissions` (2026-10-07).
//
// Le contrat 2.3 (annexe 1, A1.7) renvoie, pour un produit créé après la signature, à « la
// grille de référence publiée par la Société ». La voici, produit par produit, avec la date
// de publication ou de dernière modification de chaque tableau.
//
// 🔑 Aucun chiffre écrit ici : tout vient de `grilleDeReference()` (regles.ts + pricing.ts),
// que la garde `la-grille-de-reference-est-celle-du-contrat.spec.ts` compare au contrat.
// `noindex` et hors sitemap, comme le tunnel : c'est un document de référence pour les
// apporteurs, pas une page de prospection. Vouvoiement ; rien sur le parrainage ni Qualiopi.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";

import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { TunnelFacebookShell } from "@/components/recrutement/TunnelFacebookShell";
import { dateDeLaLigne, grilleDeReference } from "@/features/apporteurs-reseau/grille-reference";

export const revalidate = 3600;

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return {
    title: { absolute: "Grille de référence des commissions — Axion-IA" },
    description:
      "La grille de référence des commissions des apporteurs d'affaires d'Axion-IA, produit par produit, datée.",
    robots: { index: false, follow: false },
  };
}

/** « 05/10/2026 » depuis « 2026-10-05 ». */
const dateFr = (iso: string) => {
  const [a, m, j] = iso.split("-");
  return `${j}/${m}/${a}`;
};

export default async function Page({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale as Locale);
  const grille = grilleDeReference();

  return (
    <TunnelFacebookShell sousTitre="Apporteurs d'affaires">
      <Section tone="halo-warm" className="pt-10 pb-8 sm:pt-14 sm:pb-10">
        <div className="mx-auto max-w-3xl">
          <h1 className="display-editorial text-fg text-balance">
            Grille de référence des commissions
          </h1>
          <p className="text-fg-soft mt-4 text-lg leading-relaxed">
            Produits créés après la signature de votre contrat : annexe 1, A1.7. Les produits de
            votre contrat gardent la commission qui y figure.
          </p>
          <p className="text-fg-muted mt-3 text-sm">
            Montants hors taxes. Une commission est due dans les conditions de votre contrat.
          </p>
        </div>
      </Section>

      <Section className="py-8 sm:py-12">
        <div className="mx-auto grid max-w-3xl gap-10">
          {grille.map((t) => (
            <section key={t.cle} aria-labelledby={`grille-${t.cle.replace(/\s/g, "-")}`}>
              <h2
                id={`grille-${t.cle.replace(/\s/g, "-")}`}
                className="font-serif text-2xl font-medium"
              >
                {t.titre}
              </h2>
              <p className="text-fg-soft mt-1 text-sm">
                {t.regle} <span className="text-fg-muted">Publié le {dateFr(t.publieLe)}.</span>
              </p>
              <div className="border-border bg-paper mt-3 overflow-x-auto rounded-2xl border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-sand text-fg">
                    <tr>
                      {t.colonnes.map((c) => (
                        <th key={c} scope="col" className="px-3 py-2 font-semibold">
                          {c}
                        </th>
                      ))}
                      <th scope="col" className="px-3 py-2 font-semibold">
                        Depuis le
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.lignes.map((l) => (
                      <tr key={l.cellules.join("|")} className="border-border border-t">
                        {l.cellules.map((c, i) => (
                          <td
                            key={`${i}-${c}`}
                            className={
                              i === l.cellules.length - 1
                                ? "text-terracotta-deep px-3 py-2 font-semibold"
                                : "px-3 py-2"
                            }
                          >
                            {c}
                          </td>
                        ))}
                        <td className="text-fg-muted px-3 py-2 whitespace-nowrap">
                          {dateFr(dateDeLaLigne(t, l))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      </Section>
    </TunnelFacebookShell>
  );
}
