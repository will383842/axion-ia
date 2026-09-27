// Rappels de l'invitation à l'échange — la RÈGLE pure (décision Will, 2026-09-27).
//
// J+3 puis J+7, jamais un troisième ; rien si la personne a réservé (même
// annulé), a reçu une réponse, est archivée / sans suite ou effacée. Et le
// badge de la liste suit sa priorité : échange réservé > annulé > rappel 2 >
// rappel 1 > invité.

import { describe, expect, it } from "vitest";

import {
  badgeSuiviInvitation,
  decisionRelance,
  jobIdRelanceInvitation,
  type EtatRelanceInvitation,
} from "../relance-invitation";

const JOUR = 24 * 60 * 60 * 1000;
const INVITATION = new Date("2026-09-27T19:30:00Z");
const apres = (jours: number, heures = 0) =>
  new Date(INVITATION.getTime() + jours * JOUR + heures * 3600_000);

function etat(over: Partial<EtatRelanceInvitation> = {}): EtatRelanceInvitation {
  return {
    derniereInvitation: INVITATION,
    relancesApres: [],
    reserve: false,
    repondu: false,
    close: false,
    efface: false,
    ...over,
  };
}

describe("le calendrier des rappels", () => {
  it("rien avant trois jours pleins", () => {
    expect(decisionRelance(etat(), apres(2, 23))).toEqual({ relancer: false, motif: "pas-encore" });
  });

  it("premier rappel à J+3", () => {
    expect(decisionRelance(etat(), apres(3))).toEqual({ relancer: true, etape: "j3" });
  });

  it("le lendemain du premier rappel, rien : le second attend J+7", () => {
    expect(decisionRelance(etat({ relancesApres: [apres(3)] }), apres(4))).toEqual({
      relancer: false,
      motif: "pas-encore",
    });
  });

  it("second et dernier rappel à J+7", () => {
    expect(decisionRelance(etat({ relancesApres: [apres(3, 12)] }), apres(7, 13))).toEqual({
      relancer: true,
      etape: "j7",
    });
  });

  it("🔴 jamais un troisième", () => {
    const e = etat({ relancesApres: [apres(3), apres(7)] });
    expect(decisionRelance(e, apres(8))).toEqual({ relancer: false, motif: "termine" });
    expect(decisionRelance(e, apres(13))).toEqual({ relancer: false, motif: "termine" });
  });

  it("rattrapage d'une invitation antérieure au passage : J+3 d'abord, puis trois jours d'écart", () => {
    // Invitation vieille de 9 jours, aucun rappel : le premier part…
    expect(decisionRelance(etat(), apres(9))).toEqual({ relancer: true, etape: "j3" });
    // … et le second ne part pas le lendemain, alors que J+7 est dépassé.
    expect(decisionRelance(etat({ relancesApres: [apres(9)] }), apres(10))).toEqual({
      relancer: false,
      motif: "pas-encore",
    });
    expect(decisionRelance(etat({ relancesApres: [apres(9)] }), apres(12))).toEqual({
      relancer: true,
      etape: "j7",
    });
  });

  it("au-delà de 14 jours, l'invitation n'est plus relancée", () => {
    expect(decisionRelance(etat(), apres(14, 1))).toEqual({
      relancer: false,
      motif: "trop-ancienne",
    });
  });
});

describe("ce qui arrête tout rappel", () => {
  it.each<[string, Partial<EtatRelanceInvitation>, string]>([
    ["un échange réservé (même annulé)", { reserve: true }, "reserve"],
    ["une réponse depuis l'invitation", { repondu: true }, "repondu"],
    ["une fiche archivée ou sans suite", { close: true }, "close"],
    ["une fiche supprimée ou effacée", { efface: true }, "efface"],
  ])("%s", (_cas, over, motif) => {
    expect(decisionRelance(etat(over), apres(3))).toEqual({ relancer: false, motif });
    expect(decisionRelance(etat({ ...over, relancesApres: [apres(3)] }), apres(7))).toEqual({
      relancer: false,
      motif,
    });
  });
});

describe("l'identifiant du job", () => {
  it("est déterministe, porte l'étape, l'empreinte et l'invitation — jamais l'adresse", () => {
    const a = jobIdRelanceInvitation("j3", "abc123", "inv-1");
    expect(a).toBe(jobIdRelanceInvitation("j3", "abc123", "inv-1"));
    expect(a).toBe("apporteur-invit-relance-j3-abc123-inv-1");
    expect(jobIdRelanceInvitation("j7", "abc123", "inv-1")).not.toBe(a);
    // Une nouvelle invitation (« Renvoyer quand même ») a ses propres rappels.
    expect(jobIdRelanceInvitation("j3", "abc123", "inv-2")).not.toBe(a);
    expect(a).not.toContain(":");
    expect(a).not.toContain("@");
  });
});

describe("le badge de la liste suit la priorité", () => {
  const INV = new Date("2026-09-27T19:30:00Z");
  const R1 = new Date("2026-10-01T08:00:00Z");
  const R2 = new Date("2026-10-05T08:00:00Z");

  it("échange réservé > tout le reste", () => {
    expect(
      badgeSuiviInvitation({ invitation: INV, relances: [R1, R2], echange: "reserve" }),
    ).toEqual({ type: "echange-reserve" });
  });

  it("échange annulé > rappels", () => {
    expect(
      badgeSuiviInvitation({ invitation: INV, relances: [R1, R2], echange: "annule" }),
    ).toEqual({ type: "echange-annule" });
  });

  it("rappel 2 > rappel 1 > invité", () => {
    expect(badgeSuiviInvitation({ invitation: INV, relances: [R1, R2], echange: null })).toEqual({
      type: "rappel",
      numero: 2,
      le: R2,
    });
    expect(badgeSuiviInvitation({ invitation: INV, relances: [R1], echange: null })).toEqual({
      type: "rappel",
      numero: 1,
      le: R1,
    });
    expect(badgeSuiviInvitation({ invitation: INV, relances: [], echange: null })).toEqual({
      type: "invite",
      le: INV,
    });
  });

  it("rien à dire : la liste garde son badge", () => {
    expect(badgeSuiviInvitation(undefined)).toBeNull();
    expect(badgeSuiviInvitation({ invitation: null, relances: [], echange: null })).toBeNull();
  });
});
