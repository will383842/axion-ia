import { describe, expect, it, vi } from "vitest";
import {
  DRAPEAU_OBSERVATION,
  contenuDepuisSortie,
  observationActive,
  observerSortie,
  reglagesDepuisConfig,
} from "../observation";
import { REGLAGES_PAR_DEFAUT, ReglagesPorteSchema } from "../reglages";
import { corpsValide, REPONSE_DIRECTE } from "./fixtures";

const sortie = {
  title: "Comment démarrer avec l'IA dans une PME",
  metaDescription: "Les premières étapes concrètes pour un dirigeant de PME.",
  bodyHtml: corpsValide(),
  directAnswer: REPONSE_DIRECTE,
  keyTakeaway: "Commencez par une seule tâche répétitive.",
};

function deps(surcharge: Record<string, unknown> = {}) {
  return {
    creer: vi.fn(async () => undefined),
    lireConfig: vi.fn(async () => ({}) as unknown),
    maintenant: () => new Date("2026-11-27T10:00:00Z"),
    journal: vi.fn(),
    ...surcharge,
  };
}

describe("interrupteur d'observation", () => {
  it("est éteint par défaut et n'accepte que « true » exact", () => {
    expect(DRAPEAU_OBSERVATION).toBe("CONTENT_PORTE_OBSERVATION");
    expect(observationActive({})).toBe(false);
    for (const v of ["TRUE", "1", "yes", "false", " true", ""]) {
      expect(observationActive({ [DRAPEAU_OBSERVATION]: v })).toBe(false);
    }
    expect(observationActive({ [DRAPEAU_OBSERVATION]: "true" })).toBe(true);
  });

  it("éteint : ne lit rien, n'écrit rien", async () => {
    const d = deps();
    const r = await observerSortie({ jobId: "j1", contentType: "blog_article", sortie }, d, {});
    expect(r).toBe("eteint");
    expect(d.creer).not.toHaveBeenCalled();
    expect(d.lireConfig).not.toHaveBeenCalled();
  });
});

describe("contenuDepuisSortie", () => {
  it("lit les champs de la sortie du générateur", () => {
    const c = contenuDepuisSortie("blog_article", sortie);
    expect(c?.titre).toBe(sortie.title);
    expect(c?.corpsHtml).toBe(sortie.bodyHtml);
    expect(c?.directAnswer).toBe(REPONSE_DIRECTE);
  });
  it("refuse une sortie sans corps ou non objet", () => {
    expect(contenuDepuisSortie("blog_article", null)).toBeNull();
    expect(contenuDepuisSortie("blog_article", "x")).toBeNull();
    expect(contenuDepuisSortie("blog_article", { title: "t" })).toBeNull();
  });
});

describe("reglagesDepuisConfig", () => {
  it("ne garde que les clés connues et complète par les défauts", () => {
    const r = reglagesDepuisConfig({
      phase: "observation",
      mode: "ombre",
      plafondSecuriteParJour: 3,
      seuilPublication: 88,
    });
    expect(ReglagesPorteSchema.safeParse(r).success).toBe(true);
    expect(r.seuilPublication).toBe(88);
    expect(r.motsMinArticleLong).toBe(REGLAGES_PAR_DEFAUT.motsMinArticleLong);
    expect(Object.keys(r).sort()).toEqual(Object.keys(REGLAGES_PAR_DEFAUT).sort());
  });
  it("une config illisible donne les défauts", () => {
    expect(reglagesDepuisConfig(null)).toEqual(REGLAGES_PAR_DEFAUT);
    expect(reglagesDepuisConfig("x")).toEqual(REGLAGES_PAR_DEFAUT);
  });
});

describe("observerSortie (allumé)", () => {
  const env = { [DRAPEAU_OBSERVATION]: "true" };

  it("écrit une ligne en mode « ombre » dans la table de verdicts", async () => {
    const d = deps();
    const r = await observerSortie({ jobId: "j1", contentType: "blog_article", sortie }, d, env);
    expect(r).toBe("ecrit");
    expect(d.creer).toHaveBeenCalledTimes(1);
    const ligne = (d.creer.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(ligne).toMatchObject({ jobId: "j1", contentKind: "blog_article", mode: "ombre" });
    expect(["publiable", "a_corriger", "bloque"]).toContain(ligne.verdict);
    expect(typeof ligne.note).toBe("number");
    expect(ligne.seuilsFiges).toBeTruthy();
    expect((ligne.criteres as { titre: string }).titre).toBe(sortie.title);
  });

  it("ne change aucun statut et ne lève jamais : table absente (P2021)", async () => {
    const d = deps({
      creer: vi.fn(async () => {
        throw Object.assign(new Error("table absente"), { code: "P2021" });
      }),
    });
    await expect(
      observerSortie({ jobId: "j1", contentType: "blog_article", sortie }, d, env),
    ).resolves.toBe("table_absente");
    expect(d.journal).toHaveBeenCalled();
  });

  it("ne lève jamais : autre erreur d'écriture, config illisible", async () => {
    const d1 = deps({
      creer: vi.fn(async () => {
        throw new Error("boom");
      }),
    });
    await expect(
      observerSortie({ jobId: "j", contentType: "blog_article", sortie }, d1, env),
    ).resolves.toBe("erreur");
    const d2 = deps({
      lireConfig: vi.fn(async () => {
        throw new Error("db");
      }),
    });
    // Config illisible : réglages par défaut, le verdict est écrit quand même.
    await expect(
      observerSortie({ jobId: "j", contentType: "blog_article", sortie }, d2, env),
    ).resolves.toBe("ecrit");
  });

  it("sortie inexploitable : saute sans écrire", async () => {
    const d = deps();
    await expect(
      observerSortie({ jobId: "j", contentType: "blog_article", sortie: null }, d, env),
    ).resolves.toBe("saute");
    expect(d.creer).not.toHaveBeenCalled();
  });
});
