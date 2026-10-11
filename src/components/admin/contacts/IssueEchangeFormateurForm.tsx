"use client";
// use-client: aperçu de l'e-mail à la demande, champs conditionnels, confirmation sans recharger.

// L'issue de l'échange avec un formateur indépendant (lot F-CAL-2). Même geste que
// pour un candidat apporteur (`IssueEchangeApporteurForm`) : un bouton selon la
// situation ; « Absent », « Retenu », « Non retenu » ouvrent d'abord l'APERÇU de
// l'e-mail exact, rien ne part avant « Envoyer ». Les règles (une fois par personne,
// deuxième absence, texte validé, dossier en ligne) sont côté serveur.

import { useActionState, useState, useTransition } from "react";

import {
  apercuIssueFormateurAction,
  enregistrerIssueFormateurAction,
  type ApercuIssueFormateur,
  type EtatIssueFormateur,
} from "@/features/admin-rendezvous/issue-formateur-actions";
import {
  ISSUES_ECHANGE,
  LIBELLE_ISSUE_ECHANGE,
  echangeTenu,
  type IssueEchange,
} from "@/features/admin-rendezvous/issue-echange";

export interface IssueEchangeFormateurFormProps {
  readonly calendlyEventId: string;
  /** Administrateur : « Retenu » ouvre la fiche formateur. Masqué sinon ; le serveur refuse aussi. */
  readonly peutRetenir?: boolean;
}

const ETAT_INITIAL: EtatIssueFormateur = { etat: "initial" };
const AVEC_APERCU: ReadonlySet<IssueEchange> = new Set(["absent", "retenu", "non_retenu"]);

const CHOIX =
  "inline-flex min-h-[44px] items-center gap-[var(--space-admin-2)] rounded-[var(--radius-admin-md)] border px-[var(--space-admin-4)] font-medium";
const CHOIX_ACTIF =
  "border-[color:var(--color-admin-accent)] bg-[color:var(--color-admin-accent)] text-[color:var(--color-admin-accent-fg)]";
const CHOIX_REPOS =
  "border-[color:var(--color-admin-border-strong)] bg-[color:var(--color-admin-paper)] text-[color:var(--color-admin-fg)]";
const CHAMP = "flex flex-col gap-1 text-[length:var(--text-admin-sm)]";

export function IssueEchangeFormateurForm({
  calendlyEventId,
  peutRetenir = false,
}: IssueEchangeFormateurFormProps): React.ReactElement {
  const [etat, action, enCours] = useActionState(enregistrerIssueFormateurAction, ETAT_INITIAL);
  const [choix, setChoix] = useState<IssueEchange | null>(null);
  const [noteSur20, setNoteSur20] = useState("");
  const [justification, setJustification] = useState("");
  const [rappelLe, setRappelLe] = useState("");
  const [apercu, setApercu] = useState<ApercuIssueFormateur | null>(null);
  const [apercuEnCours, lancerApercu] = useTransition();
  const occupe = enCours || apercuEnCours;

  function choisir(i: IssueEchange): void {
    setChoix(i);
    setApercu(null);
  }
  function voirApercu(): void {
    if (!choix) return;
    lancerApercu(async () => {
      setApercu(await apercuIssueFormateurAction({ calendlyEventId, issue: choix }));
    });
  }
  const apercuPret = apercu?.etat === "apercu" && apercu.issue === choix ? apercu : null;

  return (
    <form action={action} className="flex flex-col gap-[var(--space-admin-3)]">
      <input type="hidden" name="calendlyEventId" value={calendlyEventId} />
      {apercuPret?.email ? <input type="hidden" name="confirmer" value="oui" /> : null}

      <div
        role="group"
        aria-label="Issue de l'échange"
        className="flex flex-wrap gap-[var(--space-admin-2)]"
      >
        {ISSUES_ECHANGE.filter((i) => peutRetenir || i !== "retenu").map((i) =>
          i === "reporte" ? (
            <button
              key={i}
              type="submit"
              name="issue"
              value="reporte"
              className={`${CHOIX} ${choix === i ? CHOIX_ACTIF : CHOIX_REPOS}`}
              aria-pressed={choix === i}
              onClick={() => choisir(i)}
              disabled={occupe}
            >
              {LIBELLE_ISSUE_ECHANGE[i]}
            </button>
          ) : (
            <button
              key={i}
              type="button"
              className={`${CHOIX} ${choix === i ? CHOIX_ACTIF : CHOIX_REPOS}`}
              aria-pressed={choix === i}
              onClick={() => choisir(i)}
              disabled={occupe}
            >
              {LIBELLE_ISSUE_ECHANGE[i]}
            </button>
          ),
        )}
      </div>

      {choix && echangeTenu(choix) ? (
        <div className="flex flex-wrap gap-[var(--space-admin-3)]">
          <label className={CHAMP}>
            Note d&apos;échange /20 (facultatif)
            <input
              type="number"
              name="noteSur20"
              min={0}
              max={20}
              step={1}
              inputMode="numeric"
              value={noteSur20}
              onChange={(e) => setNoteSur20(e.target.value)}
              className="admin-input admin-input-w-sm"
            />
          </label>
          <label className={`${CHAMP} min-w-[16rem] flex-1`}>
            En une phrase (facultatif)
            <input
              type="text"
              name="justification"
              maxLength={500}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              className="admin-input"
            />
          </label>
        </div>
      ) : null}

      {choix === "a_revoir" ? (
        <div className="flex flex-wrap items-end gap-[var(--space-admin-3)]">
          <label className={CHAMP}>
            Me le rappeler le (facultatif)
            <input
              type="date"
              name="rappelLe"
              value={rappelLe}
              onChange={(e) => setRappelLe(e.target.value)}
              className="admin-input"
            />
          </label>
          <button
            type="submit"
            name="issue"
            value="a_revoir"
            className="admin-button"
            disabled={occupe}
          >
            {enCours ? "Enregistrement…" : "Enregistrer : à revoir"}
          </button>
        </div>
      ) : null}

      {choix && AVEC_APERCU.has(choix) && !apercuPret ? (
        <div>
          <button
            type="button"
            className="admin-button-secondary"
            onClick={voirApercu}
            disabled={occupe}
          >
            {apercuEnCours ? "Préparation de l'aperçu…" : "Voir l'e-mail avant envoi"}
          </button>
        </div>
      ) : null}

      {apercu?.etat === "erreur" ? (
        <p role="alert" className="text-[color:var(--color-admin-danger)]">
          {apercu.message}
        </p>
      ) : null}

      {apercuPret ? (
        <section
          aria-label="Aperçu de l'e-mail"
          className="flex flex-col gap-[var(--space-admin-3)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-3)]"
        >
          {apercuPret.email ? (
            <>
              <p className="text-[length:var(--text-admin-sm)]">
                <span className="text-[color:var(--color-admin-fg-muted)]">À : </span>
                {apercuPret.email.destinataire}
                <br />
                <span className="text-[color:var(--color-admin-fg-muted)]">Objet : </span>
                <strong>{apercuPret.email.sujet}</strong>
              </p>
              <iframe
                title="Aperçu de l'e-mail"
                srcDoc={apercuPret.email.html}
                sandbox=""
                referrerPolicy="no-referrer"
                className="h-[60vh] w-full max-w-[680px] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-white"
              />
            </>
          ) : (
            <p role="status">{apercuPret.sansEmail ?? "Aucun e-mail ne partira."}</p>
          )}
          <div className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
            <button
              type="submit"
              name="issue"
              value={apercuPret.issue}
              className="admin-button"
              disabled={occupe}
            >
              {enCours
                ? "Enregistrement…"
                : apercuPret.email
                  ? `Envoyer et enregistrer : ${LIBELLE_ISSUE_ECHANGE[apercuPret.issue].toLowerCase()}`
                  : `Enregistrer sans e-mail : ${LIBELLE_ISSUE_ECHANGE[apercuPret.issue].toLowerCase()}`}
            </button>
            <button
              type="button"
              className="admin-button-secondary"
              onClick={() => setApercu(null)}
              disabled={occupe}
            >
              Annuler
            </button>
          </div>
        </section>
      ) : null}

      {etat.etat === "erreur" ? (
        <p role="alert" className="text-[color:var(--color-admin-danger)]">
          {etat.message}
        </p>
      ) : etat.etat === "ok" ? (
        <p role="status" className="text-[color:var(--color-admin-success)]">
          {etat.message}
        </p>
      ) : null}
    </form>
  );
}
