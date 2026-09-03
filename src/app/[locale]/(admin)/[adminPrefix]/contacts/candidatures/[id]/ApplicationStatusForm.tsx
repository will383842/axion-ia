"use client";
// use-client: useActionState bind updateApplicationStatusAction + deleteApplicationAction.

import { useActionState, useState } from "react";
import {
  updateApplicationStatusAction,
  deleteApplicationAction,
  type UpdateApplicationState,
} from "@/features/admin-job-applications/actions";
import {
  STATUTS_CANDIDATURE,
  LIBELLE_STATUT,
  LIBELLE_MOTIF_REFUS,
  MOTIFS_REFUS_SAISISSABLES,
  exigeUnMotif,
} from "@/content/recrutement/statuts";
import type { JobApplicationStatus } from "../../../../../../../../prisma/generated/client";

const init: UpdateApplicationState = { ok: false, error: "" };

// 🔴 Ce fichier portait sa PROPRE liste de six statuts, en paires clé/libellé.
// C'était la troisième copie du même vocabulaire, et la seule que l'utilisateur
// voyait : les trois états ajoutés au lot 3 existaient en base et dans le
// filtre, mais restaient INCHOISISSABLES ici. Le menu vient maintenant de
// `@/content/recrutement/statuts`.

interface Props {
  id: string;
  status: string;
  internalNotes: string | null;
  assignedTo: string | null;
  rejectionReason: string | null;
  needsAttention: boolean;
}

export function ApplicationStatusForm({
  id,
  status,
  internalNotes,
  assignedTo,
  rejectionReason,
  needsAttention,
}: Props) {
  const [state, formAction, pending] = useActionState(updateApplicationStatusAction, init);
  const [delState, delAction, delPending] = useActionState(deleteApplicationAction, init);
  // 🔑 Le champ de motif suit le statut CHOISI, pas le statut enregistré : sans
  // cet état local, choisir « Écartée » n'afficherait le motif qu'après un
  // aller-retour serveur — donc après un refus. On demanderait au recruteur de
  // se tromper une fois pour découvrir le champ qu'il devait remplir.
  const [statutChoisi, setStatutChoisi] = useState<JobApplicationStatus>(
    status as JobApplicationStatus,
  );
  const motifRequis = exigeUnMotif(statutChoisi);

  return (
    <>
      <form action={formAction} className="admin-form">
        <input type="hidden" name="id" value={id} />
        <div className="admin-form-row">
          <div className="admin-field">
            <label htmlFor="status" className="admin-label">
              Statut
            </label>
            <select
              id="status"
              name="status"
              defaultValue={status}
              onChange={(e) => setStatutChoisi(e.target.value as JobApplicationStatus)}
              className="admin-input"
              disabled={pending}
            >
              {STATUTS_CANDIDATURE.map((k) => (
                <option key={k} value={k}>
                  {LIBELLE_STATUT[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-field">
            <label htmlFor="assignedTo" className="admin-label">
              Assignée à
            </label>
            <input
              id="assignedTo"
              name="assignedTo"
              type="text"
              maxLength={100}
              defaultValue={assignedTo ?? ""}
              className="admin-input"
              disabled={pending}
            />
          </div>
        </div>
        {/* Le motif n'apparaît QUE pour les états qui le réclament. Un champ
            toujours visible et presque toujours grisé apprend au lecteur à ne
            plus le voir ; et la contrainte SQL interdit de le remplir sur un
            état en cours, donc l'afficher là serait offrir un geste refusé.

            ⚠️ Le champ est REMONTÉ tel quel quand il est masqué (`hidden` avec
            une valeur vide) : sans cela, repasser un dossier écarté en « en
            revue » n'enverrait aucun `rejectionReason`, et le motif précédent
            resterait en base sous un statut qui l'interdit. */}
        {motifRequis ? (
          <div className="admin-field">
            <label htmlFor="rejectionReason" className="admin-label">
              Motif <span aria-hidden="true">*</span>
              <span className="sr-only">(obligatoire)</span>
            </label>
            <select
              id="rejectionReason"
              name="rejectionReason"
              defaultValue={rejectionReason ?? ""}
              required
              className="admin-input"
              disabled={pending}
            >
              <option value="">— Choisir un motif —</option>
              {MOTIFS_REFUS_SAISISSABLES.map((m) => (
                <option key={m} value={m}>
                  {LIBELLE_MOTIF_REFUS[m]}
                </option>
              ))}
            </select>
            <p className="admin-help">
              Obligatoire : sans motif, un refus ne s&apos;analyse pas et ne se relit pas six mois
              plus tard.
            </p>
          </div>
        ) : (
          <input type="hidden" name="rejectionReason" value="" />
        )}

        <div className="admin-field">
          <label htmlFor="internalNotes" className="admin-label">
            Notes internes
          </label>
          <textarea
            id="internalNotes"
            name="internalNotes"
            rows={3}
            defaultValue={internalNotes ?? ""}
            className="admin-input admin-textarea"
            disabled={pending}
          />
        </div>
        <label className="admin-checkbox">
          <input
            type="checkbox"
            name="needsAttention"
            value="true"
            defaultChecked={needsAttention}
            disabled={pending}
          />
          À traiter
        </label>
        <div>
          <button type="submit" disabled={pending} className="admin-button">
            {pending ? "Enregistrement…" : "Enregistrer"}
          </button>
          {/* 🔴 Succès et erreur portaient la MÊME classe : un échec
              d'enregistrement ressemblait trait pour trait à une réussite —
              même petit texte gris, au même endroit. */}
          {state.ok ? (
            <span role="status" className="admin-alert admin-alert-success">
              {" "}
              Mis à jour
            </span>
          ) : state.error ? (
            <span role="alert" className="admin-alert admin-alert-error">
              {" "}
              {state.error}
            </span>
          ) : null}
        </div>
      </form>

      <form
        action={delAction}
        onSubmit={(e) => {
          if (
            !window.confirm(
              "Supprimer définitivement cette candidature et son CV ? Irréversible (RGPD).",
            )
          )
            e.preventDefault();
        }}
        className="admin-inline-form"
      >
        <input type="hidden" name="id" value={id} />
        <button type="submit" disabled={delPending} className="admin-button-ghost">
          {delPending ? "…" : "Supprimer (droit à l'effacement)"}
        </button>
        {delState.ok === false && delState.error ? (
          <span role="alert" className="admin-meta-small">
            {delState.error}
          </span>
        ) : null}
      </form>
    </>
  );
}
