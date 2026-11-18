// Le fil des trois étapes du Tour France IA : « Votre demande » → « La visio » → « Votre journée
// offerte ». Composant SERVEUR, aucun JavaScript client. Posé en tête de la mini-demande (étape 1)
// et de la page de la visio (étape 2), avec les mêmes classes que le fil de l'étape 2.
//
// `<ol>` : l'ordre est l'information ; un lecteur d'écran annonce « liste de 3 éléments », et
// `aria-current="step"` marque l'étape en cours. L'étape faite porte un Check, en `text-sage`.

import * as React from "react";
import { Check } from "lucide-react";

const ETAPES_DU_FIL = ["Votre demande", "La visio", "Votre journée offerte"] as const;

export function FilEtapesTour({ etapeCourante }: { etapeCourante: 1 | 2 }) {
  return (
    <ol className="text-fg-muted mt-4 flex flex-wrap items-center gap-2 text-[11px] font-semibold tracking-wide uppercase">
      {ETAPES_DU_FIL.map((libelle, i) => {
        const numero = i + 1;
        const faite = numero < etapeCourante;
        const enCours = numero === etapeCourante;
        return (
          <React.Fragment key={libelle}>
            {i > 0 ? (
              <li aria-hidden="true" className="bg-border-strong h-px w-4 shrink-0" />
            ) : null}
            <li
              aria-current={enCours ? "step" : undefined}
              className={
                faite
                  ? "text-sage flex items-center gap-1.5"
                  : enCours
                    ? "text-terracotta-deep"
                    : undefined
              }
            >
              {faite ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}
              {libelle}
            </li>
          </React.Fragment>
        );
      })}
    </ol>
  );
}
