/**
 * Page TARIFS du catalogue formations — /formations/tarifs.
 *
 * R5a (audit d'harmonie 08/11/2026, A04 / décision n°8 de Williams) : la page reste en ligne
 * (référencement) mais n'affiche AUCUN prix de formation — « sur devis », par groupe de 2 à 15
 * stagiaires, affichée par CATÉGORIE (offres générales / par métier / par secteur d'activité).
 * Le chiffrage se fait au rendez-vous gratuit de 45 minutes. Les montants restent dans la
 * matrice de pricing.ts (devis, réservation) : la page n'en lit plus aucun. Contenu 100 % FR.
 *
 * 2026-10-16 (L16, NC7) : « prix fixe, sans surprise » remplacé par les
 * conditions tarifaires réelles (`conditions-tarifaires.ts`, copie des CGV).
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { ArrowRight } from "lucide-react";

import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/layout/Container";
import { HeroBadge } from "@/components/marketing/HeroBadge";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { getFormationsV2ByCategorie, getSeminairesV2 } from "@/content/formations/catalog-v2";
import { FORMATION_CATEGORIES_META, SUR_MESURE } from "@/content/formations/catalog-v2-meta";
import { FORMATION_DUREE_FACTS } from "@/content/formations/catalog-v2-facts";
import { CONDITIONS_TARIFAIRES_FR } from "@/content/formations/conditions-tarifaires";
import { EFFECTIF_PLAGE_FR } from "@/content/formations/effectif";
import { buildProductMetadata } from "@/lib/seo";
import { QualiopiBadge } from "@/components/qualiopi/QualiopiBadge";
import { QualiopiFinancingFaq } from "@/components/qualiopi/QualiopiFinancingFaq";
import { FinancingBadges } from "@/components/qualiopi/FinancingBadges";
import { isQualiopiCertificationObtenue } from "@/server/qualiopi/config/flag";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  // Suffixe Qualiopi/finançable — GATED Phase B (claim illégal avant agrément).
  const qualiopiSuffix = isQualiopiCertificationObtenue()
    ? " Organisme certifié Qualiopi, formations finançables (OPCO, France Travail)."
    : "";
  return buildProductMetadata({
    locale,
    path: "/formations/tarifs",
    title: "Tarifs des formations IA en entreprise",
    description: `Formations IA intra-entreprise, sur devis, pour un groupe de ${EFFECTIF_PLAGE_FR} : jamais par personne. Offres générales, par métier, par secteur. Devis après un rendez-vous gratuit de 45 minutes.${qualiopiSuffix}`,
  });
}

/** Libellé durée d'une ligne tarif (« 4 heures », « 1 journée », « 2 journées — scindable 2×1j »). */
function dureeLabel(f: { duree: keyof typeof FORMATION_DUREE_FACTS; scindable?: boolean }): string {
  const d = FORMATION_DUREE_FACTS[f.duree];
  const base = f.duree === "4h" ? d.heuresLabelFr : d.joursLabelFr;
  return f.scindable ? `${base} — scindable 2×1j` : base;
}

export default async function TarifsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const seminaire = getSeminairesV2()[0];

  // Une table par catégorie — lignes dérivées du catalogue (jamais en dur).
  const tables = FORMATION_CATEGORIES_META.map((cat) => ({
    meta: cat,
    rows: getFormationsV2ByCategorie(cat.id).map((f) => ({ formation: f })),
  }));

  return (
    <>
      {/* HERO */}
      <section className="bg-halo-warm text-fg py-14 sm:py-16 lg:py-20">
        <Container>
          <HeroBadge className="mb-8 sm:mb-10">
            <span
              aria-hidden="true"
              className="bg-terracotta inline-block h-1.5 w-1.5 rounded-full"
            />
            Tarifs
          </HeroBadge>
          <div className="max-w-3xl">
            <h1 className="display-editorial text-fg">Tarifs des formations</h1>
            <p className="text-fg-soft mt-5 max-w-2xl text-lg leading-relaxed sm:text-xl">
              Nos formations sont chiffrées <strong className="text-fg">sur devis</strong>, pour{" "}
              <strong className="text-fg">tout un groupe</strong> ({EFFECTIF_PLAGE_FR} — jamais par
              personne), en intra-entreprise dans vos locaux ou à distance. Le devis vient après un
              rendez-vous gratuit de 45 minutes.
            </p>
            {/* Réassurance Qualiopi (Phase B) — rend null hors Phase B. */}
            <QualiopiBadge variant="inline" className="mt-6" />
          </div>
        </Container>
      </section>

      {/* GRILLES PAR CATÉGORIE — 3 tableaux dérivés du catalogue. */}
      <Section
        tone="canvas"
        eyebrow="Sur devis"
        title="Le catalogue,"
        titleEm="et ses conditions"
        description={`Un devis par formation, pour tout le groupe (${EFFECTIF_PLAGE_FR}). Les formations de 2 jours sont scindables en 2×1 jour, sans surcoût.`}
      >
        <Container>
          <div className="mx-auto flex max-w-4xl flex-col gap-10">
            {tables.map(({ meta, rows }) => (
              <div key={meta.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-fg text-xl font-semibold tracking-tight sm:text-2xl">
                    {meta.labelFr}
                  </h3>
                  {meta.slug ? (
                    <Link
                      href={`/formations/${meta.slug}` as never}
                      className="text-terracotta hover:text-terracotta-deep inline-flex items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline"
                    >
                      Voir les programmes
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  ) : null}
                </div>
                <div className="border-border bg-paper mt-4 overflow-x-auto rounded-2xl border">
                  <table className="w-full min-w-[560px] border-collapse text-left">
                    <thead>
                      <tr className="border-border text-fg-muted border-b text-[12px] font-semibold tracking-wide uppercase">
                        <th className="px-5 py-3">Formation</th>
                        <th className="px-5 py-3">Durée</th>
                        <th className="px-5 py-3 text-right">Tarif</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(({ formation: f }) => (
                        <tr key={f.id} className="border-border/60 border-b last:border-b-0">
                          <td className="px-5 py-3.5">
                            <Link
                              href={`/formations/${f.slugFr}` as never}
                              className="text-fg hover:text-terracotta font-medium underline-offset-4 hover:underline"
                            >
                              {f.titreFr}
                            </Link>
                            {f.axeLabelFr ? (
                              <span className="text-fg-muted ml-2 text-[12.5px]">
                                {f.axeLabelFr}
                              </span>
                            ) : null}
                          </td>
                          <td className="text-fg-soft px-5 py-3.5 text-[14px]">{dureeLabel(f)}</td>
                          <td className="text-fg px-5 py-3.5 text-right font-semibold tabular-nums">
                            Sur devis
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            {/* Séminaire — à part, sur devis (jusqu'à 50 participants). */}
            {seminaire ? (
              <div className="border-primary/40 bg-paper rounded-2xl border border-dashed p-6 sm:flex sm:items-center sm:justify-between sm:gap-6">
                <div>
                  <p className="text-fg text-lg font-semibold">
                    {seminaire.titreFr}{" "}
                    <span className="text-fg-muted font-normal">
                      · 1 journée · jusqu’à 50 participants
                    </span>
                  </p>
                  <p className="text-fg-soft mt-1 text-[15px] leading-relaxed">
                    Réunir toute l’entreprise le même jour — présentiel uniquement, sur devis.
                  </p>
                </div>
                <div className="mt-4 shrink-0 sm:mt-0">
                  <Link
                    href={`/formations/${seminaire.slugFr}` as never}
                    className="text-terracotta hover:text-terracotta-deep inline-flex items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline"
                  >
                    Découvrir le séminaire
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-terracotta/40 bg-paper mx-auto mt-10 max-w-4xl rounded-2xl border border-dashed p-6 text-center">
            <p className="text-fg text-lg font-semibold">
              Pas sûr que ce soit la bonne formation ?
            </p>
            <p className="text-fg-soft mt-2 text-[15px]">
              Prenez rendez-vous, gratuitement et sans engagement : 45 minutes pour faire le point
              sur vos besoins et vous orienter vers le format le plus adapté à votre équipe.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Cta href="/appel" size="lg">
                Réserver un appel
              </Cta>
              <Cta href="/contact" variant="outline" size="lg">
                Nous écrire
              </Cta>
            </div>
          </div>
        </Container>
      </Section>

      {/* CE QUI EST TOUJOURS INCLUS */}
      <Section tone="sand" eyebrow="Ce qui est inclus" title="Toujours" titleEm="inclus">
        <Container>
          <ul className="text-fg-soft mx-auto grid max-w-3xl gap-3 text-[15px] sm:grid-cols-2">
            {[
              "Formations 100 % pratiques, construites sur vos propres outils et cas d'usage",
              "Pratique sur vos vraies tâches et documents (anonymisés)",
              "Des méthodes et des prompts immédiatement applicables",
              "Supports et fiches pratiques remis à chaque participant",
              "Grille d'évaluation individuelle des acquis et attestation de fin de formation",
              "Aucune préparation requise de votre côté",
              "Présentiel dans vos locaux ou distanciel, au choix",
              "Formations de 2 jours scindables en 2×1 jour, sans surcoût",
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

      {/* CONDITIONS TARIFAIRES — copie des CGV (`conditions-tarifaires.ts`), qui
          tient la place de l'ancien slogan tarifaire. Texte opposable : les CGV. */}
      <Section
        tone="canvas"
        eyebrow="Avant de commander"
        title="Les conditions,"
        titleEm="telles qu'elles s'appliquent"
        description="Ce résumé reprend nos conditions générales de vente, qui seules font foi."
      >
        <Container>
          <dl className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2">
            {CONDITIONS_TARIFAIRES_FR.map((c) => (
              <div key={c.titre} className="border-border bg-paper rounded-2xl border p-6">
                <dt className="text-fg text-base font-semibold">{c.titre}</dt>
                <dd className="text-fg-soft mt-2 text-[15px] leading-relaxed">{c.texte}</dd>
              </div>
            ))}
          </dl>
          <p className="text-fg-muted mx-auto mt-4 max-w-4xl text-[13px]">
            Le texte complet figure dans nos{" "}
            <Link
              href="/conditions-generales"
              className="text-terracotta hover:text-terracotta-deep font-semibold underline underline-offset-4"
            >
              conditions générales de vente
            </Link>
            .
          </p>
        </Container>
      </Section>

      {/* SUR-MESURE — au-delà du catalogue */}
      {SUR_MESURE.length > 0 ? (
        <Section eyebrow="Au-delà du catalogue" title="Formats" titleEm="sur mesure">
          <Container>
            <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2">
              {SUR_MESURE.map((s) => (
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

      {/* Encart financement OPCO / France Travail — gaté Phase B (rend null hors
          Phase B). Aucun claim Qualiopi hors gate. */}
      <Section tone="canvas">
        <Container>
          <FinancingBadges seed="formations-tarifs" className="max-w-3xl" />
        </Container>
      </Section>

      {/* FAQ Financement & certification (FAQPage + Speakable) — gated Phase B. */}
      <QualiopiFinancingFaq />

      <CtaBlock
        eyebrow="Une question ?"
        title="On vous oriente vers le bon format"
        description="Un rendez-vous gratuit de 45 minutes suffit : besoins, équipe, format le plus adapté — sans engagement."
        cta={
          <Cta
            href="/appel"
            size="lg"
            className="bg-primary text-primary-fg hover:bg-primary-hover"
            track="formations-tarifs-ctablock"
          >
            Réserver un appel →
          </Cta>
        }
        tone="dark"
      />
    </>
  );
}
