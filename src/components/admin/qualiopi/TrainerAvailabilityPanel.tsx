"use client";
// use-client: saisie interactive des indisponibilités (ajout / suppression),
// avec useTransition + router.refresh().

/**
 * TrainerAvailabilityPanel — congés et indisponibilités d'un formateur.
 *
 * Une indisponibilité N'EMPÊCHE PAS d'affecter le formateur : elle remonte dans
 * le hub de pilotage comme signal critique, et un humain arbitre (un formateur
 * peut écourter ses congés). Bloquer la saisie empêcherait d'enregistrer la
 * réalité quand elle est inconfortable.
 *
 * Bornes de jour INCLUSES : « du 3 au 3 » vaut un jour, « du 3 au 7 » en vaut cinq.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  createTrainerAvailabilityAction,
  deleteTrainerAvailabilityAction,
} from "@/server/actions/qualiopi/trainer-availability";
import {
  LIBELLE_INDISPO,
  joursDeLIndispo,
  type TrainerAvailabilityTypeValue,
} from "@/server/qualiopi/trainers/availability";

export interface IndispoView {
  id: string;
  type: TrainerAvailabilityTypeValue;
  debut: string;
  fin: string;
  motif: string | null;
}

const TYPES: TrainerAvailabilityTypeValue[] = [
  "conge",
  "maladie",
  "formation_interne",
  "indisponible",
];

interface Props {
  trainerId: string;
  indispos: IndispoView[];
}

export function TrainerAvailabilityPanel({ trainerId, indispos }: Props): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<TrainerAvailabilityTypeValue>("conge");
  const [debut, setDebut] = useState("");
  const [fin, setFin] = useState("");
  const [motif, setMotif] = useState("");

  function ajouter() {
    setError(null);
    startTransition(async () => {
      const r = await createTrainerAvailabilityAction({
        trainerId,
        type,
        dateDebut: debut,
        dateFin: fin,
        motif: motif || undefined,
      });
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setDebut("");
      setFin("");
      setMotif("");
      router.refresh();
    });
  }

  function supprimer(id: string) {
    setError(null);
    startTransition(async () => {
      const r = await deleteTrainerAvailabilityAction({ id });
      if ("error" in r) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]">
      <h2 className="admin-h2">Congés et indisponibilités</h2>
      <p className="admin-muted">
        Le formateur reste assignable : le hub de pilotage signale une prestation qui tombe sur ces
        dates, un humain arbitre. Le dernier jour est inclus.
      </p>

      <div className="mt-[var(--space-admin-4)] flex flex-wrap items-end gap-[var(--space-admin-3)]">
        <div className="admin-field">
          <label className="admin-label" htmlFor="indispo-type">
            Type
          </label>
          <select
            id="indispo-type"
            className="admin-input"
            value={type}
            onChange={(e) => setType(e.target.value as TrainerAvailabilityTypeValue)}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {LIBELLE_INDISPO[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor="indispo-debut">
            Du
          </label>
          <input
            id="indispo-debut"
            type="date"
            className="admin-input"
            value={debut}
            onChange={(e) => setDebut(e.target.value)}
          />
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor="indispo-fin">
            Au (inclus)
          </label>
          <input
            id="indispo-fin"
            type="date"
            className="admin-input"
            value={fin}
            onChange={(e) => setFin(e.target.value)}
          />
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor="indispo-motif">
            Motif (facultatif)
          </label>
          <input
            id="indispo-motif"
            className="admin-input"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="admin-button"
          disabled={isPending || debut === "" || fin === ""}
          onClick={ajouter}
        >
          {isPending ? "…" : "Ajouter"}
        </button>
      </div>

      {error !== null && (
        <p
          role="alert"
          className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-destructive)]"
        >
          {error}
        </p>
      )}

      {indispos.length === 0 ? (
        <p className="admin-muted mt-[var(--space-admin-4)]">Aucune indisponibilité enregistrée.</p>
      ) : (
        <table className="admin-table mt-[var(--space-admin-4)]">
          <thead>
            <tr>
              <th scope="col">Type</th>
              <th scope="col">Du</th>
              <th scope="col">Au (inclus)</th>
              <th scope="col">Jours</th>
              <th scope="col">Motif</th>
              <th scope="col">
                <span className="sr-only">Supprimer</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {indispos.map((i) => (
              <tr key={i.id}>
                <td>{LIBELLE_INDISPO[i.type]}</td>
                <td>{i.debut}</td>
                <td>{i.fin}</td>
                <td className="tabular-nums">
                  {joursDeLIndispo({ trainerId, type: i.type, debut: i.debut, fin: i.fin }).length}
                </td>
                <td>{i.motif ?? "—"}</td>
                <td>
                  <button
                    type="button"
                    className="admin-button-ghost"
                    disabled={isPending}
                    onClick={() => supprimer(i.id)}
                  >
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
