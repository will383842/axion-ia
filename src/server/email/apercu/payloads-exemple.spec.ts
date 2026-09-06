/**
 * L'aperçu affiche-t-il des gabarits COMPLETS, ou des gabarits troués ?
 *
 * ## Ce que ce fichier verrouille
 *
 * `PAYLOAD_EXEMPLE` est un objet unique qui alimente les 49 gabarits. Son
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
import { renderEmailTemplate, EMAIL_TEMPLATE_NAMES } from "@/lib/email/templates";

const DOSSIER = join(process.cwd(), "src", "lib", "email", "templates");

/** Les fichiers qui ne sont pas des gabarits : la mise en page et le registre. */
// Les fichiers préfixés `_` sont des fragments partagés (`_layout`,
// `_infos-pratiques-formateur`), pas des gabarits : la règle est le préfixe,
// pas une liste à tenir. `index` est le registre.
const NON_GABARITS = new Set(["index"]);

function gabarits(): ReadonlyArray<{ nom: string; source: string }> {
  return readdirSync(DOSSIER)
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => f.replace(/\.tsx$/, ""))
    .filter((n) => !NON_GABARITS.has(n) && !n.startsWith("_") && !n.endsWith(".spec"))
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
  // `bloc?.[1]` et non `bloc` seul : en mode strict, le groupe capturant est
  // `string | undefined`. Le tester ici évite deux assertions plus bas.
  if (!bloc?.[1]) return null;
  const champs: Array<{ nom: string; optionnel: boolean }> = [];
  for (const ligne of bloc[1].split("\n")) {
    const m = /^\s*(?:readonly\s+)?([A-Za-z_]\w*)(\??):/.exec(ligne);
    if (m?.[1]) champs.push({ nom: m[1], optionnel: m[2] === "?" });
  }
  return champs;
}

describe("le jeu de données d'exemple couvre tous les gabarits", () => {
  const tous = gabarits();

  it("lit bien les 51 gabarits — sinon la garde serait verte en ne regardant rien", () => {
    // 🔴 Le témoin qui distingue « rien à signaler » de « je n'ai rien lu ».
    // Si ce nombre change parce qu'un gabarit a été ajouté, mettre le chiffre à
    // jour est le bon geste — le baisser pour faire passer la garde ne l'est pas.
    expect(tous.length, "aucun gabarit lu : le dossier a changé de nom ?").toBeGreaterThan(0);
    // 47 sur `main` (le tunnel Facebook en a apporté deux) + `candidature-reponse`
    // apporté par ce lot. Le chiffre est relevé de la MESURE, jamais deviné : le
    // compter à la main aurait raté les gabarits arrivés sur `main` pendant que
    // cette branche vivait.
    // 🔴 2026-09-05 — RELEVÉ À 51, et le chemin pour y arriver mérite d'être
    // écrit : la garde était DÉJÀ ROUGE à 50 avant ce lot. `piece-exemplaire-signe`
    // (lot A) a été ajouté sans relever ce compteur ni déclarer son champ
    // `libellePiece` ci-dessous. Le rappel de la veille (ADR 0048 §4.3) fait le
    // 51ᵉ. Deux gabarits, un seul chiffre — c'est exactement ce que cette garde
    // existe pour attraper, et elle l'a attrapé.
    expect(tous.length).toBe(51);
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

  /**
   * L'aperçu RENDU, pas seulement les champs déclarés.
   *
   * 🔴 La garde au-dessus vérifie qu'aucun champ requis ne MANQUE. Elle ne dit
   * rien de son TYPE — et c'est par là que le défaut est passé : `fteRecovered`
   * valait la chaîne « 0,4 ETP », `savedEurPerYear` la chaîne « 18 000 € », et
   * `roi-report` les passe à `Intl.NumberFormat`. La console affichait donc,
   * en toutes lettres, « 320 heures par an, soit NaN temps plein récupéré » et
   * « Votre estimation : 0 € par an ».
   *
   * Trois autres s'y ajoutaient : « [INFO] Alerte Qualiopi — undefined » faute
   * de `titre`/`code`/`niveau`, et « valable jusqu'au valable jusqu'au 30
   * septembre 2026 » parce que le libellé de date portait déjà la phrase que le
   * gabarit écrit lui-même.
   *
   * Aucun test ne les voyait : ils se lisaient à l'œil, dans la console. On
   * rend donc TOUS les aperçus du registre pour de vrai, et on refuse les trous.
   *
   * ⚠️ « du registre », pas « des fichiers » : `EMAIL_TEMPLATE_NAMES` en compte
   * DEUX de plus que le dossier n'a de fichiers — deux noms partagent le
   * composant d'un autre gabarit. Le chiffre était écrit en dur ici, et il
   * désignait le registre pendant que l'assertion voisine comptait les
   * fichiers : deux ensembles différents sous le même nombre.
   */
  it("aucun aperçu ne montre de trou (undefined, NaN, [object Object])", async () => {
    const troues: string[] = [];
    for (const nom of EMAIL_TEMPLATE_NAMES) {
      const r = await renderEmailTemplate(nom, "fr", { ...PAYLOAD_EXEMPLE });
      const visible = `${r.subject} ${r.text}`;
      const trous = ["undefined", "NaN", "[object Object]"].filter((t) => visible.includes(t));
      if (trous.length > 0) troues.push(`${nom} → ${trous.join(", ")}`);
    }
    expect(
      troues,
      "un aperçu de la console affiche un trou : c'est la première chose que " +
        "Will voit du gabarit, et un « NaN » y discrédite tout le reste.",
    ).toEqual([]);
    // Rendre tout le registre dépasse les 5 s par défaut de Vitest.
  }, 60_000);

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
