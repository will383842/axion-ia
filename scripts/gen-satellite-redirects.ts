// Génère une map LÉGÈRE (Edge-safe) ville satellite → hub + le set des hubs,
// consommée par `src/proxy.ts` (middleware Edge) pour les 301 satellites → hub.
//
// Pourquoi un fichier généré séparé : le middleware tourne en Edge runtime et ne
// doit PAS importer `@/content/villes` (VILLES = données lourdes). On précalcule
// donc un simple Record<string,string> de slugs.
//
// Régénérer après tout changement du seuil hub ou des données villes :
//   pnpm tsx scripts/gen-satellite-redirects.ts

import { writeFileSync } from "node:fs";
import { getHubSlugs, getHubForSatellite } from "@/content/recrutement/satellites";
import { VILLES } from "@/content/villes";

const hubs = getHubSlugs();
const map: Record<string, string> = {};
for (const v of VILLES) {
  const hub = getHubForSatellite(v.slug);
  if (hub) map[v.slug] = hub;
}

const content = `// AUTO-GÉNÉRÉ par scripts/gen-satellite-redirects.ts — NE PAS ÉDITER À LA MAIN.
// Map légère (Edge-safe) consommée par le middleware proxy.ts pour les 301
// satellites → hub. Régénérer : pnpm tsx scripts/gen-satellite-redirects.ts
export const HUB_SLUGS: ReadonlySet<string> = new Set(${JSON.stringify(hubs)});
export const SATELLITE_TO_HUB: Readonly<Record<string, string>> = ${JSON.stringify(map)};
`;

writeFileSync("src/content/recrutement/satellite-redirects.generated.ts", content, "utf8");
console.log(`wrote ${Object.keys(map).length} satellites, ${hubs.length} hubs`);
