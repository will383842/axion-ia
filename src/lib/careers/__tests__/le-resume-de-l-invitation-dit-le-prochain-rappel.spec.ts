import { describe, expect, it } from "vitest";

import { resumeInvitationFormateur } from "../invitation-formateur-resume";

const M = new Date("2026-10-20T10:00:00Z");
describe("resumeInvitationFormateur (S-UX-16)", () => {
  it("dit le prochain rappel et ce qui l'arrête", () => {
    const r = resumeInvitationFormateur(
      {
        invitationFormateurAt: new Date("2026-10-19T10:00:00Z"),
        rattrapageAt: null,
        clotureSansSuiteAt: null,
      },
      M,
    );
    expect(r).toContain("Prochain rappel le 22 octobre");
    expect(r).toContain("réserve, répond ou que vous décidez");
  });
  it("après J+7 : plus rien ; rattrapage : sans rappel ; close : sans e-mail", () => {
    expect(
      resumeInvitationFormateur(
        {
          invitationFormateurAt: new Date("2026-10-01T10:00:00Z"),
          rattrapageAt: null,
          clotureSansSuiteAt: null,
        },
        M,
      ),
    ).toContain("Plus aucun rappel");
    expect(
      resumeInvitationFormateur(
        { invitationFormateurAt: null, rattrapageAt: M, clotureSansSuiteAt: null },
        M,
      ),
    ).toContain("sans rappel");
    expect(
      resumeInvitationFormateur(
        { invitationFormateurAt: M, rattrapageAt: null, clotureSansSuiteAt: M },
        M,
      ),
    ).toContain("sans e-mail");
  });
});
