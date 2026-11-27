// Questionnaire du Baromètre 2027 (`/[locale]/questionnaire-barometre-ia-2027`).
//
// Page diffusée par lien : `noindex`, hors du sitemap. Composant serveur, aucune lecture de la
// base. Texte d'information, puis le formulaire si la collecte est ouverte, sinon « fermé ».
// Le bloc `#retrait` est TOUJOURS présent : le retrait reste possible après la fermeture.

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { estOuvert } from "@/lib/barometre-questionnaire/constantes";
import {
  AIDES,
  DESCRIPTION_PAGE,
  DUREE,
  FERME,
  FORMULAIRE,
  H1,
  LIBELLES_QUESTIONS,
  Q1,
  Q2,
  Q3,
  Q4,
  Q4_NON,
  Q5,
  Q6,
  Q7,
  Q8,
  Q9,
  Q10,
  Q10_MAX,
  Q11,
  Q12,
  Q12_AVEC_SALARIES,
  Q13,
  Q14,
  RETRAIT,
  RGPD,
  SECTIONS,
  TEXTE_CONSENTEMENT,
  TITRE_PAGE,
} from "@/content/barometre-questionnaire/textes";
import {
  FormulaireBarometre,
  type QuestionsProp,
} from "@/components/barometre-questionnaire/FormulaireBarometre";
import { RetraitQuestionnaire } from "@/components/barometre-questionnaire/RetraitQuestionnaire";

interface Props {
  params: Promise<{ locale: string }>;
}

// Rendu dynamique : l'ouverture dépend de la date, jamais figée au build.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return {
    title: { absolute: TITRE_PAGE },
    description: DESCRIPTION_PAGE,
    robots: { index: false, follow: false },
  };
}

export default async function QuestionnaireBarometrePage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale) || locale !== "fr") notFound();
  setRequestLocale(locale);

  const ouvert = estOuvert(new Date());
  const questions: QuestionsProp = {
    libelles: LIBELLES_QUESTIONS,
    sections: SECTIONS,
    aides: AIDES,
    options: {
      q1: Q1,
      q2: Q2,
      q3: Q3,
      q4: Q4,
      q5: Q5,
      q6: Q6,
      q7: Q7,
      q8: Q8,
      q9: Q9,
      q10: Q10,
      q11: Q11,
      q12: Q12,
      q13: Q13,
      q14: Q14,
    },
    q4Non: Q4_NON,
    q12AvecSalaries: Q12_AVEC_SALARIES,
    q10Max: Q10_MAX,
    texteConsentement: TEXTE_CONSENTEMENT,
    textes: { ...FORMULAIRE, formulaire: H1 },
  };

  return (
    <div>
      <Container className="py-10 sm:py-14">
        <h1 className="text-3xl font-semibold">{H1}</h1>
        <p className="mt-3 text-sm">{DUREE}</p>

        <section aria-labelledby="bq-info" className="mt-6">
          <h2 id="bq-info" className="text-xl font-semibold">
            Mention d&apos;information
          </h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed">
            {RGPD.map((r) => (
              <li key={r.titre}>
                <strong>{r.titre}</strong> : {r.texte}
              </li>
            ))}
          </ul>
        </section>

        {ouvert ? (
          <FormulaireBarometre q={questions} />
        ) : (
          <section
            aria-labelledby="bq-ferme"
            className="mt-8 rounded-xl border border-black/15 p-5"
          >
            <h2 id="bq-ferme" className="text-lg font-semibold">
              {FERME.titre}
            </h2>
            <p className="mt-2 text-sm">{FERME.texte}</p>
          </section>
        )}

        <section id="retrait" aria-labelledby="bq-retrait-titre" className="mt-12 scroll-mt-6">
          <h2 id="bq-retrait-titre" className="text-2xl font-semibold">
            {RETRAIT.titre}
          </h2>
          <p className="mt-2 text-sm">{RETRAIT.intro}</p>
          <RetraitQuestionnaire t={RETRAIT} />
        </section>
      </Container>
    </div>
  );
}
