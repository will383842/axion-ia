/**
 * P2, P3, P4 — ENTRÉES CONSTRUITES PAR LE CODE, PÉRIMÈTRE PAR PÉRIMÈTRE, et
 * contrôle de leurs sorties (`compte-rendu-et-extraction.md` §5.3-5.5 ; G10).
 *
 * ⛔ G10 — LA CONSOLIDATION NE VOIT JAMAIS UN AUTRE PROJET. P3 est appelée
 * UNE FOIS PAR PÉRIMÈTRE (l'entreprise, puis chaque projet connu touché par
 * l'échange). Son entrée est construite ici, et ne contient QUE les faits du
 * périmètre visé : ni les faits validés d'un autre projet, ni les faits du
 * jour rangés ailleurs. C'est le constructeur qui est testé, pas l'IA
 * (`la-consolidation-ne-voit-jamais-un-autre-projet.spec.ts`). Et une relation
 * rendue vers un fait hors du périmètre envoyé est REJETÉE
 * (`relation_hors_projet`).
 *
 * P4 (ébauche de devis) suit la même règle : les faits du projet évoqué, plus
 * ceux de l'entreprise, jamais ceux d'un autre projet.
 *
 * Rien n'est APPLIQUÉ ici (décision A4) : les rattachements, relations et
 * lignes sont des PROPOSITIONS que Will valide.
 *
 * Module PUR.
 */

import type { ConsolidationV1, EbaucheV1, RattachementV1 } from "./schemas/autres";
import { ligneFait, type FaitPourPasse, type ProjetDeLaBase } from "./contexte";
import { contientUnPrix, neutraliserDonnees, referenceConnue } from "./verification/regles";

/** Un fait déjà validé, avec sa référence `H…` et son périmètre. */
export interface FaitConnuPourPasse {
  readonly ref: string;
  /** `null` = entreprise ; sinon l'identifiant du projet. */
  readonly projetId: string | null;
  readonly type: string;
  readonly enonce: string;
  readonly constateLe: Date;
}

export interface ProjetEvoque {
  readonly ref: string;
  readonly intitule: string;
  readonly activite: string | null;
}

// ── P2 ───────────────────────────────────────────────────────────────────────

export function construireEntreeP2(a: {
  readonly projetsConnus: ReadonlyArray<ProjetDeLaBase & { readonly ref: string }>;
  readonly faitsConnus: readonly FaitConnuPourPasse[];
  readonly projetsEvoques: readonly ProjetEvoque[];
  readonly faits: readonly FaitPourPasse[];
}): string {
  const n = neutraliserDonnees;
  const connus = a.projetsConnus
    .map((p) => {
      const cles = a.faitsConnus
        .filter((f) => f.projetId === p.id)
        .slice(-6)
        .map((f) => `${f.type} : ${n(f.enonce)}`)
        .join(" ; ");
      return [p.ref, n(p.titre), p.activite ?? "—", p.statut, cles || "aucun fait validé"].join(
        " | ",
      );
    })
    .join("\n");
  return [
    `<projets_connus>\n${connus || "aucun"}\n</projets_connus>`,
    `<projets_evoques>\n${
      a.projetsEvoques
        .map((j) => [j.ref, n(j.intitule), j.activite ?? "—"].join(" | "))
        .join("\n") || "aucun"
    }\n</projets_evoques>`,
    `<faits_verifies>\n${a.faits.map(ligneFait).join("\n") || "aucun"}\n</faits_verifies>`,
    "Produis la proposition de rattachement au format imposé.",
  ].join("\n");
}

/** Garde les seules décisions dont toutes les références ont été envoyées. */
export function filtrerRattachement(
  r: RattachementV1,
  envoyes: {
    readonly projetsConnus: ReadonlySet<string>;
    readonly evoques: ReadonlySet<string>;
    readonly faits: ReadonlySet<string>;
  },
): { readonly rattachement: RattachementV1; readonly ecartees: number } {
  let ecartees = 0;
  const decisions = r.decisions.filter((d) => {
    const ok =
      envoyes.evoques.has(d.projet_evoque_ref) &&
      (d.projet_connu_ref === null || envoyes.projetsConnus.has(d.projet_connu_ref)) &&
      (d.decision !== "projet_existant" || d.projet_connu_ref !== null) &&
      d.faits_refs.every((f) => envoyes.faits.has(f));
    if (!ok) ecartees += 1;
    return ok;
  });
  const portees = r.portees_a_corriger.filter((p) => {
    const ok =
      envoyes.faits.has(p.fait_ref) &&
      (p.projet_evoque_ref === null || envoyes.evoques.has(p.projet_evoque_ref));
    if (!ok) ecartees += 1;
    return ok;
  });
  const principal =
    r.projet_principal_ref !== null && envoyes.evoques.has(r.projet_principal_ref)
      ? r.projet_principal_ref
      : null;
  return {
    rattachement: { decisions, portees_a_corriger: portees, projet_principal_ref: principal },
    ecartees,
  };
}

// ── P3 ───────────────────────────────────────────────────────────────────────

export interface Perimetre {
  /** `null` = l'entreprise. */
  readonly projetId: string | null;
  readonly libelle: string;
  /** Les projets évoqués (`J…`) que Will pourrait ranger dans ce périmètre. */
  readonly evoques: readonly string[];
}

export interface EntreeP3 {
  readonly perimetre: Perimetre;
  readonly entree: string;
  /** Les références envoyées (H… et F…) : seules admises dans la sortie. */
  readonly refsEnvoyees: ReadonlySet<string>;
  readonly faitsDuJour: ReadonlySet<string>;
}

/**
 * Les périmètres à consolider : l'entreprise, et chaque projet CONNU proposé
 * par P2 pour un projet évoqué. Seuls ceux qui ont déjà des faits validés.
 */
export function perimetresAConsolider(a: {
  readonly rattachement: RattachementV1 | null;
  readonly correspondancesProjets: ReadonlyMap<string, string>;
  readonly projets: ReadonlyArray<{ readonly id: string; readonly titre: string }>;
  readonly faitsConnus: readonly FaitConnuPourPasse[];
}): Perimetre[] {
  const perimetres: Perimetre[] = [];
  if (a.faitsConnus.some((f) => f.projetId === null)) {
    perimetres.push({ projetId: null, libelle: "l'entreprise dans son ensemble", evoques: [] });
  }
  const parProjet = new Map<string, string[]>();
  for (const d of a.rattachement?.decisions ?? []) {
    if (d.decision !== "projet_existant" || d.projet_connu_ref === null) continue;
    const id = a.correspondancesProjets.get(d.projet_connu_ref);
    if (!id) continue;
    parProjet.set(id, [...(parProjet.get(id) ?? []), d.projet_evoque_ref]);
  }
  for (const [projetId, evoques] of parProjet) {
    if (!a.faitsConnus.some((f) => f.projetId === projetId)) continue;
    const titre = a.projets.find((p) => p.id === projetId)?.titre ?? "projet";
    perimetres.push({ projetId, libelle: `le projet « ${titre} »`, evoques });
  }
  return perimetres;
}

/** ⛔ G10 : l'entrée d'UN périmètre, et rien d'autre. */
export function construireEntreeP3(
  perimetre: Perimetre,
  faitsConnus: readonly FaitConnuPourPasse[],
  faitsDuJour: readonly FaitPourPasse[],
): EntreeP3 {
  const n = neutraliserDonnees;
  const connus = faitsConnus.filter((f) => f.projetId === perimetre.projetId);
  const duJour = faitsDuJour.filter((f) =>
    perimetre.projetId === null
      ? f.portee === "entreprise"
      : f.portee === "projet" && f.projetRef !== null && perimetre.evoques.includes(f.projetRef),
  );
  const entree = [
    `<perimetre>${n(perimetre.libelle)}</perimetre>`,
    `<faits_connus>\n${
      connus
        .map((f) =>
          [f.ref, f.type, n(f.enonce), `RDV du ${f.constateLe.toISOString().slice(0, 10)}`].join(
            " | ",
          ),
        )
        .join("\n") || "aucun"
    }\n</faits_connus>`,
    `<faits_du_jour>\n${duJour.map(ligneFait).join("\n") || "aucun"}\n</faits_du_jour>`,
    "Produis la consolidation au format imposé.",
  ].join("\n");
  return {
    perimetre,
    entree,
    refsEnvoyees: new Set([...connus.map((f) => f.ref), ...duJour.map((f) => f.ref)]),
    faitsDuJour: new Set(duJour.map((f) => f.ref)),
  };
}

/** ⛔ G10 : une relation vers un fait hors du périmètre envoyé est rejetée. */
export function filtrerConsolidation(
  c: ConsolidationV1,
  entree: Pick<EntreeP3, "refsEnvoyees" | "faitsDuJour">,
): { readonly consolidation: ConsolidationV1; readonly horsPerimetre: number } {
  let horsPerimetre = 0;
  const relations = c.relations.filter((r) => {
    const ok =
      entree.faitsDuJour.has(r.fait_du_jour_ref) &&
      (r.fait_existant_ref === null || entree.refsEnvoyees.has(r.fait_existant_ref)) &&
      (r.plus_recent_ref === null || entree.refsEnvoyees.has(r.plus_recent_ref));
    if (!ok) horsPerimetre += 1;
    return ok;
  });
  const change = c.ce_qui_a_change
    .map((p) => ({ ...p, faits_refs: p.faits_refs.filter((ref) => entree.refsEnvoyees.has(ref)) }))
    .filter((p) => p.faits_refs.length > 0);
  return { consolidation: { relations, ce_qui_a_change: change }, horsPerimetre };
}

// ── P4 ───────────────────────────────────────────────────────────────────────

/** Types qui justifient une ébauche de devis pour un projet évoqué. */
const TYPES_DEVIS = new Set(["besoin", "offre_envisagee", "public_cible", "nb_participants"]);

export function projetsAEbaucher(
  faits: readonly FaitPourPasse[],
  evoques: readonly ProjetEvoque[],
): ProjetEvoque[] {
  return evoques.filter((j) => faits.some((f) => f.projetRef === j.ref && TYPES_DEVIS.has(f.type)));
}

export function construireEntreeP4(
  projet: ProjetEvoque,
  faits: readonly FaitPourPasse[],
  faitsConnusDuProjet: readonly FaitConnuPourPasse[],
): string {
  const n = neutraliserDonnees;
  const duProjet = faits.filter((f) => f.portee === "projet" && f.projetRef === projet.ref);
  const entreprise = faits.filter((f) => f.portee === "entreprise");
  return [
    `<projet>${projet.ref} | « ${n(projet.intitule)} » | activité : ${projet.activite ?? "non précisée"}</projet>`,
    `<faits_du_projet>\n${
      [
        ...duProjet.map((f) => `${ligneFait(f)} | vérifié du jour`),
        ...faitsConnusDuProjet.map((f) => `${f.ref} | ${f.type} | ${n(f.enonce)} | validé`),
      ].join("\n") || "aucun"
    }\n</faits_du_projet>`,
    `<faits_entreprise>\n${entreprise.map(ligneFait).join("\n") || "aucun"}\n</faits_entreprise>`,
    "Produis l'ébauche au format imposé.",
  ].join("\n");
}

/** G14 + G7 : sortie avec un prix = rejet ENTIER ; référence inconnue = ligne retirée. */
export function controlerEbauche(
  e: EbaucheV1,
  catalogue: ReadonlySet<string>,
):
  | { readonly ok: false }
  | { readonly ok: true; readonly ebauche: EbaucheV1; readonly lignesRetirees: number } {
  if (contientUnPrix(e)) return { ok: false };
  const lignes = e.lignes.filter(
    (l) => referenceConnue(l.ref_catalogue, catalogue) && l.quantite > 0,
  );
  return { ok: true, ebauche: { ...e, lignes }, lignesRetirees: e.lignes.length - lignes.length };
}
