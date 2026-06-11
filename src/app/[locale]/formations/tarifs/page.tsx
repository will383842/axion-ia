/**
 * Page TARIFS du catalogue formations V2 — /formations/tarifs. Affiche la
 * matrice de prix (gamme × durée × effectif) dérivée de pricing.ts — aucun prix
 * en dur. Public/live (décision Will 2026-06-11). Contenu 100 % FR.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";

import { routing } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { getSurMesureGlobal } from "@/content/formations/catalog-v2-meta";
import {
  type FormationBracket,
  type FormationDuree,
  type FormationGamme,
  formatAmount,
  formatFormationPrice,
  getFormationBrackets,
  getFormationCatalogPriceRange,
} from "@/content/pricing";
import { buildProductMetadata } from "@/lib/seo";

export const revalidate = 3600;

const DUREE_ROWS: ReadonlyArray<{ duree: FormationDuree; label: string }> = [
  { duree: "4h", label: "4 heures" },
  { duree: "1j", label: "1 jour" },
  { duree: "2j", label: "2 jours" },
  { duree: "3j", label: "3 jours" },
];

const GAMME_BLOCKS: ReadonlyArray<{ gamme: FormationGamme; label: string; note: string }> = [
  {
    gamme: "ia-standard",
    label: "Gamme IA",
    note: "Toutes les formations IA générales, par durée (effectif 2-15 ou 16-30).",
  },
  {
    gamme: "agents-automatisations",
    label: "Agents & Automatisations",
    note: "Groupes limités à 12 pour l'accompagnement individuel (code source, zéro abonnement).",
  },
  {
    gamme: "claude",
    label: "Gamme Claude",
    note: "Formateur certifié écosystème Claude (+20 %). Découverte 2-15/16-30 ; Créateur et Architecte 2-12.",
  },
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const { minEur, maxEur } = getFormationCatalogPriceRange();
  return buildProductMetadata({
    locale,
    path: "/formations/tarifs",
    title: "Tarifs des formations IA en entreprise | Axion-IA",
    description: `Tarifs HT par groupe (pas par personne) des formations IA intra-entreprise : de ${formatAmount(minEur, "fr")} (4 h) à ${formatAmount(maxEur, "fr")} (3 jours). Prise en charge OPCO possible — nous montons le dossier.`,
  });
}

export default async function TarifsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const surMesureGlobal = getSurMesureGlobal();

  return (
    <>
      {/* HERO */}
      <section className="bg-halo-warm text-fg py-14 sm:py-16 lg:py-20">
        <Container>
          <div className="max-w-3xl">
            <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
              <span
                aria-hidden="true"
                className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
              />
              Tarifs
            </p>
            <h1 className="display-editorial text-fg mt-5">Tarifs des formations</h1>
            <p className="text-fg-soft mt-5 max-w-2xl text-lg leading-relaxed sm:text-xl">
              Tarifs HT <strong className="text-fg">par groupe</strong> (pas par personne), en
              intra-entreprise dans vos locaux, hors frais de déplacement. Exemple : une journée
              pour 10 salariés revient à moins cher qu&apos;une formation catalogue en salle
              extérieure, sans déplacer vos équipes.
            </p>
          </div>
        </Container>
      </section>

      {/* MATRICE — un bloc par gamme */}
      {GAMME_BLOCKS.map((block, idx) => (
        <Section
          key={block.gamme}
          tone={idx % 2 === 0 ? "canvas" : "paper"}
          eyebrow="Grille tarifaire"
          title={block.label}
          description={block.note}
        >
          <Container>
            <div className="border-border overflow-hidden rounded-2xl border">
              <table className="w-full text-left text-[15px]">
                <thead className="bg-sand text-fg-muted text-[12px] font-semibold tracking-wide uppercase">
                  <tr>
                    <th className="px-4 py-3">Durée</th>
                    <th className="px-4 py-3">2 à 15 pers.</th>
                    <th className="px-4 py-3">16 à 30 pers.</th>
                    <th className="px-4 py-3">2 à 12 pers.</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {DUREE_ROWS.map((row) => {
                    const brackets = getFormationBrackets(block.gamme, row.duree);
                    if (brackets.length === 0) return null;
                    const cell = (b: FormationBracket) =>
                      brackets.includes(b)
                        ? formatFormationPrice(block.gamme, row.duree, b, "fr")
                        : "—";
                    return (
                      <tr key={row.duree} className="bg-paper">
                        <td className="text-fg px-4 py-3 font-semibold">{row.label}</td>
                        <td className="text-fg-soft px-4 py-3 tabular-nums">{cell("2-15")}</td>
                        <td className="text-fg-soft px-4 py-3 tabular-nums">{cell("16-30")}</td>
                        <td className="text-fg-soft px-4 py-3 tabular-nums">{cell("2-12")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Container>
        </Section>
      ))}

      {/* FINANCEMENT / INCLUS */}
      <Section
        tone="sand"
        eyebrow="Financement & inclus"
        title="Prise en charge"
        titleEm="OPCO possible"
        description="Les formations peuvent être prises en charge par votre OPCO (selon votre opérateur et votre accord de branche) — nous montons le dossier avec vous. La demande doit être faite avant la formation, jamais rétroactivement."
      >
        <Container>
          <ul className="text-fg-soft mx-auto grid max-w-3xl gap-3 text-[15px] sm:grid-cols-2">
            {[
              "Attestation de fin de formation + certificat de réalisation",
              "Supports et fiches pratiques remis à chaque participant",
              "Questionnaire de cadrage (15 min) — adaptation à votre métier",
              "Pratique sur vos vraies tâches et documents (anonymisés)",
              "Formateur qui apporte sa connexion 4G/5G de secours",
              "Sur mesure possible (toute durée, toute gamme) — sur devis",
            ].map((line, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span
                  aria-hidden="true"
                  className="bg-terracotta mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      {/* SUR-MESURE GLOBAL (toute durée / toute gamme) */}
      {surMesureGlobal.length > 0 ? (
        <Section eyebrow="Au-delà du catalogue" title="Sur mesure" titleEm="de A à Z">
          <Container>
            <div className="mx-auto grid max-w-3xl gap-4">
              {surMesureGlobal.map((s) => (
                <div
                  key={s.id}
                  className="border-border bg-paper flex flex-col items-start gap-3 rounded-3xl border border-dashed p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7"
                >
                  <div>
                    <p className="text-fg text-lg font-semibold">
                      {s.labelFr} <span className="text-fg-muted font-normal">· {s.dureeFr}</span>
                    </p>
                    <p className="text-fg-soft mt-1 text-[15px] leading-relaxed">
                      {s.descriptionFr}
                    </p>
                  </div>
                  <Cta href="/appel" size="lg" track="formations-tarifs-surmesure-global">
                    Demander un devis
                  </Cta>
                </div>
              ))}
            </div>
          </Container>
        </Section>
      ) : null}

      <CtaBlock
        eyebrow="Un devis ?"
        title="On chiffre votre besoin précisément"
        description="Devis sous 24-48 h, montage du dossier OPCO inclus. Vous pouvez nous écrire, réserver un appel, ou choisir directement au calendrier."
        cta={
          <Cta
            href="/appel"
            size="lg"
            className="bg-primary text-primary-fg hover:bg-primary-hover"
            track="formations-tarifs-ctablock"
          >
            Demander un devis →
          </Cta>
        }
        tone="dark"
      />
    </>
  );
}
