"use client";
// use-client: useActionState sur consignerAuJournalAction + repli du formulaire.

/**
 * Consigner un fait au journal : une note, un appel, un message reçu, une pièce.
 *
 * ## Le champ de date, et pourquoi il est offert plutôt que déduit
 *
 * Un appel se consigne rarement pendant l'appel. Sans champ de date, la frise
 * raconterait l'ordre de la SAISIE et non celui des faits — et un dossier relu
 * six mois plus tard deviendrait illisible. Le champ est donc là, vide par
 * défaut (« maintenant »), et borné au passé côté serveur : un journal qui
 * accepte une date future n'est plus un journal, c'est un agenda.
 */

import { useActionState, useState } from "react";

import {
  consignerAuJournalAction,
  type EtatJournal,
} from "@/features/admin-job-applications/journal-actions";

const DEPART: EtatJournal = { ok: false, error: "" };

const TYPES: ReadonlyArray<readonly [string, string, string]> = [
  ["note", "Note", "Ce qu'on veut se rappeler."],
  ["appel", "Appel", "Un échange téléphonique, et ce qui s'y est dit."],
  ["email_recu", "Message reçu", "Une réponse du candidat, rapatriée à la main."],
  ["piece_recue", "Pièce reçue", "Un CV, un portfolio, un document envoyé après coup."],
];

const LIBELLES_ERREUR: Record<string, string> = {
  unauthorized: "Session expirée — reconnectez-vous.",
  forbidden: "Vous n'avez pas accès aux dossiers de candidature.",
  champs_invalides: "Il manque le texte, ou il est trop court.",
  date_future: "La date d'un fait ne peut pas être dans le futur.",
  db_failed: "Échec d'enregistrement.",
};

export function ConsignerAuJournal({
  applicationId,
}: {
  applicationId: string;
}): React.ReactElement {
  const [etat, action, enCours] = useActionState(consignerAuJournalAction, DEPART);
  const [ouvert, setOuvert] = useState(false);

  if (!ouvert) {
    return (
      <button type="button" className="admin-button-secondary" onClick={() => setOuvert(true)}>
        Consigner un fait
      </button>
    );
  }

  return (
    <form action={action} className="admin-form">
      <input type="hidden" name="applicationId" value={applicationId} />
      <div className="admin-form-row">
        <div className="admin-field">
          <label htmlFor="type" className="admin-label">
            Nature
          </label>
          <select id="type" name="type" className="admin-input" disabled={enCours}>
            {TYPES.map(([valeur, libelle, aide]) => (
              <option key={valeur} value={valeur} title={aide}>
                {libelle}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="occurredAt" className="admin-label">
            Quand ? <span className="admin-meta-small">(vide = maintenant)</span>
          </label>
          <input
            id="occurredAt"
            name="occurredAt"
            type="datetime-local"
            className="admin-input"
            disabled={enCours}
          />
        </div>
      </div>

      <div className="admin-field">
        <label htmlFor="texte" className="admin-label">
          Ce qui s’est passé
        </label>
        <textarea
          id="texte"
          name="texte"
          rows={4}
          className="admin-input admin-textarea"
          disabled={enCours}
          required
        />
        <p className="admin-meta-small">
          La première ligne sert de résumé dans la frise ; tout le texte est conservé.
        </p>
      </div>

      <div>
        <button type="submit" className="admin-button" disabled={enCours}>
          {enCours ? "Enregistrement…" : "Consigner"}
        </button>
        <button type="button" className="admin-button-ghost" onClick={() => setOuvert(false)}>
          Annuler
        </button>
        {etat.ok ? (
          <span role="status" className="admin-alert admin-alert-success">
            {" "}
            Consigné.
          </span>
        ) : etat.error ? (
          <span role="alert" className="admin-alert admin-alert-error">
            {" "}
            {LIBELLES_ERREUR[etat.error] ?? etat.error}
          </span>
        ) : null}
      </div>

      {/* 🔑 Dit ici plutôt que sous-entendu : le journal est en ajout seul. Une
          personne qui croit pouvoir corriger sa note écrira autrement que
          quelqu'un qui sait que sa ligne restera. */}
      <p className="admin-meta-small">
        Une ligne consignée ne peut plus être modifiée ni supprimée — c’est ce qui lui donne sa
        valeur. Une erreur se corrige par une seconde ligne qui la corrige.
      </p>
    </form>
  );
}
