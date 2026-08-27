/**
 * Barre de commande de l'Agenda — vues, navigation, saut à une date (2026-08-27).
 *
 * CE QU'ELLE RÉPARE
 * -----------------
 * 🔴 La version précédente n'offrait QU'UNE frise de sept jours centrée sur
 * aujourd'hui. Aucun moyen de changer de mois, de revenir en arrière, ni
 * d'atteindre une date précise : la console ne savait montrer qu'une fenêtre
 * glissante autour du présent. Signalé par Will le 2026-08-27, à juste titre.
 *
 * AUCUN JAVASCRIPT, ET POURTANT INSTANTANÉ
 * -----------------------------------------
 * Tout ici est un lien ou un formulaire `GET`. Aucun état client, aucun
 * gestionnaire d'événement, zéro octet ajouté au bundle. Ce n'est pas un
 * compromis : le routeur de Next fait de chaque `Link` une navigation côté
 * client qui ne recharge pas la page et ne rejoue que le rendu serveur du
 * segment. On obtient donc le confort d'une interface interactive sans en payer
 * le poids — et sans qu'un blocage de script puisse rendre l'agenda inutilisable.
 *
 * Le saut à une date passe par un `<input type="date">` dans un `<form method="get">` :
 * le sélecteur natif du navigateur, gratuit, accessible au clavier, traduit, et
 * capable d'atteindre 1970 comme 2099.
 */

import Link from "next/link";
import {
  VUES,
  naviguer,
  libelleDeLaVue,
  type VueAgenda,
  type CleJour,
} from "@/features/admin-agenda/calendrier";

const LIBELLES_VUE: Record<VueAgenda, string> = {
  mois: "Mois",
  semaine: "Semaine",
  jour: "Jour",
};

export interface AgendaBarreProps {
  readonly base: string;
  readonly vue: VueAgenda;
  readonly jour: CleJour;
  readonly aujourdhui: CleJour;
  /** Sources actives, pour les conserver en changeant de vue ou de date. */
  readonly sources: readonly string[];
}

/** Construit une URL de la page en ne changeant que ce qu'on lui demande. */
function lien(
  base: string,
  vue: VueAgenda,
  jour: CleJour,
  sources: readonly string[],
): string {
  const p = new URLSearchParams({ vue, jour });
  // Les filtres ne sont écrits que s'ils filtrent réellement : une URL propre
  // quand tout est affiché reste partageable et lisible.
  if (sources.length > 0) p.set("sources", sources.join(","));
  return `${base}?${p.toString()}`;
}

export function AgendaBarre({
  base,
  vue,
  jour,
  aujourdhui,
  sources,
}: AgendaBarreProps): React.ReactElement {
  const surAujourdhui = jour === aujourdhui;

  return (
    <div className="flex flex-col gap-[var(--space-admin-3)] rounded-[var(--radius-admin-lg)] border border-[color:var(--color-admin-border-strong)] bg-[color:var(--color-admin-bg-subtle)] p-[var(--space-admin-3)]">
      <div className="flex flex-wrap items-center justify-between gap-[var(--space-admin-3)]">
        {/* Onglets de vue — des liens, donc ouvrables dans un nouvel onglet. */}
        <nav aria-label="Choisir une vue">
          <ul className="flex gap-[var(--space-admin-1)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-bg)] p-[2px]">
            {VUES.map((v) => {
              const actif = v === vue;
              return (
                <li key={v}>
                  <Link
                    href={lien(base, v, jour, sources)}
                    aria-current={actif ? "page" : undefined}
                    className={`block rounded-[var(--radius-admin-sm)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] font-medium transition-colors ${
                      actif
                        ? "bg-[color:var(--color-admin-accent)] text-[color:var(--color-admin-accent-fg)]"
                        : "text-[color:var(--color-admin-fg-muted)] hover:bg-[color:var(--color-admin-hover)] hover:text-[color:var(--color-admin-fg)]"
                    }`}
                  >
                    {LIBELLES_VUE[v]}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Titre de la période — la seule information qui dit où l'on est. */}
        <h2 className="text-[length:var(--text-admin-lg)] font-semibold first-letter:uppercase tabular-nums">
          {libelleDeLaVue(vue, jour)}
        </h2>

        <div className="flex items-center gap-[var(--space-admin-1)]">
          <Link
            href={lien(base, vue, naviguer(vue, jour, -1), sources)}
            aria-label={vue === "mois" ? "Mois précédent" : vue === "semaine" ? "Semaine précédente" : "Jour précédent"}
            className="flex h-[2.25rem] w-[2.25rem] items-center justify-center rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border-strong)] bg-[color:var(--color-admin-bg)] text-[length:var(--text-admin-md)] hover:bg-[color:var(--color-admin-hover)]"
          >
            ‹
          </Link>
          <Link
            href={lien(base, vue, aujourdhui, sources)}
            aria-current={surAujourdhui ? "date" : undefined}
            className={`rounded-[var(--radius-admin-md)] border px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] font-medium ${
              surAujourdhui
                ? "border-[color:var(--color-admin-accent)] bg-[color:var(--color-admin-info-soft)] text-[color:var(--color-admin-fg)]"
                : "border-[color:var(--color-admin-border-strong)] bg-[color:var(--color-admin-bg)] hover:bg-[color:var(--color-admin-hover)]"
            }`}
          >
            Aujourd&apos;hui
          </Link>
          <Link
            href={lien(base, vue, naviguer(vue, jour, 1), sources)}
            aria-label={vue === "mois" ? "Mois suivant" : vue === "semaine" ? "Semaine suivante" : "Jour suivant"}
            className="flex h-[2.25rem] w-[2.25rem] items-center justify-center rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border-strong)] bg-[color:var(--color-admin-bg)] text-[length:var(--text-admin-md)] hover:bg-[color:var(--color-admin-hover)]"
          >
            ›
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-[var(--space-admin-3)]">
        {/*
          Saut à une date quelconque, passé comme futur.
          `method="get"` : le formulaire écrit lui-même `?jour=…` dans l'URL, sans
          une ligne de JavaScript. Les autres paramètres voyagent en champs cachés,
          sinon changer de date remettrait la vue et les filtres à zéro.
        */}
        <form method="get" action={base} className="flex items-end gap-[var(--space-admin-2)]">
          <input type="hidden" name="vue" value={vue} />
          {sources.length > 0 && <input type="hidden" name="sources" value={sources.join(",")} />}
          <label className="flex flex-col gap-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            Aller à une date
            <input
              type="date"
              name="jour"
              defaultValue={jour}
              className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border-strong)] bg-[color:var(--color-admin-bg)] px-[var(--space-admin-2)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]"
            />
          </label>
          <button
            type="submit"
            className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border-strong)] bg-[color:var(--color-admin-bg)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] font-medium hover:bg-[color:var(--color-admin-hover)]"
          >
            Y aller
          </button>
        </form>

        <AgendaFiltres base={base} vue={vue} jour={jour} sources={sources} />
      </div>
    </div>
  );
}

/** Les trois sources, et leur couleur d'identité. Une seule source de vérité. */
export const SOURCES_FILTRABLES = [
  { id: "calendly", label: "Réservations", couleur: "var(--color-admin-id-bleu)" },
  { id: "google", label: "Personnel", couleur: "var(--color-admin-id-teal)" },
  { id: "console", label: "Blocages", couleur: "var(--color-admin-id-terracotta)" },
] as const;

/**
 * Filtres par source — des liens qui basculent, pas des cases à cocher.
 *
 * Un lien plutôt qu'une case : l'état vit dans l'URL, donc il est partageable,
 * il survit à un rafraîchissement, il fonctionne avec le bouton Retour, et il
 * ne coûte aucun JavaScript. Une case à cocher aurait exigé un composant client
 * pour un résultat strictement identique à l'écran.
 */
function AgendaFiltres({
  base,
  vue,
  jour,
  sources,
}: {
  readonly base: string;
  readonly vue: VueAgenda;
  readonly jour: CleJour;
  readonly sources: readonly string[];
}): React.ReactElement {
  // `sources` vide = tout est affiché. C'est l'état par défaut et il ne s'écrit
  // pas dans l'URL : on ne montre pas un filtre à quelqu'un qui n'en a posé aucun.
  const toutes = SOURCES_FILTRABLES.map((s) => s.id) as readonly string[];
  const actives = sources.length > 0 ? sources : toutes;

  return (
    <fieldset className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
      <legend className="sr-only">Filtrer par source</legend>
      {SOURCES_FILTRABLES.map((s) => {
        const active = actives.includes(s.id);
        // Basculer CETTE source, en gardant les autres. Retirer la dernière
        // source active reviendrait à vider l'écran : on retombe alors sur tout,
        // ce qui est le seul comportement qui ne laisse pas l'utilisateur devant
        // une page vide sans comprendre pourquoi.
        const suivantes = active ? actives.filter((x) => x !== s.id) : [...actives, s.id];
        const p = new URLSearchParams({ vue, jour });
        if (suivantes.length > 0 && suivantes.length < toutes.length) {
          p.set("sources", suivantes.join(","));
        }
        return (
          <Link
            key={s.id}
            href={`${base}?${p.toString()}`}
            aria-pressed={active}
            className={`flex items-center gap-[var(--space-admin-1)] rounded-[var(--radius-admin-md)] border px-[var(--space-admin-2)] py-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] font-medium ${
              active
                ? "border-[color:var(--color-admin-border-strong)] bg-[color:var(--color-admin-bg)] text-[color:var(--color-admin-fg)]"
                : "border-[color:var(--color-admin-border)] bg-transparent text-[color:var(--color-admin-fg-disabled)] line-through"
            }`}
          >
            <span
              aria-hidden="true"
              className="h-[0.625rem] w-[0.625rem] shrink-0 rounded-full"
              style={{ backgroundColor: active ? s.couleur : "transparent", border: `1px solid ${s.couleur}` }}
            />
            {s.label}
          </Link>
        );
      })}
    </fieldset>
  );
}
