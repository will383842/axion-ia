/**
 * Les PROJETS ÉVOQUÉS d'un rendez-vous, pour « Après l'appel » (chantier
 * visio, V1-03).
 *
 * P1 déclare, pour chaque fait, le projet évoqué (`J1`, `J2`…) ; P2 propose,
 * pour chaque projet évoqué, un projet existant ou un nouveau projet. Ces
 * propositions vivent dans l'état chiffré du compte rendu, jamais appliquées
 * d'elles-mêmes (A4). Ce module les rend lisibles par l'écran : les faits « à
 * ranger » sont groupés par projet évoqué, un choix de projet par groupe —
 * sans quoi un seul clic rangeait le budget de l'audit dans le projet de la
 * formation.
 *
 * Module PUR : l'état est déjà déchiffré par l'appelant.
 */

import type { EtatCompteRendu } from "@/server/visio/etat-compte-rendu";

export type PropositionProjet =
  | { readonly mode: "existant"; readonly projetId: string }
  | { readonly mode: "nouveau"; readonly titre: string };

export interface ProjetEvoqueAffiche {
  readonly ref: string;
  readonly intitule: string;
  readonly proposition: PropositionProjet | null;
}

export interface Evocations {
  readonly projets: ReadonlyArray<ProjetEvoqueAffiche>;
  /** Identifiant du fait → projet évoqué (`J…`). */
  readonly projetDuFait: Readonly<Record<string, string>>;
  /** Le projet principal selon P2, ou `null`. */
  readonly principal: string | null;
}

type EtatLu = Pick<
  EtatCompteRendu,
  "faits" | "declarations" | "projetsEvoques" | "rattachement" | "correspondances"
>;

/** Ce que l'écran retient de l'état du compte rendu. */
export function evocationsDe(etat: EtatLu): Evocations {
  const idParRef = new Map(etat.faits);
  const refParProjetConnu = new Map(etat.correspondances.projets);
  const rattachement = typeof etat.rattachement === "object" ? etat.rattachement : null;

  const projetDuFait: Record<string, string> = {};
  for (const [ref, portee, j] of etat.declarations) {
    const id = idParRef.get(ref);
    if (id !== undefined && portee === "projet" && j !== null) projetDuFait[id] = j;
  }
  for (const p of rattachement?.portees_a_corriger ?? []) {
    const id = idParRef.get(p.fait_ref);
    if (id === undefined) continue;
    if (p.portee_proposee === "projet" && p.projet_evoque_ref !== null) {
      projetDuFait[id] = p.projet_evoque_ref;
    } else if (p.portee_proposee === "entreprise") {
      delete projetDuFait[id];
    }
  }

  const projets = etat.projetsEvoques.map((j): ProjetEvoqueAffiche => {
    const d = rattachement?.decisions.find((x) => x.projet_evoque_ref === j.ref);
    let proposition: PropositionProjet | null = null;
    if (d?.decision === "projet_existant" && d.projet_connu_ref !== null) {
      const projetId = refParProjetConnu.get(d.projet_connu_ref);
      if (projetId !== undefined) proposition = { mode: "existant", projetId };
    } else if (d?.decision === "nouveau_projet") {
      proposition = { mode: "nouveau", titre: (d.titre_propose ?? j.intitule).slice(0, 200) };
    }
    return { ref: j.ref, intitule: j.intitule, proposition };
  });

  return { projets, projetDuFait, principal: rattachement?.projet_principal_ref ?? null };
}

export interface GroupeDeFaits<F> {
  /** `null` : faits sans projet évoqué (et faits déjà rangés). */
  readonly ref: string | null;
  readonly intitule: string | null;
  readonly proposition: PropositionProjet | null;
  readonly faits: F[];
}

/**
 * Groupe les faits de l'écran. Le groupe PRINCIPAL suit le choix de projet
 * du rendez-vous (faits déjà rangés, faits sans projet évoqué, et le projet
 * principal de P2 — ou, à défaut, le premier évoqué). Chaque AUTRE projet
 * évoqué qui a des faits « à ranger » forme son propre groupe.
 */
export function grouperParProjetEvoque<F extends { readonly id: string; readonly portee: string }>(
  faits: readonly F[],
  ev: Evocations | null,
): { readonly principal: GroupeDeFaits<F>; readonly autres: ReadonlyArray<GroupeDeFaits<F>> } {
  const refDe = (f: F): string | null =>
    ev !== null && f.portee === "a_ranger" ? (ev.projetDuFait[f.id] ?? null) : null;
  const evoques = [...new Set(faits.map(refDe).filter((r): r is string => r !== null))];
  const principalRef =
    ev?.principal !== null && ev?.principal !== undefined && evoques.includes(ev.principal)
      ? ev.principal
      : (evoques[0] ?? null);
  const decrire = (ref: string | null) => {
    const p = ref === null ? undefined : ev?.projets.find((x) => x.ref === ref);
    return { ref, intitule: p?.intitule ?? null, proposition: p?.proposition ?? null };
  };
  const principal: GroupeDeFaits<F> = { ...decrire(principalRef), faits: [] };
  const autres = new Map<string, GroupeDeFaits<F>>();
  for (const f of faits) {
    const ref = refDe(f);
    if (ref === null || ref === principalRef) {
      principal.faits.push(f);
      continue;
    }
    let g = autres.get(ref);
    if (g === undefined) {
      g = { ...decrire(ref), faits: [] };
      autres.set(ref, g);
    }
    g.faits.push(f);
  }
  return { principal, autres: [...autres.values()] };
}
