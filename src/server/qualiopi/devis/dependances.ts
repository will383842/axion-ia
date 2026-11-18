/**
 * Dépendances entre automatisations d'une offre de devis — module PUR.
 *
 * Une automatisation peut exiger d'autres automatisations (`dependDe`, par
 * code). Deux contrôles : le graphe est-il sain (`verifierDependances`) et une
 * sélection du client est-elle complète (`selectionComplete`).
 */

export interface AutomatisationDependante {
  readonly code: string;
  readonly facultative: boolean;
  readonly dependDe: readonly string[];
}

export type ResultatDependances =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly motif: "code_double" | "code_inconnu" | "auto_dependance" | "cycle";
      readonly code: string;
      /** Pour un cycle : le chemin fermé (a → b → a). */
      readonly chemin?: readonly string[];
    };

/** Contrôle le graphe : doublons, codes inconnus, auto-dépendance, cycles (parcours en profondeur, trois couleurs). */
export function verifierDependances(
  automatisations: readonly AutomatisationDependante[],
): ResultatDependances {
  const parCode = new Map<string, AutomatisationDependante>();
  for (const a of automatisations) {
    if (parCode.has(a.code)) return { ok: false, motif: "code_double", code: a.code };
    parCode.set(a.code, a);
  }
  for (const a of automatisations) {
    for (const d of a.dependDe) {
      if (d === a.code) return { ok: false, motif: "auto_dependance", code: a.code };
      if (!parCode.has(d)) return { ok: false, motif: "code_inconnu", code: d };
    }
  }

  // Blanc = jamais vu ; gris = sur la pile courante ; noir = terminé.
  const couleur = new Map<string, "gris" | "noir">();
  const pile: string[] = [];
  const visiter = (code: string): readonly string[] | null => {
    couleur.set(code, "gris");
    pile.push(code);
    for (const d of parCode.get(code)!.dependDe) {
      const c = couleur.get(d);
      if (c === "gris") return [...pile.slice(pile.indexOf(d)), d];
      if (c === undefined) {
        const cycle = visiter(d);
        if (cycle) return cycle;
      }
    }
    pile.pop();
    couleur.set(code, "noir");
    return null;
  };
  for (const a of automatisations) {
    if (couleur.has(a.code)) continue;
    const cycle = visiter(a.code);
    if (cycle) return { ok: false, motif: "cycle", code: cycle[0]!, chemin: cycle };
  }
  return { ok: true };
}

export type ResultatSelection =
  | { readonly ok: true; readonly retenues: readonly string[] }
  | {
      readonly ok: false;
      readonly inconnues: readonly string[];
      readonly manquantes: readonly string[];
    };

/**
 * Une sélection est complète si chaque automatisation retenue a ses dépendances
 * retenues. Une automatisation non facultative est toujours retenue.
 */
export function selectionComplete(
  selection: readonly string[],
  automatisations: readonly AutomatisationDependante[],
): ResultatSelection {
  const connus = new Set(automatisations.map((a) => a.code));
  const inconnues = selection.filter((c) => !connus.has(c));
  const retenues = new Set(selection.filter((c) => connus.has(c)));
  for (const a of automatisations) if (!a.facultative) retenues.add(a.code);

  const manquantes = new Set<string>();
  for (const a of automatisations) {
    if (!retenues.has(a.code)) continue;
    for (const d of a.dependDe) if (!retenues.has(d)) manquantes.add(d);
  }
  if (inconnues.length > 0 || manquantes.size > 0) {
    return { ok: false, inconnues, manquantes: [...manquantes] };
  }
  return { ok: true, retenues: automatisations.map((a) => a.code).filter((c) => retenues.has(c)) };
}
