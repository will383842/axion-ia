/**
 * Indicateur 2 — `/certification-qualiopi` ne contredit plus la fiche formation.
 *
 * 🔴 Analyse d'écarts du 02/10/2026 (B4). La page affirmait « Nous ne publions
 * aucune valeur non représentative », alors que l'encadré « Nos résultats sur
 * cette formation » de la fiche publie dès la première session, avec l'effectif
 * et la mention d'un échantillon trop faible. Les deux règles sont désormais
 * dites : dès la première session sur la fiche, toujours avec l'échantillon ;
 * sous 5 réponses, signalées comme non représentatives.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { IndicateursResult } from "@/server/qualiopi/indicateurs/service";
import { IndicateursResultatsPublic } from "./IndicateursResultatsPublic";

const EN_CONSTITUTION = { tauxPct: 0, nb: 1, fiable: false, libelle: "En cours de constitution" };
const RESULTAT: IndicateursResult = {
  annee: 2026,
  tauxSatisfaction: EN_CONSTITUTION,
  tauxReussite: EN_CONSTITUTION,
  tauxCompletion: EN_CONSTITUTION,
  delaiAccesMoyen: { jours: 0, nb: 1, fiable: false },
  methodes: { satisfaction: "m1", reussite: "m2", completion: "m3", delaiAcces: "m4" },
  calculeAt: new Date("2026-10-02T08:00:00.000Z"),
};

const PAGE = readFileSync(
  join(process.cwd(), "src", "app", "[locale]", "certification-qualiopi", "page.tsx"),
  "utf8",
);

describe("/certification-qualiopi — la règle de publication dite sans contradiction", () => {
  it("la description annonce la publication dès la première session, avec l'échantillon", () => {
    expect(PAGE).toContain(
      "Nous publions nos résultats dès la première session, toujours avec la taille de l’échantillon ; sous 5 réponses, ils sont signalés comme non représentatifs.",
    );
  });

  it("🔴 plus aucune version n'affirme « aucune valeur non représentative »", () => {
    const result = RESULTAT;
    const html = renderToStaticMarkup(<IndicateursResultatsPublic result={result} isFr />);
    const htmlEn = renderToStaticMarkup(
      <IndicateursResultatsPublic result={result} isFr={false} />,
    );
    expect(html).not.toMatch(/aucune valeur non représentative/i);
    expect(htmlEn).not.toMatch(/do not publish non-representative/i);
    expect(PAGE).not.toMatch(/aucune valeur non représentative/i);
    expect(html).toContain("publiés sur sa fiche dès la première session");
    expect(html).toContain("taille de l&#x27;échantillon");
    // Aucun script : composant serveur, HTML pur.
    expect(html).not.toMatch(/<script/);
  });
});
