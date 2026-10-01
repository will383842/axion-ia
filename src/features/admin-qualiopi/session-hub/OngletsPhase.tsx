/**
 * Les onglets de phase de la fiche session — Préparer / Le jour J / Après /
 * Clôturée.
 *
 * ## Pourquoi des onglets
 *
 * 🔴 Audit UX du 30/09/2026 : huit écrans, 77 boutons, tout affiché tout le
 * temps. On ne savait ni quoi faire ni où aller. La fiche s'ouvre désormais sur
 * la phase COURANTE du dossier (`phaseDossier`, ADR 0060) ; un autre onglet
 * n'est qu'un lien `?phase=`.
 *
 * ## Pourquoi des liens, et pas un composant client
 *
 * Un onglet ici est une URL : partageable, rechargeable, et atteinte en un clic
 * depuis « À traiter » (`hrefEtape` porte `?phase=`). Le rendu est serveur, sans
 * une ligne de JavaScript envoyée au navigateur — la console n'ajoute rien à son
 * bundle pour cela.
 *
 * L'onglet de la phase courante le DIT en toutes lettres (« phase actuelle »),
 * pas seulement par une couleur (WCAG 1.4.1).
 */

import Link from "next/link";

import { PHASES_FICHE, type PhaseFiche } from "./ancres";

export function OngletsPhase({
  hrefFiche,
  affichee,
  courante,
}: {
  /** URL de la fiche, sans paramètre. */
  readonly hrefFiche: string;
  /** L'onglet affiché. */
  readonly affichee: PhaseFiche;
  /** La phase du dossier (`phaseDossier`) — `null` si le dossier est hors parcours. */
  readonly courante: PhaseFiche | null;
}) {
  return (
    <nav
      aria-label="Phases du dossier"
      className="mb-[var(--space-admin-6)] flex flex-wrap gap-[var(--space-admin-2)] border-b border-[color:var(--color-admin-border)]"
    >
      {PHASES_FICHE.map((p) => {
        const active = p.id === affichee;
        return (
          <Link
            key={p.id}
            href={`${hrefFiche}?phase=${p.id}`}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "-mb-px border-b-2 border-[color:var(--color-admin-accent)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-fg)]"
                : "px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)] hover:text-[color:var(--color-admin-fg)]"
            }
          >
            {p.libelle}
            {p.id === courante ? (
              <span className="text-[length:var(--text-admin-xs)] font-normal text-[color:var(--color-admin-fg-muted)]">
                {" "}
                (phase actuelle)
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
