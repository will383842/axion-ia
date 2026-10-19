"use client";
// use-client: état du dépôt (useActionState) + jeton Turnstile ; la soumission reste un formulaire natif.

/**
 * Formulaire PUBLIC de réclamation (chantier QNC, L09 — indicateur 31).
 *
 * Bâti sur les briques de /contact : Turnstile souple (`useTurnstileToken`),
 * composants `ui/`. La soumission est un `<form action>` natif : le FormData
 * est celui du DOM, le leurre y est donc toujours — pas de construction à la
 * main à oublier.
 *
 * Îlot client minimal : les champs (leurre compris) arrivent en `children`,
 * rendus par le Server Component `ChampsReclamation` — ils n'envoient aucun
 * JavaScript. Ici ne restent que l'état du dépôt, le jeton et le bouton.
 *
 * Ouvert à toute partie prenante. Depuis l'espace stagiaire, la personne peut
 * choisir sa formation : seule une inscription qui lui appartient sera
 * rattachée (vérifié côté serveur).
 */

import { useActionState, useCallback, useState } from "react";
import dynamic from "next/dynamic";
import type {
  EtatDepotReclamation,
  deposerReclamationPubliqueAction,
} from "@/server/actions/qualiopi/reclamation-publique";

// Turnstile (script + rendu) n'a pas à peser dans le JS initial de la page.
const TurnstileDiffere = dynamic(
  () => import("@/components/forms/TurnstileWidget").then((m) => m.TurnstileWidget),
  { ssr: false },
);

export interface FormulaireReclamationProps {
  /** Classes du bouton, calculées par le serveur (`buttonVariants()`) : pas de `Button` côté client. */
  classeBouton: string;
  action: typeof deposerReclamationPubliqueAction;
  /** Adresse écrite de repli, citée en cas d'échec. */
  adresseContact: string;
  /** Les champs, rendus par le serveur (`ChampsReclamation`). */
  children: React.ReactNode;
}

const ETAT_INITIAL: EtatDepotReclamation = { etat: "initial" };

export function FormulaireReclamation({
  action,
  adresseContact,
  classeBouton,
  children,
}: FormulaireReclamationProps) {
  const [etat, soumettre, enCours] = useActionState(action, ETAT_INITIAL);
  const [token, setToken] = useState("");
  // Identité stable : le widget se re-monte si ses rappels changent à chaque rendu.
  const effacerToken = useCallback(() => setToken(""), []);

  if (etat.etat === "recue") {
    return (
      <div role="status" className="border-border bg-paper rounded-lg border p-6">
        <p className="text-mocha font-serif text-lg font-semibold">
          Votre réclamation est enregistrée.
        </p>
        <p className="text-fg-soft mt-2 text-sm leading-relaxed">
          {etat.numero !== null ? `Son numéro : ${etat.numero}. ` : ""}
          Un accusé de réception vient de vous être envoyé par e-mail. Une personne de
          l&apos;organisme l&apos;examine et vous répondra par écrit, au plus tard sous 15 jours
          ouvrés.
        </p>
      </div>
    );
  }

  return (
    <form action={soumettre} className="flex flex-col gap-5" noValidate={false}>
      <input type="hidden" name="cf-turnstile-response" value={token} />

      {children}

      {etat.etat === "erreur" && (
        <p role="alert" className="text-terracotta text-sm">
          {etat.message} ({adresseContact})
        </p>
      )}

      <TurnstileDiffere action="reclamation" onToken={setToken} onExpire={effacerToken} />

      <button type="submit" disabled={enCours} className={classeBouton}>
        {enCours ? "Envoi…" : "Déposer ma réclamation"}
      </button>
    </form>
  );
}
