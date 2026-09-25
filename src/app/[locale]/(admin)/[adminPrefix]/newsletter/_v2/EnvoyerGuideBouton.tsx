"use client";
// use-client: useActionState + confirmation en deux clics pour « Envoyer / Renvoyer le guide ».
// Zéro appel DB côté client : délègue aux Server Actions envoyerGuideAAbonneAction /
// renvoyerGuideAction, qui portent l'idempotence (une réservation conditionnelle en base).

import { useActionState, useState } from "react";
import {
  envoyerGuideAAbonneAction,
  renvoyerGuideAction,
  type EnvoiGuideState,
} from "@/features/admin-newsletter/actions";

const IDLE: EnvoiGuideState = { ok: false, error: "" };

export interface EnvoyerGuideBoutonProps {
  /** « envoyer » : id de l'ABONNÉ ; « renvoyer » : id de la DEMANDE du guide. */
  id: string;
  mode: "envoyer" | "renvoyer";
  /**
   * Le geste serait refusé (`refusConsole`, calculé côté serveur) : le bouton
   * n'est PAS affiché, la phrase du refus l'est à sa place. Le geste refuse de
   * toute façon — masquer évite seulement un clic qui ne mène nulle part.
   */
  refus?: string;
}

export function EnvoyerGuideBouton({
  id,
  mode,
  refus,
}: EnvoyerGuideBoutonProps): React.ReactElement {
  const [state, action, pending] = useActionState(
    mode === "envoyer" ? envoyerGuideAAbonneAction : renvoyerGuideAction,
    IDLE,
  );
  const [confirmer, setConfirmer] = useState(false);
  const libelle = mode === "envoyer" ? "Envoyer le guide" : "Renvoyer le guide";

  if (refus !== undefined) {
    return (
      <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        {refus}
      </p>
    );
  }

  return (
    <div className="flex flex-col items-start gap-[var(--space-admin-2)]">
      {confirmer ? (
        <form action={action} className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
          <input type="hidden" name="id" value={id} />
          <label className="flex items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-soft)]">
            <input type="checkbox" name="reprise" />
            Ajouter la phrase « inscrit avant la parution du guide »
          </label>
          <button type="submit" disabled={pending} className="admin-button-ghost">
            {pending ? "…" : `Confirmer : ${libelle.toLowerCase()}`}
          </button>
          <button type="button" onClick={() => setConfirmer(false)} className="admin-button-ghost">
            Annuler
          </button>
        </form>
      ) : (
        <button type="button" onClick={() => setConfirmer(true)} className="admin-button-ghost">
          {libelle}
        </button>
      )}
      {state.ok ? (
        <span
          role="status"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-success)]"
        >
          {state.message}
        </span>
      ) : state.error ? (
        <span
          role="alert"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
        >
          {state.error}
        </span>
      ) : null}
    </div>
  );
}
