"use client";
// use-client: bloc oui/non contrôlé, partagé par les formulaires de satisfaction v1 et v2.
/**
 * Chantier QNC, L04 — « les aménagements prévus pour vous vous ont-ils été
 * utiles ? ». Un seul bloc pour la v1 (`SatisfactionPortailForm`) et la v2 du
 * lot L08 (`SatisfactionV2PortailForm`) : même question, même clé.
 *
 * Clé écrite en toutes lettres (cloisonnement du domaine qualiopi) :
 * `CLE_AMENAGEMENTS_UTILES` côté serveur, verrouillée par la spec de l'action
 * qui asserte ce même littéral.
 */
export const CLE_AMENAGEMENTS_UTILES = "amenagementsUtiles";

export const MESSAGE_AMENAGEMENTS_SANS_REPONSE =
  "Indiquez si les aménagements prévus pour vous ont été utiles (oui ou non).";

export function QuestionAmenagementsUtiles({
  questionnaireId,
  valeur,
  onChange,
  desactive,
}: {
  questionnaireId: string;
  valeur: boolean | null;
  onChange: (v: boolean) => void;
  desactive: boolean;
}): React.ReactElement {
  return (
    <fieldset className="rounded-md border border-gray-200 p-3">
      <legend className="px-1 text-sm text-gray-700">
        Les aménagements prévus pour vous vous ont-ils été utiles ?
      </legend>
      <div className="mt-2 flex flex-wrap gap-4">
        {[true, false].map((oui) => (
          <label key={String(oui)} className="flex items-center gap-2 text-sm text-gray-900">
            <input
              type="radio"
              name={`amenagements-${questionnaireId}`}
              checked={valeur === oui}
              onChange={() => onChange(oui)}
              disabled={desactive}
              required
            />
            {oui ? "Oui" : "Non"}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
