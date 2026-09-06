"use client";
// use-client: renvoi de proposition et déclaration d'absence — état local, transitions serveur.

/**
 * Console — état de la MISSION du formateur principal (2026-09-03).
 *
 * Sous le sélecteur d'affectation, ce panneau dit ce que le formateur a
 * répondu — ou n'a pas répondu — et offre les deux gestes qui restent à
 * l'organisme : renvoyer la proposition, consigner une absence. Il ne décide
 * rien à la place de Will.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  consignerAccordHorsOutilAction,
  renvoyerPropositionMissionAction,
  declarerAbsenceFormateurAction,
} from "@/server/actions/qualiopi/mission-formateur";

export interface MissionFormateurPanelProps {
  sessionId: string;
  trainerId: string;
  trainerNom: string;
  /** Phrase d'état déjà formulée côté serveur (statut + date + motif). */
  etat: string;
  /** Vrai tant qu'aucune réponse n'est venue : le bouton « Renvoyer » a un sens. */
  enAttente: boolean;
  /** Vrai si la session est encore à venir : on ne renvoie pas une proposition pour une session passée. */
  sessionAVenir: boolean;
  /** Vrai si la session a démarré ou est passée : déclarer une absence a un sens. */
  absencePossible: boolean;
  /**
   * Vrai quand la sollicitation est restée SANS RÉPONSE et que la session a
   * démarré : c'est le seul cas où « consigner l'accord » a un sens.
   *
   * 🔴 Cette branche n'existait pas, et elle est celle que l'alerte réclame.
   * `formateur_mission_expiree` demande de « vérifier que la session a bien été
   * animée » OU de consigner un incident — l'écran n'offrait que le second, et
   * « Proposer à nouveau » disparaît dès que la session démarre. Une session
   * réellement animée n'avait donc AUCUN geste, et l'alerte, `resolutionAuto`,
   * ne pouvait plus s'éteindre.
   */
  accordConsignable: boolean;
}

const FAITS = [
  { value: "desistement", label: "Désistement — ne s'est pas présenté" },
  { value: "annulation_tardive", label: "Annulation tardive — a prévenu trop tard" },
] as const;

export function MissionFormateurPanel({
  sessionId,
  trainerId,
  trainerNom,
  etat,
  enAttente,
  sessionAVenir,
  absencePossible,
  accordConsignable,
}: MissionFormateurPanelProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [absenceOuverte, setAbsenceOuverte] = useState(false);
  const [accordOuvert, setAccordOuvert] = useState(false);
  const [motifAccord, setMotifAccord] = useState("");
  const [fait, setFait] = useState<(typeof FAITS)[number]["value"]>("desistement");
  const [commentaire, setCommentaire] = useState("");

  function renvoyer() {
    setMsg(null);
    setErreur(null);
    startTransition(async () => {
      const r = await renvoyerPropositionMissionAction({ sessionId, trainerId });
      if ("error" in r) {
        setErreur(r.error);
        return;
      }
      setMsg(
        r.data.emailEnvoye
          ? "Proposition renvoyée : le formateur a reçu un nouveau lien de réponse."
          : "Proposition journalisée, mais l'e-mail n'est pas parti (file indisponible ou message garé) — voir la chaîne d'envoi.",
      );
      router.refresh();
    });
  }

  function declarer() {
    setMsg(null);
    setErreur(null);
    startTransition(async () => {
      const r = await declarerAbsenceFormateurAction({
        sessionId,
        trainerId,
        fait,
        ...(commentaire.trim() !== "" ? { commentaire: commentaire.trim() } : {}),
      });
      if ("error" in r) {
        setErreur(r.error);
        return;
      }
      setMsg(
        "Absence consignée au registre des incidents ; elle pèse sur la fiabilité du formateur.",
      );
      setAbsenceOuverte(false);
      setCommentaire("");
      router.refresh();
    });
  }

  function consignerAccord() {
    setMsg(null);
    setErreur(null);
    startTransition(async () => {
      const r = await consignerAccordHorsOutilAction({
        sessionId,
        trainerId,
        motif: motifAccord.trim(),
      });
      if ("error" in r) {
        setErreur(r.error);
        return;
      }
      setMsg(
        "Accord consigné hors outil. La ligne porte désormais votre nom, la date " +
          "et votre motif — un auditeur ne la confondra pas avec une acceptation par lien.",
      );
      setAccordOuvert(false);
      setMotifAccord("");
      router.refresh();
    });
  }

  const inputCls =
    "rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]";

  return (
    <div className="mt-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]">
      <p className="admin-meta">Réponse du formateur</p>
      <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
        <strong>{trainerNom}</strong> — {etat}
      </p>

      <div className="mt-[var(--space-admin-3)] flex flex-wrap gap-[var(--space-admin-3)]">
        {sessionAVenir && (
          <button type="button" className="admin-button" disabled={isPending} onClick={renvoyer}>
            {isPending ? "…" : enAttente ? "Renvoyer la proposition" : "Proposer à nouveau"}
          </button>
        )}
        {accordConsignable && !accordOuvert && (
          <button
            type="button"
            className="admin-button"
            disabled={isPending}
            onClick={() => setAccordOuvert(true)}
          >
            Consigner l’accord (donné hors outil)
          </button>
        )}
        {absencePossible && !absenceOuverte && (
          <button
            type="button"
            className="admin-button"
            disabled={isPending}
            onClick={() => setAbsenceOuverte(true)}
          >
            Déclarer une absence
          </button>
        )}
      </div>

      {accordOuvert && (
        <div className="mt-[var(--space-admin-4)] space-y-[var(--space-admin-3)]">
          <label
            className="mb-[var(--space-admin-1)] block text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase"
            htmlFor="accord-motif"
          >
            D’où vient cet accord ?
          </label>
          <textarea
            id="accord-motif"
            value={motifAccord}
            onChange={(e) => setMotifAccord(e.target.value)}
            rows={3}
            className={`${inputCls} w-full`}
            placeholder="Ex. : accord donné par téléphone le 04/09 à 18h10, confirmé sur place le jour de la session."
          />
          <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            La ligne ne dira PAS « acceptée » : elle dira « accord consigné hors outil », avec votre
            nom, la date et ce motif. Un auditeur doit pouvoir distinguer un accord attesté par
            l’organisme d’une acceptation cliquée par le formateur.
          </p>
          <div className="flex flex-wrap gap-[var(--space-admin-3)]">
            <button
              type="button"
              className="admin-button"
              disabled={isPending || motifAccord.trim().length < 15}
              onClick={consignerAccord}
            >
              {isPending ? "…" : "Consigner l’accord"}
            </button>
            <button
              type="button"
              className="admin-button"
              disabled={isPending}
              onClick={() => setAccordOuvert(false)}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {absenceOuverte && (
        <div className="mt-[var(--space-admin-4)] space-y-[var(--space-admin-3)]">
          <div>
            <label
              className="mb-[var(--space-admin-1)] block text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase"
              htmlFor="absence-fait"
            >
              Fait constaté
            </label>
            <select
              id="absence-fait"
              value={fait}
              onChange={(e) => setFait(e.target.value as (typeof FAITS)[number]["value"])}
              disabled={isPending}
              className={inputCls}
            >
              {FAITS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              className="mb-[var(--space-admin-1)] block text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase"
              htmlFor="absence-commentaire"
            >
              Circonstances (facultatif)
            </label>
            <textarea
              id="absence-commentaire"
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              disabled={isPending}
              rows={2}
              maxLength={2000}
              className={`${inputCls} w-full`}
            />
          </div>
          <div className="flex flex-wrap gap-[var(--space-admin-3)]">
            <button type="button" className="admin-button" disabled={isPending} onClick={declarer}>
              {isPending ? "…" : "Consigner l'absence"}
            </button>
            <button
              type="button"
              className="admin-button"
              disabled={isPending}
              onClick={() => setAbsenceOuverte(false)}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {erreur && (
        <p
          role="alert"
          className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-destructive)]"
        >
          {erreur}
        </p>
      )}
      {msg && (
        <p
          role="status"
          className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
        >
          {msg}
        </p>
      )}
    </div>
  );
}
