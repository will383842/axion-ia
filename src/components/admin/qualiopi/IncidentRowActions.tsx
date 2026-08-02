"use client";
// use-client: édition inline + suppression d'un incident via useTransition + Server Actions.

/**
 * IncidentRowActions — Édition / suppression d'un incident (LOT 4).
 *
 * Bouton « Modifier » ouvre un panneau d'édition inline (statut, gravité,
 * action corrective…) → updateIncidentAction (statut resolu → resoluAt posé
 * côté service). Bouton « Supprimer » → supprimerIncidentAction (confirmation).
 *
 * "use client" : useState/useTransition + appel Server Actions.
 * Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  updateIncidentAction,
  supprimerIncidentAction,
} from "@/server/actions/qualiopi/incidents";

type IncidentType = "pedagogique" | "administratif" | "technique" | "autre";
type IncidentGravite = "mineur" | "majeur" | "critique";
type IncidentStatut = "ouvert" | "en_cours" | "resolu";

const TYPE_LABELS: Record<IncidentType, string> = {
  pedagogique: "Pédagogique",
  administratif: "Administratif",
  technique: "Technique",
  autre: "Autre",
};

const GRAVITE_LABELS: Record<IncidentGravite, string> = {
  mineur: "Mineur",
  majeur: "Majeur",
  critique: "Critique",
};

const STATUT_LABELS: Record<IncidentStatut, string> = {
  ouvert: "Ouvert",
  en_cours: "En cours",
  resolu: "Résolu",
};

const inputCls =
  "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-admin-accent)]";
const labelCls =
  "block text-[length:var(--text-admin-xs)] font-medium uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-1";

export interface IncidentRowActionsProps {
  incident: {
    id: string;
    type: string;
    gravite: string;
    statut: string;
    titre: string;
    description: string;
    actionCorrective: string;
    dateIncident: Date;
  };
  updateAction: typeof updateIncidentAction;
  supprimerAction: typeof supprimerIncidentAction;
}

export function IncidentRowActions({
  incident,
  updateAction,
  supprimerAction,
}: IncidentRowActionsProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<IncidentType>(incident.type as IncidentType);
  const [gravite, setGravite] = useState<IncidentGravite>(incident.gravite as IncidentGravite);
  const [statut, setStatut] = useState<IncidentStatut>(incident.statut as IncidentStatut);
  const [titre, setTitre] = useState(incident.titre);
  const [description, setDescription] = useState(incident.description);
  const [actionCorrective, setActionCorrective] = useState(incident.actionCorrective);
  const [dateIncident, setDateIncident] = useState(() =>
    incident.dateIncident.toISOString().slice(0, 10),
  );

  function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateAction({
        id: incident.id,
        type,
        gravite,
        statut,
        titre,
        description,
        actionCorrective,
        ...(dateIncident ? { dateIncident: new Date(dateIncident) } : {}),
      });
      if ("error" in result) {
        setError(result.error);
      } else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  function handleDelete() {
    if (!window.confirm("Supprimer définitivement cet incident du registre ?")) return;
    setError(null);
    startTransition(async () => {
      const result = await supprimerAction({ id: incident.id });
      if ("error" in result) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-[var(--space-admin-2)]">
      <div className="flex flex-wrap gap-[var(--space-admin-2)]">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          disabled={isPending}
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline disabled:opacity-50"
        >
          {open ? "Fermer" : "Modifier"}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)] underline-offset-2 hover:underline disabled:opacity-50"
        >
          {isPending ? "…" : "Supprimer"}
        </button>
      </div>

      {open && (
        <form
          onSubmit={handleUpdate}
          className="w-80 rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-4)]"
        >
          <div className="flex flex-col gap-[var(--space-admin-3)]">
            <div>
              <label htmlFor="incidentrowactions-type" className={labelCls}>
                Type
              </label>
              <select
                id="incidentrowactions-type"
                value={type}
                onChange={(e) => setType(e.target.value as IncidentType)}
                disabled={isPending}
                className={inputCls}
              >
                {(Object.keys(TYPE_LABELS) as IncidentType[]).map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="incidentrowactions-gravite" className={labelCls}>
                Gravité
              </label>
              <select
                id="incidentrowactions-gravite"
                value={gravite}
                onChange={(e) => setGravite(e.target.value as IncidentGravite)}
                disabled={isPending}
                className={inputCls}
              >
                {(Object.keys(GRAVITE_LABELS) as IncidentGravite[]).map((g) => (
                  <option key={g} value={g}>
                    {GRAVITE_LABELS[g]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="incidentrowactions-statut-resolu-date-de-resolution"
                className={labelCls}
              >
                Statut (résolu = date de résolution posée)
              </label>
              <select
                id="incidentrowactions-statut-resolu-date-de-resolution"
                value={statut}
                onChange={(e) => setStatut(e.target.value as IncidentStatut)}
                disabled={isPending}
                className={inputCls}
              >
                {(Object.keys(STATUT_LABELS) as IncidentStatut[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUT_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="incidentrowactions-titre" className={labelCls}>
                Titre
              </label>
              <input
                id="incidentrowactions-titre"
                type="text"
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                disabled={isPending}
                required
                maxLength={300}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="incidentrowactions-date-de-lincident" className={labelCls}>
                Date de l&apos;incident
              </label>
              <input
                id="incidentrowactions-date-de-lincident"
                type="date"
                value={dateIncident}
                onChange={(e) => setDateIncident(e.target.value)}
                disabled={isPending}
                required
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="incidentrowactions-description" className={labelCls}>
                Description
              </label>
              <textarea
                id="incidentrowactions-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isPending}
                rows={2}
                className={inputCls}
              />
            </div>
            <div>
              <label
                htmlFor="incidentrowactions-action-corrective-alimente-m9"
                className={labelCls}
              >
                Action corrective (alimente M9)
              </label>
              <textarea
                id="incidentrowactions-action-corrective-alimente-m9"
                value={actionCorrective}
                onChange={(e) => setActionCorrective(e.target.value)}
                disabled={isPending}
                rows={2}
                className={inputCls}
              />
            </div>
            <button type="submit" disabled={isPending} className="admin-button">
              {isPending ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      )}

      {error && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
        >
          Erreur : {error}
        </p>
      )}
    </div>
  );
}
