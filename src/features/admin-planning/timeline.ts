// Planning unifié — vue « TIMELINE RESSOURCES » : logique PURE (aucune I/O).
//
// Question métier : sur un mois, QUI fait QUOI, et QUAND ? Une ligne par
// formateur, une colonne par jour. Là où la vue « charge » agrège un volume en
// un pourcentage, la timeline montre la RÉPARTITION — c'est elle qui fait voir
// une semaine pleine suivie d'une semaine vide, que 50 % de charge dissimule.
//
// ── La ligne « Non affecté » ─────────────────────────────────────────────────
// Les prestations sans formateur ne disparaissent pas : elles forment une ligne
// à part, placée EN PREMIER. C'est le seul endroit du cockpit qui rend visible
// une session non staffée, et c'est l'action la plus urgente qu'un pilote puisse
// avoir. La noyer en bas de liste reviendrait à la cacher.
//
// ── Ce qu'on ne montre pas ───────────────────────────────────────────────────
// Les prestations annulées / reportées sont exclues (`mobiliseLeFormateur`) :
// elles ne mobilisent personne, donc n'occupent aucune case. Même règle que la
// vue charge et que la détection de conflits — les trois doivent s'accorder,
// sinon un formateur paraîtrait chargé un jour où il est libre.
//
// ── Pourquoi pas de ligne à zéro ─────────────────────────────────────────────
// Un formateur sans aucune prestation du mois n'a pas de ligne. La sous-charge
// est le sujet de la vue « charge » (qui, elle, liste tout le monde) ; ici, une
// trentaine de lignes vides écraserait le signal.

import { mobiliseLeFormateur } from "./conflicts";
import type { PlanningEvent } from "./types";

export interface TimelineLigne {
  /** `null` = prestations sans formateur assigné. */
  formateurId: string | null;
  formateurNom: string;
  /** Jour (`YYYY-MM-DD`) → prestations de ce formateur ce jour-là. */
  parJour: Map<string, PlanningEvent[]>;
  /** Nombre de jours distincts où la ligne est occupée. */
  joursOccupes: number;
  /** Prestations distinctes du mois (une multi-jours ne compte qu'une fois). */
  nbPrestations: number;
}

/** Un formateur, tel que la timeline a besoin de le nommer. */
export interface TimelineFormateur {
  id: string;
  prenom: string;
  nom: string;
}

/**
 * Construit les lignes de la timeline à partir de la `Map<jour, events[]>` que
 * `getPlanningMonth` produit déjà — aucune requête neuve, et l'étalement des
 * prestations multi-jours reste celui d'`expandEventDayKeys`, source de vérité
 * unique (elle a résolu le passage à l'heure d'été une fois pour toutes).
 *
 * `byDay` est déjà borné au mois affiché : une formation du 30 juillet au 2 août
 * n'apporte ici que ses jours de juillet. C'est voulu — la timeline de juillet
 * ne doit pas déborder sur août.
 *
 * Un formateur présent dans `byDay` mais absent de `formateurs` (désactivé
 * depuis, par exemple) garde sa ligne, sous le nom que porte l'événement : on ne
 * fait pas disparaître du travail réellement planifié.
 */
export function construireTimeline(
  byDay: Map<string, PlanningEvent[]>,
  formateurs: readonly TimelineFormateur[],
): TimelineLigne[] {
  const noms = new Map(formateurs.map((f) => [f.id, `${f.prenom} ${f.nom}`.trim()]));

  // La clé de ligne est l'id du formateur, ou `null` pour « Non affecté ». Une
  // `Map` accepte `null` comme clé : inutile d'inventer une sentinelle textuelle
  // qui pourrait un jour collisionner avec un identifiant réel.
  //
  // Map<formateurId|null, Map<jour, Map<eventKey, event>>>. La Map la plus interne
  // déduplique : `getPlanningMonth` répète une prestation sous chacun de ses jours,
  // et deux passages sur le même jour ne doivent pas la compter deux fois.
  const lignes = new Map<string | null, Map<string, Map<string, PlanningEvent>>>();
  const nomDeLigne = new Map<string | null, string>();

  for (const [dayKey, events] of byDay) {
    for (const e of events) {
      if (!mobiliseLeFormateur(e)) continue;

      const cle = e.formateurId ?? null;
      if (!nomDeLigne.has(cle)) {
        nomDeLigne.set(
          cle,
          cle === null ? "Non affecté" : (noms.get(cle) ?? e.formateurNom ?? "Formateur inconnu"),
        );
      }

      let jours = lignes.get(cle);
      if (jours === undefined) {
        jours = new Map();
        lignes.set(cle, jours);
      }
      let duJour = jours.get(dayKey);
      if (duJour === undefined) {
        duJour = new Map();
        jours.set(dayKey, duJour);
      }
      duJour.set(e.key, e);
    }
  }

  const result: TimelineLigne[] = [];
  for (const [cle, jours] of lignes) {
    const parJour = new Map<string, PlanningEvent[]>();
    const keysDistinctes = new Set<string>();
    for (const [dayKey, duJour] of jours) {
      parJour.set(dayKey, [...duJour.values()]);
      for (const k of duJour.keys()) keysDistinctes.add(k);
    }
    result.push({
      formateurId: cle,
      formateurNom: nomDeLigne.get(cle) ?? "Formateur inconnu",
      parJour,
      joursOccupes: parJour.size,
      nbPrestations: keysDistinctes.size,
    });
  }

  return trierLignes(result);
}

/**
 * « Non affecté » d'abord (c'est une action, pas une information), puis du plus
 * occupé au moins occupé, puis alphabétique — pour que l'ordre soit stable d'un
 * rendu à l'autre : un tableau qui se réordonne tout seul est illisible.
 */
function trierLignes(lignes: TimelineLigne[]): TimelineLigne[] {
  return [...lignes].sort((a, b) => {
    if (a.formateurId === null) return -1;
    if (b.formateurId === null) return 1;
    if (b.joursOccupes !== a.joursOccupes) return b.joursOccupes - a.joursOccupes;
    return a.formateurNom.localeCompare(b.formateurNom, "fr");
  });
}

/**
 * Les clés jour du mois, dans l'ordre — les colonnes du tableau. `month` est en
 * 1-12. Ces clés sont des ÉTIQUETTES et des clés de Map, jamais des instants :
 * le fuseau est déjà résolu en amont par `expandEventDayKeys`, qui produit des
 * clés parisiennes. Les construire en UTC est donc sans effet de bord.
 */
export function joursDuMois(year: number, month: number): string[] {
  const jours: string[] = [];
  // `Date.UTC(y, month, 0)` = dernier jour du mois `month` (1-12). Gère février.
  const nbJours = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let j = 1; j <= nbJours; j++) {
    jours.push(`${year}-${String(month).padStart(2, "0")}-${String(j).padStart(2, "0")}`);
  }
  return jours;
}

/** Samedi ou dimanche ? Sert à griser les colonnes de week-end. */
export function estWeekEnd(dayKey: string): boolean {
  const jour = new Date(`${dayKey}T12:00:00Z`).getUTCDay();
  return jour === 0 || jour === 6;
}
