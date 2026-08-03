/**
 * IndicateursResultatsPublic — diffusion publique des indicateurs de résultats
 * de l'organisme (indicateur RNQ 2 : « Indicateurs de résultats adaptés à la
 * nature des prestations »).
 *
 * Server Component présentationnel (aucun JS client). Affiche les 4 indicateurs
 * calculés par `getIndicateurs` avec leur MÉTHODE. Chaque valeur est déjà
 * libellée « En cours de constitution » par le service tant que l'échantillon
 * n'est pas fiable (n < 5) → JAMAIS de chiffre creux ou fabriqué (conforme
 * L.121-2 : aucune allégation trompeuse). Rendu uniquement sur la page publique
 * Qualiopi, elle-même gatée par `OF_PUBLIC_DISCLOSURE_ENABLED`.
 */

import type { IndicateursResult } from "@/server/qualiopi/indicateurs/service";

interface Props {
  result: IndicateursResult;
  isFr: boolean;
}

interface Tuile {
  labelFr: string;
  labelEn: string;
  valeur: string;
  methode: string;
  fiable: boolean;
}

export function IndicateursResultatsPublic({ result, isFr }: Props): React.ReactElement {
  // Le délai d'accès se contentait de `nb > 0` : une « moyenne » calculée sur
  // UNE session s'affichait publiquement comme un résultat établi, alors que
  // les trois taux voisins exigent cinq observations avant de sortir de
  // « En cours de constitution ». Sur une page que lisent les auditeurs et les
  // financeurs, la même règle vaut pour les quatre.
  const delaiFiable = result.delaiAccesMoyen.fiable;
  const tuiles: Tuile[] = [
    {
      labelFr: "Satisfaction des bénéficiaires",
      labelEn: "Learner satisfaction",
      valeur: result.tauxSatisfaction.libelle,
      methode: result.methodes.satisfaction,
      fiable: result.tauxSatisfaction.fiable,
    },
    {
      labelFr: "Réussite / atteinte des objectifs",
      labelEn: "Success / objectives met",
      valeur: result.tauxReussite.libelle,
      methode: result.methodes.reussite,
      fiable: result.tauxReussite.fiable,
    },
    {
      labelFr: "Assiduité / complétion",
      labelEn: "Attendance / completion",
      valeur: result.tauxCompletion.libelle,
      methode: result.methodes.completion,
      fiable: result.tauxCompletion.fiable,
    },
    {
      labelFr: "Délai d'accès moyen",
      labelEn: "Average access lead time",
      valeur: delaiFiable
        ? `${result.delaiAccesMoyen.jours} ${isFr ? "jours" : "days"}`
        : isFr
          ? "En cours de constitution"
          : "Being compiled",
      methode: result.methodes.delaiAcces,
      fiable: delaiFiable,
    },
  ];

  return (
    <div>
      <ul role="list" className="xs:grid-cols-2 grid grid-cols-1 gap-4 lg:grid-cols-4">
        {tuiles.map((t) => (
          <li
            key={t.labelFr}
            className="border-border bg-canvas shadow-subtle flex flex-col rounded-2xl border p-5"
          >
            <p className="text-fg-soft text-[13px] leading-snug">{isFr ? t.labelFr : t.labelEn}</p>
            <p className="text-fg mt-2 text-2xl font-semibold tabular-nums">{t.valeur}</p>
            {!t.fiable && (
              <p className="text-fg-soft mt-1 text-[12px] italic">
                {isFr ? "Résultats en cours de constitution" : "Results being compiled"}
              </p>
            )}
            <p className="text-fg-soft mt-3 text-[12px] leading-snug">{t.methode}</p>
          </li>
        ))}
      </ul>
      <p className="text-fg-soft mt-4 text-[13px] leading-snug">
        {isFr
          ? `Indicateurs calculés sur l'année ${result.annee}. Un indicateur reste « en cours de constitution » tant que le nombre de retours est insuffisant pour être statistiquement représentatif (seuil de fiabilité). Nous ne publions aucune valeur non représentative.`
          : `Indicators computed for year ${result.annee}. An indicator remains "being compiled" until the number of responses is statistically representative (reliability threshold). We do not publish non-representative values.`}
      </p>
    </div>
  );
}
