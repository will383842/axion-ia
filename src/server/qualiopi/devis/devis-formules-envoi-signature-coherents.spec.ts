/**
 * Cohérence envoi ⇔ signature ⇔ PDF du devis à formules, sur le VRAI module de l'interrupteur
 * (Prisma simulé) : 3 états × 2 types de fiche. Un devis qui peut partir doit pouvoir se signer ;
 * un devis refusé à l'envoi ne produit ni PDF ni jeton.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  etat: "eteint" as "eteint" | "essai" | "actif",
  essais: new Set<string>(),
  lectures: 0,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    setting: {
      findUnique: async () => {
        h.lectures += 1;
        return { value: { etat: h.etat } };
      },
    },
    clientTestInterne: {
      findUnique: async ({ where }: { where: { clientId: string } }) =>
        h.essais.has(where.clientId) ? { clientId: where.clientId } : null,
    },
  },
}));
vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: async () => ({ raisonSociale: "Axion", qualiopi: "" }),
}));
vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: async (k: string) => (k === "regime_tva" ? "assujetti" : 20),
}));
vi.mock("@/server/qualiopi/config/flag", () => ({ isQualiopiCertificationObtenue: () => false }));

import { offreFictive } from "./offre-fixtures.spec-util";
import { formulesActives } from "./interrupteur-formules";
import {
  donneesPdfDevis,
  lireContextePdfDevis,
  OffreDevisInvalideError,
  type DevisPourPdf,
} from "../documents/donnees-pdf-devis";

const FICHE = "c-essai";
const VRAI = "c-vrai";
const ETATS = ["eteint", "essai", "actif"] as const;

const devis = (clientId: string) =>
  ({
    clientId,
    numero: "AXI-DEV-1",
    lignes: [],
    activite: "implementation",
    refClient: null,
    financementSuggere: null,
    montantOpcoEstimeCents: null,
    resteAChargeCents: null,
    conditionsParticulieres: null,
    dateValidite: new Date("2026-12-31"),
    offre: {
      ...offreFictive(),
      abonnement: { ...offreFictive().abonnement!, indemniteSortieTauxBps: 0 },
    },
    client: { type: "entreprise", raisonSociale: "X" },
  }) as unknown as DevisPourPdf & { clientId: string };

/** Ce que fait l'envoi : UNE lecture de l'interrupteur, transmise au PDF. */
async function envoi(d: ReturnType<typeof devis>): Promise<"accepte" | "refuse"> {
  const ok = await formulesActives(undefined, { clientId: d.clientId });
  if (!ok) return "refuse";
  try {
    const data = donneesPdfDevis(d, await lireContextePdfDevis(ok), new Date());
    return data.formules !== undefined ? "accepte" : "refuse";
  } catch {
    return "refuse";
  }
}

/** Ce que fait la signature : même question, même cible. */
async function signature(d: ReturnType<typeof devis>): Promise<"accepte" | "refuse"> {
  return (await formulesActives(undefined, { clientId: d.clientId })) ? "accepte" : "refuse";
}

beforeEach(() => {
  h.etat = "eteint";
  h.essais = new Set([FICHE]);
  h.lectures = 0;
});

describe("envoi accepté ⇔ signature acceptée (3 états × 2 types de fiche)", () => {
  for (const etat of ETATS) {
    for (const [nom, id] of [
      ["fiche d'essai", FICHE],
      ["vrai client", VRAI],
    ] as const) {
      it(`${etat} / ${nom}`, async () => {
        h.etat = etat;
        const d = devis(id);
        const e = await envoi(d);
        expect(await signature(d)).toBe(e);
        const attendu = etat === "actif" || (etat === "essai" && id === FICHE);
        expect(e).toBe(attendu ? "accepte" : "refuse");
      });
    }
  }
});

describe("PDF du devis à formules", () => {
  it("essai + fiche d'essai : le PDF contient les formules", async () => {
    h.etat = "essai";
    const d = devis(FICHE);
    const ctx = await lireContextePdfDevis({ clientId: FICHE });
    expect(donneesPdfDevis(d, ctx, new Date()).formules).toBeDefined();
  });

  it("essai + vrai client : refus (OffreDevisInvalideError), jamais un devis classique vide", async () => {
    h.etat = "essai";
    const ctx = await lireContextePdfDevis({ clientId: VRAI });
    expect(() => donneesPdfDevis(devis(VRAI), ctx, new Date())).toThrow(OffreDevisInvalideError);
  });

  it("formules coupées : une offre n'est jamais rendue en devis classique", async () => {
    const ctx = await lireContextePdfDevis(false);
    expect(() => donneesPdfDevis(devis(FICHE), ctx, new Date())).toThrow(OffreDevisInvalideError);
  });

  it("garde vraie puis bascule : le PDF n'a pas relu l'interrupteur (une seule lecture)", async () => {
    h.etat = "actif";
    const d = devis(VRAI);
    const ok = await formulesActives(undefined, { clientId: d.clientId });
    const lecturesApresGarde = h.lectures;
    h.etat = "eteint"; // bascule entre la garde et le rendu
    const ctx = await lireContextePdfDevis(ok);
    expect(h.lectures).toBe(lecturesApresGarde);
    expect(donneesPdfDevis(d, ctx, new Date()).formules).toBeDefined();
  });

  it("devis classique : inchangé quel que soit l'état", async () => {
    const d = { ...devis(VRAI), offre: null };
    for (const etat of ETATS) {
      h.etat = etat;
      const ctx = await lireContextePdfDevis({ clientId: VRAI });
      expect(donneesPdfDevis(d, ctx, new Date()).formules).toBeUndefined();
    }
  });
});
