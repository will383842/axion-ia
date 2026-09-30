/**
 * ADR 0060 — AUCUNE ÉCRITURE SUR UN DOSSIER DE SESSION N'ÉCHAPPE AU REGISTRE.
 *
 * Analyse statique des modules `"use server"` de `src/server/actions/qualiopi/**` :
 * toute action exportée dont le corps écrit (create, update, upsert, delete…)
 * sur `trainingSession`, `sessionJour`, `enrollment`, `presenceCreneau`,
 * `emargement*`, `evaluation*`, `questionnaire`, `documentGenere`,
 * `documentSignature` ou `sessionFormateur` DOIT figurer dans
 * `ECRITURES_SESSION`. Une nouvelle action non classée fait rougir ce test :
 * c'est exactement la porte qu'on oublierait de fermer.
 *
 * Et réciproquement : chaque entrée du registre désigne une action qui EXISTE
 * dans le fichier nommé — une entrée périmée garderait une porte qui n'existe
 * plus, pendant que la vraie resterait ouverte.
 *
 * ⚠️ Limite assumée, écrite ici plutôt que tue : une action qui délègue
 * l'écriture à un service (les `generer*` passent par `generateDocument`) n'est
 * pas vue par l'analyse — c'est pourquoi le registre les liste à la main, et
 * pourquoi `ecritures-refusees-dossier-clos.spec.ts` appelle chacune.
 */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { ECRITURES_SESSION } from "../verrou-dossier-registre";

const RACINE = join(process.cwd(), "src", "server", "actions", "qualiopi");

const MODELES =
  "trainingSession|sessionJour|enrollment|presenceCreneau|emargement\\w*|evaluation\\w*|questionnaire|documentGenere|documentSignature|sessionFormateur";
const ECRITURE = new RegExp(
  `\\b(?:prisma|tx|client|db)\\s*\\.\\s*(${MODELES})\\s*\\.\\s*(create|createMany|update|updateMany|upsert|delete|deleteMany)\\b`,
  "g",
);

function modules(dossier: string): string[] {
  const out: string[] = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) out.push(...modules(chemin));
    else if (nom.endsWith(".ts") && !/\.(spec|test)\.ts$/.test(nom)) out.push(chemin);
  }
  return out;
}

interface ActionExportee {
  fichier: string;
  action: string;
  ecritures: string[];
}

/** Les actions exportées de chaque module `"use server"`, avec leurs écritures directes. */
function actionsExportees(racine: string = RACINE): ActionExportee[] {
  const out: ActionExportee[] = [];
  for (const chemin of modules(racine)) {
    const source = readFileSync(chemin, "utf-8");
    if (!/^\s*["']use server["'];?/m.test(source)) continue;
    const fichier = relative(racine, chemin).replace(/\\/g, "/");
    const debuts = [...source.matchAll(/^export\s+(?:async\s+)?function\s+(\w+)/gm)];
    debuts.forEach((m, i) => {
      const fin = debuts[i + 1]?.index ?? source.length;
      const corps = source.slice(m.index ?? 0, fin);
      const ecritures = [...corps.matchAll(ECRITURE)].map((e) => `${e[1]}.${e[2]}`);
      out.push({ fichier, action: m[1] as string, ecritures: [...new Set(ecritures)] });
    });
  }
  return out;
}

describe("registre des écritures sur un dossier de session — exhaustif", () => {
  const exportees = actionsExportees();
  const cle = (f: string, a: string): string => `${f}#${a}`;
  const classees = new Set(ECRITURES_SESSION.map((e) => cle(e.fichier, e.action)));

  it("l'analyse voit bien les modules d'actions (témoin)", () => {
    expect(exportees.length).toBeGreaterThan(200);
    const ecrivains = exportees.filter((e) => e.ecritures.length > 0);
    expect(ecrivains.length).toBeGreaterThan(15);
    expect(ecrivains.map((e) => e.action)).toContain("setSessionDatesAction");
  });

  it("🔴 toute action qui écrit sur un dossier de session est classée au registre", () => {
    const nonClassees = exportees
      .filter((e) => e.ecritures.length > 0 && !classees.has(cle(e.fichier, e.action)))
      .map((e) => `${e.fichier}#${e.action} (${e.ecritures.join(", ")})`);
    expect(
      nonClassees,
      "à classer dans src/server/qualiopi/sessions/verrou-dossier-registre.ts (verrou, ouverte ou entrante)",
    ).toEqual([]);
  });

  it("chaque entrée du registre désigne une action qui existe dans son fichier", () => {
    const presentes = new Set(exportees.map((e) => cle(e.fichier, e.action)));
    const perimees = ECRITURES_SESSION.filter((e) => !presentes.has(cle(e.fichier, e.action))).map(
      (e) => cle(e.fichier, e.action),
    );
    expect(perimees).toEqual([]);
  });

  it("aucune action n'est classée deux fois", () => {
    const noms = ECRITURES_SESSION.map((e) => cle(e.fichier, e.action));
    expect(new Set(noms).size).toBe(noms.length);
  });

  it("chaque entrée porte une raison lisible", () => {
    for (const e of ECRITURES_SESSION) {
      expect(e.raison.trim().length, e.action).toBeGreaterThan(15);
    }
  });

  it("contre-témoin : une écriture ajoutée à une action non classée est vue", () => {
    const faux = `"use server";\nexport async function nouvelleAction() {\n  await prisma.enrollment.update({ where: { id }, data: {} });\n}\n`;
    const ecritures = [...faux.matchAll(ECRITURE)].map((e) => `${e[1]}.${e[2]}`);
    expect(ecritures).toEqual(["enrollment.update"]);
  });
});
