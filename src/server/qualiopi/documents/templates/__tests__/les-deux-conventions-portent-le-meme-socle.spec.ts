/**
 * 🛑 GARDE — la convention TRIPARTITE ne redérive jamais de la bipartite.
 *
 * ## Le défaut que cette garde ferme (M6)
 *
 * La convention tripartite était restée **à la version d'avant le 02/08/2026** :
 * ni les trois mentions L.6353-1 ajoutées à la bipartite, ni ses sections 5 à 9.
 *
 * 🔴 Et c'est la pièce que lit l'OPCO. **La moins complète des deux était celle
 * que l'organisme financeur examine.**
 *
 * Le motif est celui que ce dépôt paie le plus souvent : **le jumeau oublié**.
 * On corrige une pièce, on ne pense pas à sa sœur, et rien ne rougit — les deux
 * fichiers compilent, les deux PDF se rendent, les deux tests passent.
 *
 * ## Ce que cette garde vérifie
 *
 * Deux invariants, dérivés du SOURCE des deux gabarits :
 *
 * 1. **le même socle légal** — les deux lisent les mêmes clés de
 *    `LEGAL_MENTIONS`. Ajouter une mention à l'une sans l'autre rougit ;
 * 2. **la même charpente** — la liste des sections numérotées est identique.
 *    Ajouter une section 12 à la bipartite seule rougit.
 *
 * ## Ce que cette garde ne couvre PAS
 *
 * Le CONTENU des sections : deux sections « 5. Obligations des parties » peuvent
 * dire des choses différentes, et c'est parfois légitime (un financeur tiers a
 * des obligations propres). Cette garde tient la charpente et le socle légal,
 * pas la rédaction.
 *
 * Elle ne dit rien non plus du CONTRAT de formation (`produireContratFormation`,
 * L.6353-3), qui s'adresse à un particulier et n'a pas à porter le même plan —
 * la médiation y est verrouillée par sa propre garde.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const DOSSIER = "src/server/qualiopi/documents/templates";
const BIPARTITE = "convention.tsx";
const TRIPARTITE = "convention-tripartite.tsx";

function source(fichier: string): string {
  return readFileSync(join(process.cwd(), DOSSIER, fichier), "utf8");
}

/** Les clés de `LEGAL_MENTIONS` réellement lues par un gabarit. */
function clesLegales(fichier: string): string[] {
  return [
    ...new Set([...source(fichier).matchAll(/LEGAL_MENTIONS\.([A-Za-z0-9_]+)/g)].map((m) => m[1]!)),
  ].sort();
}

/** Les titres de section numérotés, dans l'ordre du gabarit. */
function sections(fichier: string): string[] {
  return [...source(fichier).matchAll(/["'`](\d+\s*[.)–-]\s*[A-ZÉÈÀÇ][^"'`]{3,70})["'`]/g)].map(
    (m) => m[1]!.trim(),
  );
}

describe("🛑 bipartite et tripartite portent le même socle", () => {
  it("🔑 les deux gabarits sont bien LUS", () => {
    // Le mode d'échec le plus fréquent de ce genre de garde : un chemin qui ne
    // désigne plus rien, et deux listes vides qui se ressemblent parfaitement.
    // Une comparaison de deux riens est toujours verte.
    for (const f of [BIPARTITE, TRIPARTITE]) {
      expect(source(f).length, `${f} est vide ou introuvable`).toBeGreaterThan(2000);
      expect(sections(f).length, `aucune section extraite de ${f}`).toBeGreaterThan(5);
      expect(clesLegales(f).length, `aucune mention légale extraite de ${f}`).toBeGreaterThan(0);
    }
  });

  it("lisent les MÊMES mentions légales", () => {
    expect(
      clesLegales(TRIPARTITE),
      "La tripartite ne lit plus les mêmes mentions légales que la bipartite. " +
        "C'est la pièce que lit l'OPCO : elle ne doit jamais être la moins " +
        "complète des deux. Si une mention ne concerne QUE l'une, écrire ici " +
        "pourquoi — ne pas supprimer l'assertion.",
    ).toEqual(clesLegales(BIPARTITE));
  });

  it("portent la MÊME charpente de sections", () => {
    expect(
      sections(TRIPARTITE),
      "Les deux conventions n'ont plus le même plan. Le défaut du 02/08/2026 : " +
        "la tripartite avait raté les sections 5 à 9 de sa sœur, et personne ne " +
        "l'a vu — les deux fichiers compilaient.",
    ).toEqual(sections(BIPARTITE));
  });
});
