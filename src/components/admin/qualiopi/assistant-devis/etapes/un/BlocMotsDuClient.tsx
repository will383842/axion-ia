"use client";
// use-client: champs de texte contrôlés (gestionnaires d événements).

/**
 * Étape 1 — « Ce que le client vous a dit » (fiche E09). Trois champs de texte, gardés dans
 * le brouillon. Rien n'est pré-rempli (décision du 29/09) et aucun chiffre n'est inventé :
 * la valeur n'est qu'une saisie facultative, gardée dans le récit non imprimé (décision D1).
 */
import { useState, type Dispatch } from "react";

import { AdminBlocRepliable } from "@/components/admin/ui/AdminBlocRepliable";

import type { ActionAssistant } from "../../etat";
import { CHAMP, ZONE } from "./styles";
import type { EtatAssistant } from "../../types";

export interface PropsBlocMots {
  etat: EtatAssistant;
  dispatch: Dispatch<ActionAssistant>;
}

export function BlocMotsDuClient({ etat, dispatch }: PropsBlocMots) {
  const champ = (patch: Partial<EtatAssistant>) => dispatch({ type: "champs", patch });
  // Ouvert à l'arrivée si un champ est déjà rempli ; fixé une fois : vider un champ ne referme pas.
  const [ouvert] = useState(
    () =>
      etat.motsDuClient.trim() !== "" ||
      etat.resultatVise.trim() !== "" ||
      etat.valeurClient.trim() !== "",
  );
  return (
    <section aria-label="Mots du client">
      <AdminBlocRepliable titre="Ce que le client vous a dit" ouvertParDefaut={ouvert}>
        <p className="mt-0 text-[length:var(--text-admin-sm)]" id="aide-mots">
          Notez son problème avec ses propres mots, pour votre dossier. Le devis n&apos;imprime que
          l&apos;intitulé, le besoin, le résultat visé et la phrase de garantie, et seulement sur un
          devis à formules.
        </p>
        <textarea
          rows={3}
          className={ZONE}
          aria-label="Ce que le client vous a dit"
          aria-describedby="aide-mots"
          value={etat.motsDuClient}
          onChange={(e) => champ({ motsDuClient: e.target.value })}
        />
        <label className="mt-[var(--space-admin-4,8px)] flex flex-col gap-1 font-medium">
          Résultat visé, en une phrase
          <input
            className={`${CHAMP} font-normal`}
            value={etat.resultatVise}
            onChange={(e) => champ({ resultatVise: e.target.value })}
          />
        </label>
        <label className="mt-[var(--space-admin-4,8px)] flex flex-col gap-1 font-medium">
          Valeur pour le client (facultatif, ses chiffres)
          <span
            className="text-[length:var(--text-admin-sm)] font-normal text-[color:var(--color-admin-fg-muted)]"
            id="aide-valeur"
          >
            Pour votre suivi uniquement : cette valeur est gardée dans le récit du devis et
            n&apos;est pas imprimée. Rien n&apos;est inventé.
          </span>
          <textarea
            rows={2}
            className={`${ZONE} font-normal`}
            aria-describedby="aide-valeur"
            value={etat.valeurClient}
            onChange={(e) => champ({ valeurClient: e.target.value })}
          />
        </label>
      </AdminBlocRepliable>
    </section>
  );
}
