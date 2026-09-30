// @vitest-environment node
/**
 * ⛔ UX-02 : une carte de rendez-vous d'un client dont le dossier est visible
 * n'offre PLUS deux façons de « faire le point ». « Après l'appel » est mis
 * en avant ; le formulaire court ne garde que « Absent » et « Reporté » :
 * cliquer « A eu lieu » sur la carte faisait retomber la pastille sans
 * projet, sans faits validés, et le dossier restait vide sans signal.
 *
 * Mutations qui font rougir :
 *   · retirer `sansEuLieu` du formulaire : « A eu lieu » réapparaît ;
 *   · rendre le formulaire complet sur la carte d'un type du dossier.
 * Contre-témoin : sans `sansEuLieu` (apporteurs, rôles sans dossier, types
 * hors liste blanche), les trois issues restent.
 * Angle mort : la page elle-même est lue comme un texte (composant serveur
 * asynchrone), pas rendue.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/admin-rendezvous/suivi-actions", () => ({
  enregistrerSuiviAction: vi.fn(),
}));

import { SuiviRendezVousForm } from "../SuiviRendezVousForm";

const PAGE = "src/app/[locale]/(admin)/[adminPrefix]/rendez-vous/page.tsx";

describe("⛔ une carte du dossier fait le point dans « Après l'appel »", () => {
  it("le formulaire court n'offre que « Absent » et « Reporté »", () => {
    const html = renderToStaticMarkup(<SuiviRendezVousForm calendlyEventId="evt_1" sansEuLieu />);
    expect(html).not.toContain("A eu lieu");
    expect(html).toContain("Absent");
    expect(html).toContain("Reporté");
  });

  it("contre-témoin : sans l'option, les trois issues restent", () => {
    const html = renderToStaticMarkup(<SuiviRendezVousForm calendlyEventId="evt_1" />);
    expect(html).toContain("A eu lieu");
  });

  it("les deux cartes de la page : « Après l'appel » d'abord, le formulaire court ensuite", () => {
    const src = readFileSync(join(process.cwd(), PAGE), "utf8");
    for (const [debut, fin] of [
      ["function CarteRdv(", "function CartePoint("],
      ["function CartePoint(", "function Chiffre("],
    ] as const) {
      const carte = src.slice(src.indexOf(debut), src.indexOf(fin));
      const liens = carte.indexOf("<LiensApresLAppel");
      const court = carte.indexOf("sansEuLieu");
      expect(liens, debut).toBeGreaterThan(-1);
      expect(court, debut).toBeGreaterThan(liens);
    }
  });
});
