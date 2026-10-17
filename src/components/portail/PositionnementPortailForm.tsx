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

/**
 * Chantier QNC, L04 — le catalogue des mesures, reçu de la page (forme de
 * `cataloguePortail()`). Recopié en TYPE ici, et non importé : les composants
 * du portail ne tirent pas le domaine qualiopi (cloisonnement). Le serveur
 * revalide tout (`lireDeclaration`) ; ces aides ne décident que de l'affichage.
 */
export interface CatalogueAdaptation {
  readonly types: readonly { readonly code: string; readonly libelle: string }[];
  readonly mesures: readonly {
    readonly code: string;
    readonly libelle: string;
    readonly types: readonly string[];
    readonly complexe: boolean;
  }[];
  readonly champs: {
    readonly types: string;
    readonly mesures: string;
    readonly commentaire: string;
    readonly consentement: string;
    readonly choix: string;
  };
  readonly commentaireMax: number;
}

type ChoixAdaptation = "confirme" | "echange";

function mesuresDisponibles(catalogue: CatalogueAdaptation, types: readonly string[]) {
  return catalogue.mesures.filter((m) => m.types.some((t) => types.includes(t)));
}

function mesuresProposees(catalogue: CatalogueAdaptation, types: readonly string[]): string[] {
  return mesuresDisponibles(catalogue, types)
    .filter((m) => !m.complexe)
    .map((m) => m.code);
}

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
  /**
   * Chantier QNC, L04 — déclaration STRUCTURÉE du besoin (types, mesures
   * proposées, consentement séparé, confirmation ou échange). Absent : le
   * formulaire de toujours.
   */
  adaptationAutomatique?: boolean;
  /** Le catalogue des mesures — requis quand `adaptationAutomatique` est vrai. */
  catalogueAdaptation?: CatalogueAdaptation;
  soumettreAction: (input: {
    questionnaireId: string;
    reponses: Record<string, unknown>;
    noteGlobale?: number;
  }) => Promise<ActionResult<{ id: string }>>;
}

export function PositionnementPortailForm({
  questionnaireId,
  objectifs,
  adaptationAutomatique: adaptationDemandee = false,
  catalogueAdaptation,
  soumettreAction,
}: PositionnementPortailFormProps): React.ReactElement {
  const [fonction, setFonction] = useState("");
  const [secteur, setSecteur] = useState("");
  const [outilsUtilises, setOutilsUtilises] = useState("");
  const [frequence, setFrequence] = useState("");
  const [niveaux, setNiveaux] = useState<Record<number, number>>({});
  const [attentes, setAttentes] = useState("");
  const [tacheVisee, setTacheVisee] = useState("");
  /**
   * 🔴 2026-09-15 — `null` tant que la personne n'a PAS répondu.
   *
   * La question était une case à cocher « J'ai un besoin d'adaptation
   * (matériel, rythme, accessibilité, situation de handicap) ». Deux défauts,
   * vus sur la seule session réelle :
   *   · « matériel » et « rythme » sont des souhaits que tout participant peut
   *     avoir : une personne sans handicap ni contrainte de santé l'a cochée, et
   *     la console a affiché « besoin d'adaptation déclaré : oui » ;
   *   · une case NON cochée partait en `false` — « non » — même si la personne
   *     n'avait jamais lu la question.
   * La question vise désormais l'aménagement lié à un handicap, à la santé ou à
   * l'accessibilité, se répond par oui OU non, et ne part pas sans réponse. La
   * clé et son type ne changent pas : les réponses déjà en base gardent leur sens.
   */
  const [besoinAdaptation, setBesoinAdaptation] = useState<boolean | null>(null);
  const [detailAdaptation, setDetailAdaptation] = useState("");
  // Chantier QNC, L04 — déclaration structurée.
  const catalogue = catalogueAdaptation ?? null;
  const adaptationAutomatique = adaptationDemandee && catalogue !== null;
  const [typesBesoin, setTypesBesoin] = useState<string[]>([]);
  const [mesures, setMesures] = useState<string[]>([]);
  const [commentaire, setCommentaire] = useState("");
  const [consentement, setConsentement] = useState(false);
  const [choix, setChoix] = useState<ChoixAdaptation | null>(null);

  /** Cocher un type PROPOSE ses mesures standard ; décocher retire celles qui n'ont plus d'objet. */
  function basculerType(code: string) {
    if (catalogue === null) return;
    const suivants = typesBesoin.includes(code)
      ? typesBesoin.filter((t) => t !== code)
      : [...typesBesoin, code];
    const disponibles = new Set(mesuresDisponibles(catalogue, suivants).map((m) => m.code));
    const ajoutees = typesBesoin.includes(code)
      ? []
      : mesuresProposees(catalogue, [code]).filter((m) => !mesures.includes(m));
    setTypesBesoin(suivants);
    setMesures([...mesures, ...ajoutees].filter((m) => disponibles.has(m)));
  }

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Le besoin d'adaptation se répond, il ne se suppose pas : ni « non » par
    // défaut, ni envoi sans réponse.
    if (besoinAdaptation === null) {
      setError(
        "Indiquez si vous avez besoin d'un aménagement pour suivre la formation (oui ou non).",
      );
      return;
    }
    const besoin: boolean = besoinAdaptation;
    const structuree = adaptationAutomatique && besoin;
    if (structuree) {
      if (choix === null) {
        setError(
          "Confirmez les aménagements proposés, ou demandez un échange écrit avec le référent handicap.",
        );
        return;
      }
      if (consentement && typesBesoin.length === 0) {
        setError("Cochez au moins un type de besoin dans la liste.");
        return;
      }
      if (!consentement && choix === "confirme") {
        setError(
          "Sans votre accord pour transmettre ces précisions au référent handicap, choisissez l'échange écrit.",
        );
        return;
      }
      if (choix === "confirme" && mesures.length === 0) {
        setError(
          "Cochez au moins un aménagement, ou demandez un échange avec le référent handicap.",
        );
        return;
      }
    }

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
          besoinAdaptation: besoin,
          // Le serveur exige ce marqueur : un ancien formulaire en cache, qui
          // enverrait `false` sans avoir posé la question, ne le porte pas.
          // Clé écrite en toutes lettres (cloisonnement du domaine qualiopi) :
          // `CLE_BESOIN_ADAPTATION_REPONDU` côté serveur, verrouillée par les
          // deux specs (formulaire et action) qui assertent ce même littéral.
          besoinAdaptationRepondu: true,
          ...(!structuree && besoin && detailAdaptation.trim()
            ? { detailAdaptation: detailAdaptation.trim() }
            : {}),
          // Sans accord, aucune précision ne quitte le navigateur.
          ...(structuree && catalogue !== null
            ? {
                [catalogue.champs.consentement]: consentement,
                [catalogue.champs.choix]: choix,
                ...(consentement
                  ? {
                      [catalogue.champs.types]: typesBesoin,
                      [catalogue.champs.mesures]: mesures,
                      [catalogue.champs.commentaire]: commentaire.trim(),
                    }
                  : {}),
              }
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

      <fieldset className="rounded-md border border-gray-200 p-3">
        <legend className="px-1 text-sm font-medium text-gray-900">
          Avez-vous besoin d&apos;un aménagement pour suivre cette formation, en raison d&apos;un
          handicap, d&apos;un problème de santé ou d&apos;une difficulté d&apos;accès ?
        </legend>
        <p id="pos-besoin-aide" className="mt-1 text-xs text-gray-600">
          Par exemple : accès à la salle, supports agrandis, sous-titrage, pauses supplémentaires.
          Vos attentes sur le contenu ou le niveau se précisent plus haut, dans «
          Qu&apos;attendez-vous concrètement de cette formation ? ».
        </p>
        <div className="mt-2 flex flex-wrap gap-4" aria-describedby="pos-besoin-aide">
          <label className="flex items-center gap-2 text-sm text-gray-900">
            <input
              type="radio"
              name="pos-besoin-adaptation"
              value="non"
              checked={besoinAdaptation === false}
              onChange={() => setBesoinAdaptation(false)}
              disabled={isPending}
              required
            />
            Non, aucun aménagement
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-900">
            <input
              type="radio"
              name="pos-besoin-adaptation"
              value="oui"
              checked={besoinAdaptation === true}
              onChange={() => setBesoinAdaptation(true)}
              disabled={isPending}
              required
            />
            Oui, j&apos;ai besoin d&apos;un aménagement
          </label>
        </div>
        {besoinAdaptation === true && catalogue !== null && adaptationAutomatique && (
          <DeclarationStructuree
            catalogue={catalogue}
            types={typesBesoin}
            basculerType={basculerType}
            mesures={mesures}
            setMesures={setMesures}
            commentaire={commentaire}
            setCommentaire={setCommentaire}
            consentement={consentement}
            setConsentement={setConsentement}
            choix={choix}
            setChoix={setChoix}
            disabled={isPending}
            champ={champ}
          />
        )}
        {besoinAdaptation === true && !adaptationAutomatique && (
          <textarea
            value={detailAdaptation}
            onChange={(e) => setDetailAdaptation(e.target.value)}
            disabled={isPending}
            rows={2}
            maxLength={1000}
            placeholder="Précisez si vous le souhaitez — transmis de façon confidentielle au référent handicap."
            className={`${champ} mt-3`}
            aria-label="Précision sur le besoin d'aménagement"
          />
        )}
      </fieldset>

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

/**
 * Chantier QNC, L04 — la précision du besoin, sans donnée médicale : un TYPE
 * dans une liste, des AMÉNAGEMENTS proposés par le catalogue, un commentaire
 * facultatif, un CONSENTEMENT séparé, puis confirmer en un clic ou demander un
 * échange écrit.
 */
function DeclarationStructuree(props: {
  catalogue: CatalogueAdaptation;
  types: string[];
  basculerType: (t: string) => void;
  mesures: string[];
  setMesures: (m: string[]) => void;
  commentaire: string;
  setCommentaire: (c: string) => void;
  consentement: boolean;
  setConsentement: (c: boolean) => void;
  choix: ChoixAdaptation | null;
  setChoix: (c: ChoixAdaptation) => void;
  disabled: boolean;
  champ: string;
}): React.ReactElement {
  const disponibles = mesuresDisponibles(props.catalogue, props.types);
  return (
    <div className="mt-3 space-y-4">
      <p className="text-xs text-gray-600">
        Ces précisions sont transmises au seul référent handicap. N&apos;indiquez aucun diagnostic
        ni information médicale : le type de besoin et les aménagements souhaités suffisent.
      </p>

      <label className="flex items-start gap-2 rounded-md bg-gray-50 p-3 text-sm text-gray-900">
        <input
          type="checkbox"
          className="mt-1"
          checked={props.consentement}
          onChange={(e) => props.setConsentement(e.target.checked)}
          disabled={props.disabled}
        />
        <span>
          J&apos;accepte que ces précisions soient transmises au référent handicap de
          l&apos;organisme, pour organiser mes aménagements. Mon formateur ne reçoit que la liste
          des aménagements retenus.
        </span>
      </label>

      <fieldset disabled={props.disabled || !props.consentement}>
        <legend className="text-sm font-medium text-gray-900">Type de besoin</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {props.catalogue.types.map((t) => (
            <label key={t.code} className="flex items-center gap-2 text-sm text-gray-900">
              <input
                type="checkbox"
                checked={props.types.includes(t.code)}
                onChange={() => props.basculerType(t.code)}
              />
              {t.libelle}
            </label>
          ))}
        </div>
      </fieldset>

      {props.consentement && disponibles.length > 0 && (
        <fieldset disabled={props.disabled}>
          <legend className="text-sm font-medium text-gray-900">
            Aménagements proposés — décochez ceux qui ne vous servent pas
          </legend>
          <ul className="mt-2 space-y-2">
            {disponibles.map((m) => (
              <li key={m.code}>
                <label className="flex items-start gap-2 text-sm text-gray-900">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={props.mesures.includes(m.code)}
                    onChange={() =>
                      props.setMesures(
                        props.mesures.includes(m.code)
                          ? props.mesures.filter((x) => x !== m.code)
                          : [...props.mesures, m.code],
                      )
                    }
                  />
                  <span>
                    {m.libelle}
                    {m.complexe && (
                      <span className="block text-xs text-gray-600">
                        Le référent handicap vous répondra par écrit avant la formation.
                      </span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      {props.consentement && (
        <textarea
          value={props.commentaire}
          onChange={(e) => props.setCommentaire(e.target.value)}
          disabled={props.disabled}
          rows={2}
          maxLength={props.catalogue.commentaireMax}
          placeholder="Commentaire facultatif — sans information médicale."
          className={props.champ}
          aria-label="Commentaire facultatif sur l'aménagement souhaité"
        />
      )}

      <fieldset disabled={props.disabled} className="space-y-2">
        <legend className="text-sm font-medium text-gray-900">Votre choix</legend>
        <label className="flex items-center gap-2 text-sm text-gray-900">
          <input
            type="radio"
            name="pos-choix-adaptation"
            checked={props.choix === "confirme"}
            onChange={() => props.setChoix("confirme")}
            disabled={!props.consentement}
          />
          Je confirme ces aménagements
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-900">
          <input
            type="radio"
            name="pos-choix-adaptation"
            checked={props.choix === "echange"}
            onChange={() => props.setChoix("echange")}
          />
          Je préfère un échange écrit avec le référent handicap
        </label>
      </fieldset>
    </div>
  );
}
