// Le questionnaire ouvert : la version pas à pas (JavaScript) et, pour un
// navigateur sans JavaScript, un formulaire d'un seul tenant qui poste la MÊME
// action avec les mêmes champs. Composant SERVEUR.

import { MAX_QUI_REPOND } from "@/server/visio/questionnaire-en-ligne/constantes";
import { envoyerReponsesAction } from "./actions";
import { QuestionnaireEnLigne, type QuestionAffichee } from "./QuestionnaireEnLigne";
import { dureeTotale, MESSAGES_ERREUR, mMinutes, nQuestions, TEXTES } from "./textes";

export function QuestionnaireComplet({
  questionnaireId,
  jeton,
  questions,
  erreur,
}: {
  readonly questionnaireId: string;
  readonly jeton: string;
  readonly questions: ReadonlyArray<QuestionAffichee>;
  readonly erreur: "vide" | "trop" | null;
}) {
  const n = questions.length;
  return (
    <>
      {/* Sans JavaScript : la version pas à pas est masquée, le formulaire
        d'un seul tenant ci-dessous prend sa place. */}
      <noscript>
        <style>{".questionnaire-js{display:none}"}</style>
      </noscript>
      <div className="questionnaire-js">
        <QuestionnaireEnLigne
          questionnaireId={questionnaireId}
          jeton={jeton}
          questions={questions}
          erreur={erreur}
        />
      </div>
      <noscript>
        <h1 className="font-serif text-[36px] leading-tight font-medium tracking-tight">
          {nQuestions(n)}, {mMinutes(dureeTotale(n))}
        </h1>
        <p className="text-fg-soft mt-3 text-[19px]">{TEXTES.accueilLigne}</p>
        {erreur ? (
          <p className="bg-terracotta-soft mt-5 rounded-2xl p-4 text-[18px] font-semibold">
            {MESSAGES_ERREUR[erreur]}
          </p>
        ) : null}
        <form action={envoyerReponsesAction} className="mt-6">
          <input type="hidden" name="questionnaireId" value={questionnaireId} />
          <input type="hidden" name="jeton" value={jeton} />
          <ol className="space-y-8">
            {questions.map((q, i) => (
              <li key={q.id}>
                <label htmlFor={`nojs-${q.id}`} className="block text-[20px] font-bold">
                  {i + 1}. {q.titre}
                </label>
                <p className="text-fg-soft mt-1 text-[18px]">
                  {q.aide ?? TEXTES.aideParDefaut}
                  {q.puces.length > 0 ? ` (${q.puces.join(", ")})` : ""}
                </p>
                <textarea
                  id={`nojs-${q.id}`}
                  name={`reponse_${q.id}`}
                  rows={3}
                  maxLength={5000}
                  className="border-border-strong bg-paper mt-2 w-full rounded-2xl border-2 p-4 text-[18px]"
                />
              </li>
            ))}
          </ol>
          <p className="text-fg-soft mt-6 text-[18px]">{TEXTES.sansJsAide}</p>
          <label htmlFor="nojs-repondant" className="mt-6 block text-[18px] font-semibold">
            {TEXTES.nomFonction}{" "}
            <span className="text-fg-soft font-normal">{TEXTES.nomFonctionAide}</span>
          </label>
          <input
            id="nojs-repondant"
            name="repondant"
            type="text"
            maxLength={MAX_QUI_REPOND}
            className="border-border-strong bg-paper mt-2 min-h-[56px] w-full rounded-2xl border-2 p-3 text-[18px]"
          />
          <p className="text-fg-soft mt-6 text-[18px] leading-relaxed">{TEXTES.definitif}</p>
          <button
            type="submit"
            className="bg-terracotta mt-6 min-h-[60px] w-full rounded-full px-8 text-[20px] font-bold text-white sm:w-auto"
          >
            {TEXTES.envoyer}
          </button>
        </form>
      </noscript>
    </>
  );
}
