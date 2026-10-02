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
    expect(html).toContain("Stagiaire accueilli");
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

// Relecture PR 1265 : le décompte est celui de la console (inscrits non
// sortis) et compte donc un ABSENT. Le dire « formé » serait faux, et
// contredirait la tuile « Assiduité » juste à côté.
describe("ResultatsFormation — un absent n'est pas « formé »", () => {
  it("2 inscrits dont 1 absent : « accueillis », jamais « formés »", () => {
    const r = construireResultatsPublics({
      indicateursPubliesAt: new Date("2026-10-01T09:00:00.000Z"),
      sessions: [
        {
          dateDebut: new Date("2026-09-05T07:00:00.000Z"),
          dateFin: new Date("2026-09-05T15:00:00.000Z"),
        },
      ],
      inscriptions: [{ tauxPresencePct: 100 }, { tauxPresencePct: 0 }],
      notes: [5],
      seuilPresencePct: 80,
      calculeLe: new Date("2026-10-01T10:00:00.000Z"),
    })!;
    const html = renderToStaticMarkup(<ResultatsFormation resultats={r} />);
    expect(html).toContain("Stagiaires accueillis");
    expect(html).not.toMatch(/formé/i);
    expect(html).toContain("1 sur 2");
  });
});

// Indicateur 2 modifié par le décret n° 2026-728 : « en précisant de manière
// transparente leurs modalités de calcul ». La méthode est lisible À CÔTÉ des
// chiffres, sur la fiche même — pas seulement sur une page qui peut être fermée.
describe("ResultatsFormation — la méthode de calcul est écrite à côté des chiffres", () => {
  it("sources, troncature, seuil d'assiduité et seuil de représentativité", () => {
    const html = renderToStaticMarkup(<ResultatsFormation resultats={REEL} />);
    expect(html).toContain("Méthode : chiffres calculés automatiquement");
    expect(html).toContain("relevés de présence (émargement ou connexion)");
    expect(html).toContain("questionnaires de fin de formation");
    expect(html).toContain("moyenne des notes globales sur 5, tronquée au dixième");
    expect(html).toContain("atteint au moins 80 % de la durée prévue");
    expect(html).toContain("Sous 5 stagiaires ou 5 réponses");
    expect(html).not.toMatch(/<script/);
  });
});
