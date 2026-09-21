// Les alertes disent « apporteur » ou « client » (2026-09-19).
//
// Un échange avec un candidat apporteur et un appel de découverte client
// partagent la même catégorie et le même salon Telegram (B6 : aucun canal,
// aucun routage ne change). Le titre est donc le seul endroit où les
// distinguer depuis l'écran verrouillé.
//
// Contrat site/worker : AUCUN champ n'est ajouté au payload. Un payload d'avant
// doit se formater sans erreur — c'est le premier cas.

import { describe, it, expect } from "vitest";
import { formatNotification, formatNotificationWhatsApp } from "../format";
import { getRouting, telegramGroupFor } from "../routing";

function reservation(eventName: string | undefined) {
  return {
    category: "CALENDLY_INVITEE_CREATED" as const,
    payload: {
      eventUri: "evt_1",
      inviteeEmail: "a@b.fr",
      inviteeName: "Léa",
      eventStartTime: "(voir mail Calendly)",
      eventName,
    },
  } as Parameters<typeof formatNotification>[0];
}

describe("CALENDLY_INVITEE_CREATED — apporteur ou client", () => {
  it("un payload ANCIEN (sans aucun champ facultatif) se formate sans erreur", () => {
    const { text } = formatNotification(reservation("appel-decouverte"), "info");
    expect(text).toContain("Appel client réservé");
    expect(text).toContain("Léa");
  });

  it("un payload sans nom de type garde le titre neutre, sans rien affirmer", () => {
    const { text } = formatNotification(reservation(undefined), "info");
    expect(text).toContain("Nouvelle réservation");
    expect(text).not.toContain("client réservé");
    expect(text).not.toContain("apporteur réservé");
  });

  it("un échange apporteur s'annonce « Échange apporteur réservé »", () => {
    const { text } = formatNotification(
      reservation("Échange apporteur d'affaires (15 min)"),
      "info",
    );
    expect(text).toContain("Échange apporteur réservé");
    expect(text).not.toContain("Appel client réservé");
  });

  it("un appel de découverte s'annonce « Appel client réservé »", () => {
    const { text } = formatNotification(reservation("Appel découverte — 30 min"), "info");
    expect(text).toContain("Appel client réservé");
  });

  it("l'en-tête de thème et le salon ne changent pas", () => {
    const { text } = formatNotification(reservation("Échange apporteur"), "info");
    expect(text.startsWith("📅 *CALENDLY* · ")).toBe(true);
    expect(telegramGroupFor("CALENDLY_INVITEE_CREATED")).toBe("calendly");
  });
});

describe("COMMERCIAL_APPLICATION_RECEIVED — nouveau candidat apporteur", () => {
  const ancien = {
    category: "COMMERCIAL_APPLICATION_RECEIVED" as const,
    payload: {
      submissionId: "sub_42",
      contactName: "Léa Martin",
      contactEmail: "lea@example.com",
      usesAi: false,
      locale: "fr" as const,
    },
  };

  it("un payload ANCIEN se formate sans erreur, titré « Nouveau candidat apporteur »", () => {
    const { text } = formatNotification(ancien, "info");
    expect(text).toContain("Nouveau candidat apporteur");
    expect(text).not.toMatch(/Candidature commercial/);
  });

  it("le lien ouvre la fiche apporteur sur le bloc d'invitation", () => {
    const { text } = formatNotification(ancien, "info");
    // MarkdownV2 échappe `#`, `-` et `/` n'en fait pas partie.
    expect(text).toContain("/contacts/commercial/sub\\_42\\#invitation");
  });

  it("WhatsApp dit « apporteur » lui aussi — sans aucune donnée", () => {
    const { text } = formatNotificationWhatsApp("COMMERCIAL_APPLICATION_RECEIVED", "info");
    expect(text).toContain("Nouveau candidat apporteur");
    expect(text).not.toContain("lea@example.com");
  });
});

describe("B6 — mêmes canaux, même routage", () => {
  it("les deux catégories gardent exactement leurs canaux et leur salon", () => {
    expect(getRouting("CALENDLY_INVITEE_CREATED").channels).toEqual(["telegram"]);
    expect(getRouting("COMMERCIAL_APPLICATION_RECEIVED").channels).toEqual(["telegram"]);
    expect(telegramGroupFor("COMMERCIAL_APPLICATION_RECEIVED")).toBe("commercial-memo");
  });
});
