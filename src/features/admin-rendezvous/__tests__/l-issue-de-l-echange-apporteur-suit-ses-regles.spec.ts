// L'issue de l'échange apporteur — les règles pures (2026-09-28).

import { describe, it, expect } from "vitest";

import {
  GABARIT_ISSUE_ABSENT,
  GABARIT_ISSUE_NON_RETENU,
  GABARIT_ISSUE_RETENU,
  ISSUES_APPORTEUR,
  classeSansSuite,
  decisionAffichee,
  gabaritDeLIssue,
  issueApporteurSchema,
  issueDepuisSuivi,
  libellePointApporteur,
  lireFormulaireIssueApporteur,
  normaliserIssueApporteur,
  versSuivi,
  type DecisionApporteur,
  type EchangeAvecPoint,
} from "../issue-apporteur";
import { badgeSuiviInvitation } from "@/lib/commercial-application/relance-invitation";

const J = (iso: string) => new Date(iso);

describe("ce que chaque bouton écrit dans le point du rendez-vous", () => {
  it("absent / reporté restent des constats ; retenu, à revoir, non retenu sont des DÉCISIONS sur un échange tenu", () => {
    expect(versSuivi("absent")).toEqual({ issue: "absent", decision: null });
    expect(versSuivi("reporte")).toEqual({ issue: "reporte", decision: null });
    expect(versSuivi("retenu")).toEqual({ issue: "eu_lieu", decision: "retenu" });
    expect(versSuivi("a_revoir")).toEqual({ issue: "eu_lieu", decision: "a_revoir" });
    expect(versSuivi("non_retenu")).toEqual({ issue: "eu_lieu", decision: "non_retenu" });
  });

  it("l'aller-retour redonne le bouton de départ, pour les cinq", () => {
    for (const i of ISSUES_APPORTEUR) {
      const s = versSuivi(i);
      expect(issueDepuisSuivi(s.issue, s.decision)).toBe(i);
    }
    // Un point « a eu lieu » d'avant cet écran (sans décision) n'allume rien.
    expect(issueDepuisSuivi("eu_lieu", null)).toBeNull();
  });

  it("seul « Non retenu » classe la fiche sans suite", () => {
    expect(ISSUES_APPORTEUR.filter(classeSansSuite)).toEqual(["non_retenu"]);
  });
});

describe("quel e-mail part", () => {
  it("absent, retenu, non retenu ont leur e-mail ; reporté et à revoir n'en ont AUCUN", () => {
    expect(gabaritDeLIssue("absent", 0)).toBe(GABARIT_ISSUE_ABSENT);
    expect(gabaritDeLIssue("retenu", 0)).toBe(GABARIT_ISSUE_RETENU);
    expect(gabaritDeLIssue("non_retenu", 0)).toBe(GABARIT_ISSUE_NON_RETENU);
    expect(gabaritDeLIssue("reporte", 0)).toBeNull();
    expect(gabaritDeLIssue("a_revoir", 0)).toBeNull();
  });

  it("à la DEUXIÈME absence, plus aucun nouveau créneau n'est proposé", () => {
    expect(gabaritDeLIssue("absent", 1)).toBeNull();
    expect(gabaritDeLIssue("absent", 3)).toBeNull();
    // …mais une décision reste possible, e-mail compris.
    expect(gabaritDeLIssue("non_retenu", 2)).toBe(GABARIT_ISSUE_NON_RETENU);
  });
});

describe("la saisie", () => {
  function fd(champs: Record<string, string>): FormData {
    const f = new FormData();
    for (const [k, v] of Object.entries(champs)) f.set(k, v);
    return f;
  }

  it("lit la note /20, sa phrase et le mot personnel ; champs vides → null", () => {
    const p = issueApporteurSchema.parse(
      lireFormulaireIssueApporteur(
        fd({
          calendlyEventId: "evt_1",
          issue: "retenu",
          noteSur20: "16",
          justification: " ",
          motPersonnel: "Ravi !",
        }),
      ),
    );
    expect(p).toMatchObject({
      issue: "retenu",
      noteSur20: 16,
      justification: null,
      motPersonnel: "Ravi !",
    });
  });

  it("refuse une note hors de 0-20 ou non entière", () => {
    for (const n of ["21", "-1", "12.5", "douze"]) {
      const r = issueApporteurSchema.safeParse(
        lireFormulaireIssueApporteur(
          fd({ calendlyEventId: "evt_1", issue: "retenu", noteSur20: n }),
        ),
      );
      expect(r.success, n).toBe(false);
    }
  });

  it("la note ne se garde que pour un échange TENU, la date de rappel que pour « À revoir »", () => {
    const base = {
      calendlyEventId: "evt_1",
      noteSur20: 14,
      justification: "Bon réseau.",
      rappelLe: "2026-10-15",
      motPersonnel: null,
    };
    expect(normaliserIssueApporteur({ ...base, issue: "absent" })).toMatchObject({
      noteSur20: null,
      note: null,
      suiteLe: null,
    });
    expect(normaliserIssueApporteur({ ...base, issue: "retenu" })).toMatchObject({
      noteSur20: 14,
      note: "Bon réseau.",
      suiteLe: null,
    });
    expect(normaliserIssueApporteur({ ...base, issue: "a_revoir" }).suiteLe?.toISOString()).toBe(
      "2026-10-15T00:00:00.000Z",
    );
  });
});

describe("les libellés", () => {
  it("l'absence est datée du rendez-vous, la décision du jour où elle est prise", () => {
    const rdv = J("2026-09-22T08:00:00Z");
    const le = J("2026-09-28T10:00:00Z");
    expect(libellePointApporteur({ issue: "absent", decision: null, renseigneLe: le }, rdv)).toBe(
      "Absent le 22/09",
    );
    expect(
      libellePointApporteur({ issue: "eu_lieu", decision: "retenu", renseigneLe: le }, rdv),
    ).toBe("On poursuit (28/09)");
    expect(
      libellePointApporteur({ issue: "eu_lieu", decision: "a_revoir", renseigneLe: le }, rdv),
    ).toBe("À revoir");
  });
});

describe("le badge de la liste des apporteurs", () => {
  const point = (
    issue: "eu_lieu" | "absent" | "reporte",
    decision: DecisionApporteur | null,
    le = "2026-09-28T10:00:00Z",
  ) => ({
    issue,
    decision,
    renseigneLe: J(le),
  });

  it("une décision définitive l'emporte sur tout, la plus récente d'abord", () => {
    expect(
      decisionAffichee([
        {
          debut: J("2026-09-10T08:00:00Z"),
          annule: false,
          point: point("eu_lieu", "non_retenu", "2026-09-10T09:00:00Z"),
        },
        {
          debut: J("2026-09-20T08:00:00Z"),
          annule: false,
          point: point("eu_lieu", "retenu", "2026-09-20T09:00:00Z"),
        },
      ]),
    ).toEqual({ type: "retenu", le: J("2026-09-20T09:00:00Z") });
  });

  it("absent puis NOUVELLE réservation : l'absence s'efface devant l'échange réservé", () => {
    const echanges: EchangeAvecPoint[] = [
      { debut: J("2026-09-10T08:00:00Z"), annule: false, point: point("absent", null) },
      { debut: J("2026-09-30T08:00:00Z"), annule: false, point: null },
    ];
    expect(decisionAffichee(echanges)).toBeNull();
    expect(
      badgeSuiviInvitation({
        invitation: null,
        relances: [],
        echange: "reserve",
        decision: decisionAffichee(echanges),
      }),
    ).toEqual({ type: "echange-reserve" });
  });

  it("le dernier échange « Absent » ou « À revoir » se lit tel quel ; un échange annulé ne compte pas", () => {
    expect(
      decisionAffichee([
        { debut: J("2026-09-22T08:00:00Z"), annule: false, point: point("absent", null) },
        { debut: J("2026-09-25T08:00:00Z"), annule: true, point: null },
      ]),
    ).toEqual({ type: "absent", le: J("2026-09-22T08:00:00Z") });
    expect(
      decisionAffichee([
        { debut: J("2026-09-22T08:00:00Z"), annule: false, point: point("eu_lieu", "a_revoir") },
      ]),
    ).toEqual({ type: "a-revoir" });
    expect(
      decisionAffichee([
        { debut: J("2026-09-22T08:00:00Z"), annule: false, point: point("reporte", null) },
      ]),
    ).toBeNull();
  });

  it("🔑 la décision passe AVANT « Échange réservé » (l'échange tenu reste « programmé » dans Calendly)", () => {
    const le = J("2026-09-28T10:00:00Z");
    for (const decision of [
      { type: "retenu", le },
      { type: "non-retenu", le },
      { type: "a-revoir" },
      { type: "absent", le },
    ] as const) {
      expect(
        badgeSuiviInvitation({
          invitation: J("2026-09-15T10:00:00Z"),
          relances: [],
          echange: "reserve",
          reponse: J("2026-09-16T10:00:00Z"),
          decision,
        }),
      ).toEqual(decision);
    }
  });
});
