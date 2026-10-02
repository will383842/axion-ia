"use client";
// use-client: le jeton en clair n'existe que dans la réponse de l'action (montré une seule fois).

// Formulaire « Créer un jeton » / « Renouveler » de la page Enregistreur (PR 5).
// Le jeton n'est écrit nulle part : il s'affiche ici, une fois, pour être collé
// dans les options de l'extension. Recharger la page le fait disparaître.
//
// 🔴 02/10 (constat de Williams : « le jeton n'apparaît pas à l'écran ») : le
// jeton vit dans l'état de CE composant. Les actions ne revalident donc plus
// la page (un re-rendu démontait le formulaire et perdait le jeton) : la liste
// s'actualise par le lien « J'ai collé le jeton : actualiser la liste ».
//
// Volontairement minimal : ce fichier est le seul JavaScript client de la page, et
// il pèse dans le cliquet « SOMME des page chunks de la CONSOLE ADMIN ». Les styles
// passent par les classes partagées `.admin-input` / `.admin-button` plutôt que par
// des chaînes utilitaires longues embarquées dans le chunk, et la consigne est
// rédigée côté serveur (`etatJetonCree`).

import { useActionState, useState } from "react";

import type { EtatJeton } from "@/features/admin-enregistreur/etat-jeton";

export interface JetonAppareilFormProps {
  readonly action: (etat: EtatJeton, form: FormData) => Promise<EtatJeton>;
  readonly libelle: string;
  /** Renouvellement : l'appareil à remplacer. */
  readonly appareilId?: string;
  /** Création : proposer de nommer le poste. */
  readonly avecNom?: boolean;
  /** La page elle-même : rechargée une fois le jeton collé (la liste se met à jour). */
  readonly actualiserHref: string;
}

export function JetonAppareilForm({
  action,
  libelle,
  appareilId,
  avecNom,
  actualiserHref,
}: JetonAppareilFormProps): React.ReactElement {
  const [etat, envoyer, enCours] = useActionState(action, { etat: "initial" } as EtatJeton);
  const [copie, setCopie] = useState(false);

  if (etat.etat === "cree") {
    const jeton = etat.jeton;
    return (
      <div role="status">
        <input
          readOnly
          value={jeton}
          aria-label="Jeton"
          className="admin-input"
          onFocus={(e) => e.currentTarget.select()}
        />
        <button
          type="button"
          className="admin-button"
          onClick={() => {
            void navigator.clipboard?.writeText(jeton).then(() => setCopie(true));
          }}
        >
          {copie ? "Copié" : "Copier"}
        </button>
        <p className="font-medium">{etat.consigne}</p>
        {/* Lien simple, pas `next/link` : un vrai rechargement relit la liste. */}
        <a href={actualiserHref}>J&apos;ai collé le jeton : actualiser la liste</a>
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
