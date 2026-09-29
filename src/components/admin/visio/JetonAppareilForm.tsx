"use client";
// use-client: le jeton en clair n'existe que dans la réponse de l'action (montré une seule fois).

// Formulaire « Créer le jeton » / « Renouveler » de la page Enregistreur (PR 5).
// Le jeton n'est écrit nulle part : il s'affiche ici, une fois, pour être collé
// dans les options de l'extension. Recharger la page le fait disparaître.
//
// Volontairement minimal : ce fichier est le seul JavaScript client de la page, et
// il pèse dans le cliquet « SOMME des page chunks de la CONSOLE ADMIN ». Les styles
// passent par les classes partagées `.admin-input` / `.admin-button` plutôt que par
// des chaînes utilitaires longues embarquées dans le chunk, et la consigne est
// rédigée côté serveur (`etatJetonCree`).

import { useActionState } from "react";

import type { EtatJeton } from "@/features/admin-enregistreur/etat-jeton";

export interface JetonAppareilFormProps {
  readonly action: (etat: EtatJeton, form: FormData) => Promise<EtatJeton>;
  readonly libelle: string;
  /** Renouvellement : l'appareil à remplacer. */
  readonly appareilId?: string;
  /** Création : proposer de nommer le poste. */
  readonly avecNom?: boolean;
}

export function JetonAppareilForm({
  action,
  libelle,
  appareilId,
  avecNom,
}: JetonAppareilFormProps): React.ReactElement {
  const [etat, envoyer, enCours] = useActionState(action, { etat: "initial" } as EtatJeton);

  if (etat.etat === "cree") {
    return (
      <div role="status">
        <input readOnly value={etat.jeton} aria-label="Jeton" className="admin-input font-mono" />
        <p className="font-medium">{etat.consigne}</p>
      </div>
    );
  }

  return (
    <form action={envoyer}>
      {appareilId ? <input type="hidden" name="appareilId" value={appareilId} /> : null}
      {avecNom ? (
        <label>
          Nom du poste
          <input
            name="nom"
            defaultValue="Poste de Williams"
            maxLength={80}
            className="admin-input"
          />
        </label>
      ) : null}
      <button disabled={enCours} className="admin-button">
        {libelle}
      </button>
      {etat.etat === "erreur" ? <p role="alert">{etat.message}</p> : null}
    </form>
  );
}
