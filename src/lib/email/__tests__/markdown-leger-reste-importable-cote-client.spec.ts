// @vitest-environment node

/**
 * 🛑 LA GRAMMAIRE DU MARKDOWN LÉGER RESTE IMPORTABLE PAR UN COMPOSANT CLIENT.
 *
 * ## Ce qui est gardé
 *
 * `markdown-leger.ts` est importé par TROIS surfaces : deux gabarits d'e-mail
 * (rendu serveur, React Email) et le composeur de réponse de la console, qui est
 * un composant CLIENT.
 *
 * Le jour où ce fichier gagne un import — `@react-email/components`, le châssis
 * `_layout`, un helper serveur — ce que le composeur tire dans le bundle de la
 * console change, en silence. Aucune gate ne le verrait : la console n'est pas
 * dans le budget de performance des quinze pages publiques, et le cliquet de
 * poids est une somme globale où quelques dizaines de kilo-octets se noient.
 *
 * Un fichier sans aucun import ne peut rien tirer. C'est la seule forme de cette
 * garantie qui se vérifie sans construire.
 *
 * ## Pourquoi la grammaire a été séparée du rendu
 *
 * Elle vivait dans `templates/_markdown-leger.tsx`, qui importe `emailStyles`
 * pour colorer les liens. Le composeur ne peut pas s'en servir : il aurait tiré
 * toute la pile React Email pour afficher **gras**, *italique* et un lien.
 *
 * ⚠️ La duplication qu'on refuse ici est celle de la GRAMMAIRE, pas celle du
 * rendu. Deux apparences pour deux médias est normal ; deux analyseurs pour une
 * même syntaxe est le défaut — c'est ainsi que l'aperçu finit par montrer autre
 * chose que ce qui part.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { fragmenter, paragraphes, preEnTeteDepuisCorps } from "../markdown-leger";

const GRAMMAIRE = join(process.cwd(), "src", "lib", "email", "markdown-leger.ts");

function source(): string {
  return readFileSync(GRAMMAIRE, "utf8");
}

describe("🛑 markdown léger — la grammaire reste pure", () => {
  it("le fichier est bien lu — sinon la garde ne garde rien", () => {
    // Témoin de NON-VACUITÉ : une source vide passerait le cas suivant en
    // ne contenant, effectivement, aucun import.
    const s = source();
    expect(s.length).toBeGreaterThan(1_500);
    expect(s).toContain("export function fragmenter");
  });

  it("🔴 aucun `import` — c'est ce qui la rend sûre côté client", () => {
    const imports = source()
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /^import\s/.test(l) || /^export\s+.*\bfrom\s+["']/.test(l));

    expect(
      imports,
      "la grammaire du markdown léger a gagné un import. Elle est utilisée par " +
        "le composeur de réponse, qui est un composant CLIENT : tout ce qu'elle " +
        "importe part dans le bundle de la console. Si le besoin est réel, mettre " +
        "le code qui en dépend dans `templates/_markdown-leger.tsx`, qui n'est " +
        "chargé que côté serveur.",
    ).toEqual([]);
  });

  // ── Le comportement, tant qu'on y est : la grammaire est testable seule ────

  it("les liens sont reconnus AVANT le gras — l'ordre compte", () => {
    // 🔑 Un libellé en gras à l'intérieur d'un lien serait découpé avant que le
    // lien ne soit reconnu, et le lien partirait cassé.
    const f = fragmenter("Voir [**le dossier**](https://exemple.invalid/x)");
    const lien = f.find((x) => x.type === "lien");
    expect(lien).toBeDefined();
    expect(lien?.type === "lien" ? lien.href : null).toBe("https://exemple.invalid/x");
  });

  it("une astérisque dans une URL ne re-découpe pas le lien", () => {
    const f = fragmenter("[doc](https://exemple.invalid/a*b)");
    expect(f.filter((x) => x.type === "lien")).toHaveLength(1);
    expect(f.some((x) => x.type === "italique")).toBe(false);
  });

  it("une ligne vide sépare deux paragraphes, plusieurs n'en font pas trois", () => {
    expect(paragraphes("un\n\ndeux")).toEqual(["un", "deux"]);
    expect(paragraphes("un\n\n\n\ndeux")).toEqual(["un", "deux"]);
    expect(paragraphes("   \n  \n ")).toEqual([]);
  });

  it("le pré-en-tête retire les marques et retombe sur le repli si le corps est vide", () => {
    expect(preEnTeteDepuisCorps("**Bonjour** Sofia", "repli")).toBe("Bonjour Sofia");
    expect(preEnTeteDepuisCorps("   ", "repli")).toBe("repli");
  });
});
