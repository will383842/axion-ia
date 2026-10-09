"use client";
// use-client: état du geste (en cours, résultat, lien vers la fiche formateur).

/**
 * « Créer sa fiche formateur » — sur la fiche d'une candidature RECRUTÉE à une
 * offre de formateur (L10, chantier « candidatures unifiées », paquet 4a).
 *
 * Crée la fiche dans Qualiopi › Formateurs, pré-remplie depuis le dossier, et
 * la relie à la candidature. Une fois la fiche liée, le composant ne montre
 * plus que le lien vers elle : un second clic ne peut pas en créer une seconde
 * (l'action le refuse aussi).
 */

import Link from "next/link";
import { useState, useTransition } from "react";

import {
  creerFicheFormateurDepuisCandidatureAction,
  type EtatFicheFormateur,
} from "@/features/admin-job-applications/fiche-formateur-actions";

export function CreerFicheFormateur({
  applicationId,
  ficheExistante,
}: {
  applicationId: string;
  /** Fiche formateur déjà liée à cette candidature. */
  ficheExistante: { lien: string; mention: string | null } | null;
}): React.ReactElement {
  const [etat, setEtat] = useState<EtatFicheFormateur | null>(null);
  const [enCours, demarrer] = useTransition();

  const fiche = etat?.ok
    ? { lien: etat.lien, mention: etat.mention ?? null, deja: etat.deja === true }
    : ficheExistante
      ? { ...ficheExistante, deja: true }
      : null;

  if (fiche) {
    return (
      <div role="status">
        {etat?.ok && !fiche.deja ? (
          <p className="admin-alert admin-alert-success">
            Fiche formateur créée, inactive. Elle s&apos;active depuis Qualiopi › Formateurs.
          </p>
        ) : null}
        {fiche.mention ? <p className="admin-alert admin-alert-warning">{fiche.mention}.</p> : null}
        <p className="admin-help">
          <Link href={fiche.lien} className="admin-link">
            Ouvrir sa fiche formateur
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="admin-form">
      <p className="admin-help">
        Crée sa fiche dans Qualiopi › Formateurs avec son nom, son e-mail, son téléphone et son CV.
        Sans numéro de déclaration d&apos;activité, la fiche est créée inactive.
      </p>
      {etat && !etat.ok ? (
        <p role="alert" className="admin-alert admin-alert-error">
          {etat.message}
        </p>
      ) : null}
      <button
        type="button"
        className="admin-button-secondary"
        disabled={enCours}
        onClick={() =>
          demarrer(async () => {
            setEtat(await creerFicheFormateurDepuisCandidatureAction({ applicationId }));
          })
        }
      >
        {enCours ? "Création…" : "Créer sa fiche formateur"}
      </button>
    </div>
  );
}
