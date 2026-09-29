// @vitest-environment node

/**
 * Verrou — `ouvert` n'enregistre de vrais clients que si la notice publique
 * ANNONCE l'enregistrement, et il n'existe qu'UNE règle d'ouverture (chantier
 * visio, PR 8 ; V-15 ; LOTS-EXECUTION §0, ligne « Préavis », décision de Will
 * du 29/09).
 *
 * ## Deux règles
 *
 *   1. `modeEffectif("ouvert")` vaut `pilote` + alerte tant que
 *      `ANNONCE_VISIO_ACTIVE` est faux : une variable
 *      `ENREGISTREMENT_VISIO_OUVERT=true` posée trop tôt dans Coolify ne doit
 *      pas faire enregistrer de vrais clients pendant que la notice dit « ni
 *      enregistrés ni transcrits ». Le préavis, lui, n'entre PAS dans cette
 *      règle : Will a décidé (« 1 », 29/09) que l'ouverture ne l'attend plus ;
 *      il bloque les seuls clients actifs, route par route (PR 5).
 *   2. Une seule source : `PREAVIS_SOUS_TRAITANTS`, `DICTEE_ANNONCEE` et la
 *      durée du préavis sont déclarés UNE fois sous `src/` ; et si
 *      `src/server/visio/drapeau.ts` existe (PR 5, au rebase), il passe par
 *      `modeEffectif` au lieu de garder sa propre règle.
 *
 * Contre-témoins : `ouvert` passe quand la notice est active (la garde n'est
 * pas un refus permanent) ; `ferme` et `pilote` ne dépendent pas de la notice.
 * Angle mort : la garde 2 lit le SOURCE de `drapeau.ts` ; elle voit un
 * contournement grossier (règle recodée, `modeEffectif` jamais appelé), pas un
 * appel dont le résultat serait ignoré.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

import { ANNONCE_VISIO_ACTIVE } from "@/content/visio-annonce";

import { modeEffectif } from "../ouverture";

const RACINE = process.cwd();
const DRAPEAU = "src/server/visio/drapeau.ts";

function fichiersSource(dir: string, acc: string[] = []): string[] {
  for (const nom of readdirSync(dir)) {
    const chemin = join(dir, nom);
    if (nom === "node_modules" || nom === "__tests__" || nom === "generated") continue;
    if (statSync(chemin).isDirectory()) fichiersSource(chemin, acc);
    else if (/\.tsx?$/.test(nom) && !/\.(spec|test)\.tsx?$/.test(nom)) acc.push(chemin);
  }
  return acc;
}

let sources: ReadonlyArray<readonly [string, string]> | null = null;

/** Fichiers de `src/` (hors tests) qui DÉCLARENT l'exportation désignée par `motif`. */
function declarations(motif: RegExp): string[] {
  sources ??= fichiersSource(join(RACINE, "src")).map(
    (f) => [relative(RACINE, f).split(sep).join("/"), readFileSync(f, "utf8")] as const,
  );
  return sources.filter(([, texte]) => motif.test(texte)).map(([chemin]) => chemin);
}

describe("le drapeau « ouvert » attend la notice publique", () => {
  it("🔴 notice non publiée : « ouvert » vaut « pilote » et lève l'alerte", () => {
    expect(modeEffectif("ouvert", false)).toMatchObject({
      mode: "pilote",
      alerte: "notice_non_publiee",
    });
  });

  it("🔴 aujourd'hui, la notice n'annonce rien : « ouvert » n'enregistre aucun vrai client", () => {
    if (!ANNONCE_VISIO_ACTIVE) expect(modeEffectif("ouvert").mode).toBe("pilote");
    else expect(modeEffectif("ouvert").mode).toBe("ouvert");
  });

  it("🔑 CONTRE-TÉMOIN : notice publiée, « ouvert » est effectif sans attendre de date", () => {
    expect(modeEffectif("ouvert", true)).toEqual({ mode: "ouvert", alerte: null, motif: null });
  });

  it("🔑 CONTRE-TÉMOIN : « ferme » et « pilote » ne dépendent pas de la notice", () => {
    expect(modeEffectif("ferme", false).mode).toBe("ferme");
    expect(modeEffectif("pilote", false).mode).toBe("pilote");
  });

  it("🔴 la règle d'ouverture ne porte aucune date de préavis (décision « 1 » du 29/09)", () => {
    const source = readFileSync(join(RACINE, "src/server/visio/ouverture.ts"), "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/finLe|PREAVIS_SOUS_TRAITANTS|maintenant/);
  });
});

describe("une seule source pour le préavis, la dictée et la règle d'ouverture", () => {
  it("🔴 PREAVIS_SOUS_TRAITANTS est déclaré au plus une fois sous src/", () => {
    expect(declarations(/export const PREAVIS_SOUS_TRAITANTS\b/).length).toBeLessThanOrEqual(1);
  });

  it("🔴 DICTEE_ANNONCEE est déclaré une seule fois, dérivé de la notice", () => {
    expect(declarations(/export const DICTEE_ANNONCEE\b/)).toEqual([
      "src/content/visio-annonce.ts",
    ]);
  });

  it("🔴 la durée du préavis n'est écrite qu'une fois (DELAI_PREAVIS_JOURS)", () => {
    expect(declarations(/export const \w*PREAVIS\w*_JOURS\s*=\s*\d/)).toEqual([
      "src/lib/email/templates/preavis-sous-traitants.tsx",
    ]);
  });

  it("🔴 si drapeau.ts existe, il passe par modeEffectif et ne recode pas la règle", () => {
    if (!existsSync(join(RACINE, DRAPEAU))) return; // PR 5 pas encore fusionnée.
    const source = readFileSync(join(RACINE, DRAPEAU), "utf8");
    expect(source).toMatch(/from "\.\/ouverture"/);
    expect(source).toMatch(/modeEffectif\(/);
  });
});
