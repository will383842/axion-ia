import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
const findMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    contentQualityVerdict: {
      create: (a: unknown) => create(a),
      findMany: (a: unknown) => findMany(a),
    },
  },
}));
vi.mock("@/server/content-gen/config-store", () => ({
  readContentGenConfigDirect: vi.fn(async () => ({ phase: "observation" })),
}));

import { lireVuePorte, observerJobPorte } from "../porte-qualite-io";

const sortie = { title: "T", bodyHtml: "<h1>T</h1><p>texte</p>" };

beforeEach(() => {
  create.mockReset();
  findMany.mockReset();
  vi.unstubAllEnvs();
  vi.stubEnv("DATABASE_URL", "postgresql://u:p@db.example:5432/x");
});

describe("porte-qualite-io", () => {
  it("éteint : aucune écriture", async () => {
    expect(await observerJobPorte("j", "blog_article", sortie)).toBe("eteint");
    expect(create).not.toHaveBeenCalled();
  });
  it("allumé : écrit les colonnes de la table de Q1, mode ombre", async () => {
    vi.stubEnv("CONTENT_PORTE_OBSERVATION", "true");
    create.mockResolvedValue({});
    expect(await observerJobPorte("j1", "blog_article", sortie)).toBe("ecrit");
    const data = create.mock.calls[0]![0].data;
    expect(Object.keys(data).sort()).toEqual(
      [
        "contentKind",
        "criteres",
        "jobId",
        "mode",
        "note",
        "seuilsFiges",
        "verdict",
        "versionPorte",
      ].sort(),
    );
    expect(data.mode).toBe("ombre");
  });
  it("sous l'URL stub du build : rien ne part", async () => {
    vi.stubEnv("CONTENT_PORTE_OBSERVATION", "true");
    vi.stubEnv("DATABASE_URL", "postgresql://stub:stub@stub.invalid:5432/stub");
    expect(await observerJobPorte("j", "blog_article", sortie)).toBe("eteint");
    expect(create).not.toHaveBeenCalled();
  });
  it("lecture : table absente (P2021) = indisponible, jamais 0", async () => {
    findMany.mockRejectedValue(Object.assign(new Error("x"), { code: "P2021" }));
    const vue = await lireVuePorte();
    expect(vue.verdicts.etat).toBe("indisponible");
  });
  it("lecture : relit la ligne écrite à l'identique (aller-retour via la correspondance)", async () => {
    vi.stubEnv("CONTENT_PORTE_OBSERVATION", "true");
    create.mockResolvedValue({});
    await observerJobPorte("j1", "blog_article", sortie);
    const data = create.mock.calls[0]![0].data;
    findMany.mockResolvedValue([
      { id: "v", createdAt: new Date(), ...JSON.parse(JSON.stringify(data)) },
    ]);
    const vue = await lireVuePorte();
    if (vue.verdicts.etat !== "ok") throw new Error("attendu ok");
    expect(vue.verdicts.valeur.lignes[0]).toMatchObject({
      verdict: data.verdict,
      note: data.note,
      titre: "T",
    });
  });
});
