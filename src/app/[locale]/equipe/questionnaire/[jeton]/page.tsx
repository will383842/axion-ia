import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { routing } from "@/i18n/routing";
import { buttonVariants } from "@/components/ui/button";
import { ChampsQuestionnaire } from "@/components/equipe/questionnaire/ChampsQuestionnaire";
import { FormulaireQuestionnaire } from "@/components/equipe/questionnaire/FormulaireQuestionnaire";
import { envoyerQuestionnaireAction } from "@/server/actions/equipe/questionnaire";
import { MESSAGE_NEUTRE, lireInvitation } from "@/server/equipe/questionnaire/questionnaire";

// Page PRIVÉE, atteinte par le seul lien personnel : jamais dans le sitemap, aucun lien depuis le site,
// jamais indexée, et le jeton (dans l'adresse) ne part dans aucun en-tête Referer.
// Rendue à la demande : le jeton est lu en base (le build n'en a pas besoin).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Votre page sur le site",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

interface Props {
  params: Promise<{ locale: string; jeton: string }>;
}

export default async function QuestionnaireEquipePage({ params }: Props) {
  const { locale, jeton } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const lecture = await lireInvitation(jeton);

  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-6 pb-12 sm:pt-10">
      {lecture.etat === "ok" ? (
        <>
          <h1 className="text-fg font-serif text-3xl font-semibold">Votre page sur le site</h1>
          <p className="text-fg-soft mt-2 mb-6 text-sm leading-relaxed">
            Une dizaine de minutes. Seul votre prénom sera affiché. Votre page est relue avant sa
            mise en ligne, et rien n&apos;est publié sans votre accord.
          </p>
          <FormulaireQuestionnaire
            action={envoyerQuestionnaireAction}
            classeBouton={buttonVariants()}
            messageNeutre={MESSAGE_NEUTRE}
          >
            <ChampsQuestionnaire jeton={jeton} questions={lecture.invitation.questions} />
          </FormulaireQuestionnaire>
        </>
      ) : (
        <div role="alert" className="border-border bg-paper rounded-lg border p-6">
          <h1 className="text-fg font-serif text-xl font-semibold">
            Ce lien n&apos;est plus valable.
          </h1>
          <p className="text-fg-soft mt-2 text-sm">{MESSAGE_NEUTRE}</p>
        </div>
      )}
    </div>
  );
}
