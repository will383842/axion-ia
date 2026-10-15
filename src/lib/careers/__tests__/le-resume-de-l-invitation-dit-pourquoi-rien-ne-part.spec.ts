import { describe, expect, it } from "vitest";

import { resumeInvitationFormateur } from "../invitation-formateur-resume";

const M = new Date("2026-10-20T10:00:00Z");
const NON_INVITEE = {
  invitationFormateurAt: null,
  rattrapageAt: null,
  clotureSansSuiteAt: null,
};

describe("V1-A-2 — la candidature attend AVEC SON MOTIF", () => {
  it("sans motif connu : « Pas encore invitée. » (le délai de 15 minutes court)", () => {
    expect(resumeInvitationFormateur(NON_INVITEE, M)).toBe("Pas encore invitée.");
  });

  it("opposition : le motif remplace « Pas encore invitée »", () => {
    const r = resumeInvitationFormateur(NON_INVITEE, M, { motifAttente: "opposition" });
    expect(r).not.toMatch(/Pas encore invitée/);
    expect(r).toMatch(/opposée|opposition/i);
    expect(r).toMatch(/aucune invitation/i);
  });

  it("SIRET fermé et registre muet : chacun dit sa raison", () => {
    expect(resumeInvitationFormateur(NON_INVITEE, M, { motifAttente: "siret-ferme" })).toMatch(
      /fermée/,
    );
    expect(resumeInvitationFormateur(NON_INVITEE, M, { motifAttente: "registre-muet" })).toMatch(
      /n'a pas répondu/,
    );
  });

  it("un motif sans libellé propre retombe sur « Pas encore invitée. »", () => {
    expect(resumeInvitationFormateur(NON_INVITEE, M, { motifAttente: "pas-freelance" })).toBe(
      "Pas encore invitée.",
    );
  });
});

describe("V1-A-4 — une personne invitée, sans réponse, est « à décider » après J+14", () => {
  const invitee = { ...NON_INVITEE, invitationFormateurAt: new Date("2026-10-01T10:00:00Z") };

  it("après J+14 sans réservation ni réponse : la phrase dit « à décider »", () => {
    expect(resumeInvitationFormateur(invitee, M, { aDecider: true })).toMatch(/À décider/);
  });

  it("sans le fait « à décider » : la phrase reste celle de J+7", () => {
    expect(resumeInvitationFormateur(invitee, M)).toContain("Plus aucun rappel");
  });
});
