"use client";
// use-client: useActionState garde le texte de l'avis après un refus du serveur (V2-N-3).

/**
 * Espace formateur — l'avis du bilan de fin de formation (V2-N-3).
 *
 * L'avis s'écrit au téléphone, souvent en plusieurs lignes : un refus du serveur (avis
 * trop court, dossier clos, connexion expirée) ne doit JAMAIS l'effacer. L'action rend
 * alors un état (message + saisie) au lieu de rediriger ; les champs sont remontés avec
 * le texte rendu, le message est annoncé (`role="alert"`). Sans JavaScript, le formulaire
 * fonctionne encore : la page revient avec le même état.
 */

import { useActionState } from "react";

import { donnerAvisAction } from "@/server/actions/formateur/bilan-fin-formation.actions";

export interface AvisBilanFormProps {
  readonly sessionId: string;
  readonly bouton: string;
  readonly choix: string;
}

export function AvisBilanForm({ sessionId, bouton, choix }: AvisBilanFormProps) {
  const [etat, envoyer, enCours] = useActionState(donnerAvisAction, null);
  const note = etat?.note ?? "";

  return (
    <form action={envoyer} className="space-y-3">
      <input type="hidden" name="sessionId" value={sessionId} />
      {etat !== null ? (
        <p
          role="alert"
          className="border-terracotta text-mocha rounded-md border px-3 py-2 text-sm font-medium"
        >
          {etat.message}
        </p>
      ) : null}
      {/* `key` : React vide un formulaire après chaque envoi ; on remonte les champs avec
          ce que l'action a rendu, pour que rien de ce qui a été tapé ne disparaisse. */}
      <div key={etat?.essai ?? 0} className="space-y-3">
        <fieldset className="space-y-1.5">
          <legend className="text-mocha text-sm">Votre note (facultative)</legend>
          <div className="grid grid-cols-6 gap-2">
            {["", "1", "2", "3", "4", "5"].map((v) => (
              <label key={v || "aucune"} className="cursor-pointer">
                <input
                  type="radio"
                  name="note"
                  value={v}
                  defaultChecked={v === note}
                  aria-label={v === "" ? "Pas de note" : `${v} sur 5`}
                  className="peer sr-only"
                />
                <span className={choix}>{v === "" ? "—" : v}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block space-y-1.5">
          <span className="text-mocha text-sm">
            Quelques lignes : déroulé, incidents, absences, suggestions.
          </span>
          <textarea
            name="commentaire"
            required
            minLength={10}
            maxLength={2000}
            rows={4}
            defaultValue={etat?.commentaire ?? ""}
            className="border-border text-mocha w-full rounded-lg border p-3 text-base"
          />
        </label>
      </div>
      <button type="submit" disabled={enCours} className={`${bouton} disabled:opacity-60`}>
        {enCours ? "Envoi…" : "Enregistrer mon avis"}
      </button>
    </form>
  );
}
