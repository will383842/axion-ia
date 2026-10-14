"use client";
// use-client: useActionState pour afficher le refus ou le nombre de textes validés.

import { useActionState } from "react";

import {
  validerTousTextesFormateursAction,
  type EtatValidation,
} from "@/server/email/textes-valides-actions";

const INITIAL: EtatValidation = { ok: true, message: "" };

/** M1 — « Valider tous les textes formateurs d'un coup », avec confirmation. */
export function ValiderTousTextesFormateurs({
  nombre,
  liste,
}: {
  nombre: number;
  /** Les clés affichées (`listeDesTextesAffichee`) : l'action les recompare. */
  liste: string;
}) {
  const [etat, formAction, enCours] = useActionState(validerTousTextesFormateursAction, INITIAL);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="nombre" value={String(nombre)} />
      <input type="hidden" name="liste" value={liste} />
      <label className="text-fg-soft flex items-start gap-2 text-sm">
        <input type="checkbox" name="confirme" value="oui" required className="mt-1" />
        <span>
          J&apos;ai relu les {nombre} textes ci-dessous (gabarits et variantes) et je les valide
          tous. Chacun pourra partir dès que l&apos;interrupteur « textes validés » sera allumé.
        </span>
      </label>
      <button type="submit" className="admin-button" disabled={enCours}>
        Valider tous les textes formateurs
      </button>
      {!etat.ok ? (
        <p role="alert" className="text-destructive text-sm">
          {etat.error}
        </p>
      ) : etat.message ? (
        <p className="text-fg-soft text-sm">{etat.message}</p>
      ) : null}
    </form>
  );
}
