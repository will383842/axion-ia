import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * **RÈGLE INTANGIBLE DE LA COUCHE MÉTHODE (ADR 0076) : CE DÉPÔT EST PUBLIC.**
 *
 *   1. aucun fichier de la fiche ne contient de contenu réel ou privé : pas de montant en
 *      euros, pas de courriel, pas de téléphone, pas de lien de session, pas de nom du
 *      fondateur, pas de nom de ville de siège, aucun slug `methode/…` qui ne commence pas
 *      par `methode/faux-` ;
 *   2. rien ne déclenche l'import (aucun fichier hors `scripts/methode/`, `docs/` et ces
 *      tests ne le cite) ;
 *   3. rien hors `src/server/methode/` (et l'import lui-même) n'importe la couche ;
 *   4. toute ouverture arrive ÉTEINTE : aucune configuration commise ne pose les trois
 *      variables, aucun code ne les écrit.
 *
 * Ce fichier ne contient lui-même aucun des motifs qu'il interdit : les valeurs sensibles
 * sont assemblées à l'exécution.
 */

const RACINE = path.resolve(__dirname, "../../../..");

/** Les fichiers que la fiche KB-05a a le droit d'ajouter ou de modifier. */
const FICHIERS_DE_LA_FICHE = [
  "src/server/methode/index.ts",
  "src/server/methode/decoupage.ts",
  "src/server/methode/filtre-sortie.ts",
  "src/server/methode/__tests__/couche-methode.spec.ts",
  "src/server/methode/__tests__/filtre-sortie.spec.ts",
  "src/server/methode/__tests__/aucun-extrait-prive.spec.ts",
  "src/server/methode/__tests__/jamais-publiee.spec.ts",
  "scripts/methode/importer-methode.ts",
  "docs/adr/0076-couche-methode-collection-separee.md",
  "docs/knowledge/COUCHE-METHODE.md",
];

const EURO = String.fromCharCode(0x20ac);
const MOTIF_MONTANT = new RegExp(String.raw`\d[\d\s  .,]*\s?(?:${EURO}|EUR\b|euros?\b)`, "i");
const MOTIF_COURRIEL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/;
const MOTIF_TELEPHONE = /(?:\+33|0033|(?<![\d.]))0?[1-9](?:[\s.-]?\d{2}){4}(?!\d)/;
const MOTIF_SESSION = new RegExp(
  [String.raw`claude\.ai/code`, "session_[0-9A-Za-z]{10,}", ["Claude", "Session"].join("-")].join(
    "|",
  ),
  "i",
);
const NOM_FONDATEUR = new RegExp(["Will", "iams"].join(""), "i");
const NOM_VILLE_SIEGE = new RegExp(["Gren", "obl"].join(""), "i");
/** Un slug `methode/<x>` où <x> commence par un caractère de slug (ni `<`, ni guillemet). */
const MOTIF_SLUG_REEL = /(?<![\w./@\\-])methode\/([a-z0-9][a-z0-9-]*)/g;

function lire(rel: string): string {
  return readFileSync(path.join(RACINE, rel), "utf8");
}

/** `git grep` (fichiers suivis ET nouveaux) : liste des fichiers qui contiennent le motif. */
function fichiersContenant(motif: string, pathspec: string[] = []): string[] {
  try {
    const sortie = execFileSync(
      "git",
      [
        "grep",
        "-l",
        "-I",
        "--untracked",
        "-E",
        motif,
        "--",
        ...(pathspec.length ? pathspec : ["."]),
      ],
      { cwd: RACINE, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    );
    return sortie.split("\n").filter(Boolean);
  } catch (e) {
    // Code 1 = aucune correspondance.
    if ((e as { status?: number }).status === 1) return [];
    throw e;
  }
}

describe("1 · aucun contenu réel ou privé dans les fichiers de la fiche", () => {
  const presents = FICHIERS_DE_LA_FICHE.filter((f) => existsSync(path.join(RACINE, f)));

  it("les fichiers principaux existent", () => {
    expect(presents).toEqual(expect.arrayContaining(["src/server/methode/index.ts"]));
  });

  for (const fichier of FICHIERS_DE_LA_FICHE) {
    describe(fichier, () => {
      if (!existsSync(path.join(RACINE, fichier))) {
        it.skip("(fichier absent)", () => undefined);
        return;
      }
      const texte = lire(fichier);

      it("aucun montant en euros", () => expect(MOTIF_MONTANT.exec(texte)?.[0]).toBeUndefined());
      it("aucun courriel", () => expect(MOTIF_COURRIEL.exec(texte)?.[0]).toBeUndefined());
      it("aucun téléphone", () => expect(MOTIF_TELEPHONE.exec(texte)?.[0]).toBeUndefined());
      it("aucun lien ou identifiant de session", () =>
        expect(MOTIF_SESSION.exec(texte)?.[0]).toBeUndefined());
      it("aucun nom du fondateur", () => expect(NOM_FONDATEUR.exec(texte)?.[0]).toBeUndefined());
      it("aucun nom de ville de siège", () =>
        expect(NOM_VILLE_SIEGE.exec(texte)?.[0]).toBeUndefined());
      it("aucun slug methode/ qui ne commence pas par methode/faux-", () => {
        const reels = [...texte.matchAll(MOTIF_SLUG_REEL)]
          .map((m) => m[1]!)
          .filter((suite) => !suite.startsWith("faux-"));
        expect(reels).toEqual([]);
      });
    });
  }

  it("les motifs de ce scanner détectent bien ce qu'ils doivent (sinon le test ne prouve rien)", () => {
    expect(MOTIF_MONTANT.test(`12 345 ${EURO}`)).toBe(true);
    expect(MOTIF_MONTANT.test(["3", "euros"].join(" "))).toBe(true);
    expect(MOTIF_COURRIEL.test(["a", "b.invalid"].join("@"))).toBe(true);
    expect(MOTIF_TELEPHONE.test(["01", "23", "45", "67", "89"].join(" "))).toBe(true);
    expect(MOTIF_TELEPHONE.test(["+33", "6", "12", "34", "56", "78"].join(" "))).toBe(true);
    expect(
      MOTIF_SESSION.test(
        ["https://claude.ai", "code", ["session", "ABCDEFGHIJKL"].join("_")].join("/"),
      ),
    ).toBe(true);
    expect(["methode", "00-quelque-chose"].join("/").match(MOTIF_SLUG_REEL)).not.toBeNull();
    expect("src/server/methode/index.ts".match(MOTIF_SLUG_REEL)).toBeNull();
    expect("methode/faux-a".match(MOTIF_SLUG_REEL)?.[0]).toBe("methode/faux-a");
  });
});

describe("2 · rien ne déclenche l'import", () => {
  it("aucun fichier hors scripts/methode/, docs/ et ces tests ne cite le script d'import", () => {
    const autorises = [/^scripts\/methode\//, /^docs\//, /^src\/server\/methode\/__tests__\//];
    const trouves = fichiersContenant("importer-methode").filter(
      (f) => !autorises.some((re) => re.test(f)),
    );
    expect(trouves).toEqual([]);
  });

  it("package.json, workflows, Dockerfile, docker-compose, worker et cron ne le lancent pas", () => {
    const trouves = fichiersContenant("importer-methode|scripts/methode", [
      "package.json",
      ".github",
      "Dockerfile*",
      "docker-compose*",
      "axionia",
      "src/server/queue",
      "scripts/vps",
    ]);
    expect(trouves).toEqual([]);
  });
});

describe("3 · rien ne lit la couche Méthode hors de la liste blanche", () => {
  it("aucun fichier hors src/server/methode/ (et l'import lui-même) n'importe la couche", () => {
    const trouves = fichiersContenant(`['"\`][^'"\`]*server/methode(/[^'"\`]*)?['"\`]`, [
      "*.ts",
      "*.tsx",
      "*.js",
      "*.mjs",
      "*.cjs",
    ]).filter(
      (f) => !f.startsWith("src/server/methode/") && f !== "scripts/methode/importer-methode.ts",
    );
    expect(trouves).toEqual([]);
  });

  it("ni le chatbot ni les générateurs de contenu ne sont branchés", () => {
    const trouves = fichiersContenant("server/methode", [
      "src/server/chatbot",
      "src/server/content-gen",
    ]);
    expect(trouves).toEqual([]);
  });
});

describe("4 · toute ouverture arrive éteinte", () => {
  const VARIABLES = ["METHODE_ACTIVE", "METHODE_STUDIO_OUVERT", "METHODE_STUDIO_SECRET"];

  it("aucune configuration commise (workflow, Dockerfile, compose, package.json) ne les pose", () => {
    const trouves = fichiersContenant(VARIABLES.join("|"), [
      "package.json",
      ".github",
      "Dockerfile*",
      "docker-compose*",
      "axionia",
      "scripts/vps",
    ]);
    expect(trouves).toEqual([]);
  });

  it(".env.example : les variables ne sont que COMMENTÉES", () => {
    const lignes = lire(".env.example").split("\n");
    const posees = lignes.filter(
      (l) => VARIABLES.some((v) => l.includes(v)) && !l.trimStart().startsWith("#"),
    );
    expect(posees).toEqual([]);
    for (const v of VARIABLES.slice(0, 1)) {
      expect(lignes.some((l) => l.includes(v))).toBe(true);
    }
  });

  it("aucun autre fichier d'exemple d'environnement ne pose une valeur", () => {
    for (const f of [".env.ci.example", ".env.dev.example", ".env.production.example"]) {
      const posees = lire(f)
        .split("\n")
        .filter((l) => VARIABLES.some((v) => l.includes(v)) && !l.trimStart().startsWith("#"));
      expect(posees).toEqual([]);
    }
  });

  it('src/env.ts : METHODE_ACTIVE et METHODE_STUDIO_OUVERT suivent la forme exacte z.enum(["true", "false"]).optional()', () => {
    const env = lire("src/env.ts");
    for (const v of ["METHODE_ACTIVE", "METHODE_STUDIO_OUVERT"]) {
      expect(env).toMatch(
        new RegExp(`\\b${v}: z\\.enum\\(\\["true", "false"\\]\\)\\.optional\\(\\),`),
      );
      expect(env).toMatch(new RegExp(`\\b${v}: process\\.env\\.${v},`));
    }
    expect(env).toMatch(/\bMETHODE_STUDIO_SECRET: z\.string\(\)\.min\(32\)\.optional\(\),/);
    expect(env).toMatch(/\bMETHODE_STUDIO_SECRET: process\.env\.METHODE_STUDIO_SECRET,/);
  });

  it("aucune ligne de code (hors tests) n'écrit ces variables", () => {
    const motifEcriture = String.raw`process\.env\.(${VARIABLES.join("|")})\s*=[^=]|process\.env\[['"](${VARIABLES.join("|")})['"]\]\s*=[^=]`;
    const trouves = fichiersContenant(motifEcriture, [
      "*.ts",
      "*.tsx",
      "*.js",
      "*.mjs",
      "*.sh",
      "*.yml",
    ]).filter((f) => !/\.(spec|test)\.[tj]sx?$/.test(f) && !f.includes("/__tests__/"));
    expect(trouves).toEqual([]);
  });
});
