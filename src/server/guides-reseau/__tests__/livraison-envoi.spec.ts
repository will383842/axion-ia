// @vitest-environment node
//
// PR-S2b — `mettreEnFileGuide` livre le bon guide (scénarios 8 à 11).
// Charge de l'e-mail : 2 clés FACULTATIVES (`guideCode`, `guideTitre`), JAMAIS pour guide-ia.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type Ligne = Record<string, unknown>;
const bd = vi.hoisted(() => ({
  envois: [] as unknown[][],
  lecturesCibles: 0,
  cible: null as Ligne | null,
  circuit: false,
  journal: [] as string[],
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    cibleReseau: {
      findUnique: async () => {
        bd.lecturesCibles += 1;
        return bd.cible;
      },
    },
    emailLog: { count: async () => 0 },
    guideRequest: { update: async () => ({}) },
  },
}));
vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: (e: string | null | undefined) => (e ? `h:${e.trim().toLowerCase()}` : null),
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: async (...a: unknown[]) => {
    bd.envois.push(a);
    return { enqueued: true };
  },
}));
vi.mock("@/server/guide-ia/coupe-circuit", () => ({
  coupeCircuitDeclenche: async () => bd.circuit,
}));

import { mettreEnFileGuide } from "@/server/guide-ia/envoi";

const D = "d".repeat(64);
const CIBLE = {
  code: "gde-essai-01",
  type: "guide",
  titre: "Le plan en 90 jours",
  cheminPdf: "guides-reseau/plan-90-jours.pdf",
  actif: true,
  test: false,
};
const demande = (aimant: string) => ({
  id: "demande-1",
  email: "personne@example.test",
  locale: "fr" as const,
  downloadToken: D,
  aimant,
});

beforeEach(() => {
  bd.envois.length = 0;
  bd.journal.length = 0;
  bd.lecturesCibles = 0;
  bd.cible = { ...CIBLE };
  bd.circuit = false;
  for (const m of ["warn", "error", "log"] as const) {
    vi.spyOn(console, m).mockImplementation((...a: unknown[]) => {
      bd.journal.push(a.map(String).join(" "));
    });
  }
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("mettreEnFileGuide — livrer le bon guide", () => {
  it("8. guide du catalogue, livraison ÉTEINTE : rien en file, jamais le texte guide-ia, journal sans adresse", async () => {
    const r = await mettreEnFileGuide(demande("gde-essai-01"), { reseau: true });
    expect(r).toBe("non-parti");
    expect(bd.envois).toHaveLength(0);
    expect(bd.journal.join("\n")).toContain("guides_reseau_livraison_retenue");
    expect(bd.journal.join("\n")).not.toContain("personne@example.test");
  });

  it("9. guide du catalogue, livraison ALLUMÉE : la charge porte guideCode et guideTitre, rien d'autre en plus", async () => {
    vi.stubEnv("GUIDES_RESEAU_LIVRAISON_ENABLED", "true");
    const r = await mettreEnFileGuide(demande("gde-essai-01"), { reseau: true });
    expect(r).toBe("en-file");
    expect(bd.envois).toHaveLength(1);
    expect(bd.envois[0]![0]).toBe("guide-ia-envoi");
    expect(bd.envois[0]![3]).toStrictEqual({
      downloadToken: D,
      reseau: true,
      guideCode: "gde-essai-01",
      guideTitre: "Le plan en 90 jours",
    });
    expect(bd.envois[0]![4]).toEqual({
      entityType: "GuideRequest",
      entityId: "demande-1",
      priority: 10,
    });
  });

  it("10. guide-ia : charge strictement inchangée, AUCUNE lecture de cibles_reseau (livraison éteinte ou allumée)", async () => {
    for (const livraison of [undefined, "true"]) {
      bd.envois.length = 0;
      if (livraison) vi.stubEnv("GUIDES_RESEAU_LIVRAISON_ENABLED", livraison);
      const r = await mettreEnFileGuide(demande("guide-ia"), { unsubscribeToken: "u".repeat(64) });
      expect(r).toBe("en-file");
      expect(bd.envois[0]![3]).toStrictEqual({
        downloadToken: D,
        unsubscribeToken: "u".repeat(64),
      });
    }
    expect(bd.lecturesCibles).toBe(0);
  });

  it("11. indisponible (inactive, chemin hors racine, titre piégé) : non-parti, raison journalisée sans adresse ; les 3 bornes passent d'abord", async () => {
    vi.stubEnv("GUIDES_RESEAU_LIVRAISON_ENABLED", "true");
    for (const [cible, raison] of [
      [{ ...CIBLE, actif: false }, "inactive"],
      [
        { ...CIBLE, cheminPdf: "imprimes/dossier-intervenant-williams-jullin-axion-ia.pdf" },
        "chemin",
      ],
      [{ ...CIBLE, titre: "Abc\r\nBcc: x" }, "titre"],
    ] as const) {
      bd.cible = { ...cible };
      bd.journal.length = 0;
      expect(await mettreEnFileGuide(demande("gde-essai-01"), { reseau: true })).toBe("non-parti");
      const j = bd.journal.join("\n");
      expect(j).toContain("guides_reseau_guide_indisponible");
      expect(j).toContain(raison);
      expect(j).not.toContain("personne@example.test");
    }
    expect(bd.envois).toHaveLength(0);
    // Coupe-circuit : la borne passe AVANT toute lecture du catalogue.
    bd.circuit = true;
    bd.lecturesCibles = 0;
    expect(await mettreEnFileGuide(demande("gde-essai-01"), { reseau: true })).toBe("suspendu");
    expect(bd.lecturesCibles).toBe(0);
  });
});
