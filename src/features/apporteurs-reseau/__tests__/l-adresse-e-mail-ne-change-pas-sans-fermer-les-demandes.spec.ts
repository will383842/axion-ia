/**
 * GARDES STATIQUES DU CHANGEMENT D'IBAN (plan apporteurs-changement-iban, §2.5, §2.5 bis, §2.6 ; lot 3).
 *
 * Toute la sécurité du changement d'IBAN repose sur DEUX coordonnées de la fiche : l'adresse e-mail (qui reçoit
 * la confirmation et l'alerte) et le téléphone (le rappel de l'administrateur). Si l'une d'elles pouvait changer
 * en même temps que l'IBAN, la barrière tomberait. Aujourd'hui aucune action ne les modifie après la signature ;
 * ce fichier fige la LISTE FERMÉE des écrivains. Une écriture de plus fait rougir ici : son auteur doit alors,
 * dans la même transaction, fermer les demandes ouvertes et alerter (plan §2.5 / §2.5 bis), puis ajouter son
 * entrée à la liste en le disant.
 *
 * Et §2.6 : aucun assistant d'IA ne saisit, ne lit ni ne devine un IBAN. Le chemin du changement d'IBAN
 * n'importe aucun appel de modèle, aucun agent de navigateur, aucune extraction automatique de document.
 *
 * Limite avouée de l'analyse (statique, par lecture du code) : elle ne voit pas une clé construite dynamiquement
 * (`data: { [cle]: v }`) ni un `data` passé par une variable ; elle REFUSE ces deux formes (voir `appelsOpaques`)
 * plutôt que de les laisser passer.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = path.resolve(__dirname, "../../../..");

function fichiers(dir: string, sortie: string[] = []): string[] {
  for (const nom of readdirSync(dir)) {
    if (nom === "node_modules" || nom === "__tests__" || nom === ".next") continue;
    const p = path.join(dir, nom);
    if (statSync(p).isDirectory()) fichiers(p, sortie);
    else if (/\.(ts|tsx|mjs|js)$/.test(nom) && !/\.(spec|test)\.[tj]sx?$/.test(nom)) sortie.push(p);
  }
  return sortie;
}
const rel = (p: string) => path.relative(RACINE, p).split(path.sep).join("/");

// ── Écrivains de `email`, `emailHash`, `telephone`, `telephoneHash` sur `apporteurReseau` ────────────────────────

interface EcritureCoordonnee {
  readonly fichier: string;
  readonly appel: string;
  readonly cles: readonly string[];
}

const APPEL_ECRITURE = /apporteurReseau\s*\.\s*(create|createMany|update|updateMany|upsert)\s*\(/g;
const COORDONNEES = ["email", "emailHash", "telephone", "telephoneHash"];
const CLES_COORDONNEES =
  /(?<![\w.])["']?(email|emailHash|telephone|telephoneHash)["']?\s*(?::|,|\})/g;

/** Les arguments d'un appel, parenthèses équilibrées (les chaînes ne contiennent pas de parenthèse ici). */
function argumentsDe(source: string, debut: number): string {
  let profondeur = 1;
  let i = debut;
  while (profondeur > 0 && i < source.length) {
    const c = source[i];
    if (c === "(") profondeur += 1;
    else if (c === ")") profondeur -= 1;
    i += 1;
  }
  return source.slice(debut, i - 1);
}

/**
 * Retire le bloc `declarations: { … }` : c'est un JSON libre de la fiche (cases cochées, marqueurs), pas une
 * colonne de coordonnée ; les dispersions et les clés calculées y sont normales.
 */
function sansDeclarations(args: string): string {
  const m = /\bdeclarations\s*:\s*\{/.exec(args);
  if (!m) return args;
  let d = 1;
  let i = m.index + m[0].length;
  while (d > 0 && i < args.length) {
    if (args[i] === "{") d += 1;
    else if (args[i] === "}") d -= 1;
    i += 1;
  }
  return sansDeclarations(args.slice(0, m.index) + args.slice(i));
}

export function lireEcritures(sources: ReadonlyArray<{ fichier: string; texte: string }>): {
  ecritures: EcritureCoordonnee[];
  appelsOpaques: string[];
  sql: string[];
} {
  const ecritures: EcritureCoordonnee[] = [];
  const appelsOpaques: string[] = [];
  const sql: string[] = [];
  const toutLeTexte = sources.map((x) => x.texte).join("\n");
  for (const { fichier, texte } of sources) {
    for (const m of texte.matchAll(APPEL_ECRITURE)) {
      const args = sansDeclarations(argumentsDe(texte, (m.index ?? 0) + m[0].length));
      // `data:` doit être un littéral objet, sans clé calculée : sinon l'analyse ne peut pas conclure.
      // Un `upsert` porte `create:` et `update:` : chacun doit être un littéral objet.
      for (const k of args.matchAll(/\b(create|update)\s*:\s*(\S)/g))
        if (k[2] !== "{") appelsOpaques.push(`${fichier} : ${m[1]}(${k[1]}: ${k[2]}…)`);
      // Une dispersion d'identifiant (`...patch`) cache des clés : opaque (les `...(cond ? {…} : {})` sont lisibles).
      if (/\.\.\.\s*[A-Za-z_$]/.test(args)) appelsOpaques.push(`${fichier} : ${m[1]}(dispersion)`);
      if (m[1] !== "upsert" && !/\bdata\s*:/.test(args))
        appelsOpaques.push(`${fichier} : ${m[1]}(sans « data: » littéral)`);
      const data = /\bdata\s*:\s*(\S)/.exec(args);
      if (data && data[1] !== "{") appelsOpaques.push(`${fichier} : ${m[1]}(data: ${data[1]}…)`);
      // Une clé calculée n'est lisible que si c'est une constante `CLE_…` (définie dans le dépôt), définie par un
      // littéral qui n'est PAS une coordonnée (ex. la clé du marqueur « registre indisponible » du JSON).
      for (const calc of args.matchAll(/\[\s*(\w+)\s*\]\s*:/g)) {
        const nom = calc[1] as string;
        const def = new RegExp(`const\\s+${nom}\\s*=\\s*["']([^"']+)["']`).exec(toutLeTexte);
        const lisible =
          /^CLE_[A-Z_]+$/.test(nom) && def !== null && !COORDONNEES.includes(def[1] as string);
        if (!lisible) appelsOpaques.push(`${fichier} : ${m[1]}(clé calculée ${nom})`);
      }
      const cles = [
        ...new Set([...args.matchAll(CLES_COORDONNEES)].map((k) => k[1] as string)),
      ].sort();
      if (cles.length > 0) ecritures.push({ fichier, appel: m[1] as string, cles });
    }
    // SQL brut : une écriture de la table de la fiche, quelle que soit la forme.
    if (
      /(?:update|insert\s+into)\s+(?:only\s+)?(?:"?public"?\s*\.\s*)?"?apporteurs_reseau"?/i.test(
        texte,
      ) ||
      /\$executeRaw(?:Unsafe)?[\s\S]{0,400}apporteurs_reseau/i.test(texte) ||
      /\$queryRaw(?:Unsafe)?[\s\S]{0,400}\b(?:update|insert|delete)\b[\s\S]{0,200}apporteurs_reseau/i.test(
        texte,
      )
    )
      sql.push(fichier);
    // Alias ou accès par crochets : `const f = prisma.apporteurReseau;`, `prisma["apporteurReseau"]`.
    for (const a of texte.matchAll(
      /(?:=\s*[\w.]*\.apporteurReseau\s*[;,\n]|\[\s*["']apporteurReseau["']\s*\])/g,
    ))
      appelsOpaques.push(`${fichier} : accès indirect à apporteurReseau (${a[0].trim()})`);
    // Écriture imbriquée par une relation : `{ apporteur: { update: { telephone … } } }`.
    for (const a of texte.matchAll(
      /\bapporteur\s*:\s*\{\s*(update|upsert|create|connectOrCreate)\s*:/g,
    )) {
      const reste = texte.slice(a.index ?? 0, (a.index ?? 0) + 600);
      if ([...reste.matchAll(CLES_COORDONNEES)].length > 0)
        appelsOpaques.push(`${fichier} : écriture imbriquée apporteur.${a[1]} sur une coordonnée`);
    }
  }
  return { ecritures, appelsOpaques, sql };
}

/**
 * LA LISTE FERMÉE. Chaque entrée dit POURQUOI elle est sans danger pour une demande ouverte.
 *   · créations : une fiche qui naît n'a pas de demande ouverte (§2.5) ;
 *   · étapes 1 et 2 du dossier : avant la signature (garde `dossierModifiableParLien`, statuts
 *     `dossier_en_cours` et `a_completer`), donc jamais pendant une demande, qui exige un dossier `signe` ;
 *   · effacement RGPD : efface, ne remplace pas.
 */
const ECRITURES_ATTENDUES: readonly EcritureCoordonnee[] = [
  {
    fichier: "src/features/apporteurs-reseau/donnees.ts",
    appel: "create",
    cles: ["email", "emailHash", "telephone"],
  },
  {
    fichier: "src/features/apporteurs-reseau/verification.ts",
    appel: "create",
    cles: ["email", "emailHash", "telephone"],
  },
  { fichier: "src/features/apporteurs-reseau/donnees.ts", appel: "update", cles: ["telephone"] }, // enregistrerCoordonnees (étape 1)
  { fichier: "src/features/apporteurs-reseau/donnees.ts", appel: "update", cles: ["telephone"] }, // enregistrerActivite (étape 2, avant signature)
  { fichier: "src/lib/rgpd-erase.ts", appel: "update", cles: ["telephone"] },
  { fichier: "src/lib/rgpd-erase.ts", appel: "update", cles: ["email", "emailHash", "telephone"] },
];

const cle = (e: EcritureCoordonnee) => `${e.fichier} · ${e.appel} · ${e.cles.join("+")}`;

describe("les coordonnées de la fiche (e-mail, téléphone) ne changent que par la liste fermée des écrivains", () => {
  const sources = [
    ...fichiers(path.join(RACINE, "src")),
    ...fichiers(path.join(RACINE, "scripts")),
  ].map((p) => ({
    fichier: rel(p),
    texte: readFileSync(p, "utf8"),
  }));
  const lues = lireEcritures(sources);

  it("🔴 aucune écriture d'adresse ou de téléphone hors de la liste fermée", () => {
    expect(lues.ecritures.map(cle).sort()).toEqual(ECRITURES_ATTENDUES.map(cle).sort());
  });

  it("🔴 aucune forme que l'analyse ne sait pas lire (data par variable, clé calculée)", () => {
    expect(lues.appelsOpaques).toEqual([]);
  });

  it("🔴 aucune écriture en SQL brut de la table des fiches", () => {
    expect(lues.sql).toEqual([]);
  });

  it("l'adresse (email, emailHash) n'est écrite que par les créations et l'effacement : jamais un `update` de la fiche", () => {
    const adresses = lues.ecritures.filter((e) =>
      e.cles.some((k) => k === "email" || k === "emailHash"),
    );
    for (const e of adresses) {
      const permis =
        (e.appel === "create" && /(donnees|verification)\.ts$/.test(e.fichier)) ||
        (e.appel === "update" && e.fichier === "src/lib/rgpd-erase.ts");
      expect(permis, cle(e)).toBe(true);
    }
  });

  it("contre-témoins : une écriture fictive fait rougir l'analyse", () => {
    const fictives = lireEcritures([
      {
        fichier: "src/x/modifier-adresse.ts",
        texte:
          "await prisma.apporteurReseau.update({ where: { id }, data: { email: chiffre(nouvelle), emailHash: h } });",
      },
      {
        fichier: "src/x/tel.ts",
        texte: "await tx.apporteurReseau.updateMany({ where, data: { telephone: null } })",
      },
      {
        fichier: "src/x/tel-hash.ts",
        texte:
          "await tx.apporteurReseau.upsert({ where, update: {}, create: { telephoneHash: h } })",
      },
      {
        fichier: "src/x/opaque.ts",
        texte: "await prisma.apporteurReseau.update({ where, data: charge })",
      },
      {
        fichier: "src/x/calcule.ts",
        texte: "await prisma.apporteurReseau.update({ where, data: { [champ]: v } })",
      },
      {
        fichier: "src/x/sql.ts",
        texte: 'await prisma.$executeRaw`UPDATE "apporteurs_reseau" SET email = ${e}`',
      },
    ]);
    expect(fictives.ecritures.map(cle)).toEqual(
      expect.arrayContaining([
        "src/x/modifier-adresse.ts · update · email+emailHash",
        "src/x/tel.ts · updateMany · telephone",
        "src/x/tel-hash.ts · upsert · telephoneHash",
      ]),
    );
    expect(fictives.appelsOpaques).toHaveLength(2);
    expect(fictives.sql).toEqual(["src/x/sql.ts"]);
  });

  it("contre-témoins : les formes détournées sont refusées comme opaques ou lues", () => {
    const l = lireEcritures([
      {
        fichier: "src/y/alias.ts",
        texte: "const f = prisma.apporteurReseau;\nawait f.update({ data: { email } });",
      },
      {
        fichier: "src/y/crochets.ts",
        texte: 'await prisma["apporteurReseau"].update({ data: { email: x } });',
      },
      {
        fichier: "src/y/dispersion.ts",
        texte: "await prisma.apporteurReseau.update({ where, data: { ...patch } });",
      },
      {
        fichier: "src/y/abrege.ts",
        texte: "await prisma.apporteurReseau.update({ where, data });",
      },
      {
        fichier: "src/y/upsert.ts",
        texte: "await prisma.apporteurReseau.upsert({ where, create: c, update: u });",
      },
      {
        fichier: "src/y/guillemets.ts",
        texte: 'await prisma.apporteurReseau.update({ where, data: { "email": x } });',
      },
      {
        fichier: "src/y/imbrique.ts",
        texte:
          "await prisma.pieceApporteur.update({ data: { apporteur: { update: { telephone: null } } } });",
      },
      {
        fichier: "src/y/sql-only.ts",
        texte: "await prisma.$executeRawUnsafe(`UPDATE ONLY apporteurs_reseau SET x = 1`);",
      },
      {
        fichier: "src/y/sql-variable.ts",
        texte: "await prisma.$executeRawUnsafe(`UPDATE ${t} SET x = 1`, 'apporteurs_reseau');",
      },
    ]);
    const opaques = l.appelsOpaques.join("\n");
    expect(opaques).toContain("src/y/alias.ts");
    expect(opaques).toContain("src/y/crochets.ts");
    expect(opaques).toContain("src/y/dispersion.ts");
    expect(opaques).toContain("src/y/upsert.ts");
    expect(opaques).toContain("src/y/abrege.ts");
    expect(opaques).toContain("src/y/imbrique.ts");
    expect(l.ecritures.map(cle)).toContain("src/y/guillemets.ts · update · email");
    expect(l.sql).toEqual(expect.arrayContaining(["src/y/sql-only.ts", "src/y/sql-variable.ts"]));
  });

  it("une écriture qui ne touche aucune coordonnée n'est pas comptée (retrait, résiliation, nom…)", () => {
    const l = lireEcritures([
      {
        fichier: "src/x/a.ts",
        texte: "await prisma.apporteurReseau.update({ where: { id }, data: { noteInterne: n } })",
      },
    ]);
    expect(l.ecritures).toEqual([]);
  });
});

// ── §2.6 : aucune IA ne touche l'IBAN ────────────────────────────────────────────────────────────────────────────

/** Les fichiers du chemin du changement d'IBAN, par leur NOM (ils naissent aux lots 4 à 6). */
export function estDuCheminIban(chemin: string): boolean {
  const nom = chemin.split("/").pop() ?? "";
  return (
    /^changement-iban.*\.tsx?$/.test(nom) ||
    /^jeton-changement-iban\.tsx?$/.test(nom) ||
    /^actions-changement-iban\.tsx?$/.test(nom) ||
    /^actions-compte\.tsx?$/.test(nom) ||
    /^MonCompteBancaire\.tsx?$/.test(nom) ||
    /^controle-iban.*\.tsx?$/.test(nom) ||
    chemin.includes("/apporteurs/changements-de-compte/") ||
    chemin.includes("/apporteur/dossier/compte/") ||
    // lot 6 : les blocs de la fiche console dédiés au compte bancaire et à la décision
    /\/components\/admin\/apporteurs\/.*(?:Compte|ChangementIban|DecisionIban)[^/]*\.tsx?$/.test(
      chemin,
    )
  );
}

/** Ce qu'aucun module du chemin n'importe : appel de modèle, agent de navigateur, extraction de document. */
const IMPORTS_INTERDITS =
  /(?:from\s+|import\s*\(\s*|require\s*\(\s*)["']([^"']*(?:anthropic|openai|claude|\bllm\b|-llm|llm-|content-gen|chatbot|genai|generative-ai|langchain|ai-sdk|perplexity|voyage|playwright|puppeteer|tesseract|pdf-parse|pdfjs-dist|pdf2json|image-bank|observatoire\/analysis)[^"']*|ai)["']/gi;

/** Les hôtes d'API de modèle, dans le texte (un `fetch` direct contournerait les imports). */
const HOTES_MODELE =
  /api\.(?:anthropic|openai|perplexity|voyageai|mistral)\.|generativelanguage\.googleapis/i;

export function importsInterdits(texte: string): string[] {
  const hotes = HOTES_MODELE.exec(texte);
  return [
    ...[...texte.matchAll(IMPORTS_INTERDITS)].map((m) => m[1] as string),
    ...(hotes ? [`hôte d'API de modèle ${hotes[0]}`] : []),
  ];
}

describe("aucune saisie, lecture ni devinette d'IBAN par un assistant d'IA (§2.6)", () => {
  const tous = [...fichiers(path.join(RACINE, "src"))].map(rel);
  const chemin = tous.filter(estDuCheminIban);

  it("les modules du chemin n'importent aucun appel de modèle, agent de navigateur ni extraction de document", () => {
    const fautes = chemin.flatMap((f) =>
      importsInterdits(readFileSync(path.join(RACINE, f), "utf8")).map((i) => `${f} importe ${i}`),
    );
    expect(fautes).toEqual([]);
  });

  it("le repérage des fichiers du chemin reconnaît les noms du plan", () => {
    for (const f of [
      "src/features/apporteurs-reseau/changement-iban.ts",
      "src/features/apporteurs-reseau/changement-iban-regles.ts",
      "src/features/apporteurs-reseau/jeton-changement-iban.ts",
      "src/features/apporteurs-reseau/actions-changement-iban.ts",
      "src/app/apporteur/dossier/[id]/[jeton]/actions-compte.ts",
      "src/app/apporteur/dossier/[id]/[jeton]/MonCompteBancaire.tsx",
      "src/app/apporteur/dossier/compte/[demande]/[signature]/page.tsx",
      "src/app/[locale]/(admin)/[adminPrefix]/apporteurs/changements-de-compte/page.tsx",
    ]) {
      expect(estDuCheminIban(f), f).toBe(true);
    }
    expect(estDuCheminIban("src/features/apporteurs-reseau/donnees.ts")).toBe(false);
    // Le lot 1 existe déjà : la garde regarde au moins un vrai fichier.
    expect(chemin).toContain("src/features/apporteurs-reseau/changement-iban-regles.ts");
  });

  it("contre-témoins : chaque import interdit fait rougir la garde", () => {
    for (const source of [
      'import Anthropic from "@anthropic-ai/sdk";',
      'const A = (await import("@anthropic-ai/sdk")).default;',
      'import OpenAI from "openai";',
      'import { generateText } from "ai";',
      'import { x } from "@/server/content-gen/providers/anthropic";',
      'import { chromium } from "playwright";',
      'import Tesseract from "tesseract.js";',
      'const p = require("pdf-parse");',
      'import { chercher } from "@/server/clients/claude-search";',
      'import { x } from "@/server/visio/openai/client";',
      'import { y } from "../../server/content-gen/providers/anthropic";',
      'import { z } from "@/server/chatbot/engine";',
      'await fetch("https://api.anthropic.com/v1/messages");',
    ]) {
      expect(importsInterdits(source), source).not.toEqual([]);
    }
    expect(importsInterdits('import { prisma } from "@/lib/prisma";')).toEqual([]);
    expect(importsInterdits('import { ibanValide } from "@/lib/iban";')).toEqual([]);
    expect(importsInterdits('import { encryptPii } from "@/lib/pii-crypto";')).toEqual([]);
  });
});
