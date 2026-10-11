"use client";
// use-client: formulaire de saisie (état des champs, retour de l'action sans rechargement).
//
// Lot L0c-3 — « Ajouter un candidat formateur » (vue « Formateurs freelance »,
// interrupteur `formateurs.ajout_console`). Calque de la saisie manuelle des
// apporteurs : l'invitation ne part QUE si la case est cochée.

import * as React from "react";

import { AdminCard } from "@/components/admin/ui/AdminCard";
import type { EtatAjoutCandidatFormateur } from "@/features/admin-job-applications/candidat-formateur-actions";
import {
  ORIGINES_ACCORD_REQUIS_FORMATEUR,
  ORIGINES_CANDIDAT_FORMATEUR,
} from "@/lib/careers/candidat-formateur-console";

export function AjouterCandidatFormateur({
  ajouter,
}: {
  /** L'action, passée PAR LA PAGE (même doctrine que `reponseAuto.basculer`). */
  ajouter: (payload: unknown) => Promise<EtatAjoutCandidatFormateur>;
}): React.ReactElement {
  const [ouvert, setOuvert] = React.useState(false);
  const [origine, setOrigine] = React.useState("salon");
  const [inviter, setInviter] = React.useState(false);
  const [accord, setAccord] = React.useState(false);
  const [enCours, setEnCours] = React.useState(false);
  const [etat, setEtat] = React.useState<EtatAjoutCandidatFormateur | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formulaire = e.currentTarget;
    const f = new FormData(formulaire);
    const lire = (k: string) => {
      const v = f.get(k);
      return typeof v === "string" ? v : "";
    };
    setEnCours(true);
    try {
      const r = await ajouter({
        prenom: lire("prenom"),
        nom: lire("nom"),
        email: lire("email"),
        telephone: lire("telephone"),
        origine,
        adresseReelle: lire("adresseReelle"),
        envoyerInvitation: inviter,
        accordContact: accord,
      });
      setEtat(r);
      if (r.ok) formulaire.reset();
    } catch {
      setEtat({ ok: false, message: "L'ajout n'a pas été enregistré. Réessayez." });
    } finally {
      setEnCours(false);
    }
  }

  if (!ouvert) {
    return (
      <div className="mb-[var(--space-admin-4)]">
        <button type="button" className="admin-button-ghost" onClick={() => setOuvert(true)}>
          Ajouter un candidat formateur
        </button>
      </div>
    );
  }

  return (
    <AdminCard className="mb-[var(--space-admin-5)]">
      <h2 className="admin-section-title">Ajouter un candidat formateur</h2>
      <p className="admin-meta-small">
        Une personne rencontrée hors du site. Aucun message ne part, sauf l&apos;invitation à
        l&apos;échange si vous cochez la case.
      </p>
      <form onSubmit={onSubmit} className="admin-filters">
        <div className="admin-filters-grid">
          <div className="admin-field">
            <label htmlFor="cf-prenom" className="admin-label">
              Prénom
            </label>
            <input id="cf-prenom" name="prenom" required maxLength={100} className="admin-input" />
          </div>
          <div className="admin-field">
            <label htmlFor="cf-nom" className="admin-label">
              Nom
            </label>
            <input id="cf-nom" name="nom" required maxLength={100} className="admin-input" />
          </div>
          <div className="admin-field">
            <label htmlFor="cf-email" className="admin-label">
              Adresse e-mail
            </label>
            <input
              id="cf-email"
              name="email"
              type="email"
              required
              maxLength={180}
              className="admin-input"
            />
          </div>
          <div className="admin-field">
            <label htmlFor="cf-reelle" className="admin-label">
              Adresse réelle, si vous l&apos;avez
            </label>
            <input
              id="cf-reelle"
              name="adresseReelle"
              type="email"
              maxLength={180}
              className="admin-input"
            />
            <p className="admin-meta-small">
              Remplace une adresse relais (Indeed…) pour les envois.
            </p>
          </div>
          <div className="admin-field">
            <label htmlFor="cf-tel" className="admin-label">
              Téléphone
            </label>
            <input id="cf-tel" name="telephone" type="tel" maxLength={40} className="admin-input" />
          </div>
          <div className="admin-field">
            <label htmlFor="cf-origine" className="admin-label">
              Origine
            </label>
            <select
              id="cf-origine"
              value={origine}
              onChange={(ev) => setOrigine(ev.target.value)}
              className="admin-input"
            >
              {ORIGINES_CANDIDAT_FORMATEUR.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.libelle}
                </option>
              ))}
            </select>
          </div>
        </div>
        <label className="admin-meta-small flex items-center gap-[var(--space-admin-2)]">
          <input
            type="checkbox"
            checked={inviter}
            onChange={(ev) => setInviter(ev.target.checked)}
          />
          Envoyer l&apos;invitation à l&apos;échange
        </label>
        {inviter && ORIGINES_ACCORD_REQUIS_FORMATEUR.includes(origine) ? (
          <label className="admin-meta-small flex items-center gap-[var(--space-admin-2)]">
            <input
              type="checkbox"
              checked={accord}
              onChange={(ev) => setAccord(ev.target.checked)}
            />
            La personne a accepté d&apos;être contactée
          </label>
        ) : null}
        <div className="flex gap-[var(--space-admin-2)]">
          <button type="submit" className="admin-button" disabled={enCours}>
            {enCours ? "Ajout…" : "Ajouter"}
          </button>
          <button type="button" className="admin-button-ghost" onClick={() => setOuvert(false)}>
            Fermer
          </button>
        </div>
        {etat ? (
          <p role="status" className="admin-meta-small">
            {etat.message}
          </p>
        ) : null}
      </form>
    </AdminCard>
  );
}
