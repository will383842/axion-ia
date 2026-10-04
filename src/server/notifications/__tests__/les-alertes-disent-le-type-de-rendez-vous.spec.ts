// Les alertes de réservation disent le TYPE de rendez-vous (2026-10-04).
//
// Chantier « Types de rendez-vous », lot L3. Le titre Telegram est le seul
// endroit où distinguer, depuis l'écran verrouillé, un diagnostic d'un échange
// projet, d'un salon ou d'un candidat apporteur. Le payload peut porter le
// type classé ; sans lui (payload d'avant), le nom fait foi.

import { describe, it, expect } from "vitest";
import { formatNotification } from "../format";

function reservation(payload: { eventName?: string; typeRendezVous?: string; besoin?: string }) {
  return {
    category: "CALENDLY_INVITEE_CREATED" as const,
    payload: {
      eventUri: "evt_1",
      inviteeEmail: "a@b.fr",
      inviteeName: "Léa",
      eventStartTime: "(voir mail Calendly)",
      ...payload,
    },
  } as Parameters<typeof formatNotification>[0];
}

/** La ligne d'en-tête, déséchappée du MarkdownV2. */
function titre(payload: Parameters<typeof reservation>[0]): string {
  const { text } = formatNotification(reservation(payload), "info");
  return (text.split("\n")[0] ?? "").replace(/\\(.)/g, "$1");
}

describe("CALENDLY_INVITEE_CREATED — un titre par type", () => {
  it("diagnostic : « Diagnostic IA réservé »", () => {
    expect(titre({ eventName: "Diagnostic IA", typeRendezVous: "diagnostic" })).toContain(
      "Diagnostic IA réservé",
    );
  });

  it("échange projet avec besoin : « Échange projet réservé — Besoin : Formation »", () => {
    expect(
      titre({
        eventName: "Discutons de votre projet IA",
        typeRendezVous: "echange_projet",
        besoin: "Formation",
      }),
    ).toContain("Échange projet réservé — Besoin : Formation");
  });

  it("échange projet sans besoin : titre court, sans « Besoin : »", () => {
    const t = titre({ eventName: "premier-contact", typeRendezVous: "echange_projet" });
    expect(t).toContain("Échange projet réservé");
    expect(t).not.toContain("Besoin");
  });

  it("salon GOFAB : « Salon GOFAB réservé » — plus jamais « client »", () => {
    const t = titre({
      eventName: "Rencontre au salon GOFAB — 13 octobre",
      typeRendezVous: "salon",
    });
    expect(t).toContain("Salon GOFAB réservé");
    expect(t).not.toContain("client");
  });

  it("apporteur : « Échange apporteur réservé »", () => {
    expect(
      titre({ eventName: "Échange apporteur d'affaires", typeRendezVous: "apporteur" }),
    ).toContain("Échange apporteur réservé");
  });

  it("double verrou : un nom apporteur reste apporteur, même mal classé", () => {
    expect(titre({ eventName: "Échange apporteur", typeRendezVous: "echange_projet" })).toContain(
      "Échange apporteur réservé",
    );
  });

  it("type absent (payload d'avant) : le NOM classe — slug premier-contact = échange projet", () => {
    expect(titre({ eventName: "premier-contact" })).toContain("Échange projet réservé");
    expect(titre({ eventName: "Rencontre au salon GOFAB" })).toContain("Salon GOFAB réservé");
    expect(titre({ eventName: "diagnostic-ia" })).toContain("Diagnostic IA réservé");
  });

  it("type inconnu ou hors liste : repli sur le nom, jamais une valeur brute", () => {
    const t = titre({ eventName: "Appel découverte", typeRendezVous: "n'importe-quoi" });
    expect(t).toContain("Appel client réservé");
    expect(t).not.toContain("n'importe-quoi");
  });

  it("un besoin très long est tronqué dans le titre", () => {
    const t = titre({
      eventName: "Échange projet",
      typeRendezVous: "echange_projet",
      besoin: "x".repeat(200),
    });
    expect(t.length).toBeLessThan(140);
    expect(t).toContain("…");
  });
});
