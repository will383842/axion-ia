// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CellulesInfosSession } from "../CellulesInfosSession";

// Contrat de l'E2E 01-presentiel : `#infos > div > div` filtré sur /^Modalité/ = 1 cellule.
// `#infos` est la <section> elle-même, directement parente de la grille.
describe("fiche session : contrat E2E de #infos", () => {
  it("rend la section et la grille ; une seule cellule « Modalité »", () => {
    const { container } = render(
      <section id="infos" className="admin-bloc admin-bloc--bleu">
        <h2 className="admin-bloc-titre">Informations générales</h2>
        <CellulesInfosSession
          locale="fr"
          adminPrefix="x"
          base="/fr/x/qualiopi/sessions"
          formation={{ id: "f1", numero: "F-1", titre: "Formation Distanciel IA" }}
          client={{ id: "c1", numero: "C-1", raisonSociale: "Acme" }}
          hrefClient="/fr/x/qualiopi/clients/c1"
          modaliteLibelle="Présentiel"
          financementLibelle="Non défini"
          inscrits={2}
          prevus={5}
          reels={null}
          montantHtCents={120000}
          mentionTva={null}
          dureeReelleHeures={null}
          sessionParentId={null}
          sessionReporteeId={null}
        />
      </section>,
    );
    const cellules = Array.from(container.querySelectorAll("#infos > div > div")).filter((c) =>
      /^Modalité/.test((c.textContent ?? "").trim()),
    );
    expect(cellules).toHaveLength(1);
    expect(cellules[0]?.textContent).toContain("Présentiel");
    expect(container.querySelectorAll('[id="infos"]')).toHaveLength(1);
    expect(container.querySelector("#infos")?.tagName).toBe("SECTION");
    expect(container.querySelector('a[href="/fr/x/qualiopi/clients/c1"]')).not.toBeNull();
  });
});
