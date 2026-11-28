import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  CLE_COUPE_CIRCUIT,
  DRAPEAU_POINT_FINAL,
  appliquerPointFinal,
  controlerTexteHorsArticle,
  evaluerB17,
  lireCoupeCircuit,
  pointFinalActif,
} from "../point-final";
import { corpsValide, REPONSE_DIRECTE } from "./fixtures";

const sortie = {
  title: "Comment démarrer avec l'IA dans une PME",
  metaDescription: "Les premières étapes concrètes pour un dirigeant de PME.",
  bodyHtml: corpsValide(),
  directAnswer: REPONSE_DIRECTE,
  keyTakeaway: "Commencez par une seule tâche répétitive.",
};
const ON = { [DRAPEAU_POINT_FINAL]: "true" };
const entree = { jobId: "j1", contentType: "blog_article", sortie };

function deps(config: Record<string, unknown> = {}, surcharge: Record<string, unknown> = {}) {
  return {
    lireConfig: vi.fn(async (cle: string) => config[cle] ?? null),
    ecrireVerdict: vi.fn(async () => undefined),
    maintenant: () => new Date("2026-11-28T10:00:00Z"),
    journal: vi.fn(),
    ...surcharge,
  };
}

describe("drapeau CONTENT_PORTE_QUALITE", () => {
  it("est éteint par défaut et n'accepte que « true » exact", () => {
    expect(DRAPEAU_POINT_FINAL).toBe("CONTENT_PORTE_QUALITE");
    expect(pointFinalActif({})).toBe(false);
    for (const v of ["TRUE", "1", "yes", "false", " true", ""]) {
      expect(pointFinalActif({ [DRAPEAU_POINT_FINAL]: v })).toBe(false);
    }
    expect(pointFinalActif(ON)).toBe(true);
  });

  it("ÉTEINT : comportement strictement identique (inerte, aucune lecture, aucune écriture)", async () => {
    const d = deps();
    for (const env of [{}, { [DRAPEAU_POINT_FINAL]: "false" }]) {
      expect(await appliquerPointFinal(entree, d, env)).toEqual({ action: "inerte" });
    }
    expect(d.lireConfig).not.toHaveBeenCalled();
    expect(d.ecrireVerdict).not.toHaveBeenCalled();
    expect(d.journal).not.toHaveBeenCalled();
  });
});

describe("B17 : un report, jamais un refus", () => {
  it("lit l'état du coupe-circuit ; illisible = indisponible", () => {
    expect(lireCoupeCircuit(null)).toEqual({ etat: "ok", valeur: false });
    expect(lireCoupeCircuit({ actif: true })).toEqual({ etat: "ok", valeur: true });
    expect(lireCoupeCircuit({ actif: "oui" }).etat).toBe("indisponible");
    expect(lireCoupeCircuit("x").etat).toBe("indisponible");
  });
  it("coupe-circuit actif ou illisible : report", () => {
    const ok = { etat: "ok", valeur: false } as const;
    expect(
      evaluerB17({ coupeCircuit: ok, publieAujourdhui: null, plafondSecurite: null }).statut,
    ).toBe("ok");
    expect(
      evaluerB17({
        coupeCircuit: { etat: "ok", valeur: true },
        publieAujourdhui: null,
        plafondSecurite: null,
      }).statut,
    ).toBe("reporte");
    expect(
      evaluerB17({
        coupeCircuit: { etat: "indisponible", raison: "x" },
        publieAujourdhui: null,
        plafondSecurite: null,
      }).statut,
    ).toBe("reporte");
  });
  it("plafond de sécurité atteint ou compte illisible : report ; sous le plafond : ok", () => {
    const ok = { etat: "ok", valeur: false } as const;
    const n = (valeur: number) => ({ etat: "ok", valeur }) as const;
    expect(
      evaluerB17({ coupeCircuit: ok, publieAujourdhui: n(2), plafondSecurite: 3 }).statut,
    ).toBe("ok");
    expect(
      evaluerB17({ coupeCircuit: ok, publieAujourdhui: n(3), plafondSecurite: 3 }).statut,
    ).toBe("reporte");
    expect(
      evaluerB17({ coupeCircuit: ok, publieAujourdhui: null, plafondSecurite: 3 }).statut,
    ).toBe("reporte");
  });
  it("coupe-circuit actif : reporte, sans verdict écrit", async () => {
    const d = deps({ [CLE_COUPE_CIRCUIT]: { actif: true } });
    const r = await appliquerPointFinal(entree, d, ON);
    expect(r.action).toBe("reporter");
    expect(d.ecrireVerdict).not.toHaveBeenCalled();
  });
  it("lecture du coupe-circuit en panne : report", async () => {
    const d = deps({}, { lireConfig: vi.fn(async () => Promise.reject(new Error("redis"))) });
    expect((await appliquerPointFinal(entree, d, ON)).action).toBe("reporter");
  });
});

describe("allumé : échec fermé", () => {
  it("écrit un verdict « reel » et retient tant que le registre est incomplet", async () => {
    const d = deps();
    const r = await appliquerPointFinal(entree, d, ON);
    expect(r.action).toBe("retenir");
    expect(d.ecrireVerdict).toHaveBeenCalledTimes(1);
    const ligne = (
      d.ecrireVerdict.mock.calls[0] as unknown as [{ mode: string; jobId: string }]
    )[0];
    expect(ligne.mode).toBe("reel");
    expect(ligne.jobId).toBe("j1");
  });
  it("table absente (P2021) : refuse de publier", async () => {
    const d = deps({}, { ecrireVerdict: vi.fn(async () => Promise.reject({ code: "P2021" })) });
    const r = await appliquerPointFinal(entree, d, ON);
    expect(r).toMatchObject({ action: "retenir", code: "porte_table_absente" });
  });
  it("écriture en erreur : refuse de publier", async () => {
    const d = deps({}, { ecrireVerdict: vi.fn(async () => Promise.reject(new Error("boom"))) });
    expect(await appliquerPointFinal(entree, d, ON)).toMatchObject({
      code: "porte_ecriture_impossible",
    });
  });
  it("sortie inexploitable : refuse", async () => {
    const d = deps();
    const r = await appliquerPointFinal({ ...entree, sortie: null }, d, ON);
    expect(r).toMatchObject({ action: "retenir", code: "porte_sortie_inexploitable" });
  });
  it("un contenu avec une faute de doctrine est retenu avec B01 dans le motif", async () => {
    const d = deps();
    const r = await appliquerPointFinal(
      {
        ...entree,
        sortie: { ...sortie, bodyHtml: `${corpsValide()}<p>Nous venons de Grenoble.</p>` },
      },
      d,
      ON,
    );
    expect(r.action).toBe("retenir");
    expect(r.action === "retenir" && r.code).toContain("B01");
  });
});

describe("chemins 5 et 6 : B01 et B03 hors articles", () => {
  const faute = {
    contentType: "faq",
    titre: "Q",
    corpsHtml: "<p>Notre équipe est à Grenoble.</p>",
  };
  it("éteint : ne refuse rien", () => {
    expect(controlerTexteHorsArticle(faute, {}).refuse).toBe(false);
  });
  it("allumé : refuse une faute de doctrine", () => {
    const r = controlerTexteHorsArticle(faute, ON);
    expect(r.refuse).toBe(true);
    expect(r.codes).toContain("B01");
  });
  it("allumé : « partout en France » n'est jamais refusée", () => {
    const r = controlerTexteHorsArticle(
      {
        contentType: "faq",
        titre: "Où ?",
        corpsHtml: "<p>Nous intervenons dans vos locaux, partout en France.</p>",
      },
      ON,
    );
    expect(r.refuse).toBe(false);
  });
});

describe("chemins de contournement : câblage dans les workers", () => {
  const lire = (p: string) => readFileSync(p, "utf8");
  it("le worker de publication appelle le point final avant l'insertion de l'article", () => {
    const s = lire("src/server/queue/workers/content-publish-worker.ts");
    const i = s.indexOf("appliquerPointFinalPorte(");
    expect(i).toBeGreaterThan(0);
    expect(i).toBeLessThan(s.indexOf("tx.article.create"));
  });
  it("l'extraction de FAQ et la réécriture du fact-check passent par le contrôle", () => {
    expect(lire("src/server/queue/workers/content-qa-extract-worker.ts")).toContain(
      "controlerTexteHorsArticle(",
    );
    expect(lire("src/server/queue/workers/content-fact-check-worker.ts")).toContain(
      "controlerTexteHorsArticle(",
    );
  });
});
