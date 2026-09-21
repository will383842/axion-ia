"use client";
// use-client: deux gestes avec confirmation en deux clics et état de transition.
//
// Les deux gestes de la fiche d'un contact apporteur (2026-09-21).
//
// ── Pourquoi ils sont ICI et pas seulement dans la liste ─────────────────
// La liste les porte déjà, par ligne. Mais la fiche est l'endroit où Will lit
// ce que la personne a écrit — c'est donc là qu'il décide de ne pas donner
// suite, ou qu'il apprend qu'elle ne veut plus rien recevoir. L'obliger à
// revenir en arrière pour poser le geste, c'est le geste qui ne se pose pas.
//
// ── « Enregistrer une opposition » demande une confirmation ──────────────
// 🔑 Et c'est le SEUL des deux. Une opposition ne se défait pas depuis cet
// écran : l'empreinte est posée en base, le CRM est prévenu, les envois
// programmés sont retirés. Les deux clics ne protègent pas d'une erreur de
// jugement, ils protègent d'un clic de trop dans une liste — même motif que la
// suppression définitive de la corbeille.
//
// « Remettre à traiter » se défait d'un clic : aucune confirmation.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  remettreATraiterAction,
  enregistrerOppositionDepuisFicheAction,
} from "@/features/admin-submissions/reply-actions";

interface Props {
  id: string;
  /** La fiche est-elle close (archivée ou sans suite) ? */
  close: boolean;
}

export function GestesApporteur({ id, close }: Props): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmeOpposition, setConfirmeOpposition] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function poser(fn: () => Promise<{ ok: boolean; dejaOpposee?: boolean }>, succes: string) {
    setMessage(null);
    startTransition(async () => {
      const r = await fn();
      // Un échec se DIT. Un bouton qui ne fait rien et ne dit rien se reclique.
      setMessage(r.ok ? (r.dejaOpposee ? "Déjà enregistrée." : succes) : "Rien n'a été fait.");
      setConfirmeOpposition(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
      {close ? (
        <button
          type="button"
          disabled={isPending}
          onClick={() => poser(() => remettreATraiterAction(id), "La fiche est à traiter.")}
          className="admin-button-ghost admin-button-sm"
          title="La fiche redevient visible dans « à traiter »"
        >
          Remettre à traiter
        </button>
      ) : null}

      {confirmeOpposition ? (
        <span className="flex items-center gap-[var(--space-admin-2)]">
          <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
            Plus aucune sollicitation ne lui sera envoyée. Confirmer ?
          </span>
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              poser(
                () => enregistrerOppositionDepuisFicheAction(id),
                "Opposition enregistrée : les envois programmés sont retirés.",
              )
            }
            className="admin-button-sm text-[color:var(--color-admin-danger)]"
          >
            Oui, enregistrer
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => setConfirmeOpposition(false)}
            className="admin-button-ghost admin-button-sm"
          >
            Annuler
          </button>
        </span>
      ) : (
        <button
          type="button"
          disabled={isPending}
          onClick={() => setConfirmeOpposition(true)}
          className="admin-button-ghost admin-button-sm"
          title="Elle a dit ne plus vouloir être sollicitée (téléphone, e-mail, de vive voix)"
        >
          Enregistrer une opposition
        </button>
      )}

      {message ? (
        <span
          role="status"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]"
        >
          {message}
        </span>
      ) : null}
    </div>
  );
}
