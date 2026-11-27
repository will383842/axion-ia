"use client";
// use-client: aperçu de l'e-mail à la demande, puis confirmation sans recharger la fiche.

// « Ouvrir le dossier et envoyer le contrat » — le geste de l'administrateur
// qui ouvre le dossier du réseau d'une personne RETENUE et envoie le lien du
// contrat. Sorti de `IssueEchangeApporteurForm` pour servir aussi le bandeau de
// la fiche (`BandeauProchaineEtape`).
//
// 🔑 JAMAIS D'ENVOI EN UN SEUL CLIC : le premier clic ouvre l'aperçu de
// l'e-mail (lecture seule) ; seul « Confirmer » appelle l'action existante
// `ouvrirDossierEtEnvoyerLienAction`, qui garde tous ses refus (dossier déjà
// ouvert, refusé ou résilié, réservé à l'administrateur).

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { LecteurEmail } from "@/components/admin/ui/LecteurEmail";
import {
  ouvrirDossierEtEnvoyerLienAction,
  type EtatIssueApporteur,
} from "@/features/admin-rendezvous/issue-apporteur-actions";
import {
  apercuContratApporteurAction,
  type ApercuContratApporteur,
} from "@/features/admin-rendezvous/apercu-contrat-apporteur";

export function BoutonOuvrirDossierContrat({
  calendlyEventId,
  libelle = "Ouvrir le dossier et envoyer le contrat",
  secondaire = false,
}: {
  readonly calendlyEventId: string;
  readonly libelle?: string;
  readonly secondaire?: boolean;
}): React.ReactElement {
  const router = useRouter();
  const [apercu, setApercu] = useState<ApercuContratApporteur | null>(null);
  const [retour, setRetour] = useState<EtatIssueApporteur | null>(null);
  const [enCours, lancer] = useTransition();

  function voir(): void {
    setRetour(null);
    lancer(async () => {
      setApercu(await apercuContratApporteurAction({ calendlyEventId }));
    });
  }

  function confirmer(): void {
    lancer(async () => {
      const r = await ouvrirDossierEtEnvoyerLienAction({ calendlyEventId });
      setRetour(r);
      setApercu(null);
      if (r.etat === "ok") router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-[var(--space-admin-3)]">
      {apercu?.etat === "apercu" ? (
        <section
          aria-label="Aperçu de l'e-mail"
          className="flex flex-col gap-[var(--space-admin-3)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-3)]"
        >
          <p role="status">
            Ce clic ouvre le dossier de la personne et envoie cet e-mail avec le lien du contrat.
          </p>
          <LecteurEmail apercu={apercu.apercu} titre={`Aperçu : ${apercu.sujet}`} liensInertes />
          <div className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
            <button type="button" className="admin-button" onClick={confirmer} disabled={enCours}>
              {enCours ? "Envoi…" : "Confirmer : ouvrir le dossier et envoyer"}
            </button>
            <button
              type="button"
              className="admin-button-secondary"
              onClick={() => setApercu(null)}
              disabled={enCours}
            >
              Annuler
            </button>
          </div>
        </section>
      ) : (
        <div>
          <button
            type="button"
            className={secondaire ? "admin-button-secondary" : "admin-button"}
            onClick={voir}
            disabled={enCours}
          >
            {enCours ? "Préparation de l'aperçu…" : libelle}
          </button>
        </div>
      )}
      {apercu?.etat === "erreur" ? (
        <p role="alert" className="text-[color:var(--color-admin-danger)]">
          {apercu.message}
        </p>
      ) : null}
      {retour && retour.etat !== "initial" ? (
        <p
          role={retour.etat === "ok" ? "status" : "alert"}
          className={
            retour.etat === "ok"
              ? "text-[color:var(--color-admin-success)]"
              : "text-[color:var(--color-admin-danger)]"
          }
        >
          {retour.message}
        </p>
      ) : null}
    </div>
  );
}
