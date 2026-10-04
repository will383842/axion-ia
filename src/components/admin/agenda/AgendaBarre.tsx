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
import {
  LIBELLE_TYPE_RDV,
  TEINTE_TYPE_RDV,
  TYPES_FILTRABLES,
} from "@/features/admin-rendezvous/type-rdv";
import { estTypeRendezVous, type TypeRendezVous } from "@/server/calendly/type-rendez-vous";
import { TEINTE_SOURCE } from "./teinte-agenda";

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
  /**
   * Filtres actifs (sources ET types, cf. `TYPES_FILTRABLES_AGENDA`), pour les
   * conserver en changeant de vue ou de date.
   */
  readonly sources: readonly string[];
}

/** Construit une URL de la page en ne changeant que ce qu'on lui demande. */
function lien(base: string, vue: VueAgenda, jour: CleJour, sources: readonly string[]): string {
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
        <h2 className="text-[length:var(--text-admin-lg)] font-semibold tabular-nums first-letter:uppercase">
          {libelleDeLaVue(vue, jour)}
        </h2>

        <div className="flex items-center gap-[var(--space-admin-1)]">
          <Link
            href={lien(base, vue, naviguer(vue, jour, -1), sources)}
            aria-label={
              vue === "mois"
                ? "Mois précédent"
                : vue === "semaine"
                  ? "Semaine précédente"
                  : "Jour précédent"
            }
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
            aria-label={
              vue === "mois"
                ? "Mois suivant"
                : vue === "semaine"
                  ? "Semaine suivante"
                  : "Jour suivant"
            }
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
 * Les types de réservation filtrables (2026-10-04, lot L3), avec leur couleur
 * — la même que celle des réservations dans la grille (`teinte-agenda.ts`).
 *
 * 🔑 Ils voyagent dans le MÊME paramètre `sources` que les sources
 * (`?sources=calendly,diagnostic`) : tous les liens de l'agenda (vues, dates,
 * jours de la grille) le propagent déjà. Les jetons ne se recouvrent pas.
 * Un filtre de type ne retient que des réservations ; il laisse passer
 * l'agenda personnel et les blocages.
 */
// Lot L5b : « Autre » a aussi son bouton — un rendez-vous non classé ne doit
// jamais disparaître d'un agenda filtré faute de filtre pour le montrer.
export const TYPES_FILTRABLES_AGENDA = [...TYPES_FILTRABLES, "autre" as const].map((t) => ({
  id: t,
  label: LIBELLE_TYPE_RDV[t],
  couleur: `var(--color-admin-id-${TEINTE_TYPE_RDV[t] ?? TEINTE_SOURCE.calendly})`,
}));

/** Les jetons de `?sources=` connus : sources, puis types. */
export function lireFiltresAgenda(brut: string | undefined): {
  readonly sources: readonly string[];
  readonly types: readonly TypeRendezVous[];
} {
  const jetons = (brut ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  const connues = SOURCES_FILTRABLES.map((s) => s.id) as readonly string[];
  return {
    sources: jetons.filter((x) => connues.includes(x)),
    types: jetons.filter(
      (x): x is TypeRendezVous =>
        estTypeRendezVous(x) && TYPES_FILTRABLES_AGENDA.some((t) => t.id === x),
    ),
  };
}

/**
 * Un élément de l'agenda passe-t-il les filtres ? Un filtre de type ne retient
 * que des réservations : l'agenda personnel et les blocages restent visibles
 * (ils disent quand on est pris).
 */
export function passeLesFiltresAgenda(
  item: { readonly source: string; readonly typeRendezVous: TypeRendezVous | null },
  filtres: ReturnType<typeof lireFiltresAgenda>,
): boolean {
  if (filtres.sources.length > 0 && !filtres.sources.includes(item.source)) return false;
  if (filtres.types.length === 0 || item.source !== "calendly") return true;
  return item.typeRendezVous !== null && filtres.types.includes(item.typeRendezVous);
}

/**
 * Filtres par source et par type — des liens qui basculent, pas des cases à
 * cocher.
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
  sources: jetons,
}: {
  readonly base: string;
  readonly vue: VueAgenda;
  readonly jour: CleJour;
  readonly sources: readonly string[];
}): React.ReactElement {
  const { sources, types } = lireFiltresAgenda(jetons.join(","));
  const toutesSources = SOURCES_FILTRABLES.map((s) => s.id) as readonly string[];
  const tousTypes = TYPES_FILTRABLES_AGENDA.map((t) => t.id) as readonly string[];
  // Un groupe vide = tout est affiché. C'est l'état par défaut et il ne
  // s'écrit pas dans l'URL : on ne montre pas un filtre à quelqu'un qui n'en a
  // posé aucun.
  const sourcesActives = sources.length > 0 ? sources : toutesSources;
  const typesActifs = types.length > 0 ? (types as readonly string[]) : tousTypes;

  // Basculer UN jeton de son groupe, en gardant l'autre groupe tel quel.
  // Retirer le dernier actif d'un groupe reviendrait à vider l'écran : on
  // retombe alors sur tout, le seul comportement qui ne laisse pas devant une
  // page vide sans comprendre pourquoi.
  const hrefBascule = (id: string, groupe: "source" | "type"): string => {
    const actifs = groupe === "source" ? sourcesActives : typesActifs;
    const tous = groupe === "source" ? toutesSources : tousTypes;
    const suivants = actifs.includes(id) ? actifs.filter((x) => x !== id) : [...actifs, id];
    const groupeEcrit = suivants.length > 0 && suivants.length < tous.length ? suivants : [];
    const autre = groupe === "source" ? types : sources;
    const tout = groupe === "source" ? [...groupeEcrit, ...autre] : [...autre, ...groupeEcrit];
    const p = new URLSearchParams({ vue, jour });
    if (tout.length > 0) p.set("sources", tout.join(","));
    return `${base}?${p.toString()}`;
  };

  const puce = (
    id: string,
    label: string,
    couleur: string,
    active: boolean,
    groupe: "source" | "type",
  ) => (
    <Link
      key={id}
      href={hrefBascule(id, groupe)}
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
        style={{
          backgroundColor: active ? couleur : "transparent",
          border: `1px solid ${couleur}`,
        }}
      />
      {label}
    </Link>
  );

  return (
    <div className="flex flex-col items-end gap-[var(--space-admin-2)]">
      <fieldset className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
        <legend className="sr-only">Filtrer par source</legend>
        {SOURCES_FILTRABLES.map((s) =>
          puce(s.id, s.label, s.couleur, sourcesActives.includes(s.id), "source"),
        )}
      </fieldset>
      <fieldset className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
        <legend className="sr-only">Filtrer les réservations par type</legend>
        {TYPES_FILTRABLES_AGENDA.map((t) =>
          puce(t.id, t.label, t.couleur, typesActifs.includes(t.id), "type"),
        )}
      </fieldset>
    </div>
  );
}
