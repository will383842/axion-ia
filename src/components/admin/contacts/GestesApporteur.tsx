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
  reponduHorsCircuitAction,
} from "@/features/admin-submissions/reply-actions";

interface Props {
  id: string;
  /** La fiche est-elle close (archivée ou sans suite) ? */
  close: boolean;
  /** Une réponse a-t-elle déjà été faite hors de la console ? */
  reponduAilleurs: boolean;
}

export function GestesApporteur({ id, close, reponduAilleurs }: Props): React.ReactElement {
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

      {/* 🔴 LE GESTE QUE WILL A DEMANDÉ, mot pour mot : « je voudrais pouvoir
          répondre manuellement sans passer par le circuit normal, pour éviter
          d'avoir des messages en doublons ».

          Répondre DEPUIS la console arrête déjà les relances. Mais Will répond
          souvent depuis Gmail, ou au téléphone — et rien, alors, n'arrêtait les
          rappels « ton dossier t'attend » qui dorment dans Redis jusqu'à J+2 et
          J+7. La personne recevait sa réponse, puis deux relances qui
          l'ignoraient. */}
      {reponduAilleurs ? (
        <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Réponse enregistrée hors console — les relances sont arrêtées.
        </span>
      ) : (
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            poser(
              () => reponduHorsCircuitAction(id),
              "C'est noté : les relances en attente sont retirées.",
            )
          }
          className="admin-button-ghost admin-button-sm"
          title="Tu as répondu depuis Gmail, au téléphone ou de vive voix"
        >
          J&apos;ai répondu ailleurs
        </button>
      )}

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
