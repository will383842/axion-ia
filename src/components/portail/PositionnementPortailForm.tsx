"use client";
// use-client: formulaire interactif de positionnement (auto-évaluation + attentes) avec useTransition.
/**
 * PositionnementPortailForm — Questionnaire de POSITIONNEMENT du portail stagiaire.
 *
 * 🔴 Audit certification 2026-07-26 (F17). Le portail rendait `SatisfactionPortailForm`
 * pour les TROIS types de questionnaire (`positionnement`, `satisfaction_chaud`,
 * `satisfaction_froid`) sans jamais tester `q.type` : le bénéficiaire recevait une
 * demande de note /5 AVANT la formation. Aucune analyse du besoin n'était donc
 * collectée — et remplir la base n'y aurait rien changé, la donnée recueillie étant
 * une satisfaction, pas un besoin.
 *
 * Ce formulaire couvre :
 *   - off.4  ⭐ Analyse du besoin du bénéficiaire (contexte, attentes, tâche visée)
 *   - off.8     Positionnement et évaluation des acquis à l'entrée (auto-évaluation
 *               objectif par objectif, comparable à l'évaluation finale)
 *   - off.26 ⭐ Situations de handicap (besoin d'adaptation déclaré en amont)
 *
 * Réponses stockées dans `Questionnaire.reponses` (Json), sans `noteGlobale` :
 * un positionnement ne se note pas.
 *
 * Sobre (charte publique — PAS de tokens admin). Français, apostrophes JSX échappées.
 */

import { useState, useTransition } from "react";

type ActionResult<T> = { data: T } | { error: string };

/**
 * Échelle de maîtrise déclarée — VOLONTAIREMENT identique à celle de
 * l'évaluation des acquis (`scoring.ts` : 1 non acquis, 2 en cours, 3 acquis).
 *
 * 🔴 Audit certification 2026-07-26 (F24). Ce formulaire notait d'abord sur
 * QUATRE niveaux. Chaque indicateur tenait isolément — le 8 comme le 11 — mais
 * l'auditrice ne demande pas « avez-vous un positionnement ? » puis « avez-vous
 * une évaluation ? » : elle demande de montrer la PROGRESSION entre l'entrée et
 * la sortie. Avec deux échelles différentes, cette démonstration se refaisait à
 * la main, dossier par dossier.
 *
 * Les libellés restent formulés à la première personne (c'est une
 * auto-évaluation, pas une notation), mais les valeurs sont les mêmes, et la
 * clé est le libellé de l'objectif des deux côtés : entrée et sortie se
 * superposent objectif par objectif.
 */
const NIVEAUX = [
  { valeur: 1, label: "Je découvre" },
  { valeur: 2, label: "Quelques notions" },
  { valeur: 3, label: "Je maîtrise" },
] as const;

const FREQUENCES = [
  "Jamais",
  "Quelques fois par an",
  "Quelques fois par mois",
  "Chaque semaine",
  "Tous les jours",
] as const;

interface PositionnementPortailFormProps {
  questionnaireId: string;
  /** Objectifs pédagogiques de la formation — auto-évaluation objectif par objectif. */
  objectifs: string[];
  soumettreAction: (input: {
    questionnaireId: string;
    reponses: Record<string, unknown>;
    noteGlobale?: number;
  }) => Promise<ActionResult<{ id: string }>>;
}

export function PositionnementPortailForm({
  questionnaireId,
  objectifs,
  soumettreAction,
}: PositionnementPortailFormProps): React.ReactElement {
  const [fonction, setFonction] = useState("");
  const [secteur, setSecteur] = useState("");
  const [outilsUtilises, setOutilsUtilises] = useState("");
  const [frequence, setFrequence] = useState("");
  const [niveaux, setNiveaux] = useState<Record<number, number>>({});
  const [attentes, setAttentes] = useState("");
  const [tacheVisee, setTacheVisee] = useState("");
  const [besoinAdaptation, setBesoinAdaptation] = useState(false);
  const [detailAdaptation, setDetailAdaptation] = useState("");

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Un positionnement ne se note pas : on n'envoie JAMAIS de noteGlobale ici.
    // C'est ce qui distingue cette réponse d'une satisfaction dans les indicateurs.
    startTransition(async () => {
      const result = await soumettreAction({
        questionnaireId: questionnaireId,
        reponses: {
          fonction: fonction.trim(),
          secteur: secteur.trim(),
          outilsUtilises: outilsUtilises.trim(),
          frequenceUsage: frequence,
          // Auto-évaluation : { "<objectif>": 1..4 } — comparable à l'évaluation finale.
          niveauParObjectif: Object.fromEntries(
            objectifs.map((o, i) => [o, niveaux[i] ?? null]).filter(([, v]) => v !== null),
          ),
          attentes: attentes.trim(),
          tacheVisee: tacheVisee.trim(),
          besoinAdaptation,
          ...(besoinAdaptation && detailAdaptation.trim()
            ? { detailAdaptation: detailAdaptation.trim() }
            : {}),
        },
      });

      if ("error" in result) setError(result.error);
      else setSuccess(true);
    });
  }

  if (success) {
    return (
      <p className="text-sm text-green-700">
        Merci. Vos réponses nous permettent d&apos;adapter la formation à votre situation.
      </p>
    );
  }

  const champ =
    "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none";
  const libelle = "mb-1 block text-sm font-medium text-gray-900";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="text-sm text-gray-600">
        Ces questions nous servent à adapter le contenu à votre niveau et à vos besoins. Il n&apos;y
        a pas de bonne ou de mauvaise réponse.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="pos-fonction" className={libelle}>
            Votre fonction
          </label>
          <input
            id="pos-fonction"
            value={fonction}
            onChange={(e) => setFonction(e.target.value)}
            disabled={isPending}
            maxLength={120}
            className={champ}
          />
        </div>
        <div>
          <label htmlFor="pos-secteur" className={libelle}>
            Votre secteur d&apos;activité
          </label>
          <input
            id="pos-secteur"
            value={secteur}
            onChange={(e) => setSecteur(e.target.value)}
            disabled={isPending}
            maxLength={120}
            className={champ}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="pos-outils" className={libelle}>
            Quels outils d&apos;IA utilisez-vous déjà ?
          </label>
          <input
            id="pos-outils"
            value={outilsUtilises}
            onChange={(e) => setOutilsUtilises(e.target.value)}
            disabled={isPending}
            maxLength={200}
            placeholder="Aucun, ou : ChatGPT, Copilot…"
            className={champ}
          />
        </div>
        <div>
          <label htmlFor="pos-frequence" className={libelle}>
            À quelle fréquence ?
          </label>
          <select
            id="pos-frequence"
            value={frequence}
            onChange={(e) => setFrequence(e.target.value)}
            disabled={isPending}
            className={champ}
          >
            <option value="">—</option>
            {FREQUENCES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
      </div>

      {objectifs.length > 0 && (
        <fieldset>
          <legend className={libelle}>
            Sur les objectifs de cette formation, où vous situez-vous aujourd&apos;hui ?
          </legend>
          <ul className="mt-2 space-y-3">
            {objectifs.map((objectif, i) => (
              <li key={objectif} className="rounded-md bg-gray-50 p-3">
                <p className="mb-2 text-sm text-gray-900">{objectif}</p>
                <div className="flex flex-wrap gap-2">
                  {NIVEAUX.map((n) => (
                    <button
                      key={n.valeur}
                      type="button"
                      disabled={isPending}
                      onClick={() => setNiveaux((prev) => ({ ...prev, [i]: n.valeur }))}
                      aria-pressed={niveaux[i] === n.valeur}
                      className={`rounded-full border px-3 py-1 text-xs transition ${
                        niveaux[i] === n.valeur
                          ? "border-gray-900 bg-gray-900 text-white"
                          : "border-gray-300 bg-white text-gray-700 hover:border-gray-500"
                      }`}
                    >
                      {n.label}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      <div>
        <label htmlFor="pos-attentes" className={libelle}>
          Qu&apos;attendez-vous concrètement de cette formation ?
        </label>
        <textarea
          id="pos-attentes"
          value={attentes}
          onChange={(e) => setAttentes(e.target.value)}
          disabled={isPending}
          rows={3}
          maxLength={1000}
          className={champ}
        />
      </div>

      <div>
        <label htmlFor="pos-tache" className={libelle}>
          Quelle tâche de votre quotidien aimeriez-vous voir traitée ?
        </label>
        <textarea
          id="pos-tache"
          value={tacheVisee}
          onChange={(e) => setTacheVisee(e.target.value)}
          disabled={isPending}
          rows={2}
          maxLength={1000}
          className={champ}
        />
      </div>

      <div className="rounded-md border border-gray-200 p-3">
        <label className="flex items-start gap-2 text-sm text-gray-900">
          <input
            type="checkbox"
            checked={besoinAdaptation}
            onChange={(e) => setBesoinAdaptation(e.target.checked)}
            disabled={isPending}
            className="mt-0.5"
          />
          <span>
            J&apos;ai un besoin d&apos;adaptation (matériel, rythme, accessibilité, situation de
            handicap)
          </span>
        </label>
        {besoinAdaptation && (
          <textarea
            value={detailAdaptation}
            onChange={(e) => setDetailAdaptation(e.target.value)}
            disabled={isPending}
            rows={2}
            maxLength={1000}
            placeholder="Précisez si vous le souhaitez — transmis au référent handicap."
            className={`${champ} mt-3`}
            aria-label="Précision sur le besoin d'adaptation"
          />
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? "Envoi…" : "Envoyer mes réponses"}
      </button>
    </form>
  );
}
