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
  updateTrainerAction,
} from "@/server/actions/qualiopi/trainers";

const STATUT_LABELS: Record<TrainerStatut, string> = {
  salarie: "Salarié",
  dirigeant: "Dirigeant-formateur",
  sous_traitant: "Sous-traitant",
};

/**
 * Conséquence documentaire de chaque statut, annoncée AVANT enregistrement.
 * Miroir de `requisPourStatut` (`src/server/qualiopi/trainers/conformite.ts`) :
 * à mettre à jour si les pièces bloquantes y changent.
 */
const CONSEQUENCE_STATUT: Record<TrainerStatut, string> = {
  dirigeant: "aucune pièce ne sera plus bloquante pour ce formateur.",
  salarie: "un contrat de travail validé sera exigé.",
  sous_traitant: "un NDA, un Kbis et un contrat de sous-traitance validés seront exigés.",
};

type TrainerStatut = "salarie" | "sous_traitant" | "dirigeant";

export interface TrainerManageFormProps {
  trainerId: string;
  statut: TrainerStatut;
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
  const [statut, setStatut] = useState<TrainerStatut>(props.statut);

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
          className="rounded-[var(--radius-admin-sm)] bg-[color:var(--color-admin-destructive-soft)] p-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-destructive-fg)]"
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

      {/* Statut — SEUL point de modification après création.
          Le champ existe aussi dans TrainerForm, mais uniquement en mode
          création : deux sélecteurs sur la même page se désynchronisent après un
          `router.refresh()` (chacun fige son état au montage via `useState`), et
          enregistrer l'identité RÉVERTAIT silencieusement le statut choisi ici.
          Placé en tête du formulaire car il conditionne les pièces exigées, donc
          le contenu de la carte de conformité en haut de page. */}
      <section id="statut-formateur" className={sectionCls}>
        <h2 className={titleCls}>Statut</h2>
        <p
          id="statut-aide"
          className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]"
        >
          Détermine les pièces exigées pour la conformité (ind. 21/27). Le dirigeant-formateur est
          l&apos;organisme lui-même : ni salarié, ni sous-traitant.
        </p>
        <div className="flex flex-wrap items-end gap-[var(--space-admin-3)]">
          <label className="flex flex-col gap-[var(--space-admin-1)]" htmlFor="statut-select">
            <span className="admin-label">Statut du formateur</span>
            <select
              id="statut-select"
              aria-describedby="statut-aide"
              value={statut}
              onChange={(e) => setStatut(e.target.value as TrainerStatut)}
              disabled={isPending}
              className={inputCls}
            >
              {(Object.keys(STATUT_LABELS) as TrainerStatut[]).map((s) => (
                <option key={s} value={s}>
                  {STATUT_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={isPending || statut === props.statut}
            aria-busy={isPending}
            {...(statut === props.statut && !isPending
              ? { title: "Choisissez un autre statut pour activer ce bouton" }
              : {})}
            className="admin-button w-auto"
            onClick={() =>
              run(
                () => updateTrainerAction({ id: props.trainerId, statut }),
                `Statut enregistré : ${STATUT_LABELS[statut]}. Conformité recalculée — voir la carte en haut de page.`,
              )
            }
          >
            {isPending ? "Enregistrement…" : "Enregistrer le statut"}
          </button>
        </div>
        {statut !== props.statut && (
          <p
            role="status"
            className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]"
          >
            En enregistrant : {CONSEQUENCE_STATUT[statut]}
          </p>
        )}
      </section>

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
