import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    setting: { findUnique: vi.fn() },
    trainingSession: { findUnique: vi.fn() },
    questionnaire: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { contenuDeLaVersion } from "./questionnaire-contenu";
import { lireReponsesDetailleesSession } from "./reponses-detaillees-session";

const p = prisma as unknown as {
  setting: { findUnique: ReturnType<typeof vi.fn> };
  trainingSession: { findUnique: ReturnType<typeof vi.fn> };
  questionnaire: { findMany: ReturnType<typeof vi.fn> };
};
const etat = (e: string | null) =>
  p.setting.findUnique.mockResolvedValue(e === null ? null : { value: { etat: e } });

const LIGNE = {
  id: "q1",
  type: "satisfaction_chaud",
  reponses: { noteContenu: 4, acquisParObjectif: { Rédiger: 3 } },
  noteGlobale: 4,
  version: { version: 2, contenu: contenuDeLaVersion("satisfaction_chaud", 2) },
};

beforeEach(() => {
  vi.clearAllMocks();
  p.trainingSession.findUnique.mockResolvedValue({
    estTestInterne: false,
    formationSnapshot: null,
    formation: { objectifsPedagogiques: ["Rédiger", "Vérifier"] },
  });
  p.questionnaire.findMany.mockResolvedValue([LIGNE]);
});

describe("lireReponsesDetailleesSession", () => {
  it.each([null, "eteint"])("%s : vide, rien lu", async (e) => {
    etat(e);
    expect((await lireReponsesDetailleesSession("s1")).size).toBe(0);
    expect(p.questionnaire.findMany).not.toHaveBeenCalled();
  });

  it("essai : une session réelle n'est pas concernée", async () => {
    etat("essai");
    expect((await lireReponsesDetailleesSession("s1")).size).toBe(0);
  });

  it("actif : les réponses, question par question, avec le contenu figé de la version", async () => {
    etat("actif");
    const m = await lireReponsesDetailleesSession("s1");
    const l = m.get("q1")!;
    expect(l.find((x) => x.id === "noteContenu")!.reponse).toBe("4 / 5");
    expect(l.find((x) => x.id === "acquisParObjectif")!.lignes).toEqual([
      { libelle: "Rédiger", reponse: "Je maîtrise" },
      { libelle: "Vérifier", reponse: null },
    ]);
  });

  it("contenu stocké illisible : repli sur la version du code, puis sur la v1", async () => {
    etat("actif");
    p.questionnaire.findMany.mockResolvedValue([
      { ...LIGNE, version: { version: 2, contenu: { corrompu: true } } },
      { ...LIGNE, id: "q2", version: null },
    ]);
    const m = await lireReponsesDetailleesSession("s1");
    expect(m.get("q1")!.some((x) => x.id === "noteContenu")).toBe(true);
    expect(m.get("q2")!.map((x) => x.id)).toEqual(["noteGlobale", "commentaire"]);
  });

  it("fail-soft : une panne rend vide, la fiche session s'affiche", async () => {
    etat("actif");
    p.questionnaire.findMany.mockRejectedValue(new Error("db"));
    expect((await lireReponsesDetailleesSession("s1")).size).toBe(0);
  });
});
