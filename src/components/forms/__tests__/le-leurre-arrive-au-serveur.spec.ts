/**
 * 🔴 Un piège à robots que le navigateur n'envoie pas ne piège rien.
 *
 * Mesuré en production le 2026-09-25 : sur /fr/contact, leurre rempli d'une
 * valeur marqueur → « Demande reçue », une VRAIE fiche créée, un accusé parti,
 * aucune trace dans le registre du piège. Le formulaire construisait son
 * FormData à la main et n'y mettait jamais le leurre. Même défaut sur la
 * newsletter. La candidature spontanée, qui soumet le formulaire entier, a
 * produit la trace au premier essai.
 *
 * Deux gardes :
 *   1. le comportement de `reporterLeurre` (rempli → transmis, vide → rien) ;
 *   2. tout composant qui AFFICHE le leurre et construit un FormData VIDE doit
 *      appeler `reporterLeurre` — lu dans le CODE, commentaires retirés, sinon
 *      la garde trouverait sa preuve dans la phrase qui explique le correctif.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { NOM_DU_LEURRE, reporterLeurre } from "../reporter-leurre";

const RACINE = process.cwd();
const SRC = path.resolve(RACINE, "src");

function fichiersTsx(dir: string): string[] {
  const out: string[] = [];
  for (const entree of readdirSync(dir)) {
    const abs = path.join(dir, entree);
    if (statSync(abs).isDirectory()) {
      if (entree !== "__tests__" && entree !== "node_modules") out.push(...fichiersTsx(abs));
    } else if (abs.endsWith(".tsx")) out.push(abs);
  }
  return out;
}

/** Le code seul : commentaires de bloc, JSX et de ligne retirés. */
function codeSeul(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

/**
 * Un composant qui affiche le leurre, ne construit son FormData QU'À LA MAIN
 * (aucun `new FormData(formulaire)`, qui emporterait le leurre tout seul), et
 * ne le reporte pas.
 *
 * Un composant mixte — `new FormData(form)` pour l'envoi principal, `new
 * FormData()` pour un repli ou une étape secondaire sans leurre — n'est pas
 * visé : c'est le cas de `CommercialApplicationWizard` et `ReportEmailForm`.
 */
function oublieLeLeurre(source: string): boolean {
  const code = codeSeul(source);
  return (
    code.includes("<HoneypotField") &&
    /new FormData\(\s*\)/.test(code) &&
    !/new FormData\(\s*[^\s)]/.test(code) &&
    !/reporterLeurre\(/.test(code)
  );
}

function formulaireAvecLeurre(valeur: string): HTMLFormElement {
  const form = document.createElement("form");
  const leurre = document.createElement("input");
  leurre.name = NOM_DU_LEURRE;
  leurre.readOnly = true;
  leurre.value = valeur;
  form.appendChild(leurre);
  return form;
}

describe("reporterLeurre — le leurre voyage jusqu'à l'action serveur", () => {
  it("porte le même nom que le champ rendu par HoneypotField", () => {
    const composant = codeSeul(
      readFileSync(path.join(SRC, "components", "forms", "HoneypotField.tsx"), "utf8"),
    );
    expect(/name="([^"]+)"/.exec(composant)?.[1]).toBe(NOM_DU_LEURRE);
  });

  it("🔴 leurre rempli → la valeur est dans le FormData envoyé", () => {
    const fd = new FormData();
    fd.set("email", "x@example.invalid");
    reporterLeurre(fd, formulaireAvecLeurre("https://spam.example"));
    expect(fd.get(NOM_DU_LEURRE)).toBe("https://spam.example");
    expect(fd.get("email")).toBe("x@example.invalid");
  });

  it("leurre vide → la requête d'un humain est inchangée", () => {
    const fd = new FormData();
    reporterLeurre(fd, formulaireAvecLeurre(""));
    expect(fd.has(NOM_DU_LEURRE)).toBe(false);
  });

  it("cible absente ou qui n'est pas un formulaire → rien, sans lever", () => {
    const fd = new FormData();
    reporterLeurre(fd, null);
    reporterLeurre(fd, undefined);
    reporterLeurre(fd, document.createElement("div"));
    expect(fd.has(NOM_DU_LEURRE)).toBe(false);
  });
});

describe("🔴 aucun formulaire n'affiche le leurre sans le transmettre", () => {
  const fichiers = fichiersTsx(SRC);
  const avecLeurre = fichiers.filter((f) =>
    codeSeul(readFileSync(f, "utf8")).includes("<HoneypotField"),
  );

  it("contre-témoin : le prédicat reconnaît le défaut d'origine", () => {
    // Sans ce témoin, un prédicat cassé ne trouverait jamais de coupable et
    // passerait pour vert.
    const avant = `<HoneypotField />\nconst fd = new FormData();\nfd.set("email", v);`;
    expect(oublieLeLeurre(avant)).toBe(true);
    expect(oublieLeLeurre(`${avant}\nreporterLeurre(fd, event?.target);`)).toBe(false);
    // …et le correctif CITÉ dans un commentaire ne vaut pas correctif.
    expect(oublieLeLeurre(`${avant}\n// reporterLeurre(fd, event?.target);`)).toBe(true);
    // Un envoi principal par le formulaire entier emporte le leurre tout seul.
    expect(oublieLeLeurre(`${avant}\nconst principal = new FormData(event.currentTarget);`)).toBe(
      false,
    );
  });

  it("le leurre est bien affiché par plusieurs formulaires (la garde regarde quelque chose)", () => {
    expect(avecLeurre.length).toBeGreaterThanOrEqual(5);
  });

  it("🔴 chaque formulaire qui construit son FormData à la main y reporte le leurre", () => {
    const coupables = avecLeurre
      .filter((f) => oublieLeLeurre(readFileSync(f, "utf8")))
      .map((f) => path.relative(RACINE, f));
    expect(coupables).toEqual([]);
  });
});
