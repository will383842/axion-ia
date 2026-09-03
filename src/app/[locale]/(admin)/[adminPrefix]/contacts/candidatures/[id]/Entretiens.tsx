"use client";
// use-client: useActionState sur les trois actions d'entretien + repli des formulaires.

/**
 * LES ENTRETIENS d'une candidature — planifier, débriefer, clore.
 *
 * ## Ce que l'écran impose, et pourquoi il ne fait que refléter la base
 *
 * Marquer un entretien « tenu » exige son compte rendu ET son issue. Le bouton
 * reste inactif tant que les deux manquent — mais ce n'est pas l'écran qui
 * garantit : c'est la contrainte `job_interviews_etat_coherent_check`. Une
 * validation qui ne vivrait qu'ici se contournerait par la prochaine action
 * écrite, et un entretien coché tenu sans rien dedans est un entretien dont il
 * ne reste rien.
 *
 * ## Ce que l'écran DIT, plutôt que de le laisser deviner
 *
 * Qu'un compte rendu ne se réécrit pas. Quelqu'un qui croit pouvoir corriger
 * plus tard n'écrit pas comme quelqu'un qui sait que sa ligne restera — et la
 * valeur d'un débriefing tient précisément à ce qu'il a été écrit à chaud.
 */

import { useActionState, useState } from "react";

import {
  planifierEntretienAction,
  marquerEntretienTenuAction,
  cloreEntretienSansSuiteAction,
  LIBELLES_ERREUR_ENTRETIEN,
  type EtatEntretien,
} from "@/features/admin-job-applications/interview-actions";

const DEPART: EtatEntretien = { ok: false, error: "" };

const MODES: ReadonlyArray<readonly [string, string]> = [
  ["visio", "Visioconférence"],
  ["telephone", "Téléphone"],
  ["sur_site", "Sur site"],
];

const ISSUES: ReadonlyArray<readonly [string, string]> = [
  ["poursuivre", "On poursuit"],
  ["second_tour", "Second tour"],
  ["proposition", "On fait une proposition"],
  ["ecarter", "On écarte"],
  ["sans_suite", "Le candidat se retire"],
];

const LIBELLE_ETAT: Record<string, string> = {
  planifie: "Planifié",
  tenu: "Tenu",
  annule: "Annulé",
  absent: "Candidat absent",
};

const LIBELLE_MODE: Record<string, string> = {
  visio: "Visioconférence",
  telephone: "Téléphone",
  sur_site: "Sur site",
};

export interface EntretienAffiche {
  readonly id: string;
  readonly round: number;
  readonly mode: string;
  readonly state: string;
  readonly scheduledAt: string;
  readonly heldAt: string | null;
  readonly location: string | null;
  readonly conductedByName: string;
  readonly debrief: string | null;
  readonly outcome: string | null;
}

function Message({ etat }: { etat: EtatEntretien }): React.ReactElement | null {
  if (etat.ok) {
    return (
      <span role="status" className="admin-alert admin-alert-success">
        {" "}
        Enregistré.
      </span>
    );
  }
  if (!etat.error) return null;
  return (
    <span role="alert" className="admin-alert admin-alert-error">
      {" "}
      {LIBELLES_ERREUR_ENTRETIEN[etat.error] ?? etat.error}
    </span>
  );
}

/** Débriefer un entretien — compte rendu et issue, ensemble ou pas du tout. */
function Debriefer({ entretien }: { entretien: EntretienAffiche }): React.ReactElement {
  const [etat, action, enCours] = useActionState(marquerEntretienTenuAction, DEPART);
  const [compteRendu, setCompteRendu] = useState("");
  const [issue, setIssue] = useState("");
  const [ouvert, setOuvert] = useState(false);

  if (!ouvert) {
    return (
      <button type="button" className="admin-button-secondary" onClick={() => setOuvert(true)}>
        Débriefer
      </button>
    );
  }

  return (
    <form action={action} className="admin-form">
      <input type="hidden" name="interviewId" value={entretien.id} />
      <div className="admin-field">
        <label htmlFor={`debrief-${entretien.id}`} className="admin-label">
          Compte rendu
        </label>
        <textarea
          id={`debrief-${entretien.id}`}
          name="debrief"
          rows={6}
          className="admin-input admin-textarea"
          value={compteRendu}
          onChange={(e) => setCompteRendu(e.target.value)}
          disabled={enCours}
          required
        />
        {/* 🔑 Dit ici, pas sous-entendu. Un compte rendu qui se corrige après
            coup ne vaut plus rien : sa valeur tient à ce qu'il a été écrit à
            chaud. La correction passe par une note au journal, qui porte sa
            date et son auteur. */}
        <p className="admin-meta-small">
          Une fois enregistré, ce compte rendu ne se modifie plus. Une correction se fait par une
          note au journal, qui porte sa propre date.
        </p>
      </div>
      <div className="admin-field">
        <label htmlFor={`outcome-${entretien.id}`} className="admin-label">
          Issue
        </label>
        <select
          id={`outcome-${entretien.id}`}
          name="outcome"
          className="admin-input"
          value={issue}
          onChange={(e) => setIssue(e.target.value)}
          disabled={enCours}
          required
        >
          <option value="">— choisir —</option>
          {ISSUES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <div className="admin-field">
        <label htmlFor={`heldAt-${entretien.id}`} className="admin-label">
          Tenu le <span className="admin-meta-small">(vide = l’heure prévue)</span>
        </label>
        <input
          id={`heldAt-${entretien.id}`}
          name="heldAt"
          type="datetime-local"
          className="admin-input"
          disabled={enCours}
        />
      </div>
      <div>
        {/* Le bouton reflète la contrainte SQL, il ne la remplace pas. */}
        <button
          type="submit"
          className="admin-button"
          disabled={enCours || compteRendu.trim().length < 10 || issue === ""}
        >
          {enCours ? "Enregistrement…" : "Enregistrer le compte rendu"}
        </button>
        <button type="button" className="admin-button-ghost" onClick={() => setOuvert(false)}>
          Annuler
        </button>
        <Message etat={etat} />
      </div>
    </form>
  );
}

/** Clore sans entretien : annulation, ou candidat absent. */
function CloreSansSuite({ entretienId }: { entretienId: string }): React.ReactElement {
  const [etat, action, enCours] = useActionState(cloreEntretienSansSuiteAction, DEPART);
  return (
    <form action={action} className="admin-inline-form">
      <input type="hidden" name="interviewId" value={entretienId} />
      {/* 🔑 Deux boutons, deux faits. « Annulé » suppose un geste, « absent »
          est subi — les fondre dans un seul contrôle ferait passer un
          rendez-vous manqué pour une annulation convenue. */}
      <button
        type="submit"
        name="etat"
        value="annule"
        className="admin-button-ghost"
        disabled={enCours}
      >
        Annulé
      </button>
      <button
        type="submit"
        name="etat"
        value="absent"
        className="admin-button-ghost"
        disabled={enCours}
      >
        Ne s’est pas présenté
      </button>
      <Message etat={etat} />
    </form>
  );
}

/** Planifier un nouvel entretien. */
function Planifier({ applicationId }: { applicationId: string }): React.ReactElement {
  const [etat, action, enCours] = useActionState(planifierEntretienAction, DEPART);
  const [ouvert, setOuvert] = useState(false);

  if (!ouvert) {
    return (
      <button type="button" className="admin-button" onClick={() => setOuvert(true)}>
        Planifier un entretien
      </button>
    );
  }

  return (
    <form action={action} className="admin-form">
      <input type="hidden" name="applicationId" value={applicationId} />
      <div className="admin-form-row">
        <div className="admin-field">
          <label htmlFor="mode" className="admin-label">
            Format
          </label>
          <select id="mode" name="mode" className="admin-input" disabled={enCours}>
            {MODES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="scheduledAt" className="admin-label">
            Quand
          </label>
          <input
            id="scheduledAt"
            name="scheduledAt"
            type="datetime-local"
            className="admin-input"
            disabled={enCours}
            required
          />
        </div>
        <div className="admin-field">
          <label htmlFor="durationMin" className="admin-label">
            Durée (min)
          </label>
          <input
            id="durationMin"
            name="durationMin"
            type="number"
            min={5}
            max={480}
            defaultValue={30}
            className="admin-input"
            disabled={enCours}
          />
        </div>
      </div>
      <div className="admin-field">
        <label htmlFor="location" className="admin-label">
          Lien de visioconférence, ou adresse
        </label>
        <input
          id="location"
          name="location"
          maxLength={500}
          className="admin-input"
          disabled={enCours}
        />
      </div>
      <div>
        <button type="submit" className="admin-button" disabled={enCours}>
          {enCours ? "Enregistrement…" : "Planifier"}
        </button>
        <button type="button" className="admin-button-ghost" onClick={() => setOuvert(false)}>
          Annuler
        </button>
        <Message etat={etat} />
      </div>
    </form>
  );
}

const DATE_FR = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  dateStyle: "medium",
  timeStyle: "short",
});

export function Entretiens({
  applicationId,
  entretiens,
}: {
  applicationId: string;
  entretiens: ReadonlyArray<EntretienAffiche>;
}): React.ReactElement {
  return (
    <>
      <div className="mb-[var(--space-admin-4)]">
        <Planifier applicationId={applicationId} />
      </div>

      {entretiens.length === 0 ? (
        <p className="admin-meta-small">
          Aucun entretien. Un rendez-vous déjà pris dans l’agenda peut aussi être rattaché depuis sa
          fiche.
        </p>
      ) : (
        <ol className="m-0 list-none p-0">
          {entretiens.map((e) => (
            <li key={e.id} className="border-border-subtle border-t pt-[var(--space-admin-3)]">
              <div className="flex flex-wrap items-baseline gap-x-[var(--space-admin-3)]">
                <span className="text-[length:var(--text-admin-sm)] font-semibold">
                  Tour {e.round} · {LIBELLE_MODE[e.mode] ?? e.mode}
                </span>
                <span className="admin-meta-small">
                  {DATE_FR.format(new Date(e.scheduledAt))} · {e.conductedByName} ·{" "}
                  {LIBELLE_ETAT[e.state] ?? e.state}
                </span>
              </div>

              {e.location ? (
                <p className="admin-meta-small">
                  {/^https?:\/\//i.test(e.location) ? (
                    <a href={e.location} target="_blank" rel="noopener" className="admin-link">
                      {e.location}
                    </a>
                  ) : (
                    e.location
                  )}
                </p>
              ) : null}

              {e.state === "tenu" ? (
                <>
                  <p className="text-[length:var(--text-admin-sm)] whitespace-pre-wrap">
                    {e.debrief}
                  </p>
                  <p className="admin-meta-small">
                    Issue : {ISSUES.find(([v]) => v === e.outcome)?.[1] ?? e.outcome}
                    {e.heldAt ? ` · tenu le ${DATE_FR.format(new Date(e.heldAt))}` : ""}
                  </p>
                </>
              ) : e.state === "planifie" ? (
                <div className="mt-[var(--space-admin-2)] flex flex-wrap gap-[var(--space-admin-3)]">
                  <Debriefer entretien={e} />
                  <CloreSansSuite entretienId={e.id} />
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
