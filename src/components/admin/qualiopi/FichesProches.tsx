"use client";
// use-client: liste « c'est peut-être déjà… » recalculée pendant la frappe (délai 300 ms) et boutons d'ajout.

/**
 * « C'est peut-être déjà… » — le petit îlot qui, PENDANT la saisie d'une
 * nouvelle fiche client, montre les fiches existantes qui lui ressemblent
 * (même SIREN, même adresse, même fin d'adresse pro, même nom dans la même
 * ville). Chantier visio, plan §3.17, décision B18 : un client = une fiche.
 *
 * Ce n'est qu'une AIDE : le serveur recalcule tout à la création, sous verrou
 * (`creerOuRetrouverClient`). Un même SIREN y est refusé quoi que dise l'écran.
 *
 * ⚠️ Pas de `role="alert"` ici : la liste s'annonce poliment (`aria-live`),
 * et le parcours E2E lit l'alerte du formulaire comme un REFUS de création.
 */

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import {
  ajouterPersonneALaFicheAction,
  fichesProchesAction,
} from "@/features/dossier-client/actions";
import type { FicheProche, FicheProcheLibellee } from "@/server/qualiopi/crm/porte-client";

export interface SaisieFiche {
  readonly type: "entreprise" | "particulier";
  readonly raisonSociale: string;
  readonly siret?: string;
  readonly siren?: string;
  readonly email?: string;
  readonly ville?: string;
  readonly codePostal?: string;
}

export interface FichesProchesProps {
  readonly saisie: SaisieFiche;
  /** Lien vers une fiche : `${base}/${id}`. */
  readonly baseFicheHref: string;
  /** La personne saisie, pour « Ajouter cette personne à la fiche ». */
  readonly personne?: {
    readonly nom?: string;
    readonly email?: string;
    readonly telephone?: string;
    readonly fonction?: string;
  };
  /** Assistant de vente : « Utiliser cette fiche » au lieu d'ouvrir un lien. */
  readonly onUtiliser?: (fiche: FicheProche) => void;
}

/** Assez saisi pour chercher ? (évite une requête à chaque première lettre). */
function assezSaisi(s: SaisieFiche): boolean {
  const chiffres = `${s.siret ?? ""}${s.siren ?? ""}`.replace(/\D/g, "");
  return (
    s.raisonSociale.trim().length >= 3 || (s.email ?? "").includes("@") || chiffres.length >= 9
  );
}

export function FichesProches({
  saisie,
  baseFicheHref,
  personne,
  onUtiliser,
}: FichesProchesProps): React.ReactElement | null {
  const [proches, setProches] = useState<FicheProcheLibellee[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, startTransition] = useTransition();
  const cle = JSON.stringify(saisie);

  const actif = assezSaisi(saisie);

  useEffect(() => {
    if (!actif) return;
    let annule = false;
    const minuterie = setTimeout(() => {
      fichesProchesAction(saisie)
        .then((r) => {
          if (!annule) setProches(r);
        })
        .catch(() => {
          // Aide seulement : une panne ne bloque pas la saisie.
          if (!annule) setProches([]);
        });
    }, 300);
    return () => {
      annule = true;
      clearTimeout(minuterie);
    };
    // `cle` résume la saisie : l'objet change à chaque rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle, actif]);

  // Saisie trop courte : on n'affiche rien (sans vider l'état dans l'effet).
  const visibles = actif ? proches : [];
  if (visibles.length === 0) return null;

  const peutAjouter = Boolean(personne?.nom?.trim() || personne?.email?.trim());

  function ajouter(fiche: FicheProche): void {
    setMessage(null);
    startTransition(async () => {
      const r = await ajouterPersonneALaFicheAction({
        clientId: fiche.ficheId,
        ...(personne?.nom ? { nom: personne.nom } : {}),
        ...(personne?.email ? { email: personne.email } : {}),
        ...(personne?.telephone ? { telephone: personne.telephone } : {}),
        ...(personne?.fonction ? { fonction: personne.fonction } : {}),
      });
      setMessage(
        r.ok
          ? r.cree
            ? `Personne ajoutée à la fiche ${fiche.numero}. Aucune nouvelle fiche n'a été créée.`
            : `Cette personne est déjà sur la fiche ${fiche.numero}.`
          : r.erreur,
      );
    });
  }

  return (
    <section
      aria-live="polite"
      className="mt-[var(--space-admin-4)] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-warning)] bg-[color:var(--color-admin-bg)] p-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]"
    >
      <p className="font-semibold text-[color:var(--color-admin-fg)]">
        C&apos;est peut-être déjà un client :
      </p>
      <ul className="mt-[var(--space-admin-2)] space-y-[var(--space-admin-2)]">
        {visibles.map((p) => (
          <li key={p.ficheId} className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
            <Link
              href={`${baseFicheHref}/${p.ficheId}`}
              className="font-mono text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
            >
              {p.numero}
            </Link>
            <span className="font-medium">{p.raisonSociale}</span>
            <span className="text-[color:var(--color-admin-fg-muted)]">({p.libelle})</span>
            {p.force === "bloquant" ? (
              <span className="text-[color:var(--color-admin-error)]">
                une entreprise n&apos;a qu&apos;une fiche : la création sera refusée
              </span>
            ) : null}
            {onUtiliser ? (
              <button
                type="button"
                className="admin-button-ghost"
                onClick={() => onUtiliser(p)}
                disabled={enCours}
              >
                Utiliser cette fiche
              </button>
            ) : null}
            {peutAjouter ? (
              <button
                type="button"
                className="admin-button-ghost"
                onClick={() => ajouter(p)}
                disabled={enCours}
              >
                Ajouter cette personne à la fiche
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {message !== null ? (
        <p className="mt-[var(--space-admin-2)] text-[color:var(--color-admin-fg-soft)]">
          {message}
        </p>
      ) : null}
    </section>
  );
}
