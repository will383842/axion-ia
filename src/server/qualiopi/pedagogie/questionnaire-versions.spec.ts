import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    setting: { findUnique: vi.fn() },
    enrollment: { findUnique: vi.fn() },
    questionnaireVersion: { findUnique: vi.fn(), create: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { contenuDeLaVersion } from "./questionnaire-contenu";
import { empreinteContenu } from "./questionnaire-empreinte";
import { assurerVersionQuestionnaire, versionIdPourNouvelEnvoi } from "./questionnaire-versions";

const p = prisma as unknown as {
  setting: { findUnique: ReturnType<typeof vi.fn> };
  enrollment: { findUnique: ReturnType<typeof vi.fn> };
  questionnaireVersion: { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
};
const etat = (e: string | null) =>
  p.setting.findUnique.mockResolvedValue(e === null ? null : { value: { etat: e } });
const EMP = empreinteContenu(contenuDeLaVersion("satisfaction_chaud", 2)!);

beforeEach(() => {
  vi.clearAllMocks();
  p.enrollment.findUnique.mockResolvedValue({
    estTestInterne: false,
    session: { estTestInterne: false },
  });
});

describe("assurerVersionQuestionnaire", () => {
  it("crée la ligne de la version courante, contenu et empreinte compris", async () => {
    p.questionnaireVersion.findUnique.mockResolvedValue(null);
    p.questionnaireVersion.create.mockResolvedValue({ id: "v-new" });
    expect(await assurerVersionQuestionnaire("satisfaction_chaud")).toBe("v-new");
    expect(p.questionnaireVersion.create.mock.calls[0]![0].data).toMatchObject({
      type: "satisfaction_chaud",
      version: 2,
      empreinte: EMP,
    });
  });

  it("réutilise la ligne existante", async () => {
    p.questionnaireVersion.findUnique.mockResolvedValue({ id: "v-old", empreinte: EMP });
    expect(await assurerVersionQuestionnaire("satisfaction_chaud")).toBe("v-old");
    expect(p.questionnaireVersion.create).not.toHaveBeenCalled();
  });

  it("🔴 une version publiée ne se réécrit jamais : contenu différent = refus", async () => {
    p.questionnaireVersion.findUnique.mockResolvedValue({ id: "v-old", empreinte: "0".repeat(64) });
    await expect(assurerVersionQuestionnaire("satisfaction_chaud")).rejects.toThrow(/jamais/);
  });

  it("course entre deux créations : on relit la ligne gagnante", async () => {
    p.questionnaireVersion.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "v-gagnante", empreinte: EMP });
    p.questionnaireVersion.create.mockRejectedValue(
      Object.assign(new Error("dup"), { code: "P2002" }),
    );
    expect(await assurerVersionQuestionnaire("satisfaction_chaud")).toBe("v-gagnante");
  });
});

describe("versionIdPourNouvelEnvoi", () => {
  beforeEach(() => {
    p.questionnaireVersion.findUnique.mockResolvedValue({ id: "v-id", empreinte: EMP });
  });

  it.each([null, "eteint"])("%s : aucune version posée, rien lu", async (e) => {
    etat(e);
    expect(await versionIdPourNouvelEnvoi("e1", "satisfaction_chaud")).toBeNull();
    expect(p.questionnaireVersion.findUnique).not.toHaveBeenCalled();
  });

  it("actif : l'identifiant de la version courante", async () => {
    etat("actif");
    expect(await versionIdPourNouvelEnvoi("e1", "satisfaction_chaud")).toBe("v-id");
  });

  it("essai : seulement pour le banc d'essai", async () => {
    etat("essai");
    expect(await versionIdPourNouvelEnvoi("e1", "satisfaction_chaud")).toBeNull();
    p.enrollment.findUnique.mockResolvedValue({
      estTestInterne: false,
      session: { estTestInterne: true },
    });
    expect(await versionIdPourNouvelEnvoi("e1", "satisfaction_chaud")).toBe("v-id");
  });

  it("fail-soft : une panne ne bloque jamais la création du questionnaire", async () => {
    etat("actif");
    p.questionnaireVersion.findUnique.mockRejectedValue(new Error("db"));
    expect(await versionIdPourNouvelEnvoi("e1", "satisfaction_chaud")).toBeNull();
  });

  it("un type hors des trois (entreprise) n'est pas versionné", async () => {
    etat("actif");
    expect(await versionIdPourNouvelEnvoi("e1", "satisfaction_entreprise")).toBeNull();
  });
});
