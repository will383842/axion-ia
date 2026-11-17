// L'accusé de demande de devis, sans nom d'entreprise : la phrase reste
// complète et rien ne s'affiche en « undefined ».

import { describe, expect, it } from "vitest";

import { renderEmailTemplate } from "../index";

describe("quote-request-received sans entreprise", () => {
  it("dit la demande de devis, sans undefined", async () => {
    const { html } = await renderEmailTemplate("quote-request-received", "fr", {
      contactName: "X",
      submissionId: "s",
    });
    expect(html).toContain("Nous avons bien reçu votre demande de devis.");
    expect(html).not.toContain("undefined");
  });
});
