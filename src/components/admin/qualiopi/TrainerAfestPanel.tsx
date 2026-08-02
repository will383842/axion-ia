"use client";
// use-client: bascule d'habilitation + saisie de date, appel Server Action.

/**
 * TrainerAfestPanel — habilitation AFEST d'un formateur (D.6313-3-1 §2).
 *
 * 🔴 `Trainer.afestHabiliteAt` était LU à trois endroits — dont un garde-fou qui
 * REFUSE la création d'un parcours AFEST quand il est nul — et n'était ÉCRIT
 * nulle part. L'habilitation était donc impossible à accorder, et le garde-fou
 * infranchissable : la fiche formateur affichait « Non habilité » pour
 * l'éternité. Un champ qu'on lit sans jamais pouvoir l'écrire n'est pas une
 * règle, c'est un cul-de-sac.
 *
 * ⚠️ L'habilitation est DATÉE : c'est la date qui fait la preuve, pas la case
 * cochée. Un auditeur demande quand l'habilitation a été accordée.
 *
 * Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTrainerAfestHabiliteAction } from "@/server/actions/qualiopi/trainers";

export function TrainerAfestPanel({
  trainerId,
  habiliteAtInitial,
}: {
  trainerId: string;
  /** `YYYY-MM-DD` si habilité, "" sinon. */
  habiliteAtInitial: string;
}): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [habilite, setHabilite] = useState(habiliteAtInitial !== "");
  const [date, setDate] = useState(habiliteAtInitial);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function enregistrer() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await setTrainerAfestHabiliteAction({
        id: trainerId,
        habilite,
        ...(habilite && date !== "" ? { dateHabilitation: date } : {}),
      });
      if ("error" in res) {
        setError(res.error);
      } else {
        setSuccess(
          res.data.habiliteAt !== null
            ? "Habilitation AFEST enregistrée."
            : "Habilitation AFEST retirée.",
        );
        router.refresh();
      }
    });
  }

  const inputCls =
    "rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-2)] py-[var(--space-admin-1)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:ring-1 focus:ring-[color:var(--color-admin-accent)] focus:outline-none";

  return (
    <section className="mb-[var(--space-admin-6)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]">
      <h2 className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
        Habilitation AFEST
      </h2>
      <p className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        Formateur-accompagnateur en situation de travail (art. D.6313-3-1 §2). Sans habilitation, la
        création d&apos;un parcours AFEST est refusée lorsque le contrôle est activé en
        configuration.
      </p>

      <div className="flex flex-wrap items-end gap-[var(--space-admin-4)]">
        <label className="flex items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
          <input
            type="checkbox"
            checked={habilite}
            onChange={(e) => {
              setHabilite(e.target.checked);
              setSuccess(null);
            }}
            disabled={isPending}
          />
          <span>Formateur habilité AFEST</span>
        </label>

        {habilite && (
          <label className="flex flex-col gap-[var(--space-admin-1)]">
            <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
              Habilité depuis le
            </span>
            <input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setSuccess(null);
              }}
              disabled={isPending}
              aria-label="Date d'habilitation AFEST"
              className={inputCls}
            />
          </label>
        )}

        <button type="button" onClick={enregistrer} disabled={isPending} className="admin-button">
          {isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>

      {habilite && date === "" && (
        <p className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          Sans date saisie, l&apos;habilitation sera datée d&apos;aujourd&apos;hui.
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
      {success && (
        <p
          role="status"
          className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
        >
          {success}
        </p>
      )}
    </section>
  );
}
