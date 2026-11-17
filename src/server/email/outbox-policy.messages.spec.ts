/**
 * Garde : la liste des gabarits qui lisent le « message personnalisé » est exacte.
 *
 * On lit la SOURCE de chaque gabarit (`src/lib/email/templates/<nom>.tsx`, le nom
 * du fichier est celui du job), commentaires retirés, et les fichiers d'aide
 * (`.ts`, `_*.tsx`) qu'il importe. Un gabarit qui lit `messagePersonnalise` sans être
 * dans la liste perdrait le texte saisi à la validation ; un gabarit listé qui ne
 * le lit pas afficherait un champ sans effet. Les deux font rougir ce test.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { EMAIL_TEMPLATE_NAMES } from "@/lib/email/templates";
import { GABARITS_QUI_LISENT_LE_MESSAGE, gabaritLitLeMessage } from "./outbox-policy";

const DOSSIER = join(process.cwd(), "src/lib/email/templates");

/** Source sans commentaires : un commentaire qui NOMME le champ ne le lit pas. */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

const lire = (f: string): string => sansCommentaires(readFileSync(join(DOSSIER, f), "utf8"));
const estSpec = (f: string): boolean => /\.spec\.tsx?$/.test(f);

/** Fichiers d'aide : `.ts` et `_*.tsx` (hors specs). */
function fichiersAide(): string[] {
  return readdirSync(DOSSIER).filter(
    (f) => !estSpec(f) && (f.endsWith(".ts") || (f.endsWith(".tsx") && f.startsWith("_"))),
  );
}

/** Gabarits (un `.tsx` sans `_`, hors specs) qui lisent le champ, directement ou via un fichier d'aide. */
function gabaritsLisantLeMessage(): string[] {
  const aideLisante = fichiersAide()
    .filter((f) => lire(f).includes("messagePersonnalise"))
    .map((f) => f.replace(/\.tsx?$/, ""));
  return readdirSync(DOSSIER)
    .filter((f) => f.endsWith(".tsx") && !estSpec(f) && !f.startsWith("_"))
    .filter((f) => {
      const src = lire(f);
      return (
        src.includes("messagePersonnalise") ||
        aideLisante.some((h) => new RegExp(`from\\s+["']\\./${h}["']`).test(src))
      );
    })
    .map((f) => f.replace(/\.tsx$/, ""))
    .sort();
}

describe("sansCommentaires", () => {
  it("ignore un commentaire qui nomme le champ, garde le code", () => {
    expect(sansCommentaires("// messagePersonnalise\nconst a = 1;")).not.toContain(
      "messagePersonnalise",
    );
    expect(sansCommentaires("/* messagePersonnalise */ x")).not.toContain("messagePersonnalise");
    expect(sansCommentaires("const m = props.messagePersonnalise; // ok")).toContain(
      "messagePersonnalise",
    );
  });
});

describe("GABARITS_QUI_LISENT_LE_MESSAGE", () => {
  it("égale exactement l'ensemble des gabarits dont la source lit messagePersonnalise", () => {
    expect([...GABARITS_QUI_LISENT_LE_MESSAGE].sort()).toEqual(gabaritsLisantLeMessage());
  });

  it("ne nomme que des gabarits enregistrés", () => {
    for (const nom of GABARITS_QUI_LISENT_LE_MESSAGE) {
      expect(EMAIL_TEMPLATE_NAMES as string[]).toContain(nom);
    }
  });

  it("gabaritLitLeMessage suit la liste", () => {
    expect(gabaritLitLeMessage("facture-envoi")).toBe(true);
    expect(gabaritLitLeMessage("qualiopi-convocation")).toBe(false);
  });
});
