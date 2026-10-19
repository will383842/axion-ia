"use client";
// use-client: état local du sélecteur, confirmation en deux temps avant « actif ».

import { useState, useTransition } from "react";

import type { EtatBasculeQualiopi } from "@/server/actions/qualiopi/interrupteurs-qualiopi";

type Etat = "eteint" | "essai" | "actif";

const LIBELLES: Readonly<Record<Etat, string>> = {
  eteint: "Éteint",
  essai: "Essai",
  actif: "Actif",
};

interface Props {
  lot: string;
  libelle: string;
  etat: Etat;
  action: (input: {
    lot: string;
    etat: string;
    confirmerActif?: boolean;
  }) => Promise<EtatBasculeQualiopi>;
  desactive: boolean;
}

export function InterrupteurQualiopiSelecteur({ lot, libelle, etat, action, desactive }: Props) {
  const [courant, setCourant] = useState<Etat>(etat);
  const [choix, setChoix] = useState<Etat>(etat);
  const [aConfirmer, setAConfirmer] = useState(false);
  const [retour, setRetour] = useState<EtatBasculeQualiopi | null>(null);
  const [enCours, demarrer] = useTransition();

  function envoyer(cible: Etat, confirmerActif: boolean) {
    demarrer(async () => {
      const r = await action({ lot, etat: cible, confirmerActif });
      setRetour(r);
      setAConfirmer(false);
      if (r.ok) {
        setCourant(r.etat);
        setChoix(r.etat);
      } else {
        setChoix(courant);
      }
    });
  }

  function appliquer() {
    if (choix === courant) return;
    if (choix === "actif") {
      setAConfirmer(true);
      return;
    }
    envoyer(choix, false);
  }

  const inactif = desactive || enCours;

  return (
    <div className="flex flex-col items-end gap-[var(--space-admin-2)]">
      <div className="flex items-center gap-[var(--space-admin-2)]">
        <select
          className="admin-input"
          aria-label={`État de l'interrupteur « ${libelle} »`}
          value={choix}
          disabled={inactif || aConfirmer}
          onChange={(e) => {
            setChoix(e.target.value as Etat);
            setRetour(null);
          }}
        >
          {(Object.keys(LIBELLES) as Etat[]).map((e) => (
            <option key={e} value={e}>
              {LIBELLES[e]}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="admin-button-ghost"
          disabled={inactif || aConfirmer || choix === courant}
          onClick={appliquer}
        >
          Appliquer
        </button>
      </div>
      {aConfirmer ? (
        <div role="alertdialog" aria-label="Confirmer le passage à actif" className="text-right">
          <p className="admin-meta-small">
            « {libelle} » agira sur de VRAIS clients, pas seulement sur les sessions d&apos;essai.
            Confirmer le passage à « actif » ?
          </p>
          <div className="flex justify-end gap-[var(--space-admin-2)]">
            <button
              type="button"
              className="admin-button"
              disabled={enCours}
              onClick={() => envoyer("actif", true)}
            >
              Oui, passer à actif
            </button>
            <button
              type="button"
              className="admin-button-ghost"
              disabled={enCours}
              onClick={() => {
                setAConfirmer(false);
                setChoix(courant);
              }}
            >
              Annuler
            </button>
          </div>
        </div>
      ) : null}
      {retour && !retour.ok ? (
        <p role="alert" className="admin-meta-small text-[color:var(--color-admin-destructive-fg)]">
          {retour.error}
        </p>
      ) : retour?.ok ? (
        <p role="status" className="admin-meta-small">
          {retour.message}
        </p>
      ) : null}
    </div>
  );
}
