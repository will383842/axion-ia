// @vitest-environment node
/**
 * UX-02 puis R2 (2e vérification) : sur la carte d'un rendez-vous du dossier,
 * « Après l'appel » vient EN PREMIER (c'est là que le point se fait) ; le
 * formulaire court reste COMPLET en dessous. Il garde « A eu lieu » : un
 * « Discutons » hors cible, sans suite, doit pouvoir se clore sans créer de
 * fiche client (« Après l'appel » en exige une, `valider.ts`).
 *
 * Mutations qui font rougir : passer le formulaire court avant « Après
 * l'appel » ; lui retirer « A eu lieu » sur une carte du dossier.
 * Angle mort : la page est lue comme un texte (composant serveur asynchrone).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PAGE = "src/app/[locale]/(admin)/[adminPrefix]/rendez-vous/page.tsx";

describe("une carte du dossier fait le point dans « Après l'appel »", () => {
  it("les deux cartes : « Après l'appel » d'abord, le formulaire court complet ensuite", () => {
    const src = readFileSync(join(process.cwd(), PAGE), "utf8");
    for (const [debut, fin] of [
      ["function CarteRdv(", "function CartePoint("],
      ["function CartePoint(", "function Chiffre("],
    ] as const) {
      const carte = src.slice(src.indexOf(debut), src.indexOf(fin));
      const liens = carte.indexOf("<LiensApresLAppel");
      const court = carte.indexOf("<SuiviRendezVousForm", liens);
      expect(liens, debut).toBeGreaterThan(-1);
      expect(court, debut).toBeGreaterThan(liens);
      expect(carte, debut).toContain("ou sans suite ?");
    }
    expect(src).not.toContain("sansEuLieu");
  });
});
