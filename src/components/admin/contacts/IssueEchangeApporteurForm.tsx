"use client";
// use-client: aperçu de l'e-mail à la demande, champs conditionnels, confirmation sans recharger.

// L'issue de l'échange avec un candidat apporteur (2026-09-28).
//
// Demande de Will : un bouton selon la situation, et le bon e-mail part.
//   · « Reporté » ENREGISTRE au clic — aucun e-mail ;
//   · « À revoir » ouvre la note et une date de rappel facultative, puis
//     « Enregistrer » — aucun e-mail ;
//   · « Absent », « Retenu », « Non retenu » ouvrent l'APERÇU de l'e-mail exact
//     (vrai gabarit, prénom compris) ; rien ne part avant « Envoyer ».
// Modifier le mot personnel après l'aperçu l'efface : ce qui part est toujours
// ce qui a été relu. Les règles (une fois par personne, deuxième absence…) sont
// côté serveur ; ce composant ne fait que les annoncer.

import { useActionState, useState, useTransition } from "react";

import {
  apercuIssueApporteurAction,
  ouvrirDossierEtEnvoyerLienAction,
  enregistrerIssueApporteurAction,
  type ApercuIssueApporteur,
  type EtatIssueApporteur,
} from "@/features/admin-rendezvous/issue-apporteur-actions";
import {
  ISSUES_APPORTEUR,
  LIBELLE_ISSUE_APPORTEUR,
  MOT_PERSONNEL_MAX,
  echangeTenu,
  type IssueApporteur,
} from "@/features/admin-rendezvous/issue-apporteur";

export interface IssueEchangeApporteurFormProps {
  readonly calendlyEventId: string;
  readonly initial?: {
    readonly issue: IssueApporteur | null;
    readonly noteSur20: number | null;
    readonly justification: string | null;
    readonly rappelLe: string | null;
  } | null;
}

const ETAT_INITIAL: EtatIssueApporteur = { etat: "initial" };

/** Les issues qui font partir un e-mail — l'aperçu d'abord. */
const AVEC_EMAIL: ReadonlySet<IssueApporteur> = new Set(["absent", "retenu", "non_retenu"]);

const PICTO: Readonly<Record<IssueApporteur, string>> = {
  absent: "❌",
  reporte: "🔁",
  retenu: "✅",
  a_revoir: "🤔",
  non_retenu: "🚫",
};

const CHOIX =
  "inline-flex min-h-[44px] items-center gap-[var(--space-admin-2)] rounded-[var(--radius-admin-md)] border px-[var(--space-admin-4)] font-medium";
const CHOIX_ACTIF =
  "border-[color:var(--color-admin-accent)] bg-[color:var(--color-admin-accent)] text-[color:var(--color-admin-accent-fg)]";
const CHOIX_REPOS =
  "border-[color:var(--color-admin-border-strong)] bg-[color:var(--color-admin-paper)] text-[color:var(--color-admin-fg)]";
const CHAMP = "flex flex-col gap-1 text-[length:var(--text-admin-sm)]";

export function IssueEchangeApporteurForm({
  calendlyEventId,
  initial = null,
}: IssueEchangeApporteurFormProps): React.ReactElement {
  const [etat, action, enCours] = useActionState(enregistrerIssueApporteurAction, ETAT_INITIAL);
  const [choix, setChoix] = useState<IssueApporteur | null>(initial?.issue ?? null);
  // 🔑 CONTRÔLÉS : React 19 remet un `<form action>` à zéro après l'action,
  // erreur comprise — un `defaultValue` perdrait la saisie au pire moment.
  const [noteSur20, setNoteSur20] = useState(
    initial?.noteSur20 !== null && initial?.noteSur20 !== undefined
      ? String(initial.noteSur20)
      : "",
  );
  const [justification, setJustification] = useState(initial?.justification ?? "");
  const [rappelLe, setRappelLe] = useState(initial?.rappelLe ?? "");
  const [motPersonnel, setMotPersonnel] = useState("");
  const [apercu, setApercu] = useState<ApercuIssueApporteur | null>(null);
  const [apercuEnCours, lancerApercu] = useTransition();

  const occupe = enCours || apercuEnCours;

  function choisir(i: IssueApporteur): void {
    setChoix(i);
    setApercu(null);
  }

  function voirApercu(): void {
    if (!choix) return;
    lancerApercu(async () => {
      setApercu(await apercuIssueApporteurAction({ calendlyEventId, issue: choix, motPersonnel }));
    });
  }

  const apercuPret = apercu?.etat === "apercu" && apercu.issue === choix ? apercu : null;
  const [dossierEnCours, setDossierEnCours] = useState(false);
  const [retourDossier, setRetourDossier] = useState<EtatIssueApporteur | null>(null);
  async function ouvrirDossier() {
    setDossierEnCours(true);
    setRetourDossier(null);
    try {
      setRetourDossier(await ouvrirDossierEtEnvoyerLienAction({ calendlyEventId }));
    } finally {
      setDossierEnCours(false);
    }
  }

  return (
    <form action={action} className="flex flex-col gap-[var(--space-admin-3)]">
      <input type="hidden" name="calendlyEventId" value={calendlyEventId} />
      {/* 🔑 L'issue voyage sur le bouton soumetteur, jamais dans un champ
          caché : un champ caché passerait AVANT la valeur du bouton
          « Reporté » (`FormData.get` lit la première). */}
      {apercuPret?.email ? <input type="hidden" name="confirmer" value="oui" /> : null}
      {choix && AVEC_EMAIL.has(choix) ? (
        <input type="hidden" name="motPersonnel" value={motPersonnel} />
      ) : null}

      <div
        role="group"
        aria-label="Issue de l'échange"
        className="flex flex-wrap gap-[var(--space-admin-2)]"
      >
        {ISSUES_APPORTEUR.map((i) =>
          i === "reporte" ? (
            // « Reporté » ENVOIE au clic : le bouton porte la valeur.
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
              {PICTO[i]} {LIBELLE_ISSUE_APPORTEUR[i]}
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
              {PICTO[i]} {LIBELLE_ISSUE_APPORTEUR[i]}
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
          <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Usage interne : aucun e-mail ne part.
          </span>
        </div>
      ) : null}

      {choix && AVEC_EMAIL.has(choix) ? (
        <div className="flex flex-col gap-[var(--space-admin-3)]">
          <label className={CHAMP}>
            Mot personnel en haut de l&apos;e-mail (facultatif)
            <textarea
              rows={2}
              maxLength={MOT_PERSONNEL_MAX}
              value={motPersonnel}
              onChange={(e) => {
                setMotPersonnel(e.target.value);
                // Ce qui part doit être ce qui a été relu.
                setApercu(null);
              }}
              className="admin-input"
            />
          </label>
          <div className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
            {!apercuPret ? (
              <button
                type="button"
                className="admin-button-secondary"
                onClick={voirApercu}
                disabled={occupe}
              >
                {apercuEnCours ? "Préparation de l'aperçu…" : "Voir l'e-mail avant envoi"}
              </button>
            ) : null}
            <button
              type="submit"
              name="issueSansEmail"
              value={choix}
              className="admin-button-secondary"
              disabled={occupe}
            >
              Enregistrer sans envoyer d&apos;e-mail
            </button>
          </div>
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
              {apercuPret.alerte ? (
                <p role="alert" className="text-[color:var(--color-admin-danger)]">
                  ⚠️ {apercuPret.alerte}
                </p>
              ) : null}
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
              <div className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
                <button
                  type="submit"
                  name="issue"
                  value={apercuPret.issue}
                  className="admin-button"
                  disabled={occupe}
                >
                  {enCours
                    ? "Envoi…"
                    : `Envoyer et enregistrer : ${LIBELLE_ISSUE_APPORTEUR[apercuPret.issue].toLowerCase()}`}
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
            </>
          ) : (
            <>
              <p role="status">{apercuPret.sansEmail ?? "Aucun e-mail ne partira."}</p>
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
                    : `Enregistrer sans e-mail : ${LIBELLE_ISSUE_APPORTEUR[apercuPret.issue].toLowerCase()}`}
                </button>
                {apercuPret.proposerDossier ? (
                  <button
                    type="button"
                    className="admin-button-secondary"
                    onClick={ouvrirDossier}
                    disabled={occupe || dossierEnCours}
                  >
                    {dossierEnCours ? "Ouverture…" : "Ouvrir le dossier et envoyer le lien"}
                  </button>
                ) : null}
                {apercuPret.issue === "absent" ? (
                  <button
                    type="button"
                    className="admin-button-secondary"
                    onClick={() => choisir("non_retenu")}
                    disabled={occupe}
                  >
                    Plutôt : Non retenu
                  </button>
                ) : null}
              </div>
            </>
          )}
          {retourDossier && retourDossier.etat !== "initial" ? (
            <p
              role={retourDossier.etat === "ok" ? "status" : "alert"}
              className={
                retourDossier.etat === "ok"
                  ? "text-[color:var(--color-admin-success)]"
                  : "text-[color:var(--color-admin-danger)]"
              }
            >
              {retourDossier.message}
            </p>
          ) : null}
        </section>
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
    </form>
  );
}
