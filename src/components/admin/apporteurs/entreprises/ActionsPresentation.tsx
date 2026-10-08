"use client";
// use-client: trois petits formulaires (réponse de l'entreprise, démenti, note) avec retour sans recharger.

import { useActionState } from "react";

import {
  confirmerPresentationAction,
  constaterManquementAction,
  dementirPresentationAction,
  noterPresentationAction,
  type EtatAction,
} from "@/features/apporteurs-reseau/actions-presentations";

const INITIAL: EtatAction = { etat: "initial" };

function Retour({ etat }: { etat: EtatAction }) {
  if (etat.etat === "initial") return null;
  return (
    <span
      role={etat.etat === "ok" ? "status" : "alert"}
      className={
        etat.etat === "ok"
          ? "text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
          : "text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-destructive)]"
      }
    >
      {etat.message}
    </span>
  );
}

export function ActionsPresentation({
  id,
  peutConfirmer,
  peutDementir,
  note,
  aujourdhui,
}: {
  id: string;
  peutConfirmer: boolean;
  peutDementir: boolean;
  note: string | null;
  /** « AAAA-MM-JJ » à Paris. */
  aujourdhui: string;
}) {
  const [eC, confirmer, cEnCours] = useActionState(confirmerPresentationAction, INITIAL);
  const [eD, dementir, dEnCours] = useActionState(dementirPresentationAction, INITIAL);
  const [eN, noter, nEnCours] = useActionState(noterPresentationAction, INITIAL);
  const [eM, manquement, mEnCours] = useActionState(constaterManquementAction, INITIAL);

  return (
    <div className="flex flex-col gap-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]">
      {peutConfirmer ? (
        <form action={confirmer} className="flex flex-wrap items-end gap-[var(--space-admin-2)]">
          <input type="hidden" name="id" value={id} />
          <label className="flex flex-col gap-1">
            L&apos;entreprise a répondu le
            <input
              type="date"
              name="confirmeeLe"
              required
              defaultValue={aujourdhui}
              max={aujourdhui}
              className="admin-input"
            />
          </label>
          <button type="submit" className="admin-button" disabled={cEnCours}>
            Confirmer
          </button>
          <Retour etat={eC} />
        </form>
      ) : null}

      {peutDementir ? (
        <form action={dementir} className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
          <input type="hidden" name="id" value={id} />
          <label className="inline-flex items-center gap-[var(--space-admin-2)]">
            <input type="checkbox" name="confirmer" value="oui" required />
            L&apos;entreprise dit ne pas connaître l&apos;apporteur
          </label>
          <button type="submit" className="admin-button-secondary" disabled={dEnCours}>
            Noter le démenti
          </button>
          <Retour etat={eD} />
        </form>
      ) : null}

      <details>
        <summary className="cursor-pointer">Manquement ou fraude (art. 4.5 bis)</summary>
        <form
          action={manquement}
          className="mt-[var(--space-admin-2)] flex flex-col gap-[var(--space-admin-2)]"
        >
          <input type="hidden" name="id" value={id} />
          <p className="text-[color:var(--color-admin-fg-muted)]">
            Déclaration non sincère, intérêt non déclaré ou fraude : aucune commission n&apos;est
            due sur cette affaire. Non facturées : annulées. Facturées non versées : bloquées.
            Versées : reprises. L&apos;apporteur reçoit les faits ci-dessous et peut contester par
            écrit (réponse motivée sous 30 jours).
          </p>
          <label className="flex flex-col gap-1">
            Les faits (envoyés à l&apos;apporteur)
            <textarea
              name="faits"
              rows={3}
              required
              minLength={10}
              maxLength={1500}
              className="admin-input"
            />
          </label>
          <label className="inline-flex items-center gap-[var(--space-admin-2)]">
            <input type="checkbox" name="confirmer" value="oui" required />
            Je confirme : rien n&apos;est supprimé, tout est tracé au journal.
          </label>
          <div>
            <button type="submit" className="admin-button-secondary" disabled={mEnCours}>
              Constater le manquement
            </button>
          </div>
          <Retour etat={eM} />
        </form>
      </details>

      <form action={noter} className="flex flex-wrap items-end gap-[var(--space-admin-2)]">
        <input type="hidden" name="id" value={id} />
        <label className="flex min-w-[16rem] flex-1 flex-col gap-1">
          Note
          <textarea
            name="note"
            rows={2}
            defaultValue={note ?? ""}
            maxLength={4000}
            className="admin-input"
          />
        </label>
        <button type="submit" className="admin-button-secondary" disabled={nEnCours}>
          Enregistrer
        </button>
        <Retour etat={eN} />
      </form>
    </div>
  );
}
