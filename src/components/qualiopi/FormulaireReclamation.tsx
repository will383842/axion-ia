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

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { useTurnstileToken } from "@/components/forms/TurnstileWidget";
import type {
  EtatDepotReclamation,
  deposerReclamationPubliqueAction,
} from "@/server/actions/qualiopi/reclamation-publique";

export interface FormulaireReclamationProps {
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
  children,
}: FormulaireReclamationProps) {
  const [etat, soumettre, enCours] = useActionState(action, ETAT_INITIAL);
  const { token, widget } = useTurnstileToken("reclamation");

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

      {widget}

      <Button type="submit" disabled={enCours}>
        {enCours ? "Envoi…" : "Déposer ma réclamation"}
      </Button>
    </form>
  );
}
