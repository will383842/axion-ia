/**
 * `<AdminTable>` et `.admin-table` doivent rendre le même tableau.
 *
 * ## Le défaut mesuré (2026-09-06, en PRODUCTION)
 *
 * La console rend ses listes de TROIS façons : le composant `<AdminTable>`
 * (51 fichiers), la classe `.admin-table` (32 fichiers), et à la main
 * (51 fichiers). Relevé au navigateur sur deux écrans voisins :
 *
 * | | « Utilisateurs » (`<AdminTable>`) | « Sessions » (à la main) | `.admin-table` |
 * |---|---|---|---|
 * | police du corps | **16 px** | 13 px | **13 px** |
 * | chiffres | `normal` | `normal` | **`tabular-nums`** |
 *
 * Deux listes de la même console, **23 % d'écart** de taille de texte. Et
 * aucune des deux ne posait `tabular-nums` : les colonnes de nombres —
 * montants, taux, effectifs — ne s'alignaient pas verticalement, ce qui est
 * exactement le défaut que `.admin-table` avait été écrite pour corriger.
 *
 * 🔑 **La cause n'est pas une faute de frappe, c'est une DUPLICATION.**
 * `AdminTable.tsx` ne compose pas `.admin-table` : il réimplémente le rendu
 * avec des utilitaires Tailwind. Le composant porte même, sur le fond de sa
 * ligne d'en-tête, le commentaire « Aligné sur `.admin-table` » — une propriété
 * recopiée à la main, et les autres oubliées. C'est le contraire de ce que fait
 * `AdminButton`, qui compose `.admin-button` et ne peut donc pas dériver.
 *
 * ## Pourquoi ce test plutôt que la fusion des deux
 *
 * Fusionner pour de bon — poser `class="admin-table"` sur le composant et
 * retirer ses utilitaires — est la bonne cible, mais `.admin-table` est HORS
 * COUCHE : elle écraserait d'un coup les paddings et l'en-tête des 51 écrans
 * qui passent par le composant, en laissant derrière une pile d'utilitaires
 * morts que la garde des jetons ne voit pas (elle compare classe et utilitaire
 * sur le MÊME élément ; ici la classe serait sur `<table>` et les utilitaires
 * sur `<th>`/`<td>`). Cette bascule se fait **en la regardant**, pas à l'aveugle.
 *
 * En attendant, ce test verrouille les deux propriétés qui DIVERGEAIENT
 * vraiment, et il les **dérive de `admin.css`** au lieu de les recopier : si
 * quelqu'un change la police de `.admin-table`, c'est ce test qui l'apprend au
 * composant, pas une relecture.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

const RACINE = process.cwd();
const ADMIN_CSS = join(RACINE, "src/app/admin.css");
const ADMIN_TABLE = join(RACINE, "src/components/admin/ui/AdminTable.tsx");

/** Le corps de la règle `.admin-table { … }`, commentaires retirés. */
function regleAdminTable(): string {
  const css = readFileSync(ADMIN_CSS, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const debut = css.indexOf(".admin-table {");
  expect(debut, "la règle `.admin-table` a disparu d'admin.css").toBeGreaterThan(-1);
  const fin = css.indexOf("}", debut);
  return css.slice(debut, fin);
}

/** La ligne `<table className="…">` du composant. */
function classeDuTableau(): string {
  const src = readFileSync(ADMIN_TABLE, "utf8");
  const m = src.match(/<table className="([^"]*)"/);
  expect(m, '`<table className="…">` introuvable dans AdminTable.tsx').not.toBeNull();
  return (m as RegExpMatchArray)[1] as string;
}

describe("AdminTable ne diverge pas de .admin-table", () => {
  it("🔑 CONTRE-TÉMOIN : les deux sources sont réellement lues", () => {
    // Sans ceci, un fichier renommé rendrait des chaînes vides et les deux
    // tests suivants passeraient au vert sans avoir comparé quoi que ce soit.
    expect(regleAdminTable().length, "la règle `.admin-table` lue est vide").toBeGreaterThan(40);
    expect(classeDuTableau().length, "le className du <table> lu est vide").toBeGreaterThan(10);
  });

  it("rend le corps du tableau à la MÊME taille que la classe", () => {
    const jeton = regleAdminTable().match(/font-size:\s*var\((--text-admin-[a-z0-9]+)\)/);
    expect(jeton, "`.admin-table` ne fixe plus sa taille par un jeton").not.toBeNull();
    const attendu = (jeton as RegExpMatchArray)[1] as string;
    expect(
      classeDuTableau(),
      `🔴 « <AdminTable> » ne rend plus son corps à la taille de « .admin-table » (${attendu}).\n` +
        "\n" +
        "   Les deux écritures produisent des listes dans la MÊME console : si\n" +
        "   elles ne s'accordent pas sur la taille du texte, deux écrans voisins\n" +
        "   n'ont pas la même densité — c'est ce qui a été mesuré en production le\n" +
        "   2026-09-06 (16 px contre 13 px).\n" +
        "\n" +
        `   Remède : poser \`text-[length:var(${attendu})]\` sur le <table> du composant,\n` +
        "   ou — meilleur — lui faire composer `.admin-table` et retirer ses utilitaires.",
    ).toContain(`text-[length:var(${attendu})]`);
  });

  it("aligne les colonnes de nombres, comme la classe", () => {
    expect(
      regleAdminTable(),
      "`.admin-table` ne pose plus `tabular-nums` — vérifier que c'est voulu avant de " +
        "relâcher ce test, les colonnes de montants en dépendent",
    ).toContain("font-variant-numeric: tabular-nums");
    expect(
      classeDuTableau(),
      "🔴 « <AdminTable> » ne pose pas `tabular-nums`.\n" +
        "\n" +
        "   Sans lui, les chiffres n'ont pas tous la même chasse : une colonne de\n" +
        "   montants, de taux ou d'effectifs ne s'aligne pas verticalement, et\n" +
        "   comparer deux lignes d'un coup d'œil devient impossible.",
    ).toContain("[font-variant-numeric:tabular-nums]");
  });
});
