"use client";
// use-client: useActionState — le retour d'un geste groupé doit s'afficher sans recharger.
//
// 🔴 POURQUOI UNE ÎLE CLIENTE ICI, ALORS QUE LA LISTE EST SERVEUR.
//
// Un `<form action={serverAction}>` purement serveur marcherait — sans un
// kilo-octet de JavaScript — mais il ne saurait RIEN dire en retour. Or c'est
// le seul écran du dossier où un clic touche cinquante dossiers d'un coup :
// « refusé, rien n'a été modifié » et « 12 traitées, 3 déjà dans cet état »
// sont exactement ce qu'il faut savoir, et un rechargement muet ne le dit pas.
//
// 🔑 La TABLE reste serveur : elle passe en `children`. Le composant client
// n'enveloppe que le formulaire et la barre — la liste, ses lignes et leurs
// identités ne traversent pas la frontière.

import { useActionState } from "react";

import { changerStatutEnMasseAction } from "@/features/admin-job-applications/actions-en-masse";
import type { EtatEnMasse } from "@/features/admin-job-applications/en-masse";

/**
 * Une option de menu, reduite a ce qu'un `<option>` a besoin de savoir.
 *
 * 🔴 LE VOCABULAIRE NE TRAVERSE PLUS LA FRONTIERE, ET CE N'EST PAS COSMETIQUE.
 *
 * Ce composant importait `STATUTS_CANDIDATURE`, `LIBELLE_STATUT`,
 * `MOTIFS_REFUS_SAISISSABLES` et `LIBELLE_MOTIF_REFUS` depuis
 * `@/content/recrutement/statuts`. Un seul import client suffit a tirer le
 * MODULE ENTIER dans le paquet du navigateur — ses 8,5 Ko de source, ses six
 * predicats de decision et ses trois tables, dont aucun n'est utilise ici.
 *
 * 🔑 Ce module est le SSOT des statuts : il est appele a grossir, et chaque
 * ajout serait alors paye par le navigateur sur une console que personne ne
 * charge sur un reseau mobile. Le cliquet anti-croissance de `bundle:check`
 * l'a attrape a 700,35 Ko contre 700 — un depassement de 0,35 Ko qui disait
 * quelque chose de juste.
 *
 * Les listes sont donc calculees PAR LE PARENT, qui est un composant serveur,
 * et passees en props deja reduites a `{ value, label }`.
 */
export interface OptionDeMenu {
  readonly value: string;
  readonly label: string;
}

/**
 * État initial. `traitees: 0` plutôt qu'un état « vierge » distinct : l'écran
 * n'affiche rien tant que rien n'a été fait, et un troisième état n'aurait
 * servi qu'à être oublié dans un `switch`.
 */
const INITIAL: EtatEnMasse = { ok: true, traitees: 0, inchangees: 0 };

interface Props {
  children: React.ReactNode;
  /** Les statuts proposables, dans l'ordre du vocabulaire. */
  statuts: readonly OptionDeMenu[];
  /**
   * Les motifs SAISISSABLES — `non_renseigne` en est deja exclu par le parent,
   * comme sur la fiche : il existe pour dire la verite sur le stock anterieur,
   * pas pour offrir une porte de sortie a qui ne veut pas choisir.
   */
  motifs: readonly OptionDeMenu[];
  /** Plafond de dossiers par geste, affiche a l'ecran. */
  plafond: number;
}

export function FormulaireEnMasse({
  children,
  statuts,
  motifs,
  plafond,
}: Props): React.ReactElement {
  const [etat, action, enCours] = useActionState(changerStatutEnMasseAction, INITIAL);

  return (
    <form action={action}>
      {children}

      <div
        role="group"
        aria-label="Appliquer à la sélection"
        className="mt-[var(--space-admin-4)] flex flex-wrap items-end gap-[var(--space-admin-3)]"
      >
        <div className="admin-field">
          <label htmlFor="masse-status" className="admin-label">
            Nouveau statut
          </label>
          <select id="masse-status" name="status" className="admin-input" defaultValue="reviewing">
            {statuts.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-field">
          <label htmlFor="masse-motif" className="admin-label">
            Motif (si écartée ou retirée)
          </label>
          {/* 🔑 `non_renseigne` reste HORS de ce menu, comme sur la fiche : il
              existe pour dire la vérité sur le stock antérieur, pas pour offrir
              une porte de sortie à qui ne veut pas choisir. Le filtrage est
              fait par le parent, côté serveur. */}
          <select id="masse-motif" name="rejectionReason" className="admin-input" defaultValue="">
            <option value="">—</option>
            {motifs.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" className="admin-button-secondary" disabled={enCours}>
          {enCours ? "Application…" : "Appliquer à la sélection"}
        </button>

        <p className="admin-meta-small">Au plus {plafond} dossiers par geste.</p>
      </div>

      {/* `role="status"` et non `alert` : un compte rendu de geste réussi n'est
          pas une alerte, et un lecteur d'écran qui interrompt tout à chaque
          enregistrement finit par être coupé. */}
      {!etat.ok ? (
        <p className="admin-alert admin-alert-error mt-[var(--space-admin-3)]" role="alert">
          {etat.error}
        </p>
      ) : etat.traitees > 0 || etat.inchangees > 0 ? (
        <p className="admin-alert admin-alert-success mt-[var(--space-admin-3)]" role="status">
          {etat.traitees} candidature{etat.traitees > 1 ? "s" : ""} modifiée
          {etat.traitees > 1 ? "s" : ""}
          {/* Les dossiers DÉJÀ dans l'état visé sont comptés à part. Les fondre
              dans le total ferait croire à un geste qui n'a pas eu lieu — et
              c'est justement ce qu'on vérifie quand on doute d'un clic. */}
          {etat.inchangees > 0 ? ` · ${etat.inchangees} déjà dans cet état` : ""}.
        </p>
      ) : null}
    </form>
  );
}
