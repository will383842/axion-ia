/**
 * Encadré « Nos résultats » (indicateur 2) — rendu SERVEUR, HTML pur.
 * Doctrine et calcul : `src/server/qualiopi/indicateurs/resultats-publics.ts`.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { construireResultatsPublics } from "@/server/qualiopi/indicateurs/resultats-publics";
import { ResultatsFormation } from "./ResultatsFormation";

// La réalité au 2026-10-01 : AXI-SESS-2026-001, 05/09/2026, 1 stagiaire, 5/5.
const REEL = construireResultatsPublics({
  indicateursPubliesAt: new Date("2026-10-01T09:00:00.000Z"),
  sessions: [
    {
      dateDebut: new Date("2026-09-05T07:00:00.000Z"),
      dateFin: new Date("2026-09-05T15:00:00.000Z"),
    },
  ],
  inscriptions: [{ tauxPresencePct: 100 }],
  notes: [5],
  seuilPresencePct: 80,
  calculeLe: new Date("2026-10-01T10:00:00.000Z"),
})!;

describe("ResultatsFormation — rendu serveur", () => {
  it("affiche les chiffres, l'échantillon, la période et la date de mise à jour", () => {
    const html = renderToStaticMarkup(<ResultatsFormation resultats={REEL} />);
    expect(html).toContain("Nos résultats sur cette formation");
    expect(html).toContain("Session réalisée");
    expect(html).toContain("Stagiaire formé");
    expect(html).toContain("5/5");
    expect(html).toContain("1 réponse au questionnaire de fin de formation.");
    expect(html).toContain("1 sur 1");
    expect(html).toContain("Sur 1 session réalisée et 1 stagiaire — premiers résultats.");
    expect(html).toContain("Session du 5 septembre 2026.");
    expect(html).toContain("Chiffres mis à jour le 1er octobre 2026.");
    expect(html).toContain("trop faible pour être représentatif");
    // Aucune image, aucun script : HTML pur.
    expect(html).not.toMatch(/<img|<script/);
  });
});
