// Tests format.ts — escapeMarkdownV2 + formatNotification (Sprint Notif Infra 2026-05-26).

import { describe, it, expect } from "vitest";
import { escapeMarkdownV2, formatNotification, formatParisDateTime } from "../format";

describe("escapeMarkdownV2", () => {
  it("échappe les 18 caractères réservés MarkdownV2", () => {
    const input = "_*[]()~`>#+-=|{}.!";
    const out = escapeMarkdownV2(input);
    // Chaque char devrait être préfixé par "\".
    for (const c of input) {
      expect(out).toContain(`\\${c}`);
    }
  });

  it("n'échappe pas les lettres ni les chiffres", () => {
    expect(escapeMarkdownV2("Bonjour 42")).toBe("Bonjour 42");
  });

  it("échappe les antislashes", () => {
    expect(escapeMarkdownV2("a\\b")).toBe("a\\\\b");
  });

  it("traite les emails (point + tirets)", () => {
    expect(escapeMarkdownV2("user@axion-ia.com")).toBe("user@axion\\-ia\\.com");
  });
});

describe("formatParisDateTime", () => {
  it("retourne '—' pour input invalide ou vide", () => {
    expect(formatParisDateTime(undefined)).toBe("—");
    expect(formatParisDateTime("not-a-date")).toBe("—");
  });

  it("formatte une Date en Europe/Paris fr-FR", () => {
    const d = new Date("2026-05-26T08:30:00Z"); // 10:30 Paris (heure d'été)
    const formatted = formatParisDateTime(d);
    // dateStyle: "medium" en fr-FR donne "26 mai 2026, 10:30"
    expect(formatted).toContain("26");
    expect(formatted).toContain("2026");
    expect(formatted).toContain("10:30");
  });
});

describe("formatNotification", () => {
  it("CONTACT_FORM_SUBMITTED produit un message MarkdownV2 valide", () => {
    const { text } = formatNotification(
      {
        category: "CONTACT_FORM_SUBMITTED",
        payload: {
          submissionId: "sub_123",
          contactName: "Jean Dupont",
          contactEmail: "jean@example.com",
          formType: "contact",
          ville: "Paris",
          locale: "fr",
        },
      },
      "info",
    );
    expect(text).toContain("🟢");
    expect(text).toContain("*Nouveau message contact*");
    // Email contient un point → doit être échappé.
    expect(text).toContain("jean@example\\.com");
    // ID submission affiché.
    expect(text).toContain("sub\\_123");
    // Footer avec catégorie.
    expect(text).toContain("CONTACT\\_FORM\\_SUBMITTED");
  });

  it("CALENDLY_INVITEE_CREATED inclut start-time et page URL échappés", () => {
    const { text } = formatNotification(
      {
        category: "CALENDLY_INVITEE_CREATED",
        payload: {
          eventUri: "evt_abc",
          inviteeEmail: "invitee@axion-ia.com",
          inviteeName: "Will",
          eventStartTime: "2026-05-30T10:00:00Z",
          eventName: "appel-decouverte",
          pageUrl: "https://axion-ia.com/fr/appel",
        },
      },
      "info",
    );
    expect(text).toContain("appel\\-decouverte");
    expect(text).toContain("axion\\-ia\\.com");
  });

  it("severity warn/error utilise le bon emoji", () => {
    const warn = formatNotification(
      {
        category: "OPTION_REFUSED",
        payload: { bookingId: "bk_1", admin: "Will", reason: "indispo" },
      },
      "warn",
    );
    expect(warn.text).toMatch(/^🟡/);
    const err = formatNotification(
      {
        category: "DEPLOY_FAILED",
        payload: { sha: "abc1234", error: "build crashed" },
      },
      "error",
    );
    expect(err.text).toMatch(/^🔴/);
  });
});
