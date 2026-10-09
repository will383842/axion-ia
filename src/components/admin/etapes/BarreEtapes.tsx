/**
 * La barre d'étapes d'une fiche (Candidatures unifiées L8a) — composant SERVEUR.
 *
 * Les étapes du monde de la personne, celles déjà faites, la courante
 * (`aria-current="step"`). Une SORTIE (« Non retenue », « Sans suite »…) n'a
 * pas de rang : la barre laisse place à la seule pastille. Sur téléphone, la
 * barre défile horizontalement (`admin-etapes`), comme les tableaux.
 */

import type { Etape } from "@/features/etapes/etapes";
import { PastilleEtape } from "./PastilleEtape";

export function BarreEtapes({
  etapes,
  etape,
}: {
  etapes: ReadonlyArray<string>;
  etape: Etape;
}): React.ReactElement {
  if (etape.rang === null) return <PastilleEtape etape={etape} />;
  const rang = etape.rang;
  return (
    <div>
      <ol className="admin-etapes" aria-label="Étapes">
        {etapes.map((libelle, i) => (
          <li
            key={libelle}
            className={
              i < rang
                ? "admin-etapes-pas admin-etapes-faite"
                : i === rang
                  ? "admin-etapes-pas admin-etapes-courante"
                  : "admin-etapes-pas"
            }
            {...(i === rang ? { "aria-current": "step" as const } : {})}
          >
            {i === rang ? etape.libelle : libelle}
          </li>
        ))}
      </ol>
      {etape.precision ? <p className="admin-meta-small">{etape.precision}</p> : null}
    </div>
  );
}
