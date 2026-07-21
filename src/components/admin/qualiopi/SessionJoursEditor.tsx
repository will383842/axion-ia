"use client";
// use-client: éditeur de lignes (ajout/retrait/saisie) + Server Action.
/**
 * SessionJoursEditor — Saisie des journées RÉELLEMENT animées d'une session (D14).
 *
 * Sans cet écran, `session_jours` reste vide et la génération des créneaux
 * continue de supposer que les journées se suivent. Elles ne se suivent pas
 * toujours : un parcours de 4 journées réparties sur 3 mois produit alors 66
 * jours ouvrés au lieu de 4, un dénominateur multiplié par 16, un taux de
 * présence à ≈ 3 % et une attestation refusée à un stagiaire assidu.
 *
 * Accessibilité : `<input type="date">` et `<input type="time">` natifs — clavier
 * et lecteur d'écran fonctionnent sans une ligne de JS de notre part. Chaque
 * champ porte un label lié ; le bouton de retrait nomme la journée qu'il retire,
 * sinon un lecteur d'écran annonce cinq fois « Retirer ».
 */

import { useState, useTransition, useId } from "react";
import { useRouter } from "next/navigation";

export interface JourSaisi {
  date: string;
  heureDebut: string;
  heureFin: string;
}

export interface SessionJoursEditorProps {
  sessionId: string;
  joursInitiaux: JourSaisi[];
  /** Vrai si des créneaux ont déjà été générés — change ce qu'il faut avertir. */
  hasCreneaux: boolean;
  saveAction: (input: {
    sessionId: string;
    jours: JourSaisi[];
  }) => Promise<{ data: { nbJours: number } } | { error: string }>;
}

/** Empreinte stable d'une liste de journées, insensible à l'ordre de saisie. */
function clefComparaison(jours: JourSaisi[]): string {
  return JSON.stringify(
    [...jours]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((j) => [j.date, j.heureDebut, j.heureFin]),
  );
}

/** Horaires proposés à l'ajout d'une ligne. Modifiables — ce sont des valeurs de départ, pas une vérité. */
const HEURE_DEBUT_DEFAUT = "09:00";
const HEURE_FIN_DEFAUT = "17:00";

export function SessionJoursEditor({
  sessionId,
  joursInitiaux,
  hasCreneaux,
  saveAction,
}: SessionJoursEditorProps): React.ReactElement {
  const router = useRouter();
  const [jours, setJours] = useState<JourSaisi[]>(joursInitiaux);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const idBase = useId();

  // Comparaison sur une copie TRIÉE : la relecture serveur revient ordonnée par
  // date. Comparer l'ordre de saisie laisserait `modifie` à `true` pour toujours
  // dès que l'admin saisit ses journées dans le désordre — bouton « Enregistrer »
  // actif à vide, et avertissement orange affiché en même temps que le succès.
  const modifie = clefComparaison(jours) !== clefComparaison(joursInitiaux);

  function majJour(index: number, champ: keyof JourSaisi, valeur: string) {
    setSucces(null);
    setJours((prec) => prec.map((j, i) => (i === index ? { ...j, [champ]: valeur } : j)));
  }

  function ajouter() {
    setSucces(null);
    setJours((prec) => [
      ...prec,
      { date: "", heureDebut: HEURE_DEBUT_DEFAUT, heureFin: HEURE_FIN_DEFAUT },
    ]);
  }

  function retirer(index: number) {
    setSucces(null);
    setJours((prec) => prec.filter((_, i) => i !== index));
  }

  function enregistrer() {
    setError(null);
    setSucces(null);
    startTransition(async () => {
      const r = await saveAction({ sessionId, jours });
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setSucces(
        r.data.nbJours === 0
          ? "Aucune journée déclarée : la session retombe sur sa plage de dates."
          : `${r.data.nbJours} journée(s) enregistrée(s).`,
      );
      router.refresh();
    });
  }

  const labelCls =
    "block text-[length:var(--text-admin-xs)] tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase";
  // `.admin-input` est la classe maison (`admin.css`) — la recomposer à la main
  // ferait diverger ces champs du reste de la console au premier ajustement.
  const inputCls = "admin-input";

  return (
    <section className="mb-[var(--space-admin-6)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]">
      <h2 className="text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
        Journées réellement animées
      </h2>
      <p className="mt-[var(--space-admin-1)] mb-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        Déclarez ici chaque journée animée, avec ses horaires réels. Sans cette saisie, les créneaux
        sont déduits de la plage de dates de la session — ce qui est faux dès que les journées ne se
        suivent pas, et fausse alors le taux de présence. Les horaires figureront sur la feuille
        d&apos;émargement.
      </p>

      {jours.length === 0 ? (
        <p className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Aucune journée déclarée. La session utilise sa plage de dates.
        </p>
      ) : (
        <ul className="mb-[var(--space-admin-4)] flex flex-col gap-[var(--space-admin-3)]">
          {jours.map((jour, index) => (
            // Index en clé : les lignes n'ont pas d'identité stable tant qu'elles
            // ne sont pas enregistrées, et une date vide ne peut pas servir de clé.
            <li
              key={`${idBase}-${index}`}
              className="grid grid-cols-1 items-end gap-[var(--space-admin-3)] sm:grid-cols-[1fr_auto_auto_auto]"
            >
              <div>
                <label className={labelCls} htmlFor={`${idBase}-date-${index}`}>
                  Date
                </label>
                <input
                  id={`${idBase}-date-${index}`}
                  type="date"
                  required
                  className={inputCls}
                  value={jour.date}
                  onChange={(e) => majJour(index, "date", e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor={`${idBase}-debut-${index}`}>
                  Début
                </label>
                <input
                  id={`${idBase}-debut-${index}`}
                  type="time"
                  required
                  className={inputCls}
                  value={jour.heureDebut}
                  onChange={(e) => majJour(index, "heureDebut", e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor={`${idBase}-fin-${index}`}>
                  Fin
                </label>
                <input
                  id={`${idBase}-fin-${index}`}
                  type="time"
                  required
                  className={inputCls}
                  value={jour.heureFin}
                  onChange={(e) => majJour(index, "heureFin", e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={() => retirer(index)}
                className="admin-button-ghost text-[length:var(--text-admin-sm)]"
              >
                Retirer<span className="sr-only"> la journée {jour.date || `n° ${index + 1}`}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
        <button type="button" onClick={ajouter} className="admin-button-ghost">
          Ajouter une journée
        </button>
        <button
          type="button"
          onClick={enregistrer}
          disabled={isPending || !modifie}
          className="admin-button"
        >
          {isPending ? "Enregistrement…" : "Enregistrer les journées"}
        </button>
      </div>

      {hasCreneaux && modifie && (
        <p
          role="status"
          className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-warning)]"
        >
          Des créneaux ont déjà été générés pour cette session. Modifier les journées ne les
          recalcule pas et n&apos;en supprime aucun — c&apos;est volontaire : un créneau peut porter
          une signature, et rien ne distingue en base une absence émargée d&apos;un créneau vierge.
          Aucun écran ne permet aujourd&apos;hui de supprimer un créneau : le taux de présence
          restera calculé sur les créneaux existants. Prévenez la technique avant de vous fier au
          taux de cette session.
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          Erreur : {error}
        </p>
      )}
      {succes && (
        <p
          role="status"
          className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
        >
          {succes}
        </p>
      )}
    </section>
  );
}
