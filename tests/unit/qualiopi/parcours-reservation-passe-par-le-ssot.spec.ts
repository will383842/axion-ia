/**
 * 🛑 GARDE — TOUTE la console lit ses droits AU MÊME ENDROIT.
 *
 * ## Le défaut que cette garde ferme
 *
 * Mesuré le 2026-08-27. Le SSOT `@/server/auth/habilitations` décrivait qui
 * ÉCRIT et qui ENGAGE, jamais qui REGARDE. Chaque page tranchait donc seule :
 *
 * | | |
 * |---|---|
 * | pages `(admin)` | **305** |
 * | fermées par une liste de rôles ÉCRITE EN DUR | **~65** |
 * | passant par le SSOT | **0** |
 *
 * Et le résultat n'était pas un périmètre, c'était une dérive :
 * `/qualiopi/facturation` autorisait `["admin","super_admin","editor","reader"]`.
 * **`reader` voyait le hub de facturation ; `secretaire` non** — alors que le
 * SSOT écrit, en toutes lettres, qu'elle « gère le système ».
 *
 * C'est exactement le défaut du 2026-08-17 (`requireAdminWrite` testait une
 * liste en dur d'où `responsable_qualite` et `secretaire` étaient absents,
 * rendant les deux rôles inertes). La liste avait déménagé dans le SSOT « parce
 * qu'une liste de rôles écrite dans la garde est invisible depuis la matrice ».
 * **Le déménagement n'avait jamais été propagé aux pages.**
 *
 * ## 🔑 TROIS formes, pas une
 *
 * La bascule a dû en nommer trois, et la troisième a failli être oubliée :
 *
 * - `const role = session?.user?.role; if (role !== "admin" && …)` — dominante ;
 * - `const rolesAutorises = [...]; if (!rolesAutorises.includes(role ?? ""))` ;
 * - `if (!s?.user || (s.user.role !== "admin" && …))` — **sans variable
 *   intermédiaire**, 26 pages (`image-bank`, `presse`).
 *
 * Le premier script de bascule ne connaissait que les deux premières : il serait
 * passé au vert en migrant 43 pages sur 69. C'est le patron « une campagne ne
 * trouve que les formes qu'elle a NOMMÉES ». Les trois motifs vivent donc ici,
 * et cette garde rougit sur n'importe laquelle.
 *
 * ## Ce que cette garde vérifie — et ce qu'elle NE dit pas
 *
 * Que plus aucune page de la console ne porte de liste de rôles à elle. Elle ne
 * dit rien du PÉRIMÈTRE (qui a droit à quoi) : ça, c'est le SSOT qui le porte,
 * et c'est le sujet de ses propres tests.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = "src/app/[locale]/(admin)/[adminPrefix]";

/** Les trois formes de liste de rôles écrite à la main, vues dans le dépôt. */
const EN_DUR = [
  /role !== "admin" && role !== "super_admin"/,
  /\.user\.role !== "admin" && .*\.user\.role !== "super_admin"/,
  /const rolesAutorises = \[/,
];

// ⚠️ Deux pages n'ont volontairement PAS de garde : `/qualiopi/page.tsx` et
// `/qualiopi/conformite/page.tsx` sont des redirections pures, typées
// `Promise<never>`, qui ne rendent jamais rien. Y poser un écran de refus est un
// mensonge de type autant que de sens, et leur destination porte la garde. Le
// cliquet ci-dessous ne les réclame pas — il compte, il n'énumère pas.

function pages(racine: string): string[] {
  const sortie: string[] = [];
  const marche = (d: string): void => {
    for (const nom of readdirSync(d)) {
      const p = join(d, nom);
      if (statSync(p).isDirectory()) {
        marche(p);
        continue;
      }
      if (nom === "page.tsx") sortie.push(p);
    }
  };
  marche(join(process.cwd(), racine));
  return sortie;
}

const TOUTES = pages(RACINE);
const relatif = (p: string): string =>
  p.replace(process.cwd(), "").replace(/\\/g, "/").split("[adminPrefix]")[1] ?? p;

describe("🛑 la console lit ses droits dans le SSOT", () => {
  it("🔑 le balayage voit bien TOUTE la console", () => {
    // Le mode d'échec le plus fréquent d'une garde qui parcourt des dossiers,
    // c'est de ne rien parcourir — et de rester verte. (Ce dépôt l'a payé avec
    // un glob dont les crochets étaient lus comme une classe de caractères : la
    // garde scannait presque rien, en silence.)
    expect(
      TOUTES.length,
      "moins de 250 pages scannées : ce balayage ne mesure plus la console",
    ).toBeGreaterThan(250);
  });

  it("aucune page ne porte sa propre liste de rôles", () => {
    const fautives = TOUTES.filter((chemin) => {
      const source = readFileSync(chemin, "utf8");
      return EN_DUR.some((motif) => motif.test(source));
    }).map(relatif);

    expect(
      fautives,
      `Ces pages décident des droits toutes seules :\n  ${fautives.join("\n  ")}\n\n` +
        `Une liste de rôles écrite dans la page est invisible depuis la matrice : ` +
        `on peut donner à un rôle le droit d'attester sans voir qu'il ne peut même ` +
        `pas ouvrir l'écran. Passer par \`gardePage()\` et \`peutEngager()\`.`,
    ).toEqual([]);
  });

  it("🔑 CLIQUET — on ne supprime pas une garde, on la remplace", () => {
    // Sans ce témoin, supprimer purement et simplement les tests de rôle ferait
    // passer le premier au vert : « aucune liste en dur » serait vrai, et les
    // écrans seraient ouverts à qui n'a aucun rôle reconnu.
    //
    // 🔴 Pourquoi un CLIQUET et pas « toutes les pages » : mon premier jet
    // exigeait `gardePage()` sur les 305. Il rougissait sur **216 pages qui
    // n'ont JAMAIS porté de garde de rôle** — elles ne sont protégées que par
    // l'authentification, et c'est l'état d'origine de la console, pas une
    // régression de ce lot. Exiger leur migration, c'était réclamer 216
    // modifications mécaniques pour zéro gain : `peutConsulter` rend `true`
    // pour tous les rôles admin, donc la garde n'y changerait rien.
    //
    // ⚠️ Ce que ces 216 pages laissent ouvert, dit franchement : un compte
    // authentifié SANS rôle reconnu les atteint. `gardePage` le refuserait.
    // Le risque est faible (tout `AdminUser` porte un rôle) mais il n'est pas
    // nul, et personne ne doit lire ce test comme s'il le couvrait.
    const gardees = TOUTES.filter((c) => readFileSync(c, "utf8").includes("gardePage(")).length;
    expect(
      gardees,
      `Seulement ${gardees} pages passent par \`gardePage()\`, contre 89 au moment ` +
        `où ce cliquet a été posé. Une garde a été SUPPRIMÉE au lieu d'être ` +
        `remplacée — ou une page gardée a été retirée sans mettre ce chiffre à jour.`,
    ).toBeGreaterThanOrEqual(89);
  });

  it("🔑 les écrans de CRÉATION gardés le sont en ÉCRITURE", () => {
    // `reader` est le seul rôle absent de `ROLES_ECRITURE`. Un écran `/new` ou
    // `/edit` ouvert en « consultation » lui promettrait un formulaire dont
    // toutes les actions échoueraient — la promesse non tenue que P7 cherchait.
    //
    // ⚠️ Portée : les écrans de création qui ont une garde. 18 autres n'en ont
    // pas (état d'origine, cf. le cliquet ci-dessus) et ne sont pas couverts.
    const creation = TOUTES.filter((c) =>
      /\/(new|edit|upload|import|nouveau)\/page\.tsx$/.test(c.replace(/\\/g, "/")),
    ).filter((c) => readFileSync(c, "utf8").includes("gardePage("));

    // 🔑 Ce compteur est le contre-témoin, et mon premier jet l'avait écrit À
    // L'ENVERS : il assertait que la liste des MAL gardées était non vide — donc
    // il exigeait un défaut pour passer au vert.
    expect(
      creation.length,
      "aucun écran de création gardé : le balayage ne voit rien",
    ).toBeGreaterThan(8);

    const malGardees = creation
      .filter((c) => !readFileSync(c, "utf8").includes('gardePage("ecriture"'))
      .map(relatif);
    expect(
      malGardees,
      `Ces écrans créent ou modifient et ne sont pas gardés en écriture :\n  ${malGardees.join("\n  ")}`,
    ).toEqual([]);
  });
});
