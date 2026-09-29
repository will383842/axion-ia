"use client";
// use-client: case à cocher + état du geste (en cours, résultat, lien vers la fiche).

/**
 * « Proposer le réseau d'apporteurs » — sur la fiche d'une candidature à une
 * offre d'emploi (décision Will, 2026-09-28).
 *
 * Crée une fiche apporteur (Contacts › Commercial) à partir de la candidature,
 * et, si la case est cochée (par défaut), envoie l'invitation à l'échange de
 * 15 minutes — variante « une autre proposition » : la personne a postulé à un
 * poste salarié, pas au réseau. Case décochée : la fiche seule (personne déjà
 * contactée ailleurs, par exemple sur LinkedIn).
 *
 * Une fois la fiche créée, le composant ne montre plus que le lien vers elle :
 * un second clic ne peut pas en créer une seconde (l'action le refuse aussi).
 */

import Link from "next/link";
import { useState, useTransition } from "react";

import {
  proposerReseauApporteursAction,
  type EtatPropositionReseau,
} from "@/features/admin-job-applications/proposer-reseau-actions";

export function ProposerReseauApporteurs({
  applicationId,
  ficheExistante,
  lienCalendlyConfigure,
}: {
  applicationId: string;
  /** Fiche apporteur déjà née de cette candidature. */
  ficheExistante: { lien: string; creeeLe: string } | null;
  /** `CALENDLY_APPORTEUR_URL` posé et valide : sans lui, pas d'invitation possible. */
  lienCalendlyConfigure: boolean;
}): React.ReactElement {
  const [inviter, setInviter] = useState(lienCalendlyConfigure);
  const [etat, setEtat] = useState<EtatPropositionReseau | null>(null);
  const [enCours, demarrer] = useTransition();

  const lienCree = etat?.ok ? etat.lien : null;
  if (ficheExistante && !etat) {
    return (
      <p className="admin-help">
        Réseau d&apos;apporteurs proposé le {ficheExistante.creeeLe} ·{" "}
        <Link href={ficheExistante.lien} className="admin-link">
          Ouvrir la fiche apporteur
        </Link>
      </p>
    );
  }

  if (etat?.ok && lienCree) {
    const inv = etat.invitation;
    return (
      <div role="status">
        <p
          className={
            inv && !inv.envoyee
              ? "admin-alert admin-alert-error"
              : "admin-alert admin-alert-success"
          }
        >
          {etat.deja
            ? "Le réseau a déjà été proposé : la fiche apporteur existe."
            : !inv
              ? "Fiche apporteur créée. Aucun e-mail n'est parti."
              : inv.envoyee
                ? inv.enValidation
                  ? "Fiche apporteur créée. L'invitation attend dans « Envois à valider »."
                  : "Fiche apporteur créée et invitation envoyée."
                : `Fiche apporteur créée, mais l'invitation n'est pas partie : ${inv.message}`}
        </p>
        <p className="admin-help">
          <Link href={lienCree} className="admin-link">
            Ouvrir la fiche apporteur
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="admin-form">
      <p className="admin-help">
        Crée une fiche dans Contacts › Commercial pour proposer aussi à cette personne le réseau
        d&apos;apporteurs d&apos;affaires indépendants. Sa candidature au poste n&apos;est pas
        modifiée.
      </p>
      <label className="admin-checkbox-label" htmlFor="envoyerInvitationReseau">
        <input
          id="envoyerInvitationReseau"
          type="checkbox"
          checked={inviter}
          disabled={enCours || !lienCalendlyConfigure}
          onChange={(e) => setInviter(e.target.checked)}
        />{" "}
        Envoyer aussi l&apos;invitation à l&apos;échange (15 min, Calendly)
      </label>
      {!lienCalendlyConfigure ? (
        <p className="admin-meta-small">
          Lien Calendly de l&apos;échange non configuré (CALENDLY_APPORTEUR_URL) : la fiche seule
          peut être créée.
        </p>
      ) : null}
      {etat && !etat.ok ? (
        <p role="alert" className="admin-alert admin-alert-error">
          {etat.message}{" "}
          {etat.lien ? (
            <Link href={etat.lien} className="admin-link">
              Ouvrir la fiche apporteur
            </Link>
          ) : null}
        </p>
      ) : null}
      <button
        type="button"
        className="admin-button-secondary"
        disabled={enCours}
        onClick={() =>
          demarrer(async () => {
            setEtat(
              await proposerReseauApporteursAction({
                applicationId,
                envoyerInvitation: inviter,
              }),
            );
          })
        }
      >
        {enCours ? "Création…" : "Proposer le réseau d'apporteurs"}
      </button>
    </div>
  );
}
