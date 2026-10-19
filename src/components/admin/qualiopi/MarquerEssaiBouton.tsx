"use client";
// use-client: bouton « Marquer essai » (motif obligatoire, useState + useTransition) de la console.
/**
 * MarquerEssaiBouton — marque une appréciation d'ESSAI « hors preuve » (NC14).
 *
 * L'appréciation est conservée telle quelle : seul son statut de preuve change.
 * Pas de bouton inverse. Espace admin uniquement.
 */

import { useState, useTransition } from "react";

type ActionResult<T> = { data: T } | { error: string };

interface Props {
  appreciationId: string;
  marquerAction: (input: {
    appreciationId: string;
    motif: string;
  }) => Promise<ActionResult<{ dejaMarquee: boolean }>>;
}

const MOTIF_MIN = 10;

export function MarquerEssaiBouton({ appreciationId, marquerAction }: Props) {
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [fait, setFait] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (fait) {
    return <span className="text-[length:var(--text-admin-xs)]">Marquée : hors preuve.</span>;
  }

  if (!ouvert) {
    return (
      <button type="button" className="admin-button" onClick={() => setOuvert(true)}>
        Marquer essai
      </button>
    );
  }

  return (
    <form
      className="space-y-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (motif.trim().length < MOTIF_MIN) {
          setErreur(`Le motif est obligatoire (au moins ${MOTIF_MIN} caractères).`);
          return;
        }
        setErreur(null);
        startTransition(async () => {
          const r = await marquerAction({ appreciationId, motif });
          if ("error" in r) setErreur(r.error);
          else setFait(true);
        });
      }}
    >
      <label className="block text-[length:var(--text-admin-xs)]">
        Motif (obligatoire)
        <textarea
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          rows={2}
          maxLength={500}
          className="mt-1 block w-full rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] p-1"
        />
      </label>
      {erreur ? (
        <p role="alert" className="text-[length:var(--text-admin-xs)]">
          {erreur}
        </p>
      ) : null}
      <button type="submit" disabled={isPending} className="admin-button">
        {isPending ? "Enregistrement…" : "Confirmer : hors preuve"}
      </button>
    </form>
  );
}
