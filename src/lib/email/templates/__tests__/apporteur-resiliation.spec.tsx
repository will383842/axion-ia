import { describe, expect, it } from "vitest";

import { renderEmailTemplate } from "@/lib/email/templates";

// Contrat 2.7, art. 11 : l'e-mail de résiliation donne la DATE DE FIN, vouvoie, et dit que le
// contrat continue pendant le préavis.

const base = {
  contactName: "Jeanne Martin",
  dateNotification: "9 octobre 2026",
  dateFin: "8 novembre 2026",
  preavisJours: 30,
};

describe("e-mail « apporteur-resiliation »", () => {
  it("la Société résilie : préavis, date de fin, le contrat continue d'ici là", async () => {
    const r = await renderEmailTemplate("apporteur-resiliation", "fr", { ...base, cas: "societe" });
    expect(r.subject).toBe("Résiliation de votre contrat d'apporteur");
    expect(r.html).toContain("avec un préavis de 30 jours (article 11.1 du contrat)");
    expect(r.html).toContain("Votre contrat prend fin le 8 novembre 2026.");
    expect(r.html).toContain("le contrat continue de produire ses effets");
    expect(r.html).not.toMatch(/agent commercial|\btu\b|\bton\b|\btes\b/);
  });

  it("l'apporteur résilie : accusé de réception et date de fin", async () => {
    const r = await renderEmailTemplate("apporteur-resiliation", "fr", {
      ...base,
      cas: "apporteur",
    });
    expect(r.html).toContain("Nous avons bien reçu, le 9 octobre 2026, la résiliation");
    expect(r.html).toContain("votre contrat prend fin le 8 novembre 2026");
  });

  it("manquement : sans préavis, le motif, la date de fin", async () => {
    const r = await renderEmailTemplate("apporteur-resiliation", "fr", {
      ...base,
      cas: "manquement",
      dateFin: "20 octobre 2026",
      motifResiliation: "Démarchage au nom d'Axion-IA.",
    });
    expect(r.html).toContain("sans préavis, en application de l&#x27;article 11.2");
    expect(r.html).toContain("Votre contrat prend fin le 20 octobre 2026.");
    expect(r.html).toContain("Démarchage au nom d&#x27;Axion-IA.");
  });

  it("annulée : le contrat continue", async () => {
    const r = await renderEmailTemplate("apporteur-resiliation", "fr", { ...base, cas: "annulee" });
    expect(r.subject).toBe("Votre contrat d'apporteur d'affaires continue");
    expect(r.html).toContain("qui vous avait été notifiée le 9 octobre 2026 est annulée");
  });
});
