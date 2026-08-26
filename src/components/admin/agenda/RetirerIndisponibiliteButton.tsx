"use client";
// use-client: confirmation avant suppression + appel de Server Action, avec état
// local pour le retour d'erreur. Rendu UNIQUEMENT sur les blocages posés par la
// console, donc absent des vrais rendez-vous.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { retirerIndisponibiliteAction } from "@/server/actions/agenda/indisponibilites";

/**
 * Retire une indisponibilité posée depuis la console.
 *
 * POURQUOI UNE CONFIRMATION POUR UN SIMPLE BLOCAGE
 * ------------------------------------------------
 * Parce que le geste n'est pas symétrique : reposer un blocage prend dix
 * secondes, mais entre le retrait et le nouveau blocage, les créneaux sont
 * OUVERTS — et Calendly les rouvre en une dizaine de secondes. Un clic
 * accidentel sur mobile peut donc laisser un après-midi réservable sans que
 * personne s'en aperçoive. La confirmation coûte un clic ; l'inverse coûte un
 * rendez-vous non désiré.
 *
 * ⚠️ Volontairement PAS `window.confirm()` : une boîte de dialogue native bloque
 * tout le fil d'exécution et se comporte mal en webview mobile. Deux états
 * suffisent — le bouton se transforme en question.
 */
export interface RetirerIndisponibiliteButtonProps {
  /** Identifiant Google de l'événement. Fourni seulement s'il est retirable. */
  readonly eventId: string;
  /** Libellé du blocage, repris dans la question pour lever toute ambiguïté. */
  readonly titre: string;
}

export function RetirerIndisponibiliteButton({
  eventId,
  titre,
}: RetirerIndisponibiliteButtonProps): React.ReactElement {
  const router = useRouter();
  const [confirme, setConfirme] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  function retirer(): void {
    setErreur(null);
    demarrer(async () => {
      const res = await retirerIndisponibiliteAction({ eventId });
      if (res.ok) {
        setConfirme(false);
        router.refresh();
      } else {
        // Le message vient du serveur et dit quoi faire — on ne le réécrit pas
        // en « une erreur est survenue », qui n'aide personne.
        setErreur(res.message);
      }
    });
  }

  if (erreur) {
    return (
      <span
        role="alert"
        className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-danger)]"
      >
        {erreur}
      </span>
    );
  }

  if (!confirme) {
    return (
      <button
        type="button"
        onClick={() => setConfirme(true)}
        className="text-[length:var(--text-admin-xs)] underline underline-offset-2 opacity-80 hover:opacity-100"
      >
        Rouvrir ces créneaux
        <span className="sr-only"> — retirer l&apos;indisponibilité « {titre} »</span>
      </button>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-xs)]">
      <span>Rouvrir&nbsp;?</span>
      <button
        type="button"
        onClick={retirer}
        disabled={enCours}
        className="font-medium underline underline-offset-2"
      >
        {enCours ? "…" : "Oui, rouvrir"}
      </button>
      <button
        type="button"
        onClick={() => setConfirme(false)}
        className="underline underline-offset-2 opacity-70"
      >
        Non
      </button>
    </span>
  );
}
