/**
 * Espace formateur — « Évaluation finale » d'une session (lot L08).
 *
 * Pour chaque stagiaire : une note ET une observation par objectif, puis les
 * recommandations facultatives. La grille d'évaluation PDF est produite à partir
 * de cette saisie. Composant SERVEUR, formulaires HTML simples (pas de
 * JavaScript client) ; les champs portent les mêmes bornes que le service, qui
 * reste l'autorité.
 */

import { saisirEvaluationFinaleFormAction } from "@/server/actions/formateur/evaluation-finale.actions";
import { MESSAGES_EVALUATION } from "@/server/formateur/evaluation-finale-messages";
import {
  OBSERVATION_MAX,
  OBSERVATION_MIN,
  RECOMMANDATIONS_MAX,
} from "@/server/qualiopi/pedagogie/saisie-evaluation";
import type { VueSaisie } from "@/server/qualiopi/pedagogie/saisie-evaluation-service";

const NOTES = [
  { valeur: "1", libelle: "Non acquis" },
  { valeur: "2", libelle: "En cours" },
  { valeur: "3", libelle: "Acquis" },
] as const;

const NIVEAU: Record<string, string> = {
  non_acquis: "Non acquis",
  partiellement_acquis: "En cours",
  acquis: "Acquis",
};

const BOUTON =
  "bg-terracotta inline-flex min-h-12 w-full items-center justify-center rounded-lg px-5 text-base font-semibold text-white hover:opacity-90 sm:w-auto";
const CHOIX =
  "border-border text-mocha peer-checked:bg-terracotta peer-checked:border-terracotta peer-focus-visible:ring-terracotta flex min-h-12 items-center justify-center rounded-lg border px-3 text-center text-sm font-medium peer-checked:text-white peer-focus-visible:ring-2";
const CHAMP = "border-border text-mocha w-full rounded-lg border p-3 text-sm";

export function EvaluationFinaleFormateur({
  sessionId,
  vue,
  issue,
}: {
  readonly sessionId: string;
  readonly vue: VueSaisie;
  /** Le retour du dernier geste (`?evaluation=`), ou `null`. */
  readonly issue: string | null;
}): React.ReactElement {
  const message =
    issue !== null && Object.hasOwn(MESSAGES_EVALUATION, issue)
      ? MESSAGES_EVALUATION[issue as keyof typeof MESSAGES_EVALUATION]
      : undefined;
  const evalues = vue.stagiaires.filter((s) => s.finale !== null).length;

  return (
    <section
      id="evaluation-finale"
      aria-labelledby="evaluation-finale-titre"
      className="border-border scroll-mt-24 space-y-4 rounded-lg border p-4 sm:p-5"
    >
      <h2 id="evaluation-finale-titre" className="text-espresso font-serif text-xl">
        Évaluation finale{" "}
        <span className="text-fg-muted text-base font-normal">
          ({evalues} sur {vue.stagiaires.length})
        </span>
      </h2>
      <p className="text-mocha text-sm">
        Pour chaque objectif : une note et votre observation. La grille d&apos;évaluation est
        produite à partir de ce que vous saisissez.
      </p>
      {message !== undefined ? (
        <p
          role="status"
          className={`rounded-md px-3 py-2 text-sm font-medium ${message.ok ? "bg-sand text-mocha" : "border-terracotta text-mocha border"}`}
        >
          {message.texte}
        </p>
      ) : null}

      {vue.stagiaires.length === 0 ? (
        <p className="text-fg-muted text-sm">Aucun stagiaire à évaluer.</p>
      ) : (
        <ul className="space-y-3">
          {vue.stagiaires.map((s) => (
            <li key={s.enrollmentId} className="border-border rounded-lg border p-3">
              <p className="text-mocha font-medium">
                {s.prenom} {s.nom}
              </p>
              {s.finale !== null ? (
                <p className="text-fg-muted mt-1 text-sm">
                  ✓ Évalué : {NIVEAU[s.finale.niveauGlobal] ?? s.finale.niveauGlobal} ·{" "}
                  {s.finale.reussite ? "réussite" : "non validé"}
                </p>
              ) : (
                <form action={saisirEvaluationFinaleFormAction} className="mt-2 space-y-4">
                  <input type="hidden" name="sessionId" value={sessionId} />
                  <input type="hidden" name="enrollmentId" value={s.enrollmentId} />
                  {vue.objectifs.map((objectif, k) => (
                    <fieldset key={objectif} className="space-y-1.5">
                      <legend className="text-mocha text-sm font-medium">{objectif}</legend>
                      <div className="grid grid-cols-3 gap-2">
                        {NOTES.map((n) => (
                          <label key={n.valeur} className="cursor-pointer">
                            <input
                              type="radio"
                              name={`note-${k}`}
                              value={n.valeur}
                              required
                              className="peer sr-only"
                            />
                            <span className={CHOIX}>{n.libelle}</span>
                          </label>
                        ))}
                      </div>
                      <label
                        className="text-fg-muted block text-xs"
                        htmlFor={`obs-${s.enrollmentId}-${k}`}
                      >
                        Votre observation (obligatoire)
                      </label>
                      <textarea
                        id={`obs-${s.enrollmentId}-${k}`}
                        name={`observation-${k}`}
                        required
                        minLength={OBSERVATION_MIN}
                        maxLength={OBSERVATION_MAX}
                        rows={2}
                        className={CHAMP}
                      />
                    </fieldset>
                  ))}
                  <div className="space-y-1.5">
                    <label
                      className="text-fg-muted block text-xs"
                      htmlFor={`rec-${s.enrollmentId}`}
                    >
                      Recommandations (facultatif)
                    </label>
                    <textarea
                      id={`rec-${s.enrollmentId}`}
                      name="recommandations"
                      maxLength={RECOMMANDATIONS_MAX}
                      rows={2}
                      className={CHAMP}
                    />
                  </div>
                  <button type="submit" className={BOUTON}>
                    Enregistrer l&apos;évaluation
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
