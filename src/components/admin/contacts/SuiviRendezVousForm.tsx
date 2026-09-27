"use client";
// use-client: champs conditionnels (suite, échéance) et erreur affichée sans recharger.

// Formulaire « Faire le point » d'un rendez-vous (2026-09-27).
//
// Client, et c'est justifié : le choix « A eu lieu » fait apparaître la suite
// et son échéance, et l'erreur de validation doit s'afficher sans recharger la
// page ni perdre ce qui a été saisi. La règle elle-même est côté serveur
// (`suivi.ts`) — ce composant ne fait que l'annoncer.

import { useActionState, useState } from "react";

import { enregistrerSuiviAction, type EtatSuivi } from "@/features/admin-rendezvous/suivi-actions";
import {
  ISSUES,
  LIBELLE_ISSUE,
  LIBELLE_SUITE,
  SUITES,
  type IssueRdv,
  type SuiteRdv,
} from "@/features/admin-rendezvous/suivi";

export interface SuiviRendezVousFormProps {
  readonly calendlyEventId: string;
  readonly initial?: {
    readonly issue: IssueRdv;
    readonly suite: SuiteRdv | null;
    readonly suiteLe: string | null;
    readonly note: string | null;
  } | null;
  /** `mailto:` de relance, proposé quand « Absent » est choisi. */
  readonly mailtoRelance?: string | null;
}

const ETAT_INITIAL: EtatSuivi = { etat: "initial" };

export function SuiviRendezVousForm({
  calendlyEventId,
  initial = null,
  mailtoRelance = null,
}: SuiviRendezVousFormProps): React.ReactElement {
  const [etat, action, enCours] = useActionState(enregistrerSuiviAction, ETAT_INITIAL);
  const [issue, setIssue] = useState<IssueRdv | null>(initial?.issue ?? null);
  const [suite, setSuite] = useState<SuiteRdv | "">(initial?.suite ?? "");
  // 🔑 CONTRÔLÉS, tous. React 19 remet un `<form action>` à zéro une fois
  // l'action terminée — y compris quand elle rend une erreur. Un champ en
  // `defaultValue` perdrait alors la note tapée, précisément au moment où il
  // faut la renvoyer.
  const [suiteLe, setSuiteLe] = useState(initial?.suiteLe ?? "");
  const [note, setNote] = useState(initial?.note ?? "");

  return (
    <form action={action} className="flex flex-col gap-[var(--space-admin-3)]">
      <input type="hidden" name="calendlyEventId" value={calendlyEventId} />

      <fieldset className="flex flex-wrap gap-[var(--space-admin-2)]">
        <legend className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] font-medium">
          Le rendez-vous…
        </legend>
        {ISSUES.map((i) => (
          <label
            key={i}
            className="flex min-h-[44px] cursor-pointer items-center gap-[var(--space-admin-2)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] px-[var(--space-admin-3)]"
          >
            <input
              type="radio"
              name="issue"
              value={i}
              checked={issue === i}
              onChange={() => setIssue(i)}
            />
            {i === "eu_lieu" ? "✅ " : i === "absent" ? "❌ " : "🔁 "}
            {LIBELLE_ISSUE[i]}
          </label>
        ))}
      </fieldset>

      {issue === "eu_lieu" ? (
        <div className="flex flex-wrap gap-[var(--space-admin-3)]">
          <label className="flex flex-col gap-1 text-[length:var(--text-admin-sm)]">
            Suite à donner
            <select
              name="suite"
              value={suite}
              onChange={(e) => setSuite(e.target.value as SuiteRdv | "")}
              className="admin-input"
              required
            >
              <option value="">— choisir —</option>
              {SUITES.map((s) => (
                <option key={s} value={s}>
                  {LIBELLE_SUITE[s]}
                </option>
              ))}
            </select>
          </label>
          {suite && suite !== "aucune" ? (
            <label className="flex flex-col gap-1 text-[length:var(--text-admin-sm)]">
              Pour le
              <input
                type="date"
                name="suiteLe"
                value={suiteLe}
                onChange={(e) => setSuiteLe(e.target.value)}
                className="admin-input"
                required
              />
            </label>
          ) : null}
        </div>
      ) : null}

      {issue === "absent" && mailtoRelance ? (
        <p className="text-[length:var(--text-admin-sm)]">
          <a href={mailtoRelance} className="admin-link">
            Préparer l&apos;e-mail de relance ›
          </a>{" "}
          <span className="text-[color:var(--color-admin-fg-muted)]">
            — il s&apos;ouvre dans votre messagerie, rien ne part sans vous.
          </span>
        </p>
      ) : null}

      <label className="flex flex-col gap-1 text-[length:var(--text-admin-sm)]">
        Note (facultatif)
        <textarea
          name="note"
          rows={2}
          maxLength={5000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="admin-input"
        />
      </label>

      <div className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
        <button type="submit" className="admin-button" disabled={enCours || issue === null}>
          {enCours
            ? "Enregistrement…"
            : initial
              ? "Mettre à jour le point"
              : "Enregistrer le point"}
        </button>
        {etat.etat === "erreur" ? (
          <p role="alert" className="text-[color:var(--color-admin-danger)]">
            {etat.message}
          </p>
        ) : etat.etat === "ok" ? (
          <p role="status" className="text-[color:var(--color-admin-success)]">
            {etat.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
