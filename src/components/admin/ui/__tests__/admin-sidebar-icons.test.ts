// Garde-fou des icônes de navigation de la console — refonte UI 2026-08-01
// (couche 4).
//
// POURQUOI CE TEST EXISTE
// -----------------------
// `ADMIN_NAV_ICONS` (`admin-nav-icons.ts`) est indexé par le LIBELLÉ de l'entrée
// de navigation, pas par sa route. Un libellé qui change dans la SSOT
// (`src/lib/admin-nav.ts`) ne casse donc rien bruyamment : l'entrée retombe
// sur `FolderOpen`, l'icône dossier générique, et personne ne le voit passer
// en revue de diff.
//
// C'est exactement ainsi que la barre latérale s'est dégradée : au 2026-08-01,
// `ADMIN_NAV_ICONS` couvrait 41 libellés pour 136, soit **100 des 145 entrées rendues
// avec la même icône**. « Sessions », « Stagiaires », « Audits IA »,
// « Clients (CRM) » et « Devis » étaient visuellement identiques — une icône
// qui ne distingue rien ne sert à rien. L'audit a aussi trouvé 4 clés MORTES
// (« Soumissions », « Contacts & messages », « Générateur contenus »,
// « Bookmark »), vestiges de renommages passés : la dérive va dans les deux
// sens.
//
// Ce test verrouille les deux directions.
//
// QUE FAIRE SI CE TEST ÉCHOUE
// ---------------------------
// - « libellé sans icône » → vous avez ajouté ou renommé une entrée de
//   navigation : ajoutez sa ligne dans `ADMIN_NAV_ICONS`, dans le bloc de son groupe.
//   Choisissez une icône qui la distingue de ses voisines, jamais un doublon
//   d'une entrée du même groupe.
// - « clé morte » → vous avez renommé/supprimé une entrée : mettez à jour ou
//   retirez la ligne correspondante de `ADMIN_NAV_ICONS`.
//
// Le test lit le SOURCE du registre plutôt que d'importer l'objet : c'est le
// seul moyen de voir une clé DÉCLARÉE DEUX FOIS, qu'un `Record` littéral écrase
// silencieusement à l'évaluation. Même approche que le garde-fou des jetons de
// design voisin.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildAdminNav } from "@/lib/admin-nav";

const ROOT = resolve(__dirname, "../../../../..");
const REGISTRY = join(ROOT, "src/components/admin/ui/admin-nav-icons.ts");
const LUCIDE_TYPES = join(ROOT, "node_modules/lucide-react/dist/lucide-react.d.ts");

/** Clés de `ADMIN_NAV_ICONS` telles qu'écrites dans le source du composant. */
function readIconMapKeys(): string[] {
  const source = readFileSync(REGISTRY, "utf8");
  const block = source.match(/const ADMIN_NAV_ICONS[\s\S]*?\n};/);
  if (!block) {
    throw new Error(
      "ADMIN_NAV_ICONS introuvable dans admin-nav-icons.ts — la déclaration a été " +
        "renommée ou reformatée : mettez à jour ce garde-fou.",
    );
  }
  // Une clé par ligne, à deux espaces d'indentation : soit entre guillemets
  // (libellés à espaces/ponctuation), soit nue (identifiants simples).
  return [...block[0].matchAll(/^ {2}(?:"([^"]+)"|([\p{L}\p{N}_-]+)):\s/gmu)].flatMap((m) => {
    const key = m[1] ?? m[2];
    return key ? [key] : [];
  });
}

/** Association libellé → nom du composant lucide, telle qu'écrite dans `ADMIN_NAV_ICONS`. */
function readIconMapPairs(): Map<string, string> {
  const source = readFileSync(REGISTRY, "utf8");
  const block = source.match(/const ADMIN_NAV_ICONS[\s\S]*?\n};/);
  if (!block) throw new Error("ADMIN_NAV_ICONS introuvable dans admin-nav-icons.ts");

  const pairs = new Map<string, string>();
  const rows = block[0].matchAll(/^ {2}(?:"([^"]+)"|([\p{L}\p{N}_-]+)):\s*([A-Z][A-Za-z0-9]*)/gmu);
  for (const row of rows) {
    const label = row[1] ?? row[2];
    const icon = row[3];
    if (label && icon) pairs.set(label, icon);
  }
  return pairs;
}

/** Libellés réellement rendus dans la barre latérale, via la SSOT. */
function readNavLabels(): string[] {
  return buildAdminNav("admin-test-prefix").map((item) => item.label);
}

describe("icônes de la barre latérale de la console", () => {
  it("donne une icône dédiée à chaque entrée de navigation", () => {
    const keys = new Set(readIconMapKeys());
    const uncovered = [...new Set(readNavLabels())].filter((label) => !keys.has(label));

    expect(
      uncovered,
      `${uncovered.length} libellé(s) de navigation n'ont aucune icône dans ADMIN_NAV_ICONS ` +
        `et retomberaient sur l'icône dossier générique :\n  - ${uncovered.join("\n  - ")}`,
    ).toEqual([]);
  });

  it("ne conserve aucune clé morte dans ADMIN_NAV_ICONS", () => {
    const labels = new Set(readNavLabels());
    const dead = readIconMapKeys().filter((key) => !labels.has(key));

    expect(
      dead,
      `${dead.length} clé(s) de ADMIN_NAV_ICONS ne correspondent à aucune entrée de navigation ` +
        `(entrée renommée ou supprimée sans nettoyage) :\n  - ${dead.join("\n  - ")}`,
    ).toEqual([]);
  });

  it("ne déclare pas deux fois la même clé", () => {
    const keys = readIconMapKeys();
    const seen = new Set<string>();
    const duplicated = [
      ...new Set(keys.filter((k) => (seen.has(k) ? true : (seen.add(k), false)))),
    ];

    expect(
      duplicated,
      `Clé(s) déclarée(s) plusieurs fois dans ADMIN_NAV_ICONS — seule la dernière ` +
        `s'applique, la première est silencieusement perdue :\n  - ${duplicated.join("\n  - ")}`,
    ).toEqual([]);
  });

  it("n'emploie que des noms d'icônes CANONIQUES", () => {
    // lucide expose ses anciens noms comme alias dépréciés — `TriangleAlert as
    // AlertTriangle`, `ChartColumn as BarChart3`, `CircleQuestionMark as
    // HelpCircle`. Ils compilent et rendent le bon dessin, donc rien ne les
    // signale ; mais ils disparaîtront à une majeure de lucide, et surtout ils
    // permettent au MÊME dessin d'apparaître sous deux noms dans le même
    // fichier — ce qui rend le registre illisible et trompe la détection de
    // collision ci-dessous, qui compare des NOMS.
    //
    // Un nom canonique est déclaré par un `declare const` dans les types de
    // lucide ; un alias n'existe que dans la clause `export { … as … }`.
    const types = readFileSync(LUCIDE_TYPES, "utf8");
    const canoniques = new Set(
      [...types.matchAll(/declare const ([A-Z][A-Za-z0-9]*)\b/g)].map((m) => m[1]),
    );

    const source = readFileSync(REGISTRY, "utf8");
    const imports = source.match(/import \{[\s\S]*?\} from "lucide-react";/)?.[0] ?? "";
    // « X as Y » : c'est X, le nom importé, qui doit être canonique.
    const importes = [...imports.matchAll(/^ {2}([A-Z][A-Za-z0-9]*)(?: as [A-Za-z]+)?,$/gm)].map(
      (m) => m[1],
    );

    const deprecies = importes.filter((n) => !canoniques.has(n));

    expect(
      deprecies,
      `Nom(s) d'icône déprécié(s) dans le registre : ${deprecies.join(", ")}.\n` +
        "Remplacez-les par le nom canonique (celui que lucide déclare) — la clause " +
        "`export { Canonique as Ancien }` de lucide-react.d.ts donne la correspondance.",
    ).toEqual([]);
  });

  it("n'attribue pas la même icône à deux entrées d'un même groupe", () => {
    // Deux entrées éloignées peuvent légitimement partager une icône ; deux
    // entrées VOISINES dans la même liste, non — c'est précisément la confusion
    // que cette couche corrige.
    const iconByLabel = readIconMapPairs();
    const items = buildAdminNav("admin-test-prefix");

    const collisions: string[] = [];
    const byGroup = new Map<string, Map<string, string>>();
    for (const item of items) {
      const icon = iconByLabel.get(item.label);
      if (!icon) continue;
      const group = byGroup.get(item.group) ?? new Map<string, string>();
      const previous = group.get(icon);
      if (previous && previous !== item.label) {
        collisions.push(
          `groupe « ${item.group} » : « ${previous} » et « ${item.label} » → ${icon}`,
        );
      }
      group.set(icon, item.label);
      byGroup.set(item.group, group);
    }

    expect(
      collisions,
      `Icône partagée par deux entrées du même groupe — elles seront ` +
        `indiscernables dans la liste :\n  - ${collisions.join("\n  - ")}`,
    ).toEqual([]);
  });
});
