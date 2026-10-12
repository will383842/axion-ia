/**
 * Lot C (M18) — la page ouverte depuis F23 montre le montant, l'échéance et la
 * liberté de refuser quand `choix_cartes` est allumé ; sinon, la page d'avant.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  cartes: true,
  mission: {
    id: "m1",
    statut: "en_attente",
    role: "principal",
    echeanceReponseAt: new Date("2026-11-01T10:00:00Z"),
    delaiDepasse: false,
    trainer: { id: "t1", prenom: "Marie", nom: "Durand" },
    session: {
      id: "s1",
      numero: "S-1",
      titreSession: "IA en entreprise",
      dateDebut: new Date("2026-11-10T08:00:00Z"),
      dateFin: new Date("2026-11-11T16:00:00Z"),
      modalite: "presentiel",
      lieu: "Lyon",
      effectif: "8",
    },
  },
}));

vi.mock("@/server/qualiopi/trainers/mission-formateur", () => ({
  lireMissionParJeton: async () => h.mission,
  LIBELLE_STATUT_MISSION: {},
  MOTIF_REFUS_MIN: 10,
  refusLibrePour: async () => false,
}));
vi.mock("@/server/qualiopi/formateurs-independants/interrupteur-allume", () => ({
  interrupteurAllume: async () => h.cartes,
}));
vi.mock("@/server/qualiopi/formateurs-independants/proposition-chiffree", () => ({
  lirePropositionChiffree: async () => ({
    intitule: "IA en entreprise",
    lignesJours: ["mardi 10 novembre · journée"],
    lieu: "Lyon",
    ligneHonoraires: "700 € HT",
    ligneDeplacement: "compris",
    forfaitParJourHtCents: null,
    totalHtCents: 70000,
  }),
}));
vi.mock("@/components/espace-formateur/MissionReponseForm", () => ({
  MissionReponseForm: () => null,
}));
vi.mock("@/components/espace-formateur/MissionMessageApresDelai", () => ({
  MissionMessageApresDelai: () => null,
}));
vi.mock("@/server/actions/qualiopi/mission-formateur", () => ({ ecrireApresDelaiAction: vi.fn() }));

import Page from "./page";

async function rendu(): Promise<string> {
  const el = await Page({ params: Promise.resolve({ locale: "fr", token: "jeton" }) });
  return renderToStaticMarkup(el);
}

describe("page de proposition (F23)", () => {
  beforeEach(() => {
    h.cartes = true;
  });
  it("montre honoraires, échéance et liberté de refuser", async () => {
    const html = await rendu();
    expect(html).toContain("700 € HT");
    expect(html).toContain("Réponse avant");
    expect(html).toContain("libre d&#x27;accepter ou de refuser");
  });
  it("interrupteur coupé : la page d'avant, sans montant", async () => {
    h.cartes = false;
    const html = await rendu();
    expect(html).not.toContain("700 € HT");
    expect(html).not.toContain("Réponse avant");
  });
});
