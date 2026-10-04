/**
 * Lot OPCO A5 — le bandeau des fiches client et devis : rouge pour une
 * suspension, orange pour une date limite, rien sans relevé. Et les deux fiches
 * le portent bel et bien.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";

import { BandeauEtatFonds } from "../BandeauEtatFonds";
import {
  bandeauEtatFonds,
  etatFondsPour,
  type ReleveEtatFonds,
} from "@/server/qualiopi/financements/etat-fonds-opco";

const SOURCE =
  "https://www.akto.fr/breve/entreprises-moins-50-salaries-suspension-financement-formations-pdc/";
const releve: ReleveEtatFonds = {
  id: "r",
  opco: "akto",
  idcc: "0573",
  statut: "suspendu",
  perimetre: "Commerces de gros — entreprises de moins de 50 salariés",
  dateLimiteDepot: null,
  sourceUrl: SOURCE,
  releveLe: new Date("2026-10-04T00:00:00Z"),
  note: "Enveloppe intégralement engagée.",
  createdAt: new Date("2026-10-04T08:00:00Z"),
};
const LE_5_OCTOBRE = new Date("2026-10-05T10:00:00Z");

function rendu(effectif: number | null, releves = [releve]) {
  const bandeau = bandeauEtatFonds(
    etatFondsPour({ opco: "akto", idcc: "573", effectif, aLaDate: LE_5_OCTOBRE, releves }),
  );
  return renderToStaticMarkup(<BandeauEtatFonds bandeau={bandeau} />);
}

describe("BandeauEtatFonds", () => {
  it("rouge : financement suspendu, avec la source et la date du relevé", () => {
    const html = rendu(12);
    expect(html).toContain('data-ton="rouge"');
    expect(html).toContain('role="alert"');
    expect(html).toContain("Financement suspendu pour cette branche (relevé du 04/10/2026)");
    expect(html).toContain(`href="${SOURCE}"`);
    expect(html).toContain("Enveloppe intégralement engagée.");
  });

  it("orange : dépôt avant la date limite de l'OPCO", () => {
    const html = rendu(12, [
      {
        ...releve,
        idcc: null,
        statut: "ouvert",
        perimetre: null,
        note: null,
        dateLimiteDepot: new Date("2026-11-30T00:00:00Z"),
      },
    ]);
    expect(html).toContain('data-ton="orange"');
    expect(html).toContain("Dépôt avant le 30/11/2026");
  });

  it("rien : sans relevé, ou suspension « moins de 50 » pour une entreprise de 50", () => {
    expect(rendu(12, [])).toBe("");
    expect(rendu(50)).toBe("");
  });

  it("les fiches client et devis portent le bandeau", () => {
    const base = join(process.cwd(), "src/app/[locale]/(admin)/[adminPrefix]/qualiopi");
    for (const page of ["clients/[id]/page.tsx", "devis/[id]/page.tsx"]) {
      const source = readFileSync(join(base, page), "utf8");
      expect(source, page).toContain("<BandeauEtatFonds bandeau={bandeauFonds} />");
      expect(source, page).toContain("etatFondsDuClient(");
    }
  });
});
