"use client";
// use-client: formulaire interactif (déclaration d'un incident) + useTransition pour la server action.

/**
 * IncidentForm — Formulaire de déclaration d'un incident (LOT 4).
 *
 * "use client" : interactivité locale + appel Server Action.
 * Zéro appel DB côté client — la liste des sessions est passée par le parent.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { creerIncidentAction } from "@/server/actions/qualiopi/incidents";

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
const fieldCls = "flex flex-col gap-1";

export interface IncidentFormProps {
  creerAction: typeof creerIncidentAction;
  /** Sessions récentes proposées pour le rattachement (facultatif). */
  sessions: Array<{ id: string; numero: string; titreSession: string }>;
}

export function IncidentForm({ creerAction, sessions }: IncidentFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [type, setType] = useState<IncidentType>("pedagogique");
  const [gravite, setGravite] = useState<IncidentGravite>("mineur");
  const [statut, setStatut] = useState<IncidentStatut>("ouvert");
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [dateIncident, setDateIncident] = useState(() => new Date().toISOString().slice(0, 10));
  const [actionCorrective, setActionCorrective] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!dateIncident) {
      setError("La date de l'incident est requise.");
      return;
    }

    startTransition(async () => {
      const result = await creerAction({
        type,
        gravite,
        statut,
        titre,
        dateIncident: new Date(dateIncident),
        ...(description.trim() ? { description } : {}),
        ...(sessionId ? { sessionId } : {}),
        ...(actionCorrective.trim() ? { actionCorrective } : {}),
      });

      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccessMsg("Incident enregistré au registre.");
        setTitre("");
        setDescription("");
        setSessionId("");
        setActionCorrective("");
        router.refresh();
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-6)]"
    >
      <h3 className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
        Déclarer un incident
      </h3>

      <div className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-4">
        {/* Type */}
        <div className={fieldCls}>
          <label htmlFor="incidentform-type" className={labelCls}>
            Type
          </label>
          <select
            id="incidentform-type"
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

        {/* Gravité */}
        <div className={fieldCls}>
          <label htmlFor="incidentform-gravite" className={labelCls}>
            Gravité
          </label>
          <select
            id="incidentform-gravite"
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

        {/* Statut */}
        <div className={fieldCls}>
          <label htmlFor="incidentform-statut" className={labelCls}>
            Statut
          </label>
          <select
            id="incidentform-statut"
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

        {/* Date de l'incident */}
        <div className={fieldCls}>
          <label htmlFor="incidentform-date-de-lincident" className={labelCls}>
            Date de l&apos;incident
          </label>
          <input
            id="incidentform-date-de-lincident"
            type="date"
            value={dateIncident}
            onChange={(e) => setDateIncident(e.target.value)}
            disabled={isPending}
            required
            className={inputCls}
          />
        </div>
      </div>

      {/* Titre */}
      <div className={`mt-[var(--space-admin-4)] ${fieldCls}`}>
        <label htmlFor="incidentform-titre" className={labelCls}>
          Titre
        </label>
        <input
          id="incidentform-titre"
          type="text"
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          disabled={isPending}
          required
          maxLength={300}
          placeholder="Ex. : Coupure visio pendant la session du 12/03 — 40 min perdues"
          className={inputCls}
        />
      </div>

      {/* Session liée */}
      <div className={`mt-[var(--space-admin-4)] ${fieldCls}`}>
        <label htmlFor="incidentform-session-liee-facultatif" className={labelCls}>
          Session liée (facultatif)
        </label>
        <select
          id="incidentform-session-liee-facultatif"
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
          disabled={isPending}
          className={inputCls}
        >
          <option value="">— Aucune session —</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.numero} — {s.titreSession}
            </option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div className={`mt-[var(--space-admin-4)] ${fieldCls}`}>
        <label htmlFor="incidentform-description-facultatif" className={labelCls}>
          Description (facultatif)
        </label>
        <textarea
          id="incidentform-description-facultatif"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isPending}
          rows={2}
          placeholder="Contexte, impact, personnes concernées…"
          className={inputCls}
        />
      </div>

      {/* Action corrective */}
      <div className={`mt-[var(--space-admin-4)] ${fieldCls}`}>
        <label htmlFor="incidentform-action-corrective-facultatif-ali" className={labelCls}>
          Action corrective (facultatif — alimente M9)
        </label>
        <textarea
          id="incidentform-action-corrective-facultatif-ali"
          value={actionCorrective}
          onChange={(e) => setActionCorrective(e.target.value)}
          disabled={isPending}
          rows={2}
          placeholder="Mesure décidée/réalisée pour éviter la récurrence…"
          className={inputCls}
        />
      </div>

      {error && (
        <p
          role="alert"
          className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          Erreur : {error}
        </p>
      )}
      {successMsg && (
        <p
          role="status"
          className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
        >
          {successMsg}
        </p>
      )}

      <button type="submit" disabled={isPending} className="admin-button mt-[var(--space-admin-4)]">
        {isPending ? "Enregistrement..." : "Enregistrer l'incident"}
      </button>
    </form>
  );
}
