"use client";
// use-client: précision interactive du besoin (cases, consentement, choix), état tenu par le parent.
/**
 * Chantier QNC, L04 — la précision du besoin, sans donnée médicale : un TYPE
 * dans une liste, des AMÉNAGEMENTS proposés par le catalogue, un commentaire
 * facultatif, un CONSENTEMENT séparé, puis confirmer en un clic ou demander un
 * échange écrit.
 *
 * Fichier À PART, chargé par `next/dynamic` depuis `PositionnementPortailForm`,
 * et seulement après un « oui » avec l'interrupteur allumé : ce bloc ne pèse
 * rien sur le premier chargement du portail (cliquet du bundle public, Gate B).
 * L'état reste chez le parent ; la règle d'envoi (`declarationAEnvoyer`) vit ici.
 */

import type { CatalogueAdaptation, ChoixAdaptation } from "./PositionnementPortailForm";

function mesuresDisponibles(catalogue: CatalogueAdaptation, types: readonly string[]) {
  return catalogue.mesures.filter((m) => m.types.some((t) => types.includes(t)));
}

/**
 * Ce que la déclaration ajoute aux réponses, ou l'erreur qui en empêche l'envoi.
 * Sans consentement, seuls l'accord (refusé) et le choix partent : ni type, ni
 * mesure, ni commentaire. Le serveur revalide tout (`lireDeclaration`).
 */
export function declarationAEnvoyer(
  catalogue: CatalogueAdaptation,
  e: {
    types: string[];
    mesures: string[];
    commentaire: string;
    consentement: boolean;
    choix: ChoixAdaptation | null;
  },
): { erreur: string } | { reponses: Record<string, unknown> } {
  if (e.choix === null) {
    return {
      erreur:
        "Confirmez les aménagements proposés, ou demandez un échange écrit avec le référent handicap.",
    };
  }
  if (e.consentement && e.types.length === 0) {
    return { erreur: "Cochez au moins un type de besoin dans la liste." };
  }
  if (!e.consentement && e.choix === "confirme") {
    return {
      erreur:
        "Sans votre accord pour transmettre ces précisions au référent handicap, choisissez l'échange écrit.",
    };
  }
  if (e.choix === "confirme" && e.mesures.length === 0) {
    return {
      erreur: "Cochez au moins un aménagement, ou demandez un échange avec le référent handicap.",
    };
  }
  const c = catalogue.champs;
  return {
    reponses: {
      [c.consentement]: e.consentement,
      [c.choix]: e.choix,
      ...(e.consentement
        ? { [c.types]: e.types, [c.mesures]: e.mesures, [c.commentaire]: e.commentaire.trim() }
        : {}),
    },
  };
}

export default function DeclarationStructureePortail(props: {
  catalogue: CatalogueAdaptation;
  types: string[];
  setTypes: (t: string[]) => void;
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
  const { catalogue, types, mesures } = props;
  const disponibles = mesuresDisponibles(catalogue, types);

  /** Cocher un type PROPOSE ses mesures standard ; décocher retire celles qui n'ont plus d'objet. */
  function basculerType(code: string) {
    const coche = types.includes(code);
    const suivants = coche ? types.filter((t) => t !== code) : [...types, code];
    const restent = new Set(mesuresDisponibles(catalogue, suivants).map((m) => m.code));
    const ajoutees = coche
      ? []
      : mesuresDisponibles(catalogue, [code])
          .filter((m) => !m.complexe && !mesures.includes(m.code))
          .map((m) => m.code);
    props.setTypes(suivants);
    props.setMesures([...mesures, ...ajoutees].filter((m) => restent.has(m)));
  }

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
          {catalogue.types.map((t) => (
            <label key={t.code} className="flex items-center gap-2 text-sm text-gray-900">
              <input
                type="checkbox"
                checked={types.includes(t.code)}
                onChange={() => basculerType(t.code)}
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
                    checked={mesures.includes(m.code)}
                    onChange={() =>
                      props.setMesures(
                        mesures.includes(m.code)
                          ? mesures.filter((x) => x !== m.code)
                          : [...mesures, m.code],
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
          maxLength={catalogue.commentaireMax}
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
