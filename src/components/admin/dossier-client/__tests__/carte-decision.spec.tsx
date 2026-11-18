// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CarteDecision, phraseDesPersonnes } from "../fiche/CarteDecision";

const P = (
  id: string,
  nom: string,
  roles: never[] | string[],
  statut: "actif" | "parti" = "actif",
) =>
  ({
    id,
    nom,
    fonction: "DG",
    statut,
    partiLe: statut === "parti" ? new Date("2026-09-01") : null,
    roles,
  }) as never;

describe("carte « Qui décide »", () => {
  it("l'OPCO est une ligne de financement, pas une personne", () => {
    const html = renderToStaticMarkup(
      <CarteDecision personnes={[P("1", "Anne Durand", ["decideur"])]} opco="Atlas" />,
    );
    expect(html).toContain("Financement : Atlas");
    expect(html).toContain("1 personne, dont 1 active");
    expect(html).not.toContain(">Atlas<");
  });

  it("affiche les rôles influenceur et bloqueur depuis le lot C3", () => {
    const html = renderToStaticMarkup(
      <CarteDecision
        personnes={[P("1", "Anne Durand", ["decideur", "influenceur", "bloqueur"])]}
        opco={null}
      />,
    );
    expect(html).toContain("décide");
    expect(html).toContain("influence la décision");
    expect(html).toContain("freine la décision");
  });

  it("une personne partie est grisée avec sa date", () => {
    const html = renderToStaticMarkup(
      <CarteDecision personnes={[P("1", "Luc Petit", ["referent"], "parti")]} opco={null} />,
    );
    expect(html).toContain("a quitté l&#x27;entreprise le 01/09/2026");
    expect(html).toContain("0 active");
  });

  it("le décompte", () => {
    expect(phraseDesPersonnes(6, 5)).toBe("6 personnes, dont 5 actives");
    expect(phraseDesPersonnes(0, 0)).toBe("Aucune personne sur cette fiche");
  });
});
