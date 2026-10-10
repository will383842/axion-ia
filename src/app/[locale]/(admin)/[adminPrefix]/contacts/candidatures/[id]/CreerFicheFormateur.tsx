"use client";
// use-client: état du geste (en cours, résultat, lien vers la fiche formateur).

/**
 * « Créer sa fiche formateur » — sur la fiche d'une candidature de formateur
 * FREELANCE (à toute étape) ou RECRUTÉE à une offre de formateur salarié (L10,
 * paquet 4a ; U6, chantier « formateurs freelance »). Réservé à la direction.
 *
 * Quand rien ne dit le statut (spontanée sans indice, offre supprimée), le
 * bouton demande de CHOISIR salarié ou sous-traitant : l'action ne devine pas.
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

type StatutFiche = "salarie" | "sous_traitant";

export function CreerFicheFormateur({
  applicationId,
  statutPropose,
  ficheExistante,
}: {
  applicationId: string;
  /** Statut lu sur l'offre ; `null` = l'administrateur doit choisir. */
  statutPropose: StatutFiche | null;
  /** Fiche formateur déjà liée à cette candidature. */
  ficheExistante: { lien: string; mention: string | null } | null;
}): React.ReactElement {
  const [etat, setEtat] = useState<EtatFicheFormateur | null>(null);
  const [enCours, demarrer] = useTransition();
  const [statutChoisi, setStatutChoisi] = useState<StatutFiche | "">("");
  const statut = statutPropose ?? (statutChoisi === "" ? null : statutChoisi);

  const fiche = etat?.ok
    ? { lien: etat.lien, mention: etat.mention ?? null, deja: etat.deja === true }
    : ficheExistante
      ? { ...ficheExistante, deja: true }
      : null;

  if (fiche) {
    return (
      <div role="status">
        {etat?.ok && etat.rattachee ? (
          <p className="admin-alert admin-alert-success">
            Une fiche formateur existait déjà à cette adresse : la candidature y est rattachée.
          </p>
        ) : null}
        {etat?.ok && !fiche.deja && !etat.rattachee ? (
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
        Crée sa fiche dans Qualiopi › Formateurs avec son nom, son e-mail et son téléphone (et son
        CV pour un salarié). La fiche est créée inactive, jusqu&apos;à confirmation du numéro de
        déclaration d&apos;activité dans le dossier. Une fiche existante à la même adresse est
        rattachée, jamais dupliquée.
      </p>
      {statutPropose === null ? (
        <label className="admin-field">
          <span className="admin-label">Statut de la fiche (rien ne l&apos;indique)</span>
          <select
            className="admin-select"
            value={statutChoisi}
            onChange={(e) => setStatutChoisi(e.target.value as StatutFiche | "")}
          >
            <option value="">— Choisir —</option>
            <option value="sous_traitant">Sous-traitant (indépendant)</option>
            <option value="salarie">Salarié</option>
          </select>
        </label>
      ) : null}
      {etat && !etat.ok ? (
        <p role="alert" className="admin-alert admin-alert-error">
          {etat.message}
        </p>
      ) : null}
      <button
        type="button"
        className="admin-button-secondary"
        disabled={enCours || statut === null}
        onClick={() =>
          demarrer(async () => {
            setEtat(
              await creerFicheFormateurDepuisCandidatureAction({
                applicationId,
                ...(statutPropose === null && statut ? { statut } : {}),
              }),
            );
          })
        }
      >
        {enCours ? "Création…" : "Créer sa fiche formateur"}
      </button>
    </div>
  );
}
