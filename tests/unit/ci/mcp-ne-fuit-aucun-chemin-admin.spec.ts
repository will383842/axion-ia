import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

/**
 * **LA GARDE QUI VÉRIFIE QUE LA GARDE MORD.**
 *
 * `pnpm admin-nav:routes-check` porte, depuis le lot 4a, une deuxième passe :
 * aucun fichier de l'adaptateur MCP ne doit contenir un chemin de console.
 * `ADMIN_URL_PREFIX` est un **segment de sécurité** — en production il vaut
 * quelque chose comme `admin-xxxxxxxx`, et c'est ce qui fait qu'un balayeur ne
 * trouve pas la console. Un outil MCP qui le recopierait dans une réponse le
 * ferait atterrir, un jour, dans une transcription ou l'écran de quelqu'un
 * d'autre.
 *
 * ═══ POURQUOI UN SOUS-PROCESSUS, ET PAS UN IMPORT ═══
 *
 * ⚠️ **CE QUE LA CI LIT, C'EST LE CODE DE SORTIE.** Un test qui importerait le
 *    script mesurerait un chargement de module, pas un échec de commande — et
 *    `| tail` masque le code de sortie dans un terminal, ce qui a déjà fait
 *    croire à une garde verte alors qu'elle rougissait. On lance donc la
 *    **commande réelle**, avec le même exécutable que la CI, et on affirme son
 *    code.
 *
 * ⚠️ **ET ON AFFIRME LES DEUX SENS.** Une garde qui rougit toujours est aussi
 *    inutile qu'une garde qui ne rougit jamais : le témoin retiré doit rendre
 *    le vert.
 */

const RACINE = resolve(__dirname, "../../..");
const DOSSIER_MCP = join(RACINE, "src/server/mcp");
const TEMOIN = join(DOSSIER_MCP, "__temoin-de-garde.ts");

/** Le dossier existait-il avant nous ? On ne détruit jamais le travail d'autrui. */
const dossierPreexistant = existsSync(DOSSIER_MCP);

function nettoyer(): void {
  if (existsSync(TEMOIN)) rmSync(TEMOIN);
  if (!dossierPreexistant && existsSync(DOSSIER_MCP)) {
    rmSync(DOSSIER_MCP, { recursive: true, force: true });
  }
}

afterEach(nettoyer);

/** Lance la vraie commande. Rend le code de sortie et la sortie fusionnée. */
function lancerLaGarde(): { code: number; sortie: string } {
  // ⚠️ `execSync` PLUTÔT QUE `execFileSync` : sur Windows, `npx` est un script
  //    shell, pas un exécutable — `execFileSync("npx", …)` ne le résout pas et
  //    rend un code -1 qu'on prendrait pour un échec de la garde. Le premier
  //    jet de ce fichier est tombé exactement dedans : quatre tests rouges qui
  //    ne mesuraient que l'impossibilité de démarrer le sous-processus.
  try {
    const sortie = execSync("npx tsx scripts/check-admin-nav-routes.ts", {
      cwd: RACINE,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, sortie };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    const sortie = `${err.stdout ?? ""}${err.stderr ?? ""}`;
    // Un code absent signifie que le PROCESSUS n'a pas démarré — ce n'est pas
    // un refus de la garde, et le confondre rendrait ce fichier menteur.
    if (err.status === undefined) {
      throw new Error(`le sous-processus n'a pas démarré du tout :
${sortie}`);
    }
    return { code: err.status, sortie };
  }
}

describe("admin-nav:routes-check refuse toute fuite de chemin d'administration", () => {
  it("rend 0 quand l'adaptateur MCP est propre — et ANNONCE combien de fichiers il a lus", () => {
    const { code, sortie } = lancerLaGarde();

    console.info(`[nav·mcp] propre → code ${String(code)}`);
    expect(code, `la garde devait passer sur un arbre propre.\n${sortie}`).toBe(0);

    // ⚠️ SANS CE COMPTE, UN ADAPTATEUR RANGÉ AILLEURS REND LA GARDE MUETTE.
    //    Elle serait verte en n'ayant rien lu, et personne ne le saurait.
    expect(sortie).toMatch(/fichier\(s\) d'adaptateur MCP lu\(s\)/);
    expect(sortie).toMatch(/motif\(s\) interdit\(s\) confronté\(s\)/);
  });

  it("rend 1 sur chacun des quatre motifs interdits, fabriqués un par un", () => {
    // Chaque témoin ne diffère d'un fichier légitime que par UNE expression.
    // Une garde qui n'en attraperait que trois serait verte à 75 %.
    const temoins: readonly [string, string][] = [
      ["le préfixe d'administration", "export const p = ADMIN_URL_PREFIX;"],
      ["adminPath()", 'export const p = adminPath("fr", "contacts");'],
      ["detailHref", "export const p = { detailHref: 1 };"],
      ["un chemin écrit en dur", 'export const p = "/fr/admin-xyz/contacts";'],
    ];

    mkdirSync(DOSSIER_MCP, { recursive: true });

    for (const [nom, source] of temoins) {
      writeFileSync(TEMOIN, `// témoin\n${source}\n`, "utf8");
      const { code, sortie } = lancerLaGarde();
      expect(code, `« ${nom} » devait faire ÉCHOUER la garde.\n${sortie}`).toBe(1);
      expect(sortie).toMatch(/fuite\(s\) de chemin d'administration/);
    }

    console.info(`[nav·mcp] ${String(temoins.length)} témoin(s) fabriqué(s), tous refusés`);
  });

  it("redevient verte dès que le témoin est retiré — une garde qui rougit toujours ne mesure rien", () => {
    mkdirSync(DOSSIER_MCP, { recursive: true });
    writeFileSync(TEMOIN, "export const p = ADMIN_URL_PREFIX;\n", "utf8");
    expect(lancerLaGarde().code).toBe(1);

    rmSync(TEMOIN);
    const { code, sortie } = lancerLaGarde();
    expect(code, `retirer le témoin devait rendre le vert.\n${sortie}`).toBe(0);
  });

  it("ne lit PAS les fichiers de test de l'adaptateur — ils citent les motifs pour les éprouver", () => {
    // Un test de l'adaptateur écrira forcément `detailHref` pour vérifier qu'il
    // est absent. Le compter comme une fuite rendrait la garde impossible à
    // satisfaire, donc, tôt ou tard, désarmée.
    const dossierTests = join(DOSSIER_MCP, "__tests__");
    mkdirSync(dossierTests, { recursive: true });
    const fichierTest = join(dossierTests, "exemple.spec.ts");
    writeFileSync(fichierTest, 'export const p = ADMIN_URL_PREFIX + "detailHref";\n', "utf8");

    const { code, sortie } = lancerLaGarde();
    expect(code, `un fichier de test ne doit pas compter pour une fuite.\n${sortie}`).toBe(0);

    rmSync(dossierTests, { recursive: true, force: true });
  });
});
