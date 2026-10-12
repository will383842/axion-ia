/**
 * Lot D2 (M22) — F36, variante « mission » de `autofacture-transmission`.
 * Le relevé MENSUEL garde son texte à l'identique (aucune valeur `missionLabel`).
 */

import { describe, expect, it } from "vitest";

import { renderEmailTemplate } from "./index";

const BASE = {
  sousTraitantNom: "Paule Martin",
  numero: "AXI-AUTOF-2026-0012",
  periodeLabel: "novembre 2026",
  montantLabel: "1 560,00 € TTC",
  dateEcheanceLabel: "17/12/2026",
  contestationAvantLabel: "03/12/2026",
};

describe("autofacture-transmission — variante mission (F36)", () => {
  it("dit « mission », le bouton d'espace pour le désaccord et l'échéance à 30 jours", async () => {
    const r = await renderEmailTemplate("autofacture-transmission", "fr", {
      ...BASE,
      missionLabel: "« IA générative » du 16/11/2026 au 17/11/2026",
    });
    expect(r.text).toContain("pour la mission « IA générative » du 16/11/2026 au 17/11/2026");
    expect(r.text).not.toContain("pour la période de");
    expect(r.text).toContain("« Signaler un désaccord »");
    expect(r.text).toContain("jusqu'au 03/12/2026 inclus");
    expect(r.text).toContain(
      "Le virement est prévu au plus tard le 17/12/2026, 30 jours après la dernière journée.",
    );
  });

  it("sans `missionLabel` : le texte du relevé mensuel, inchangé", async () => {
    const r = await renderEmailTemplate("autofacture-transmission", "fr", BASE);
    expect(r.text).toContain("pour la période de novembre 2026");
    expect(r.text).toContain("il vous suffit de répondre à cet e-mail");
    expect(r.text).toContain("Le règlement vous parviendra au plus tard le 17/12/2026.");
    expect(r.text).not.toContain("Signaler un désaccord");
  });
});
