"use client";
// use-client: gestion interactive habilitations (checkboxes) + vérif sous-traitant + actif, avec useTransition.

/**
 * TrainerManageForm — habilitations par formation, vérification sous-traitant
 * (data.gouv.fr) et activation, sur la fiche formateur (R9).
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setTrainerHabilitationsAction,
  verifyTrainerSousTraitantAction,
  setTrainerActifAction,
} from "@/server/actions/qualiopi/trainers";

export interface TrainerManageFormProps {
  trainerId: string;
  statut: "salarie" | "sous_traitant";
  actif: boolean;
  sousTraitantVerifie: boolean;
  sousTraitantNda: string | null;
  /** Catalogue des formations sélectionnables. */
  formations: Array<{ id: string; titre: string }>;
  /** Habilitations actuelles (formationIds). */
  habilitations: string[];
}

export function TrainerManageForm(props: TrainerManageFormProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set(props.habilitations));
  const [nda, setNda] = useState(props.sousTraitantNda ?? "");

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function run(fn: () => Promise<{ error: string } | { data: unknown }>, ok: string) {
    setMsg(null);
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if ("error" in r) setError(r.error);
      else {
        setMsg(ok);
        router.refresh();
      }
    });
  }

  const sectionCls =
    "rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]";
  const titleCls =
    "mb-[var(--space-admin-3)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]";
  const inputCls =
    "rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]";

  return (
    <div className="flex flex-col gap-[var(--space-admin-5)]">
      {error && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
      {msg && (
        <p
          role="status"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
        >
          {msg}
        </p>
      )}

      {/* Habilitations */}
      <section className={sectionCls}>
        <h2 className={titleCls}>Formations habilitées</h2>
        <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Un formateur ne peut être assigné qu&apos;aux formations cochées ici (garde off.6/19).
        </p>
        {props.formations.length === 0 ? (
          <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Aucune formation au catalogue.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-[var(--space-admin-2)] sm:grid-cols-2">
            {props.formations.map((f) => (
              <label
                key={f.id}
                className="flex cursor-pointer items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]"
              >
                <input
                  type="checkbox"
                  checked={selected.has(f.id)}
                  onChange={() => toggle(f.id)}
                  disabled={isPending}
                  className="h-4 w-4 accent-[color:var(--color-admin-accent)]"
                />
                {f.titre}
              </label>
            ))}
          </div>
        )}
        <div className="mt-[var(--space-admin-4)]">
          <button
            type="button"
            disabled={isPending}
            className="admin-button"
            onClick={() =>
              run(
                () =>
                  setTrainerHabilitationsAction({
                    id: props.trainerId,
                    formationsHabilitees: Array.from(selected),
                  }),
                "Habilitations enregistrées.",
              )
            }
          >
            {isPending ? "…" : "Enregistrer les habilitations"}
          </button>
        </div>
      </section>

      {/* Vérification sous-traitant */}
      {props.statut === "sous_traitant" && (
        <section className={sectionCls}>
          <h2 className={titleCls}>Vérification sous-traitant (data.gouv.fr — off.19/27)</h2>
          <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Statut actuel :{" "}
            {props.sousTraitantVerifie ? (
              <span className="text-[color:var(--color-admin-success)]">vérifié ●</span>
            ) : (
              <span className="text-[color:var(--color-admin-warning)]">non vérifié ○</span>
            )}
          </p>
          <div className="flex flex-wrap items-end gap-[var(--space-admin-3)]">
            <input
              value={nda}
              onChange={(e) => setNda(e.target.value)}
              disabled={isPending}
              maxLength={20}
              placeholder="N° NDA du sous-traitant"
              className={inputCls}
            />
            <button
              type="button"
              disabled={isPending || nda.trim() === ""}
              className="admin-button"
              onClick={() =>
                run(
                  () =>
                    verifyTrainerSousTraitantAction({ id: props.trainerId, sousTraitantNda: nda }),
                  "Sous-traitant marqué vérifié.",
                )
              }
            >
              {isPending ? "…" : "Marquer vérifié"}
            </button>
          </div>
        </section>
      )}

      {/* Activation */}
      <section className={sectionCls}>
        <h2 className={titleCls}>Disponibilité</h2>
        <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Un formateur inactif ne peut plus être assigné à une session.
        </p>
        <button
          type="button"
          disabled={isPending}
          className="admin-button"
          onClick={() =>
            run(
              () => setTrainerActifAction({ id: props.trainerId, actif: !props.actif }),
              props.actif ? "Formateur désactivé." : "Formateur réactivé.",
            )
          }
        >
          {isPending ? "…" : props.actif ? "Désactiver" : "Réactiver"}
        </button>
      </section>
    </div>
  );
}
