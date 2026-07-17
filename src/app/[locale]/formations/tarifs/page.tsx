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
import { HeroBadge } from "@/components/marketing/HeroBadge";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { SUR_MESURE } from "@/content/formations/catalog-v2-meta";
import { type FormationDuree, type FormationGamme } from "@/content/pricing";
import { buildProductMetadata } from "@/lib/seo";
import { QualiopiBadge } from "@/components/qualiopi/QualiopiBadge";
import { QualiopiFinancingFaq } from "@/components/qualiopi/QualiopiFinancingFaq";
import { FinancingBadges } from "@/components/qualiopi/FinancingBadges";
import { isQualiopiPublicDisclosureEnabled } from "@/server/qualiopi/config/flag";

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
    note: "Toutes les formations IA générales et métier : ChatGPT, Claude et Gemini, méthode AXION.",
  },
  {
    gamme: "claude",
    label: "Gamme Claude",
    note: "Les formations construites sur Claude (prise en main, maîtrise avancée, Claude Code) — formateur spécialiste de l'écosystème.",
  },
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  // Suffixe Qualiopi/finançable — GATED Phase B (claim illégal avant agrément).
  // Le flag est lu au runtime ; l'ISR (revalidate) régénère la meta en Phase B.
  const qualiopiSuffix = isQualiopiPublicDisclosureEnabled()
    ? " Organisme certifié Qualiopi, formations finançables (OPCO, France Travail)."
    : "";
  return buildProductMetadata({
    locale,
    path: "/formations/tarifs",
    title: "Tarifs des formations IA en entreprise",
    description: `Formations IA intra-entreprise sur devis : un tarif par groupe (jamais par personne), construit sur la durée (4 h à 3 jours), la gamme et la taille du groupe. Devis sous 24-48 h.${qualiopiSuffix}`,
  });
}

export default async function TarifsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const surMesure = SUR_MESURE;

  return (
    <>
      {/* HERO */}
      <section className="bg-halo-warm text-fg py-14 sm:py-16 lg:py-20">
        <Container>
          {/* Eyebrow → pastille centrée sur la page, au-dessus du contenu. */}
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
              Toutes nos formations sont <strong className="text-fg">sur devis</strong>, tarifées{" "}
              <strong className="text-fg">par groupe</strong> (jamais par personne), en
              intra-entreprise dans vos locaux ou à distance. Le devis est établi sous 24-48 h après
              un premier échange, et validé avant toute inscription.
            </p>
            {/* Réassurance Qualiopi (Phase B) — formations finançables OPCO /
                France Travail. Pastille texte seul, rend null hors Phase B. */}
            <QualiopiBadge variant="inline" className="mt-6" />
          </div>
        </Container>
      </section>

      {/* COMMENT SE CONSTRUIT VOTRE DEVIS — remplace l'ancienne grille chiffrée :
          le catalogue est 100 % sur devis (cohérence avec les fiches). */}
      <Section
        tone="canvas"
        eyebrow="Sur devis"
        title="Comment se construit"
        titleEm="votre devis"
        description="Trois facteurs, aucun montant caché par personne : le tarif est global pour votre groupe."
      >
        <Container>
          <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-3">
            {[
              {
                t: "La durée",
                d: DUREE_ROWS.map((r) => r.label).join(" · "),
              },
              {
                t: "La gamme",
                d: GAMME_BLOCKS.map((b) => b.label).join(" · "),
              },
              {
                t: "La taille du groupe",
                d: "Jusqu'à 15 participants (10 pour Claude Code, 50 pour le séminaire) — un seul groupe, vos équipes uniquement.",
              },
            ].map((f) => (
              <div key={f.t} className="border-border bg-paper rounded-2xl border p-6">
                <p className="text-fg text-lg font-semibold">{f.t}</p>
                <p className="text-fg-soft mt-2 text-[15px] leading-relaxed">{f.d}</p>
              </div>
            ))}
          </div>
          <div className="border-terracotta/40 bg-paper mx-auto mt-8 max-w-4xl rounded-2xl border border-dashed p-6 text-center">
            <p className="text-fg text-lg font-semibold">
              Demandez votre devis — réponse sous 24-48 h
            </p>
            <p className="text-fg-soft mt-2 text-[15px]">
              Un appel de 15 minutes ou un message suffit : nous revenons avec un devis détaillé,
              personnalisé et sans engagement.
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
              "Programme standardisé et éprouvé — applicable à votre secteur sans préparation",
              "Pratique sur vos vraies tâches et documents (anonymisés)",
              "Beaucoup de mise en pratique, pas de théorie passive",
              "Supports et fiches pratiques remis à chaque participant",
              "Attestation de fin de formation",
              "Aucune préparation requise de votre côté",
              "Cas d'usage transversaux, valables dans tout secteur d'activité",
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

      {/* SUR-MESURE — les 7 offres (par durée, par gamme, 100 % sur mesure) */}
      {surMesure.length > 0 ? (
        <Section eyebrow="Au-delà du catalogue" title="Formats" titleEm="sur mesure">
          <Container>
            <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2">
              {surMesure.map((s) => (
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

      {/* Encart financement OPCO / France Travail (badges neutres maison, aucun
          logo tiers). Gaté Phase B (rend null hors Phase B). Formulation variée
          et déterministe via le SSOT financing.ts. */}
      <Section tone="canvas">
        <Container>
          <FinancingBadges seed="formations-tarifs" className="max-w-3xl" />
        </Container>
      </Section>

      {/* FAQ Financement & certification (FAQPage + Speakable) — gated Phase B,
          rend null hors Phase B. */}
      <QualiopiFinancingFaq />

      <CtaBlock
        eyebrow="Un devis ?"
        title="On chiffre votre besoin précisément"
        description="Devis sous 24-48 h. Vous pouvez nous écrire, réserver un appel, ou choisir directement au calendrier."
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
