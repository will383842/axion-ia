"use client";
// use-client: contexte React (createContext / useContext) lu par les composants client de la fiche.

/**
 * 🔴 ADR 0060 — L'état du verrou du dossier, porté jusqu'aux composants de la
 * fiche session.
 *
 * Le `layout.tsx` de la fiche lit l'état UNE fois (`chargerEtatVerrou`, la
 * source unique) et le pose ici. Chaque composant qui porte une écriture
 * classée VERROU lit `useDossierFige()` : sur un dossier clos, il remplace son
 * formulaire par un résumé en lecture, ou masque son bouton. Aucune règle
 * métier n'est recalculée côté écran : seul le booléen `dossierFige(etat)`,
 * calculé par le serveur, descend.
 *
 * ⚠️ Contexte LÉGER, sans dépendance : un simple Provider (budget de la
 * console, spécification §3). Hors Provider — autres écrans qui réutilisent
 * ces composants, tests existants — la valeur par défaut est « ouvert » : rien
 * ne change pour eux.
 *
 * Le serveur reste la seule vraie garde (`assertDossierOuvert`). L'écran ne
 * fait qu'éviter d'afficher un bouton qui se ferait refuser.
 */

import { createContext, useContext } from "react";
import type { NomEtatVerrou } from "@/server/qualiopi/sessions/verrou-dossier";

export interface ValeurVerrouDossier {
  /** Vrai quand le dossier est clos : les écritures VERROU sont refusées. */
  readonly fige: boolean;
  /** Nom de l'état calculé par le serveur ; `null` hors fiche session. */
  readonly etat: NomEtatVerrou | null;
}

const VerrouDossierContext = createContext<ValeurVerrouDossier>({ fige: false, etat: null });

export function DossierVerrouProvider({
  fige,
  etat,
  children,
}: {
  fige: boolean;
  etat: NomEtatVerrou | null;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <VerrouDossierContext.Provider value={{ fige, etat }}>{children}</VerrouDossierContext.Provider>
  );
}

/** Vrai sur un dossier clos : ne rendre AUCUN geste d'écriture classé VERROU. */
export function useDossierFige(): boolean {
  return useContext(VerrouDossierContext).fige;
}

/**
 * ADR 0060 (D3) — la saisie des réponses d'un questionnaire PAR L'ORGANISME est
 * refusée dès que la session est réalisée et le dossier clos ou à recueillir :
 * seul le stagiaire répond alors (indicateur 30).
 */
export function useSaisieOrganismeFermee(): boolean {
  const { etat } = useContext(VerrouDossierContext);
  return etat === "clos" || etat === "a_recueillir";
}

/** Phrase unique posée à la place d'un formulaire masqué sur un dossier clos. */
export const MENTION_DOSSIER_CLOS =
  "Dossier clos : lecture seule. Pour corriger, rouvrez le dossier depuis le bandeau en haut de page (motif obligatoire, visible par l'auditeur).";

/** La mention, rendue. Discrète : le bandeau porte déjà l'explication complète. */
export function MentionDossierClos({ className }: { className?: string }): React.ReactElement {
  return (
    <p
      data-dossier-clos=""
      className={
        "text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)] " +
        (className ?? "")
      }
    >
      {MENTION_DOSSIER_CLOS}
    </p>
  );
}

/** Une ligne « libellé : valeur » d'un résumé en lecture. Les valeurs vides sont omises. */
export interface LigneResume {
  readonly libelle: string;
  readonly valeur: string | null | undefined;
}

/**
 * Le résumé en lecture qui remplace un formulaire sur un dossier clos : ce que
 * le formulaire aurait montré, sans rien de modifiable.
 */
export function ResumeLecture({
  lignes,
  className,
}: {
  lignes: ReadonlyArray<LigneResume>;
  className?: string;
}): React.ReactElement {
  const visibles = lignes.filter((l) => l.valeur != null && l.valeur.trim() !== "");
  return (
    <div
      className={
        "rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)] " +
        (className ?? "")
      }
    >
      {visibles.length === 0 ? (
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Non renseigné.
        </p>
      ) : (
        <dl className="grid grid-cols-1 gap-[var(--space-admin-3)] sm:grid-cols-2">
          {visibles.map((l) => (
            <div key={l.libelle}>
              <dt className="text-[length:var(--text-admin-xs)] tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
                {l.libelle}
              </dt>
              <dd className="mt-0.5 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
                {l.valeur}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <MentionDossierClos className="mt-[var(--space-admin-3)]" />
    </div>
  );
}
