// FAC-7 — L'issue de l'échange, module commun par famille : les gabarits arrivent par la
// table de la famille ; la famille apporteur garde exactement ses règles.
import { describe, expect, it } from "vitest";

import * as apporteur from "../issue-apporteur";
import {
  GABARITS_ISSUE_PAR_FAMILLE,
  ISSUES_ECHANGE,
  gabaritDeLIssue,
  versSuivi,
} from "../issue-echange";

describe("issue commune", () => {
  it("les cinq issues, rangées dans rendez_vous_suivis", () => {
    expect([...ISSUES_ECHANGE]).toEqual(["absent", "reporte", "retenu", "a_revoir", "non_retenu"]);
    expect(versSuivi("retenu")).toEqual({ issue: "eu_lieu", decision: "retenu" });
  });
  it("les gabarits viennent de la table passée", () => {
    const t = { absent: "x-absent", retenu: "x-retenu", non_retenu: "x-non" };
    expect(gabaritDeLIssue(t, "absent", 0)).toBe("x-absent");
    expect(gabaritDeLIssue(t, "absent", 1)).toBeNull();
    expect(gabaritDeLIssue(t, "non_retenu", 0)).toBe("x-non");
    expect(gabaritDeLIssue(t, "a_revoir", 0)).toBeNull();
  });
});

describe("la famille apporteur est inchangée", () => {
  it("mêmes noms de gabarits", () => {
    expect(apporteur.GABARITS_ISSUE_APPORTEUR).toEqual([
      "apporteur-issue-absent",
      "apporteur-issue-retenu",
      "apporteur-issue-non-retenu",
    ]);
    expect(GABARITS_ISSUE_PAR_FAMILLE.apporteur.retenu).toBe(apporteur.GABARIT_ISSUE_RETENU);
  });
  it("même table de décision", () => {
    for (const issue of ISSUES_ECHANGE) {
      for (const n of [0, 1, 2]) {
        expect(apporteur.gabaritDeLIssue(issue, n)).toBe(
          gabaritDeLIssue(GABARITS_ISSUE_PAR_FAMILLE.apporteur, issue, n),
        );
      }
    }
  });
});
