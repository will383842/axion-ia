/**
 * 🔴 UN COMPTEUR QUI S'ARRÊTE AU SERVEUR NE PRÉVIENT PERSONNE.
 *
 * ## Ce qui s'est passé, et je l'ai constaté sur la PROD
 *
 * #1010 a réparé un défaut réel : une alerte déjà ouverte gardait pour toujours
 * le titre écrit le jour de sa création, même après correction de la règle qui
 * la produit. Le moteur relit désormais les lignes ouvertes et remet à jour
 * titre, message et niveau. Il compte ce qu'il réécrit, dans `rafraichies`, et
 * son commit promettait :
 *
 *     « un rafraîchissement muet ne prévient personne qu'un texte a changé sous
 *       les yeux du lecteur »
 *
 * 🔑 **Et il restait muet là où ça compte.** `synchroniserAlertesAction` ne
 * rendait que `{ crees, resolues }` : le compteur mourait dans la couche action,
 * avant d'atteindre l'écran. Constaté le 2026-09-06 en cliquant « Synchroniser »
 * sur la console de production — le bandeau annonçait « 1 créée, 0 résolues », et
 * pas un mot sur ce qui venait d'être réécrit.
 *
 * Le défaut était donc le MÊME que celui que #1010 corrigeait, d'un cran plus
 * haut : on répare le mécanisme, on oublie la surface qui le donne à lire.
 *
 * ## Pourquoi ça vaut une garde, et pas juste une correction
 *
 * Un texte qui change sous les yeux de quelqu'un **sans que rien ne le dise**
 * est pire qu'un texte périmé : le lecteur croit relire ce qu'il avait déjà lu,
 * et il ne relit pas. C'est exactement le mécanisme que le catalogue redoute —
 * « une alerte qui nomme une cause fausse déplace l'attention ».
 *
 * ⚠️ Cette garde surveille une CHAÎNE, pas un fichier : le service compte, la
 * Server Action transporte, l'écran affiche. Casser n'importe lequel des trois
 * maillons rend le compteur muet sans qu'aucun test de fichier ne rougisse —
 * c'est précisément par là que le défaut est passé.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = process.cwd();

function lire(relatif: string): string {
  return readFileSync(join(RACINE, ...relatif.split("/")), "utf8");
}

const SERVICE = lire("src/server/qualiopi/alertes/alertes-service.ts");
const ACTION = lire("src/server/actions/qualiopi/alertes.ts");
const ECRAN = lire("src/components/admin/qualiopi/AlerteActions.tsx");

describe("🔴 le compteur de rafraîchissement va du moteur jusqu'à l'écran", () => {
  it("1/3 — le MOTEUR compte ce qu'il réécrit", () => {
    // Témoin de prémisse : sans ce maillon, les deux suivants transportent et
    // affichent un nombre qui n'existe pas.
    expect(
      SERVICE,
      "`synchroniserAlertes` ne rend plus `rafraichies` : le moteur ne compte " +
        "plus les libellés qu'il remet à jour, et toute la chaîne est sans objet.",
    ).toContain("rafraichies");
  });

  it("2/3 — la SERVER ACTION le transporte", () => {
    const depart = ACTION.indexOf("export async function synchroniserAlertesAction");
    expect(depart, "`synchroniserAlertesAction` a disparu").toBeGreaterThan(-1);

    const corps = ACTION.slice(depart, depart + 1200);
    expect(
      corps,
      "`synchroniserAlertesAction` ne rend plus `rafraichies` : le compteur meurt " +
        "dans la couche action, exactement comme avant la correction du 2026-09-06. " +
        "L'écran ne peut plus rien en dire, et un texte change sous les yeux du " +
        "lecteur sans que rien ne l'annonce.",
    ).toContain("rafraichies");
  });

  it("3/3 — l'ÉCRAN l'affiche", () => {
    expect(
      ECRAN,
      "`AlerteActions` ne lit plus `rafraichies` dans le résultat de la " +
        "synchronisation : le nombre arrive au navigateur et personne ne le voit.",
    ).toContain("rafraichies");

    // Lu, ce n'est pas affiché. On exige la chaîne de rendu, pas seulement la
    // déstructuration — c'est la différence entre « la donnée est là » et « le
    // lecteur l'a sous les yeux ».
    expect(
      ECRAN,
      "le message de synchronisation ne rend plus le nombre de libellés mis à " +
        "jour : `rafraichies` est lu puis jeté.",
    ).toMatch(/libellé\$\{rafraichies !== 1/);
  });

  it("🔴 le nombre ne s'affiche QUE s'il est non nul", () => {
    // Décision de conception, pas de style. Le cas courant est zéro : afficher
    // « 0 libellé mis à jour » à chaque synchronisation ajouterait un mot que
    // personne ne lit, et le jour où il passe à 1 personne ne le verrait non
    // plus. Un compteur qui parle tout le temps ne dit plus rien quand il compte.
    expect(
      ECRAN,
      "le suffixe n'est plus conditionné à `rafraichies > 0` : le message " +
        "annoncerait « 0 libellé mis à jour » à chaque passage, et le signal se " +
        "noierait dans sa propre routine.",
    ).toContain("rafraichies > 0");
  });
});
