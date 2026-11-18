"use client";
// use-client: useActionState pour dire le résultat d'un envoi (erreur, doublon) sans quitter la page.

// Enveloppe minimale d'un formulaire du profil (lot B6) : elle seule porte du JavaScript, pour
// dire le résultat (« Étiquette ajoutée », « Cette étiquette est déjà sur la fiche »). Les champs
// et boutons restent rendus par le serveur et passent en enfants.

import { useActionState } from "react";

import type { EtatProfil } from "@/features/dossier-client/fiche/actions-profil";

const ETAT_INITIAL: EtatProfil = { message: null, erreur: null };

export function FormulaireProfil(props: {
  action: (avant: EtatProfil, fd: FormData) => Promise<EtatProfil>;
  className?: string;
  /** Si fourni, les champs sont enveloppés ici et les messages restent hors de cette enveloppe. */
  classeChamps?: string;
  children: React.ReactNode;
}): React.ReactElement {
  const [etat, soumettre] = useActionState(props.action, ETAT_INITIAL);
  return (
    <form action={soumettre} className={props.className}>
      {props.classeChamps !== undefined ? (
        <div className={props.classeChamps}>{props.children}</div>
      ) : (
        props.children
      )}
      {etat.erreur !== null ? (
        <p role="alert" className="w-full text-[length:var(--text-admin-sm)] font-medium">
          {`Non enregistré : ${etat.erreur}`}
        </p>
      ) : null}
      {etat.message !== null ? (
        <p role="status" className="w-full text-[length:var(--text-admin-sm)]">
          {etat.message}
        </p>
      ) : null}
    </form>
  );
}
