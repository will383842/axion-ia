/** L8a — rendu de la pastille et de la barre d'étapes (serveur, sans JS). */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { BarreEtapes } from "../BarreEtapes";
import { PastilleEtape } from "../PastilleEtape";
import {
  BARRE_APPORTEUR,
  BARRE_EMPLOI,
  etapeApporteur,
  etapeEmploi,
} from "@/features/etapes/etapes";

describe("PastilleEtape", () => {
  it("dit le mot et sa précision", () => {
    const html = renderToStaticMarkup(
      <PastilleEtape etape={etapeApporteur({ type: "echange-fait", aRevoir: true })} />,
    );
    expect(html).toContain("Échange fait");
    expect(html).toContain("À revoir");
  });
});

describe("BarreEtapes", () => {
  it("marque les étapes faites et l'étape courante (aria-current)", () => {
    const html = renderToStaticMarkup(
      <BarreEtapes etapes={BARRE_EMPLOI} etape={etapeEmploi("interview")} />,
    );
    expect(html.match(/admin-etapes-faite/g)).toHaveLength(2);
    expect(html).toMatch(/aria-current="step"[^>]*>Échange prévu/);
  });

  it("une sortie s'affiche à la place de la barre", () => {
    const html = renderToStaticMarkup(
      <BarreEtapes etapes={BARRE_APPORTEUR} etape={etapeApporteur({ type: "sans-suite" })} />,
    );
    expect(html).toContain("Sans suite");
    expect(html).not.toContain("admin-etapes-faite");
  });
});
