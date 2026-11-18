"use client";
// use-client: champs de texte contrôlés (gestionnaires d événements).

/**
 * Étape 1 — « Ce que le client vous a dit » (fiche E09). Trois champs de texte, gardés dans
 * le brouillon. Rien n'est pré-rempli (décision du 29/09) et aucun chiffre n'est inventé :
 * la valeur n'est qu'une saisie facultative, gardée dans le récit non imprimé (décision D1).
 */
import type { Dispatch } from "react";

import type { ActionAssistant } from "../../etat";
import type { EtatAssistant } from "../../types";

export interface PropsBlocMots {
  etat: EtatAssistant;
  dispatch: Dispatch<ActionAssistant>;
}

export function BlocMotsDuClient({ etat, dispatch }: PropsBlocMots) {
  const champ = (patch: Partial<EtatAssistant>) => dispatch({ type: "champs", patch });
  return (
    <section aria-label="Mots du client" className="mb-[var(--space-admin-6,16px)]">
      <h3 id="titre-mots" className="mb-[var(--space-admin-3,6px)]">
        Ce que le client vous a dit
      </h3>
      <p className="text-[length:var(--text-admin-sm)]" id="aide-mots">
        Notez son problème avec ses propres mots, pour votre dossier. Le devis n&apos;imprime que
        l&apos;intitulé, le besoin, le résultat visé et la phrase de garantie, et seulement sur un
        devis à formules.
      </p>
      <textarea
        rows={3}
        className="w-full rounded border p-2"
        aria-labelledby="titre-mots"
        aria-describedby="aide-mots"
        value={etat.motsDuClient}
        onChange={(e) => champ({ motsDuClient: e.target.value })}
      />
      <label className="mt-3 flex flex-col">
        Résultat visé, en une phrase
        <input
          className="min-h-[44px] rounded border px-2"
          value={etat.resultatVise}
          onChange={(e) => champ({ resultatVise: e.target.value })}
        />
      </label>
      <label className="mt-3 flex flex-col">
        Valeur pour le client (facultatif, ses chiffres)
        <span className="text-[length:var(--text-admin-sm)]" id="aide-valeur">
          Pour votre suivi uniquement : cette valeur est gardée dans le récit du devis et n&apos;est
          pas imprimée. Rien n&apos;est inventé.
        </span>
        <textarea
          rows={2}
          className="rounded border p-2"
          aria-describedby="aide-valeur"
          value={etat.valeurClient}
          onChange={(e) => champ({ valeurClient: e.target.value })}
        />
      </label>
    </section>
  );
}
