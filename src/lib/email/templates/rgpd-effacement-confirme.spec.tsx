// @vitest-environment node
/**
 * Lot P10 — le courriel de confirmation (art. 19) INFORME de la corbeille
 * d'envoi gardée. Une personne dont seule une ligne de corbeille est conservée
 * ne doit pas lire que « tout » est effacé.
 */
import { describe, it, expect } from "vitest";
import { renderEmailTemplate } from "./index";

const BASE = {
  effectueLe: "19 octobre 2026",
  demandes: 0,
  newsletter: 0,
  conversations: 0,
  candidatures: 0,
  appels: 0,
};

async function texte(extra: Record<string, unknown>): Promise<string> {
  const r = await renderEmailTemplate("rgpd-effacement-confirme", "fr", { ...BASE, ...extra });
  return `${r.html} ${r.text}`;
}

describe("rgpd-effacement-confirme — bloc « conservé »", () => {
  it("🔴 seule la corbeille est gardée : le bloc le dit, sans durée chiffrée", async () => {
    const t = await texte({ outboxConserveesFormation: 2 });
    expect(t).toContain("2 e-mails");
    expect(t).toContain("durée légale de conservation");
    expect(t).not.toContain("5 ans");
  });

  it("rien de gardé : aucune phrase de conservation de formation", async () => {
    const t = await texte({ copiesFormationConservees: 0, outboxConserveesFormation: 0 });
    expect(t).not.toContain("lié");
    expect(t).not.toContain("durée légale de conservation");
  });
});
