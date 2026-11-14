/**
 * Drapeaux des guides réseaux posables par `coolify-drapeau.yml` et lisibles par
 * `coolify-lire-drapeaux.yml` : GUIDES_RESEAU_CATALOGUE_ENABLED (site), GUIDES_RESEAU_LIVRAISON_ENABLED
 * (les-deux), GUIDES_RESEAU_ESSAI_ADRESSES (les-deux, adresses @axion-ia.com seulement, jamais imprimées).
 *
 * Les étapes `run:` sont EXÉCUTÉES sous bash (curl remplacé par un faux), pas seulement lues : ce qui est
 * testé est le comportement (code de sortie, sortie standard), pas la forme du texte.
 *
 * Mutations qui rougissent (prouvées à la main, voir la PR) : retirer une clé de la liste ; relâcher la
 * cible imposée ; élargir le domaine du motif ; passer {0,4} à {0,5} ; réimprimer $VALEUR ; retirer la
 * branche « N adresse(s) » de la lecture.
 */
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const POSER = ".github/workflows/coolify-drapeau.yml";
const LIRE = ".github/workflows/coolify-lire-drapeaux.yml";

/** Le script `run: |` de l'étape `- name: <nom>` (indentation retirée). */
function script(chemin: string, nom: string): string {
  const lignes = readFileSync(chemin, "utf8").split("\n");
  const debut = lignes.findIndex((l) => l.trim() === `- name: ${nom}`);
  if (debut === -1) throw new Error(`étape introuvable : ${nom}`);
  let i = lignes.findIndex((l, k) => k > debut && /^\s+run: \|\s*$/.test(l));
  const indent = /^(\s*)/.exec(lignes[i + 1]!)![1]!.length;
  const corps: string[] = [];
  for (i += 1; i < lignes.length; i++) {
    const l = lignes[i]!;
    if (l.trim() !== "" && !l.startsWith(" ".repeat(indent))) break;
    if (/^\s*- name:/.test(l)) break;
    corps.push(l.slice(indent));
  }
  return corps.join("\n");
}

/** Faux `curl` : sans `-w`, rend le JSON fourni ; avec `-w`, rend « 200 ». Ne trace rien. */
function fauxCurl(json: string): { bin: string; env: Record<string, string> } {
  const dir = mkdtempSync(path.join(tmpdir(), "faux-curl-"));
  writeFileSync(path.join(dir, "reponse.json"), json);
  writeFileSync(
    path.join(dir, "curl"),
    `#!/bin/bash\nfor a in "$@"; do [ "$a" = "-w" ] && { printf 200; exit 0; }; done\ncat "${dir}/reponse.json"\n`,
  );
  chmodSync(path.join(dir, "curl"), 0o755);
  return { bin: dir, env: {} };
}

function lancer(code: string, env: Record<string, string>, json = "[]") {
  const { bin } = fauxCurl(json);
  const r = spawnSync("bash", ["-c", code], {
    env: {
      NODE_ENV: "test",
      PATH: `${bin}:${process.env.PATH}`,
      COOLIFY_API_TOKEN: "jeton",
      COOLIFY_URL: "https://coolify.invalid",
      COOLIFY_APP_UUID: "uuid-site",
      COOLIFY_WORKER_APP_UUID: "uuid-worker",
      CONFIRMER_EXTINCTION: "false",
      ...env,
    },
    encoding: "utf8",
  });
  return { code: r.status, sortie: `${r.stdout}${r.stderr}` };
}

const valider = (cle: string, valeur: string, cible: string) =>
  lancer(script(POSER, "Valider la valeur"), { CLE: cle, VALEUR: valeur, CIBLE: cible });

const ADR = (n: number) => Array.from({ length: n }, (_, i) => `essai${i}@axion-ia.com`).join(",");

describe("liste fermée", () => {
  it.each([
    "GUIDES_RESEAU_CATALOGUE_ENABLED",
    "GUIDES_RESEAU_LIVRAISON_ENABLED",
    "GUIDES_RESEAU_ESSAI_ADRESSES",
  ])("%s est dans les options de coolify-drapeau.yml", (cle) => {
    expect(readFileSync(POSER, "utf8")).toMatch(new RegExp(`^\\s+- "${cle}"$`, "m"));
  });

  it.each([
    "GUIDES_RESEAU_CATALOGUE_ENABLED",
    "GUIDES_RESEAU_LIVRAISON_ENABLED",
    "GUIDES_RESEAU_ESSAI_ADRESSES",
  ])("%s est dans la liste de lecture", (cle) => {
    expect(readFileSync(LIRE, "utf8")).toContain(`"${cle}"`);
  });
});

describe("GUIDES_RESEAU_CATALOGUE_ENABLED : true/false, cible site", () => {
  it.each(["true", "false"])("accepte %s sur site", (v) => {
    expect(valider("GUIDES_RESEAU_CATALOGUE_ENABLED", v, "site").code).toBe(0);
  });
  it.each(["les-deux", "worker"])("refuse la cible %s", (c) => {
    expect(valider("GUIDES_RESEAU_CATALOGUE_ENABLED", "true", c).code).toBe(1);
  });
  it.each(["oui", "essai", ""])("refuse la valeur « %s »", (v) => {
    expect(valider("GUIDES_RESEAU_CATALOGUE_ENABLED", v, "site").code).toBe(1);
  });
});

describe("GUIDES_RESEAU_LIVRAISON_ENABLED : true/false, cible les-deux imposée", () => {
  it.each(["true", "false"])("accepte %s sur les-deux", (v) => {
    expect(valider("GUIDES_RESEAU_LIVRAISON_ENABLED", v, "les-deux").code).toBe(0);
  });
  it.each(["site", "worker"])("refuse la cible %s", (c) => {
    const r = valider("GUIDES_RESEAU_LIVRAISON_ENABLED", "true", c);
    expect(r.code).toBe(1);
    expect(r.sortie).toContain("les-deux");
  });
  it.each(["oui", "essai", ""])("refuse la valeur « %s »", (v) => {
    expect(valider("GUIDES_RESEAU_LIVRAISON_ENABLED", v, "les-deux").code).toBe(1);
  });
});

describe("GUIDES_RESEAU_ESSAI_ADRESSES : adresses @axion-ia.com, cible les-deux imposée", () => {
  it("accepte 1 adresse, 5 adresses et la valeur vide (retrait)", () => {
    for (const v of ["essai@axion-ia.com", "a.b+c-d@axion-ia.com", ADR(5), ""]) {
      expect(valider("GUIDES_RESEAU_ESSAI_ADRESSES", v, "les-deux").code, v).toBe(0);
    }
  });
  it.each(["site", "worker"])("refuse la cible %s", (c) => {
    expect(valider("GUIDES_RESEAU_ESSAI_ADRESSES", "essai@axion-ia.com", c).code).toBe(1);
  });
  it("refuse plus de 5 adresses", () => {
    expect(valider("GUIDES_RESEAU_ESSAI_ADRESSES", ADR(6), "les-deux").code).toBe(1);
  });
  it.each([
    "jean.dupont@gmail.com",
    "essai@axion-ia.fr",
    "essai@axion-ia.com.evil.fr",
    "essai@evil-axion-ia.com",
    "essai@sub.axion-ia.com",
    "Essai@axion-ia.com",
    "essai@axion-ia.com,jean@gmail.com",
    "essai@axion-ia.com,",
    ",essai@axion-ia.com",
    "essai@axion-ia.com, essai2@axion-ia.com",
    "essai@axion-ia.com\njean@gmail.com",
    "@axion-ia.com",
  ])("refuse « %s »", (v) => {
    expect(valider("GUIDES_RESEAU_ESSAI_ADRESSES", v, "les-deux").code).toBe(1);
  });
  it("ne reprend jamais la valeur refusée dans son message", () => {
    const v = "jean.dupont@gmail.com";
    expect(valider("GUIDES_RESEAU_ESSAI_ADRESSES", v, "les-deux").sortie).not.toContain("dupont");
  });
});

describe("la valeur des adresses n'est jamais imprimée", () => {
  it("écriture : seul le nombre d'adresses apparaît", () => {
    const r = lancer(script(POSER, "Écrire le drapeau (Production seulement)"), {
      CLE: "GUIDES_RESEAU_ESSAI_ADRESSES",
      VALEUR: "secretun@axion-ia.com,secretdeux@axion-ia.com",
      CIBLE: "les-deux",
    });
    expect(r.code).toBe(0);
    expect(r.sortie).toContain("2 adresse(s)");
    expect(r.sortie).not.toContain("secret");
    expect(r.sortie).not.toContain("axion-ia.com");
  });
  it("écriture : valeur vide → 0 adresse(s)", () => {
    const r = lancer(script(POSER, "Écrire le drapeau (Production seulement)"), {
      CLE: "GUIDES_RESEAU_ESSAI_ADRESSES",
      VALEUR: "",
      CIBLE: "les-deux",
    });
    expect(r.code).toBe(0);
    expect(r.sortie).toContain("0 adresse(s)");
  });
  it("lecture avant écriture (coolify-drapeau.yml) : seul le nombre apparaît", () => {
    const json = JSON.stringify([
      {
        key: "GUIDES_RESEAU_ESSAI_ADRESSES",
        value: "secretun@axion-ia.com,secretdeux@axion-ia.com",
        is_preview: false,
      },
    ]);
    const r = lancer(
      script(POSER, "Lire l'état actuel"),
      { CLE: "GUIDES_RESEAU_ESSAI_ADRESSES" },
      json,
    );
    expect(r.sortie).toContain("2 adresse(s)");
    expect(r.sortie).not.toContain("secret");
    expect(r.sortie).not.toContain("axion-ia.com");
  });
  it("lecture seule (coolify-lire-drapeaux.yml) : seul le nombre apparaît", () => {
    const json = JSON.stringify([
      {
        key: "GUIDES_RESEAU_ESSAI_ADRESSES",
        value: "secretun@axion-ia.com,secretdeux@axion-ia.com,trois@axion-ia.com",
        is_preview: false,
      },
      { key: "GUIDES_RESEAU_CATALOGUE_ENABLED", value: "true", is_preview: false },
    ]);
    const r = lancer(script(LIRE, "Lire les drapeaux"), {}, json);
    expect(r.sortie).toContain("GUIDES_RESEAU_ESSAI_ADRESSES = 3 adresse(s)");
    expect(r.sortie).toContain("GUIDES_RESEAU_CATALOGUE_ENABLED = true");
    expect(r.sortie).toContain("GUIDES_RESEAU_LIVRAISON_ENABLED = absent");
    expect(r.sortie).not.toContain("secret");
    expect(r.sortie).not.toContain("axion-ia.com");
  });
  it("la branche de validation des adresses n'imprime pas VALEUR", () => {
    const code = script(POSER, "Valider la valeur");
    const debut = code.indexOf('"$CLE" = "GUIDES_RESEAU_ESSAI_ADRESSES"');
    const bloc = code.slice(debut, code.indexOf("QUESTIONNAIRE_PREAUDIT_ADRESSE_ESSAI", debut));
    expect(bloc.length).toBeGreaterThan(0);
    expect(bloc).not.toMatch(/\b(echo|printf)\b[^\n]*\$\{?VALEUR\b/);
  });
});
