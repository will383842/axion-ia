// X-6 (vérification finale du 11/11/2026, §3) — règle de Williams : « Grenoble » n'apparaît
// JAMAIS dans la communication publique d'Axion-IA ; seules les mentions légales le portent.
//
// Ce spec garde les emplacements de communication corrigés par X-6. Les occurrences LÉGITIMES
// (liste blanche, non scannées ici) sont : l'identité légale (`identite-legale-ssot`), la
// vCard, le contrat apporteur (`contrat-v2`), les gardes qui interdisent le mot
// (`interdits-publication`, `pack-journee-ia`), et les données géographiques de la page ville
// (`regions.ts`, `villes/copy/grenoble.ts`, `economic-data/grenoble.ts`).

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = process.cwd();

/** Fichiers de communication publique : aucune occurrence de « Grenoble » n'est admise. */
const COMMUNICATION: ReadonlyArray<string> = [
  "src/app/[locale]/equipe/[slug]/page.tsx",
  "src/app/[locale]/carrieres/page.tsx",
  "src/content/careers/employer-brand.ts",
  "src/content/guide-ia-page.ts",
  "src/app/[locale]/avis/page.tsx",
  "src/app/[locale]/recherche/page.tsx",
  "src/components/careers/OffersEmbedPromo.tsx",
  "src/components/sections/LocalGeoFaqSection.tsx",
];

/** Liste blanche documentaire : ces fichiers PEUVENT nommer Grenoble (mentions légales, données). */
const LISTE_BLANCHE: ReadonlyArray<string> = [
  "src/lib/identite-legale-ssot.ts",
  "src/lib/vcard/index.ts",
  "src/features/apporteurs-reseau/contrat-v2.ts",
  "src/lib/contenu/interdits-publication.ts",
  "src/lib/knowledge/pack-journee-ia.ts",
  "src/content/regions.ts",
  "src/content/villes/copy/grenoble.ts",
];

describe("« Grenoble » n'est jamais un ancrage de communication", () => {
  for (const fichier of COMMUNICATION) {
    it(`${fichier} ne cite pas Grenoble`, () => {
      const source = readFileSync(path.join(RACINE, fichier), "utf8");
      const lignes = source
        .split("\n")
        .map((texte, i) => ({ ligne: i + 1, texte }))
        .filter((l) => /grenoble/i.test(l.texte));
      expect(lignes).toEqual([]);
    });
  }

  it("aucun fichier de communication n'est dans la liste blanche", () => {
    for (const f of COMMUNICATION) expect(LISTE_BLANCHE).not.toContain(f);
  });
});
