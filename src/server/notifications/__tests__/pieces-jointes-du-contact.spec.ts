/**
 * L'alerte d'un message de contact dit combien de pièces jointes il porte
 * (2026-10-15) — le NOMBRE, jamais les noms : un nom de fichier est du contenu
 * saisi, et la règle du 11/10/2026 le garde hors de Telegram.
 */

import { describe, expect, it } from "vitest";

import { formatNotification } from "../format";
import type { NotificationEvent } from "../types";

const evenement = (extra: Record<string, unknown>) =>
  ({
    category: "INTERVENTION_REQUEST_SUBMITTED",
    payload: {
      submissionId: "sub_1",
      contactName: "Camille Exemple",
      contactEmail: "camille@example.invalid",
      locale: "fr",
      ...extra,
    },
  }) as unknown as NotificationEvent;

describe("alerte d'un message — pièces jointes", () => {
  it("affiche le nombre de pièces jointes, sans leurs noms", () => {
    const { text } = formatNotification(
      evenement({ piecesJointes: 2, piecesJointesNoms: ["CDC-CANARI.pdf", "Devis.xlsx"] }),
      "info",
    );
    expect(text).toContain("📎 Pièces jointes* : 2");
    expect(text).not.toContain("CANARI");
    expect(text).not.toContain("Devis");
  });

  it("ne dit rien sans pièce jointe", () => {
    const { text } = formatNotification(evenement({}), "info");
    expect(text).not.toContain("Pièces jointes");
  });
});
