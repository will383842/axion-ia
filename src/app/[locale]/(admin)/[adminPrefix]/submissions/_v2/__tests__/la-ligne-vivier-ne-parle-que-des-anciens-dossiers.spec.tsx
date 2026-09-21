// La ligne « vivier » de la fiche apporteur ne parle plus que des anciens dossiers.
//
// ── Pourquoi ─────────────────────────────────────────────────────────────
// Jusqu'au 19/09, la fiche affichait TOUJOURS une ligne « Conservation en
// vivier » : « Accepté le … » ou « Non — pas d'accord enregistré ». La case a
// été retirée du formulaire ce jour-là (décision B2 : le dossier apporteur ne
// part plus au CRM). Garder la ligne dirait « Non » pour chaque nouveau dossier,
// comme si la personne avait refusé une question qu'on ne lui a jamais posée.
//
// Elle ne s'affiche donc que si un accord a réellement été donné — c'est-à-dire
// sur un dossier antérieur au 19/09 —, et son libellé le dit.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CandidatureCommercialeDetail } from "../CandidatureCommercialeDetail";

const CANDIDATURE = { version: 1, ville: "Grenoble", codePostal: "38000" };

describe("fiche apporteur — la ligne vivier", () => {
  it("sans vivierConsentAt : AUCUNE ligne vivier", () => {
    const html = renderToStaticMarkup(
      <CandidatureCommercialeDetail
        candidature={CANDIDATURE}
        vivierConsentAt={null}
        consentVersion="memo-v3-2026-09-19"
      />,
    );
    // Contre-témoin : la fiche est bien rendue, avec sa version de consentement.
    expect(html).toContain("memo-v3-2026-09-19");
    expect(html.toLowerCase()).not.toContain("vivier");
  });

  it("avec vivierConsentAt : la ligne dit qu'il s'agit du formulaire antérieur au 19/09/2026", () => {
    const html = renderToStaticMarkup(
      <CandidatureCommercialeDetail
        candidature={CANDIDATURE}
        vivierConsentAt="2026-09-10T08:30:00.000Z"
        consentVersion="memo-v2-2026-08-13"
      />,
    );
    expect(html).toContain("Accord vivier (formulaire antérieur au 19/09/2026)");
    expect(html).toContain("donné le");
    expect(html).not.toContain("pas d’accord enregistré");
  });
});
