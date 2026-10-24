/**
 * CLIQUET NOMINATIF — « rien ne part sans clic de Will » (ordre du 2026-10-24).
 *
 *   · seul `features/questionnaire-preaudit/envoyer.ts` met le gabarit en file ;
 *   · seule l'action « Envoyer » de la console appelle `envoyerQuestionnaire` ;
 *   · seuls `serveur.ts` (et l'effacement RGPD) écrivent dans les deux tables : si quelqu'un ajoute
 *     un autre chemin d'écriture, ce test rougit et dit lequel.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = path.resolve(__dirname, "../../../..");

function sources(dossier: string, sortie: string[] = []): string[] {
  for (const nom of readdirSync(dossier)) {
    if (nom === "node_modules" || nom === ".next" || nom === "generated") continue;
    const p = path.join(dossier, nom);
    if (statSync(p).isDirectory()) sources(p, sortie);
    else if (/\.(ts|tsx)$/.test(nom) && !/\.spec\.tsx?$/.test(nom)) sortie.push(p);
  }
  return sortie;
}

const FICHIERS = sources(path.join(RACINE, "src")).map((p) => ({
  rel: path.relative(RACINE, p).replace(/\\/g, "/"),
  src: readFileSync(p, "utf8"),
}));

describe("le questionnaire de pré-audit ne part que par un clic de Will", () => {
  it("un seul fichier met le gabarit en file", () => {
    const appelants = FICHIERS.filter((f) =>
      /enqueueEmail\(\s*"questionnaire-avant-audit"/.test(f.src),
    ).map((f) => f.rel);
    expect(appelants).toEqual(["src/features/questionnaire-preaudit/envoyer.ts"]);
  });

  it("seule l'action de la console appelle l'envoi", () => {
    const appelants = FICHIERS.filter(
      (f) =>
        /\benvoyerQuestionnaire\(/.test(f.src) &&
        f.rel !== "src/features/questionnaire-preaudit/envoyer.ts",
    ).map((f) => f.rel);
    expect(appelants).toEqual(["src/features/questionnaire-preaudit/actions.ts"]);
  });

  it("ni la file, ni le circuit visio, ni Calendly ne connaissent le questionnaire", () => {
    const intrus = FICHIERS.filter(
      (f) =>
        /^src\/server\/(queue|visio|calendly)\//.test(f.rel) &&
        /questionnaire-avant-audit|questionnaire-preaudit|questionnaireAvantAudit/i.test(f.src) &&
        f.rel !== "src/server/queue/types.ts" &&
        f.rel !== "src/server/visio/questionnaire-en-ligne/jeton.ts",
    ).map((f) => f.rel);
    expect(intrus).toEqual([]);
  });

  it("les écrivains des deux tables sont connus", () => {
    const ecrivains = FICHIERS.filter((f) =>
      /\.questionnaireAvantAudit(Envoi)?\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\b/.test(
        f.src,
      ),
    ).map((f) => f.rel);
    expect(ecrivains.sort()).toEqual([
      "src/features/questionnaire-preaudit/serveur.ts",
      "src/lib/rgpd-erase.ts",
    ]);
  });
});
