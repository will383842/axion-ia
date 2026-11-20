// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CellulesInfosSession } from "../CellulesInfosSession";

describe("fiche session : cellules de #infos (contrat E2E 01-presentiel)", () => {
  it("`#infos > div > div` filtré sur « Modalité » = exactement 1 cellule, avec la modalité", () => {
    const { container } = render(
      <section id="infos">
        <CellulesInfosSession
          locale="fr"
          adminPrefix="x"
          base="/fr/x/qualiopi/sessions"
          formation={{ id: "f1", numero: "F-1", titre: "Formation Distanciel IA" }}
          client={null}
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
  });
});
