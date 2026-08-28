/**
 * L'aperçu affiche-t-il des gabarits COMPLETS, ou des gabarits troués ?
 *
 * ## Ce que ce fichier verrouille
 *
 * `PAYLOAD_EXEMPLE` est un objet unique qui alimente les 42 gabarits. Son
 * intérêt — un seul endroit à maintenir — est aussi son risque : rien n'oblige
 * un gabarit neuf à y trouver ses champs. Il rendrait alors un aperçu à trous,
 * et **personne ne le verrait**, puisqu'un `undefined` ne casse pas React, il
 * disparaît.
 *
 * ## 🔑 La garde est DÉRIVÉE, pas recopiée
 *
 * Elle ne porte aucune liste de champs. Elle relit les fichiers de gabarits,
 * en extrait les interfaces `Payload`, et confronte chaque champ NON optionnel
 * à l'objet. Un champ renommé, un gabarit ajouté, un `?` retiré : elle rougit
 * toute seule.
 *
 * ⚠️ C'est le contraire du motif qui a produit les trois oranges divergents de
 * ce dépôt — une valeur recopiée que rien ne reliait plus à sa source.
 *
 * ## Le compte est asserté, pas supposé
 *
 * Une garde qui parcourt des fichiers peut devenir verte en n'en lisant AUCUN :
 * mauvais dossier, glob qui ne matche plus, extension changée. Le nombre de
 * gabarits lus est donc vérifié explicitement — c'est le témoin qui distingue
 * « rien à signaler » de « je n'ai rien regardé ».
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PAYLOAD_EXEMPLE } from "./payloads-exemple";

const DOSSIER = join(process.cwd(), "src", "lib", "email", "templates");

/** Les fichiers qui ne sont pas des gabarits : la mise en page et le registre. */
const NON_GABARITS = new Set(["_layout", "index"]);

function gabarits(): ReadonlyArray<{ nom: string; source: string }> {
  return readdirSync(DOSSIER)
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => f.replace(/\.tsx$/, ""))
    .filter((n) => !NON_GABARITS.has(n) && !n.endsWith(".spec"))
    .map((nom) => ({ nom, source: readFileSync(join(DOSSIER, `${nom}.tsx`), "utf8") }));
}

/**
 * Les champs déclarés par l'interface `Payload` d'un gabarit.
 *
 * Rend `null` quand aucune interface n'est trouvée — un gabarit peut
 * légitimement n'en avoir aucune (payload vide). On distingue ce cas de
 * « interface trouvée mais vide », qui serait suspect.
 */
function champsDeclares(source: string): ReadonlyArray<{ nom: string; optionnel: boolean }> | null {
  const bloc = /(?:interface|type)\s+\w*Payload\w*\s*(?:=\s*)?\{([\s\S]*?)\n\}/.exec(source);
  if (!bloc) return null;
  const champs: Array<{ nom: string; optionnel: boolean }> = [];
  for (const ligne of bloc[1].split("\n")) {
    const m = /^\s*(?:readonly\s+)?([A-Za-z_]\w*)(\??):/.exec(ligne);
    if (m) champs.push({ nom: m[1], optionnel: m[2] === "?" });
  }
  return champs;
}

describe("le jeu de données d'exemple couvre tous les gabarits", () => {
  const tous = gabarits();

  it("lit bien les 42 gabarits — sinon la garde serait verte en ne regardant rien", () => {
    // 🔴 Le témoin qui distingue « rien à signaler » de « je n'ai rien lu ».
    // Si ce nombre change parce qu'un gabarit a été ajouté, mettre le chiffre à
    // jour est le bon geste — le baisser pour faire passer la garde ne l'est pas.
    expect(tous.length, "aucun gabarit lu : le dossier a changé de nom ?").toBeGreaterThan(0);
    expect(tous.length).toBe(42);
  });

  it.each(tous.map((g) => g.nom))("%s : tous ses champs requis ont une valeur d'exemple", (nom) => {
    const g = tous.find((x) => x.nom === nom);
    const champs = champsDeclares(g!.source);
    if (champs === null) return; // pas d'interface Payload : rien à couvrir

    const requisManquants = champs
      .filter((c) => !c.optionnel)
      .filter((c) => !(c.nom in PAYLOAD_EXEMPLE))
      .map((c) => c.nom);

    expect(
      requisManquants,
      `« ${nom} » déclare ${requisManquants.join(", ")} sans valeur d'exemple : ` +
        `son aperçu s'afficherait troué, en silence. Ajoute ces champs à PAYLOAD_EXEMPLE.`,
    ).toEqual([]);
  });

  it("n'expose AUCUNE donnée réelle", () => {
    // Un aperçu de console qui afficherait un vrai prospect, ou un lien vers la
    // production, transformerait une page de documentation en fuite.
    const valeurs = Object.values(PAYLOAD_EXEMPLE)
      .filter((v): v is string => typeof v === "string")
      .join(" ");
    expect(valeurs, "un lien pointe vers la production").not.toMatch(/axion-ia\.com/);
    expect(valeurs, "une adresse e-mail réelle est utilisée").not.toMatch(
      /@(?!exemple\.invalid|example\.invalid)[\w.-]+\.(com|fr|net|org|eu)/,
    );
  });
});
