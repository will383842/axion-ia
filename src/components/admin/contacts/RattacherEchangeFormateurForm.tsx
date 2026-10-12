"use client";
// use-client: choix de la candidature puis rafraîchissement de la carte après rattachement.

// Rattacher un ÉCHANGE FORMATEUR à sa candidature, depuis la tuile « à faire le point »
// (lot B, M17). Sans rattachement, l'issue formateur est refusée par le serveur : ce
// formulaire est donc le premier geste. Il passe par l'action commune
// `rattacherRendezVousAction` (garde de rôle et refus « déjà rattaché ailleurs » côté
// serveur), sans créer d'entretien.

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  rattacherRendezVousAction,
  type EtatRattachement,
} from "@/features/admin-job-applications/rattacher-rendez-vous";
import type { PropositionRattachement } from "@/features/admin-rendezvous/point-formateur";

export type { PropositionRattachement };

const MESSAGES: Readonly<Record<string, string>> = {
  champs_invalides: "Choisissez une candidature, ou collez son identifiant.",
  candidature_introuvable: "Candidature introuvable.",
  rendez_vous_introuvable: "Rendez-vous introuvable.",
  deja_rattache_ailleurs: "Ce rendez-vous est déjà rattaché à une autre candidature.",
  forbidden: "Votre rôle ne permet pas de rattacher ce rendez-vous.",
  unauthorized: "Session expirée : reconnectez-vous.",
};

const ETAT_INITIAL = { ok: false, error: "" } as EtatRattachement;

export function RattacherEchangeFormateurForm({
  calendlyEventId,
  propositions,
}: {
  readonly calendlyEventId: string;
  readonly propositions: ReadonlyArray<PropositionRattachement>;
}): React.ReactElement {
  const router = useRouter();
  const [etat, action, enCours] = useActionState(rattacherRendezVousAction, ETAT_INITIAL);
  useEffect(() => {
    if (etat.ok) router.refresh();
  }, [etat, router]);
  const erreur =
    !etat.ok && etat.error ? (MESSAGES[etat.error] ?? "Le rattachement a échoué.") : null;

  return (
    <form action={action} className="flex flex-col gap-[var(--space-admin-2)]">
      <input type="hidden" name="calendlyEventId" value={calendlyEventId} />
      <p className="text-[length:var(--text-admin-sm)]">
        Cet échange formateur n&apos;est rattaché à aucune candidature : rattachez-le pour noter son
        issue.
      </p>
      {propositions.length > 0 ? (
        <fieldset className="flex flex-col gap-1 text-[length:var(--text-admin-sm)]">
          <legend className="font-medium">Candidatures à la même adresse</legend>
          {propositions.map((p, i) => (
            <label key={p.id} className="flex items-center gap-[var(--space-admin-2)]">
              <input type="radio" name="applicationId" value={p.id} defaultChecked={i === 0} />
              {p.libelle}
            </label>
          ))}
        </fieldset>
      ) : (
        <label className="flex flex-col gap-1 text-[length:var(--text-admin-sm)]">
          Identifiant de la candidature (fiche candidat)
          <input
            name="applicationId"
            required
            pattern="[0-9a-fA-F-]{36}"
            className="admin-input"
            autoComplete="off"
          />
        </label>
      )}
      <div>
        <button type="submit" className="admin-button-secondary" disabled={enCours}>
          {enCours ? "Rattachement…" : "Rattacher à cette candidature"}
        </button>
      </div>
      {erreur ? (
        <p
          role="alert"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-danger)]"
        >
          {erreur}
        </p>
      ) : null}
    </form>
  );
}
