import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  LAMBDA_ROTATION,
  VERSION_ALGO,
  choisirVideo,
  departageStable,
  type AffectationActive,
  type CandidatVideo,
  type EntreeRepartiteur,
} from "../repartiteur";
import { REGLAGES_ENCARTS_DEFAUT, type ReglagesEncarts } from "../reglages";

const JOUR = 86_400_000;
const MAINTENANT = Date.UTC(2026, 10, 27, 12, 0, 0);

const reglages = (sur: Partial<ReglagesEncarts> = {}): ReglagesEncarts => ({
  ...REGLAGES_ENCARTS_DEFAUT,
  actif: true,
  seuilMin: 0.5,
  plafondParVideo: 3,
  fenetreJours: 30,
  typesContenus: ["blog", "ville"],
  ...sur,
});

const cand = (id: string, score: number, slug = id): CandidatVideo => ({ id, slug, score });

const aff = (
  siteVideoId: string,
  joursAvant: number,
  contenuId = `c-${siteVideoId}-${joursAvant}`,
): AffectationActive => ({
  contenuId,
  siteVideoId,
  choisiLe: MAINTENANT - joursAvant * JOUR,
});

const entree = (sur: Partial<EntreeRepartiteur> = {}): EntreeRepartiteur => ({
  contenuId: "article-1",
  typeContenu: "blog",
  candidats: [cand("v1", 0.8)],
  affectationsActives: [],
  videosVoisines: [],
  maintenantMs: MAINTENANT,
  reglages: reglages(),
  ...sur,
});

describe("répartiteur — éteint et types", () => {
  it("réglage `actif` faux → aucun encart, même avec un excellent candidat", () => {
    const r = choisirVideo(entree({ reglages: reglages({ actif: false }) }));
    expect(r).toEqual({ video: null, raison: "eteint" });
  });

  it("type de contenu non activé → aucun encart", () => {
    const r = choisirVideo(entree({ typeContenu: "guide" }));
    expect(r).toEqual({ video: null, raison: "type-non-active" });
  });

  it("aucun candidat → aucun encart", () => {
    expect(choisirVideo(entree({ candidats: [] }))).toEqual({
      video: null,
      raison: "aucun-candidat",
    });
  });
});

describe("répartiteur — seuil de pertinence", () => {
  it("score sous seuilMin → pas d'encart, jamais de remplissage", () => {
    const r = choisirVideo(entree({ candidats: [cand("v1", 0.49), cand("v2", 0.1)] }));
    expect(r).toEqual({ video: null, raison: "sous-seuil" });
  });

  it("score égal au seuilMin → retenu", () => {
    expect(choisirVideo(entree({ candidats: [cand("v1", 0.5)] })).video?.id).toBe("v1");
  });

  it("seuilMax absent : un score très élevé n'est jamais écarté", () => {
    expect(choisirVideo(entree({ candidats: [cand("v1", 0.99)] })).video?.id).toBe("v1");
  });

  it("seuilMax présent : au-dessus du seuil, la vidéo est écartée", () => {
    const r = choisirVideo(
      entree({
        reglages: reglages({ seuilMax: 0.9 }),
        candidats: [cand("v1", 0.95), cand("v2", 0.7)],
      }),
    );
    expect(r.video?.id).toBe("v2");
  });

  it("seuilMax présent et tout au-dessus → raison « au-dessus-seuil-max »", () => {
    const r = choisirVideo(
      entree({ reglages: reglages({ seuilMax: 0.9 }), candidats: [cand("v1", 0.95)] }),
    );
    expect(r).toEqual({ video: null, raison: "au-dessus-seuil-max" });
  });

  it("le meilleur score l'emporte parmi ceux qui passent le seuil", () => {
    const r = choisirVideo(
      entree({ candidats: [cand("v1", 0.6), cand("v2", 0.9), cand("v3", 0.7)] }),
    );
    expect(r.video?.id).toBe("v2");
  });
});

describe("répartiteur — plafond par vidéo", () => {
  it("vidéo au plafond dans la fenêtre → exclusion dure, la suivante est prise", () => {
    const r = choisirVideo(
      entree({
        candidats: [cand("v1", 0.95), cand("v2", 0.6)],
        affectationsActives: [aff("v1", 1), aff("v1", 2), aff("v1", 3)],
      }),
    );
    expect(r.video?.id).toBe("v2");
  });

  it("toutes les vidéos au plafond → pas d'encart", () => {
    const r = choisirVideo(
      entree({ affectationsActives: [aff("v1", 1), aff("v1", 2), aff("v1", 3)] }),
    );
    expect(r).toEqual({ video: null, raison: "plafond" });
  });

  it("une affectation plus ancienne que la fenêtre ne compte pas", () => {
    const r = choisirVideo(
      entree({ affectationsActives: [aff("v1", 1), aff("v1", 2), aff("v1", 31)] }),
    );
    expect(r.video?.id).toBe("v1");
  });

  it("la borne de la fenêtre est incluse (exactement fenetreJours)", () => {
    const r = choisirVideo(
      entree({ affectationsActives: [aff("v1", 1), aff("v1", 2), aff("v1", 30)] }),
    );
    expect(r).toEqual({ video: null, raison: "plafond" });
  });

  it("la propre affectation du contenu ne compte pas contre lui (réaffectation)", () => {
    const r = choisirVideo(
      entree({
        contenuId: "article-1",
        affectationsActives: [
          aff("v1", 1, "article-1"),
          aff("v1", 2, "autre-1"),
          aff("v1", 3, "autre-2"),
        ],
      }),
    );
    expect(r.video?.id).toBe("v1");
  });

  it("une affectation datée dans le futur compte (horloge décalée : prudence)", () => {
    const r = choisirVideo(
      entree({ affectationsActives: [aff("v1", -1), aff("v1", 2), aff("v1", 3)] }),
    );
    expect(r).toEqual({ video: null, raison: "plafond" });
  });
});

describe("répartiteur — pénalité de rotation", () => {
  it("à score proche, la vidéo la moins utilisée passe devant", () => {
    const r = choisirVideo(
      entree({
        candidats: [cand("v1", 0.8), cand("v2", 0.78)],
        affectationsActives: [aff("v1", 1), aff("v1", 2)],
      }),
    );
    // v1 : 0,8 − λ·2/3 ; v2 : 0,78
    expect(0.8 - LAMBDA_ROTATION * (2 / 3)).toBeLessThan(0.78);
    expect(r.video?.id).toBe("v2");
  });

  it("une grosse avance de pertinence résiste à la pénalité", () => {
    const r = choisirVideo(
      entree({
        candidats: [cand("v1", 0.95), cand("v2", 0.55)],
        affectationsActives: [aff("v1", 1), aff("v1", 2)],
      }),
    );
    expect(r.video?.id).toBe("v1");
  });

  it("le score effectif retourné est s − λ·(n/plafond)", () => {
    const r = choisirVideo(
      entree({ candidats: [cand("v1", 0.8)], affectationsActives: [aff("v1", 1)] }),
    );
    expect(r.video?.scoreEffectif).toBeCloseTo(0.8 - LAMBDA_ROTATION * (1 / 3), 10);
    expect(r.video?.score).toBe(0.8);
  });
});

describe("répartiteur — voisins et exclusions", () => {
  it("une vidéo déjà affectée à un voisin est exclue (exclureVoisins vrai)", () => {
    const r = choisirVideo(
      entree({
        candidats: [cand("v1", 0.95), cand("v2", 0.6)],
        videosVoisines: ["v1"],
      }),
    );
    expect(r.video?.id).toBe("v2");
  });

  it("exclureVoisins faux → les voisins sont ignorés", () => {
    const r = choisirVideo(
      entree({
        reglages: reglages({ exclureVoisins: false }),
        candidats: [cand("v1", 0.95), cand("v2", 0.6)],
        videosVoisines: ["v1"],
      }),
    );
    expect(r.video?.id).toBe("v1");
  });

  it("tout est voisin → pas d'encart, raison « voisins »", () => {
    const r = choisirVideo(entree({ videosVoisines: ["v1"] }));
    expect(r).toEqual({ video: null, raison: "voisins" });
  });

  it("une vidéo de `videosExclues` n'est jamais choisie", () => {
    const r = choisirVideo(
      entree({
        reglages: reglages({ videosExclues: ["v1"] }),
        candidats: [cand("v1", 0.95), cand("v2", 0.6)],
      }),
    );
    expect(r.video?.id).toBe("v2");
  });

  it("toutes exclues → raison « exclues »", () => {
    const r = choisirVideo(entree({ reglages: reglages({ videosExclues: ["v1"] }) }));
    expect(r).toEqual({ video: null, raison: "exclues" });
  });
});

describe("répartiteur — départage stable", () => {
  it("departageStable est déterministe et dépend des deux entrées", () => {
    expect(departageStable("c1", "s1")).toBe(departageStable("c1", "s1"));
    expect(departageStable("c1", "s1")).not.toBe(departageStable("c2", "s1"));
    expect(departageStable("c1", "s1")).not.toBe(departageStable("c1", "s2"));
    expect(Number.isInteger(departageStable("c1", "s1"))).toBe(true);
  });

  it("séparateur : (« ab », « c ») et (« a », « bc ») ne se confondent pas", () => {
    expect(departageStable("ab", "c")).not.toBe(departageStable("a", "bc"));
  });

  it("égalité parfaite : même résultat à chaque appel, quel que soit l'ordre des candidats", () => {
    const cs = [cand("v1", 0.7), cand("v2", 0.7), cand("v3", 0.7), cand("v4", 0.7)];
    const a = choisirVideo(entree({ candidats: cs })).video?.id;
    const b = choisirVideo(entree({ candidats: [...cs].reverse() })).video?.id;
    const c = choisirVideo(entree({ candidats: cs })).video?.id;
    expect(a).toBeDefined();
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it("égalité : le départage varie selon le contenu (pas toujours la même vidéo)", () => {
    const cs = [cand("v1", 0.7), cand("v2", 0.7), cand("v3", 0.7), cand("v4", 0.7)];
    const choisies = new Set(
      Array.from(
        { length: 60 },
        (_, i) => choisirVideo(entree({ contenuId: `article-${i}`, candidats: cs })).video?.id,
      ),
    );
    expect(choisies.size).toBeGreaterThan(1);
  });

  it("même slug, deux ids : l'id tranche en dernier recours, sans erreur", () => {
    const cs = [cand("b", 0.7, "meme"), cand("a", 0.7, "meme")];
    const a = choisirVideo(entree({ candidats: cs })).video?.id;
    const b = choisirVideo(entree({ candidats: [...cs].reverse() })).video?.id;
    expect(b).toBe(a);
  });
});

describe("répartiteur — pureté", () => {
  it("ne modifie ni les candidats ni les affectations reçus", () => {
    const candidats = [cand("v1", 0.7), cand("v2", 0.9)];
    const affectations = [aff("v1", 1)];
    const copieC = JSON.parse(JSON.stringify(candidats));
    const copieA = JSON.parse(JSON.stringify(affectations));
    choisirVideo(entree({ candidats, affectationsActives: affectations }));
    expect(candidats).toEqual(copieC);
    expect(affectations).toEqual(copieA);
  });

  it("tous les scores invalides → raison « score-invalide », pas « aucun-candidat »", () => {
    const r = choisirVideo(entree({ candidats: [cand("v1", Number.NaN), cand("v2", 1.5)] }));
    expect(r).toEqual({ video: null, raison: "score-invalide" });
  });

  it("VERSION_ALGO est un entier ≥ 1", () => {
    expect(Number.isInteger(VERSION_ALGO) && VERSION_ALGO >= 1).toBe(true);
  });

  it("scores à moins d'un epsilon : même vidéo pour TOUTES les permutations (tri transitif)", () => {
    const base = [cand("a", 0.5), cand("b", 0.5 + 6e-10), cand("c", 0.5 + 1.2e-9)];
    const perms = [
      [0, 1, 2],
      [0, 2, 1],
      [1, 0, 2],
      [1, 2, 0],
      [2, 0, 1],
      [2, 1, 0],
    ];
    for (let i = 0; i < 100; i++) {
      const ids = new Set(
        perms.map(
          (p) =>
            choisirVideo(entree({ contenuId: `art-${i}`, candidats: p.map((k) => base[k]!) })).video
              ?.id,
        ),
      );
      expect(ids.size).toBe(1);
      expect([...ids][0]).toBe("c");
    }
  });

  it("réaffectation : le score effectif ignore l'affectation du contenu lui-même", () => {
    const r = choisirVideo(
      entree({
        contenuId: "article-1",
        candidats: [cand("v1", 0.8)],
        affectationsActives: [aff("v1", 1, "article-1")],
      }),
    );
    expect(r.video?.scoreEffectif).toBeCloseTo(0.8, 10);
  });

  it("maintenantMs NaN : prudence, toutes les affectations comptent (vidéo au plafond exclue)", () => {
    const r = choisirVideo(
      entree({
        maintenantMs: Number.NaN,
        affectationsActives: [aff("v1", 1), aff("v1", 2), aff("v1", 3)],
      }),
    );
    expect(r).toEqual({ video: null, raison: "plafond" });
  });

  it("scores non finis ou hors [0 ; 1] : candidat ignoré, jamais d'exception", () => {
    const r = choisirVideo(
      entree({ candidats: [cand("v1", Number.NaN), cand("v2", 2), cand("v3", 0.6)] }),
    );
    expect(r.video?.id).toBe("v3");
  });

  it("les modules du répartiteur n'ont AUCUNE entrée/sortie ni « use client »", () => {
    for (const f of ["repartiteur.ts", "reglages.ts"]) {
      const src = readFileSync(join(__dirname, "..", f), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      expect(src, f).not.toMatch(/^\s*["']use client["']/m);
      expect(src, f).not.toMatch(
        /from\s+["'](?:@\/lib\/prisma|@\/lib\/redis|node:|fs|bullmq|ioredis|@prisma)|process\.env|Date\.now|new Date\(|\bDate\(\)|performance\.now|\bcrypto\.|\brequire\(|^\s*import\s+["']|\bimport\(|Math\.random|fetch\(/,
      );
    }
  });
});
