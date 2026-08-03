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

type IncidentFait =
  | "annulation_tardive"
  | "desistement"
  | "retard"
  | "preuve_manquante"
  | "qualite_insuffisante"
  | "autre";

/**
 * Faits reprochables à un intervenant externe (art. 7 de la procédure de
 * sous-traitance). Des FAITS observables, jamais un jugement de valeur : c'est
 * ce qui rend le registre opposable lors de la reconduction (art. 8).
 */
const FAIT_LABELS: Record<IncidentFait, string> = {
  annulation_tardive: "Annulation tardive",
  desistement: "Désistement",
  retard: "Retard",
  preuve_manquante: "Preuve non transmise",
  qualite_insuffisante: "Qualité insuffisante",
  autre: "Autre",
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
  /**
   * Intervenants externes qu'un incident peut mettre en cause (art. 7).
   * Les deux natures dans une seule liste : c'est une seule question posée à
   * Will (« qui ? »), pas deux champs dont un reste toujours vide.
   */
  intervenants?: Array<{ valeur: string; libelle: string }>;
}

export function IncidentForm({ creerAction, sessions, intervenants = [] }: IncidentFormProps) {
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
  // Encodé « Trainer:<id> » ou « SousTraitant:<id> » pour tenir les deux natures
  // dans un seul <select>. Chaîne vide = incident ne visant personne.
  const [intervenant, setIntervenant] = useState("");
  const [faitIntervenant, setFaitIntervenant] = useState<IncidentFait>("annulation_tardive");

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
        // Les deux champs voyagent ensemble : désigner quelqu'un sans dire ce
        // qu'on lui reproche serait une accusation sans motif, que l'article 8
        // ne permettrait pas de lui opposer.
        ...(intervenant
          ? {
              ...(intervenant.startsWith("Trainer:")
                ? { trainerId: intervenant.slice("Trainer:".length) }
                : { sousTraitantId: intervenant.slice("SousTraitant:".length) }),
              faitIntervenant,
            }
          : {}),
      });

      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccessMsg("Incident enregistré au registre.");
        setTitre("");
        setDescription("");
        setSessionId("");
        setActionCorrective("");
        setIntervenant("");
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

      {/*
        Mise en cause d'un intervenant externe — art. 7 de la procédure de
        sous-traitance. Rendu SEULEMENT s'il existe des intervenants : sans
        sous-traitant référencé, un champ vide se lirait comme une donnée
        manquante alors qu'il n'y a rien à saisir.
      */}
      {intervenants.length > 0 && (
        <div className="mt-[var(--space-admin-4)] grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2">
          <div className={fieldCls}>
            <label htmlFor="incidentform-intervenant" className={labelCls}>
              Intervenant externe mis en cause (facultatif)
            </label>
            <select
              id="incidentform-intervenant"
              value={intervenant}
              onChange={(e) => setIntervenant(e.target.value)}
              disabled={isPending}
              className={inputCls}
            >
              <option value="">— Aucun —</option>
              {intervenants.map((i) => (
                <option key={i.valeur} value={i.valeur}>
                  {i.libelle}
                </option>
              ))}
            </select>
          </div>

          {intervenant !== "" && (
            <div className={fieldCls}>
              <label htmlFor="incidentform-fait-intervenant" className={labelCls}>
                Fait reproché
              </label>
              <select
                id="incidentform-fait-intervenant"
                value={faitIntervenant}
                onChange={(e) => setFaitIntervenant(e.target.value as IncidentFait)}
                disabled={isPending}
                className={inputCls}
              >
                {(Object.keys(FAIT_LABELS) as IncidentFait[]).map((f) => (
                  <option key={f} value={f}>
                    {FAIT_LABELS[f]}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

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
