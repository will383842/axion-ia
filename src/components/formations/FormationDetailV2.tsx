// Server Component — fiche DÉTAIL d'une formation du catalogue V2 (SSOT).
// Rendue par /formations/[slug] quand le slug est une formation du catalogue.
// Gated par la page appelante (flag OF). Prix dérivés de la matrice. 100 % FR.

import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { JsonLd } from "@/components/marketing/JsonLd";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import {
  type FormationV2,
  getFormationV2Brackets,
  getFormationV2EntryPrice,
  getFormationV2Price,
} from "@/content/formations/catalog-v2";
import {
  formationDureeIso,
  getDureeMeta,
  getGammeMeta,
} from "@/content/formations/catalog-v2-meta";
import { formatAmount, type FormationBracket } from "@/content/pricing";
import { buildCourseJsonLd } from "@/lib/seo";

const BRACKET_LABEL: Record<FormationBracket, string> = {
  "2-15": "2 à 15 personnes",
  "16-30": "16 à 30 personnes",
  "2-12": "2 à 12 personnes",
};

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-border bg-paper rounded-2xl border p-6 sm:p-8">
      <h2 className="text-fg mb-4 text-lg leading-tight font-semibold tracking-tight">{title}</h2>
      {children}
    </div>
  );
}

export function FormationDetailV2({
  formation,
  locale,
}: {
  formation: FormationV2;
  locale: string;
}): ReactNode {
  const duree = getDureeMeta(formation.duree);
  const gamme = getGammeMeta(formation.gamme);
  const brackets = getFormationV2Brackets(formation);
  const entryPrice = getFormationV2EntryPrice(formation);

  const faqItems = formation.faqs.map((f, i) => ({
    id: `${formation.id}-faq-${i}`,
    question: f.question,
    answer: f.reponse,
  }));

  const courseJsonLd = buildCourseJsonLd({
    locale,
    path: `/formations/${formation.slugFr}`,
    name: formation.titreFr,
    description: formation.accrocheFr,
    courseMode: ["Onsite", "Hybrid"],
    duration: formationDureeIso(formation.duree),
    audienceType: formation.publicViseFr,
    about: "Formation professionnelle IA opérationnelle — Axion-IA",
    ...(entryPrice ? { priceEurHt: entryPrice } : {}),
  });

  return (
    <>
      <JsonLd data={courseJsonLd} />

      {/* HERO */}
      <section className="bg-paper border-border border-b py-14 sm:py-18">
        <Container>
          <div className="max-w-3xl">
            <nav aria-label="Fil d'Ariane" className="mb-6">
              <ol className="text-fg-muted flex flex-wrap items-center gap-1.5 text-sm">
                <li>
                  <a
                    href={`/${locale}/formations`}
                    className="hover:text-terracotta transition-colors"
                  >
                    Formations
                  </a>
                </li>
                <li aria-hidden="true">/</li>
                <li>
                  <a
                    href={`/${locale}/formations/duree/${duree.slug}`}
                    className="hover:text-terracotta transition-colors"
                  >
                    {duree.shortFr}
                  </a>
                </li>
                <li aria-hidden="true">/</li>
                <li aria-current="page" className="text-fg font-medium">
                  {formation.titreFr}
                </li>
              </ol>
            </nav>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="border-border text-fg-muted rounded-full border px-3 py-1 text-[12px] font-semibold">
                {duree.shortFr}
              </span>
              {gamme.thematique ? (
                <span className="bg-sage-soft text-sage rounded-full px-3 py-1 text-[12px] font-semibold">
                  {gamme.labelFr}
                </span>
              ) : null}
              {formation.featured ? (
                <span className="bg-terracotta-soft text-terracotta-deep rounded-full px-3 py-1 text-[12px] font-semibold">
                  ★ À la une
                </span>
              ) : null}
            </div>

            <h1
              className="text-fg text-[clamp(2rem,4vw,3rem)] leading-tight font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {formation.h1Fr}
            </h1>
            <p className="text-fg-soft mt-5 text-lg leading-relaxed">{formation.accrocheFr}</p>

            <div className="border-border mt-8 flex flex-wrap items-center gap-4 rounded-2xl border bg-white p-5 sm:gap-6">
              <div>
                <p className="text-fg-muted mb-0.5 text-[11px] font-semibold tracking-wide uppercase">
                  Tarif
                </p>
                <p className="text-fg text-2xl font-semibold">
                  {entryPrice ? `à partir de ${formatAmount(entryPrice, "fr")}` : "Sur devis"}
                </p>
              </div>
              <div className="border-border hidden h-10 border-l sm:block" />
              <p className="text-fg-muted text-sm leading-snug">
                Tarif par groupe, en intra-entreprise. Prise en charge OPCO possible — nous montons
                le dossier.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Cta href="/reserver" size="lg" track={`formation-${formation.id}-reserver`}>
                Réserver au calendrier
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Cta>
              <Cta
                href="/appel"
                variant="outline"
                size="lg"
                track={`formation-${formation.id}-appel`}
              >
                Réserver un appel
              </Cta>
              <Cta
                href="/contact"
                variant="ghost"
                size="lg"
                track={`formation-${formation.id}-ecrire`}
              >
                Nous écrire
              </Cta>
            </div>
          </div>
        </Container>
      </section>

      {/* CORPS */}
      <section className="bg-sand py-14 sm:py-18">
        <Container>
          <div className="grid gap-5 lg:grid-cols-3 lg:gap-6">
            {/* Colonne principale */}
            <div className="space-y-5 lg:col-span-2">
              <SectionCard title="Ce que chacun saura faire">
                <ul className="space-y-2.5">
                  {formation.objectifsFr.map((o, i) => (
                    <li
                      key={i}
                      className="text-fg-soft flex items-start gap-2.5 text-[15px] leading-relaxed"
                    >
                      <span
                        aria-hidden="true"
                        className="bg-terracotta mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                      />
                      <span>{o}</span>
                    </li>
                  ))}
                </ul>
              </SectionCard>

              <SectionCard title="Déroulé">
                <div className="space-y-6">
                  {formation.programme.map((sec, si) => (
                    <div key={si}>
                      <p className="text-terracotta-deep mb-2 text-[13px] font-semibold tracking-wide uppercase">
                        {sec.titreFr}
                      </p>
                      <ul className="divide-border divide-y">
                        {sec.steps.map((st, ti) => (
                          <li key={ti} className="flex items-start gap-3 py-2">
                            {st.temps ? (
                              <span className="text-fg-muted w-16 shrink-0 text-[13px] font-medium tabular-nums">
                                {st.temps}
                              </span>
                            ) : null}
                            <span className="text-fg-soft text-[15px] leading-relaxed">
                              {st.titre}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Le bénéfice pour le dirigeant">
                <p className="text-fg-soft text-[15px] leading-relaxed">
                  {formation.beneficeDirigeantFr}
                </p>
                <p className="text-fg border-terracotta mt-4 border-l-2 pl-4 text-[15px] leading-relaxed font-medium">
                  ⏱️ {formation.equationTempsFr}
                </p>
              </SectionCard>
            </div>

            {/* Colonne latérale */}
            <aside className="space-y-5">
              <SectionCard title="Tarifs par effectif">
                <ul className="divide-border divide-y">
                  {brackets.map((b) => {
                    const p = getFormationV2Price(formation, b);
                    return (
                      <li key={b} className="flex items-center justify-between py-2.5">
                        <span className="text-fg-soft text-[15px]">{BRACKET_LABEL[b]}</span>
                        <span className="text-fg font-semibold tabular-nums">
                          {p ? formatAmount(p, "fr") : "Sur devis"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-fg-muted mt-3 text-[12px] leading-snug">
                  Par groupe, pas par personne. Hors frais de déplacement.
                </p>
              </SectionCard>

              <SectionCard title="Public visé">
                <p className="text-fg-soft text-[15px] leading-relaxed">{formation.publicViseFr}</p>
              </SectionCard>

              <SectionCard title="Pré-requis">
                <p className="text-fg-soft text-[15px] leading-relaxed">
                  {formation.prerequisFr ?? "Aucun pré-requis."}
                </p>
              </SectionCard>

              <SectionCard title="Durée & modalités">
                <p className="text-fg text-xl font-semibold">{duree.heuresFr}</p>
                <p className="text-fg-soft mt-2 text-[15px] leading-relaxed">
                  Intra-entreprise (présentiel ou distanciel), dans vos locaux, sur vos cas réels.
                </p>
              </SectionCard>

              <SectionCard title="Inclus">
                <ul className="text-fg-soft space-y-1.5 text-[14px] leading-relaxed">
                  <li>Attestation de fin de formation + certificat de réalisation</li>
                  <li>Supports et fiches pratiques par participant</li>
                  <li>Questionnaire de cadrage (15 min)</li>
                  <li>Évaluation des acquis</li>
                </ul>
              </SectionCard>

              <div className="bg-terracotta rounded-2xl p-6">
                <p className="text-paper mb-3 font-semibold">Intéressé·e par cette formation ?</p>
                <a
                  href={`/${locale}/reserver`}
                  className="bg-paper text-terracotta hover:bg-paper/90 inline-flex w-full items-center justify-center rounded-xl px-5 py-3 text-[14px] font-semibold transition-colors"
                >
                  Réserver au calendrier
                </a>
                <a
                  href={`/${locale}/appel`}
                  className="text-paper/85 hover:text-paper mt-2 inline-flex w-full items-center justify-center rounded-xl px-5 py-3 text-[14px] font-medium transition-colors"
                >
                  Réserver un appel
                </a>
                <a
                  href={`/${locale}/contact`}
                  className="text-paper/85 hover:text-paper inline-flex w-full items-center justify-center rounded-xl px-5 py-2 text-[14px] font-medium transition-colors"
                >
                  Nous écrire
                </a>
              </div>
            </aside>
          </div>
        </Container>
      </section>

      {/* FAQ — FaqAccordion injecte FAQPage JSON-LD */}
      <Section
        eyebrow="Questions fréquentes"
        title={formation.titreFr}
        titleEm="ce qu'on nous demande"
      >
        <Container>
          <FaqAccordion className="mx-auto max-w-3xl" items={faqItems} />
        </Container>
      </Section>
    </>
  );
}
