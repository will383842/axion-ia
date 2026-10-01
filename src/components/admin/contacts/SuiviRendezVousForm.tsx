"use client";
// use-client: champs conditionnels (suite, échéance) et erreur affichée sans recharger.

// Formulaire « Faire le point » d'un rendez-vous (2026-09-27, refait le même jour).
//
// Demande de Will : « ce n'est pas intuitif ». Le point se fait désormais EN UN
// GESTE, là où l'on est quand on raccroche : sur la carte du rendez-vous, sous
// le bouton de visio.
//   · « Reporté » ENREGISTRE au clic — il n'y a rien d'autre à dire ;
//   · « Absent » propose d'abord l'e-mail de relance, puis « Enregistrer ».
//     Enregistrer au clic ferait disparaître la carte de « À faire le point »
//     — et le lien de relance avec elle, au moment précis où l'on en a besoin ;
//   · « A eu lieu » ouvre la suite et son échéance (obligatoires, cf.
//     `suivi.ts`), puis « Enregistrer ».
// La règle elle-même est côté serveur ; ce composant ne fait que l'annoncer.

import { useActionState, useState } from "react";

import { enregistrerSuiviAction, type EtatSuivi } from "@/features/admin-rendezvous/suivi-actions";
import {
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

/** Classe d'un gros bouton de choix, doigt compris (44 px). */
const CHOIX =
  "inline-flex min-h-[44px] items-center gap-[var(--space-admin-2)] rounded-[var(--radius-admin-md)] border px-[var(--space-admin-4)] font-medium";
const CHOIX_ACTIF =
  "border-[color:var(--color-admin-accent)] bg-[color:var(--color-admin-accent)] text-[color:var(--color-admin-accent-fg)]";
const CHOIX_REPOS =
  "border-[color:var(--color-admin-border-strong)] bg-[color:var(--color-admin-paper)] text-[color:var(--color-admin-fg)]";

export function SuiviRendezVousForm({
  calendlyEventId,
  initial = null,
  mailtoRelance = null,
}: SuiviRendezVousFormProps): React.ReactElement {
  const [etat, action, enCours] = useActionState(enregistrerSuiviAction, ETAT_INITIAL);
  // Ce que l'utilisateur a cliqué en dernier — pilote l'affichage, pas l'envoi.
  const [choix, setChoix] = useState<IssueRdv | null>(initial?.issue ?? null);
  const [suite, setSuite] = useState<SuiteRdv | "">(initial?.suite ?? "");
  // 🔑 CONTRÔLÉS, tous. React 19 remet un `<form action>` à zéro une fois
  // l'action terminée — y compris quand elle rend une erreur. Un champ en
  // `defaultValue` perdrait alors la note tapée, précisément au moment où il
  // faut la renvoyer.
  const [suiteLe, setSuiteLe] = useState(initial?.suiteLe ?? "");
  const [note, setNote] = useState(initial?.note ?? "");

  const classeChoix = (i: IssueRdv): string =>
    `${CHOIX} ${choix === i ? CHOIX_ACTIF : CHOIX_REPOS}`;

  return (
    <form action={action} className="flex flex-col gap-[var(--space-admin-3)]">
      <input type="hidden" name="calendlyEventId" value={calendlyEventId} />

      <div
        role="group"
        aria-label="Le rendez-vous a-t-il eu lieu ?"
        className="flex flex-wrap gap-[var(--space-admin-2)]"
      >
        {/* « A eu lieu » N'ENVOIE PAS : il faut d'abord dire la suite. */}
        <button
          type="button"
          className={classeChoix("eu_lieu")}
          aria-pressed={choix === "eu_lieu"}
          onClick={() => setChoix("eu_lieu")}
          disabled={enCours}
        >
          ✅ {LIBELLE_ISSUE.eu_lieu}
        </button>
        <button
          type="button"
          className={classeChoix("absent")}
          aria-pressed={choix === "absent"}
          onClick={() => setChoix("absent")}
          disabled={enCours}
        >
          ❌ {LIBELLE_ISSUE.absent}
        </button>
        {/* « Reporté » ENVOIE au clic : le bouton porte la valeur (`name` /
            `value` du bouton soumetteur, lue par l'action). */}
        <button
          type="submit"
          name="issue"
          value="reporte"
          className={classeChoix("reporte")}
          aria-pressed={choix === "reporte"}
          onClick={() => setChoix("reporte")}
          disabled={enCours}
        >
          🔁 {LIBELLE_ISSUE.reporte}
        </button>
      </div>

      {choix === "eu_lieu" ? (
        <div className="flex flex-col gap-[var(--space-admin-3)]">
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
          <div>
            <button
              type="submit"
              name="issue"
              value="eu_lieu"
              className="admin-button"
              disabled={enCours}
            >
              {enCours ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      ) : null}

      {enCours ? (
        <p role="status" className="text-[color:var(--color-admin-fg-muted)]">
          Enregistrement…
        </p>
      ) : etat.etat === "erreur" ? (
        <p role="alert" className="text-[color:var(--color-admin-danger)]">
          {etat.message}
        </p>
      ) : etat.etat === "ok" ? (
        <p role="status" className="text-[color:var(--color-admin-success)]">
          {etat.message}
        </p>
      ) : null}

      {/* « Absent » : la relance d'abord (brouillon dans la messagerie de
          Will, rien ne part), l'enregistrement ensuite. */}
      {choix === "absent" ? (
        <div className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
          {mailtoRelance ? (
            <a href={mailtoRelance} className="admin-button-secondary">
              ✉️ Préparer l&apos;e-mail de relance
            </a>
          ) : null}
          <button
            type="submit"
            name="issue"
            value="absent"
            className="admin-button"
            disabled={enCours}
          >
            {enCours ? "Enregistrement…" : "Enregistrer : absent"}
          </button>
          {mailtoRelance ? (
            <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
              L&apos;e-mail s&apos;ouvre dans votre messagerie : rien ne part sans vous.
            </span>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
