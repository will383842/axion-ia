"use client";
// use-client: compléter / décider / noter un incident via useTransition + Server Actions.

/**
 * IncidentRowActions — Suivi d'un incident (LOT 4, refondu en L09).
 *
 * 🔴 Chantier QNC, L09 — plus de « Modifier » libre ni de « Supprimer » : un
 * incident déclaré est une pièce du registre. Il reste trois gestes :
 *   - compléter ce qui n'a jamais été renseigné (nature, déclarant, origine,
 *     action corrective) ;
 *   - décider d'un changement de statut, avec son motif ;
 *   - ajouter une note (une erreur dans le titre se corrige par une note).
 * Chaque geste est écrit par le serveur dans une note signée du nom réel de la
 * personne connectée.
 *
 * Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useConfirmation } from "@/components/admin/ui/useConfirmation";
import type {
  updateIncidentAction,
  ajouterNoteIncidentAction,
} from "@/server/actions/qualiopi/incidents";
import {
  DECLARANTS_INCIDENT,
  LIBELLE_DECLARANT,
  LIBELLE_NATURE,
  LIBELLE_ORIGINE,
  LIBELLE_STATUT_INCIDENT,
  MOTIF_MIN,
  NATURES_INCIDENT,
  ORIGINES_INCIDENT,
  STATUTS_INCIDENT,
  type DeclarantIncident,
  type NatureIncident,
  type OrigineIncident,
  type StatutIncident,
} from "@/server/qualiopi/registres/incident-complement";

const inputCls =
  "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-admin-accent)]";
const labelCls =
  "block text-[length:var(--text-admin-xs)] font-medium uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-1";
const lienCls =
  "text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline disabled:opacity-50";

export interface IncidentRowActionsProps {
  incident: {
    id: string;
    statut: string;
    nature: string | null;
    declarant: string | null;
    origine: string | null;
    actionCorrective: string;
  };
  updateAction: typeof updateIncidentAction;
  noteAction: typeof ajouterNoteIncidentAction;
}

type Panneau = "fermé" | "suivi" | "note";

export function IncidentRowActions({
  incident,
  updateAction,
  noteAction,
}: IncidentRowActionsProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [panneau, setPanneau] = useState<Panneau>("fermé");
  const [error, setError] = useState<string | null>(null);
  const { demander, dialogue } = useConfirmation();

  const [statut, setStatut] = useState<StatutIncident>(incident.statut as StatutIncident);
  const [motif, setMotif] = useState("");
  const [nature, setNature] = useState<NatureIncident | "">("");
  const [declarant, setDeclarant] = useState<DeclarantIncident | "">("");
  const [origine, setOrigine] = useState<OrigineIncident | "">("");
  const [actionCorrective, setActionCorrective] = useState("");
  const [note, setNote] = useState("");

  const changeStatut = statut !== incident.statut;

  function terminer(result: { error: string } | { data: unknown }) {
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setPanneau("fermé");
    setMotif("");
    setNote("");
    setActionCorrective("");
    router.refresh();
  }

  function handleSuivi(e: React.FormEvent) {
    e.preventDefault();
    demander(
      {
        titre: "Inscrire cette décision au registre",
        description:
          "La note est signée de votre nom et datée par le serveur. Elle ne pourra plus être modifiée ni effacée : une erreur se corrigera par une note suivante.",
        libelleConfirmer: "Inscrire",
      },
      () => enregistrerSuivi(),
    );
  }

  function enregistrerSuivi() {
    setError(null);
    startTransition(async () => {
      terminer(
        await updateAction({
          id: incident.id,
          ...(changeStatut ? { statut } : {}),
          ...(motif.trim() ? { motif } : {}),
          ...(nature ? { nature } : {}),
          ...(declarant ? { declarant } : {}),
          ...(origine ? { origine } : {}),
          ...(actionCorrective.trim() ? { actionCorrective } : {}),
        }),
      );
    });
  }

  function handleNote(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      terminer(await noteAction({ id: incident.id, texte: note }));
    });
  }

  return (
    <div className="flex flex-col gap-[var(--space-admin-2)]">
      {dialogue}
      <div className="flex flex-wrap gap-[var(--space-admin-2)]">
        <button
          type="button"
          onClick={() => setPanneau((p) => (p === "suivi" ? "fermé" : "suivi"))}
          disabled={isPending}
          className={lienCls}
        >
          {panneau === "suivi" ? "Fermer" : "Décider / compléter"}
        </button>
        <button
          type="button"
          onClick={() => setPanneau((p) => (p === "note" ? "fermé" : "note"))}
          disabled={isPending}
          className={lienCls}
        >
          {panneau === "note" ? "Fermer" : "Ajouter une note"}
        </button>
      </div>

      {panneau === "suivi" && (
        <form
          onSubmit={handleSuivi}
          className="w-80 rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-4)]"
        >
          <div className="flex flex-col gap-[var(--space-admin-3)]">
            <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
              Un incident déclaré ne se réécrit pas. Vous pouvez décider de son statut (avec un
              motif) et compléter ce qui n&apos;a jamais été renseigné. Votre nom signe la note.
            </p>
            <div>
              <label htmlFor={`incident-${incident.id}-statut`} className={labelCls}>
                Statut
              </label>
              <select
                id={`incident-${incident.id}-statut`}
                value={statut}
                onChange={(e) => setStatut(e.target.value as StatutIncident)}
                disabled={isPending}
                className={inputCls}
              >
                {STATUTS_INCIDENT.map((s) => (
                  <option key={s} value={s}>
                    {LIBELLE_STATUT_INCIDENT[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`incident-${incident.id}-motif`} className={labelCls}>
                Motif de la décision{changeStatut ? ` (${MOTIF_MIN} caractères au moins)` : ""}
              </label>
              <textarea
                id={`incident-${incident.id}-motif`}
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                disabled={isPending}
                required={changeStatut}
                minLength={changeStatut ? MOTIF_MIN : undefined}
                rows={2}
                className={inputCls}
              />
            </div>
            {incident.nature === null && (
              <ChoixListe
                id={`incident-${incident.id}-nature`}
                libelle="Nature"
                valeur={nature}
                options={NATURES_INCIDENT.map((n) => [n, LIBELLE_NATURE[n]])}
                onChange={(v) => setNature(v as NatureIncident | "")}
                disabled={isPending}
              />
            )}
            {incident.declarant === null && (
              <ChoixListe
                id={`incident-${incident.id}-declarant`}
                libelle="Déclarant"
                valeur={declarant}
                options={DECLARANTS_INCIDENT.map((d) => [d, LIBELLE_DECLARANT[d]])}
                onChange={(v) => setDeclarant(v as DeclarantIncident | "")}
                disabled={isPending}
              />
            )}
            {incident.origine === null && (
              <ChoixListe
                id={`incident-${incident.id}-origine`}
                libelle="Origine"
                valeur={origine}
                options={ORIGINES_INCIDENT.map((o) => [o, LIBELLE_ORIGINE[o]])}
                onChange={(v) => setOrigine(v as OrigineIncident | "")}
                disabled={isPending}
              />
            )}
            {incident.actionCorrective.trim() === "" && (
              <div>
                <label htmlFor={`incident-${incident.id}-action`} className={labelCls}>
                  Action corrective (reprise dans le pilotage)
                </label>
                <textarea
                  id={`incident-${incident.id}-action`}
                  value={actionCorrective}
                  onChange={(e) => setActionCorrective(e.target.value)}
                  disabled={isPending}
                  rows={2}
                  className={inputCls}
                />
              </div>
            )}
            <button type="submit" disabled={isPending} className="admin-button">
              {isPending ? "Enregistrement…" : "Enregistrer la décision"}
            </button>
          </div>
        </form>
      )}

      {panneau === "note" && (
        <form
          onSubmit={handleNote}
          className="w-80 rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-4)]"
        >
          <div className="flex flex-col gap-[var(--space-admin-3)]">
            <div>
              <label htmlFor={`incident-${incident.id}-note`} className={labelCls}>
                Note de suivi (ne s&apos;efface pas)
              </label>
              <textarea
                id={`incident-${incident.id}-note`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={isPending}
                required
                minLength={3}
                rows={3}
                className={inputCls}
              />
            </div>
            <button type="submit" disabled={isPending} className="admin-button">
              {isPending ? "Enregistrement…" : "Ajouter la note"}
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

function ChoixListe(props: {
  id: string;
  libelle: string;
  valeur: string;
  options: ReadonlyArray<readonly [string, string]>;
  onChange: (v: string) => void;
  disabled: boolean;
}): React.ReactElement {
  return (
    <div>
      <label htmlFor={props.id} className={labelCls}>
        {props.libelle} (à compléter)
      </label>
      <select
        id={props.id}
        value={props.valeur}
        onChange={(e) => props.onChange(e.target.value)}
        disabled={props.disabled}
        className={inputCls}
      >
        <option value="">— non renseigné —</option>
        {props.options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}
