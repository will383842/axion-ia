import { describe, expect, it, vi } from "vitest";
import {
  PLAFOND_JOB_USD,
  SuiviEquipe,
  apresEcriture,
  avantEcriture,
  premiereEcriture,
  type DepsAvant,
  type DepsFin,
} from "./orchestration";
import type { Brief } from "./brief";
import type { SortieEnChef, DecisionEnChef, Renvoi } from "./redacteur-en-chef";
import type { ResultatConformite } from "./conformite";

const brief = { motCle: "ia pme", urlCible: "https://axion-ia.com/x" } as unknown as Brief;
const conformeOk: ResultatConformite = {
  actif: true,
  decision: "publier",
  constats: [],
  coutUsd: 0,
};

const suiviAvec = (cout: () => number) => new SuiviEquipe(async () => cout());

function depsAvant(
  over: Partial<DepsAvant> = {},
): DepsAvant & Record<string, ReturnType<typeof vi.fn>> {
  return {
    brief: vi.fn(async () => ({ statut: "brief" as const, brief, coutUsd: 0.01 })),
    gardien: vi.fn(async () => ({ decision: "feu_vert" as const, raison: "ok" })),
    dossier: vi.fn(async () => ({ coutUsd: 0.2, detail: "3 preuves" })),
    ...over,
  } as never;
}

const sortie = (decision: DecisionEnChef, coutJugeUsd = 0.1): SortieEnChef => ({
  decision,
  grille: [],
  coutJugeUsd,
  coutTotalUsd: coutJugeUsd,
});

function depsFin(chefs: DecisionEnChef[], over: Partial<DepsFin<string>> = {}) {
  const file = [...chefs];
  const d = {
    verificateurB: vi.fn(async (o: string) => ({ output: o, decision: "ok", coutUsd: 0.1 })),
    mailleur: vi.fn(async (o: string) => ({ output: o + "+m", decision: "ok" })),
    editeurSeo: vi.fn(async (o: string) => ({ output: o + "+s", decision: "conforme" })),
    conformite: vi.fn(async () => conformeOk),
    enChef: vi.fn(async () => sortie(file.shift() ?? { type: "publier" })),
    renvoyer: vi.fn(async (o: string) => ({ output: o + "+r", decision: "renvoi", coutUsd: 0.3 })),
    ...over,
  };
  return d as typeof d & DepsFin<string>;
}

const renvoi: DecisionEnChef = {
  type: "renvoi",
  renvois: [{ role: "redacteur", suite: [], criteres: ["Q1"], passages: ["p"] } as Renvoi],
};

describe("avantEcriture", () => {
  it("feu vert : brief → gardien → phase A, journal rempli", async () => {
    const suivi = suiviAvec(() => 0);
    const deps = depsAvant();
    const r = await avantEcriture(suivi, deps);
    expect(r.statut).toBe("continuer");
    const j = await suivi.journal("publier", 0);
    expect(j.entrees.map((e) => e.role)).toEqual(["strateg", "gardien", "verificateur-a"]);
    expect(j.entrees[2]).toMatchObject({ decision: "dossier", coutUsd: 0.2 });
    expect(j.entrees.every((e) => e.dureeMs >= 0)).toBe(true);
  });

  it.each([
    ["ecarter", "ecarte"],
    ["mettre_a_jour", "mise_a_jour"],
    ["relecture_humaine", "relecture_humaine"],
  ] as const)("gardien %s : arrêt, aucune phase A payée", async (decision, issue) => {
    const suivi = suiviAvec(() => 0);
    const deps = depsAvant({
      gardien: vi.fn(async () => ({ decision, raison: "r", article: {} }) as never),
    });
    const r = await avantEcriture(suivi, deps);
    expect(r).toMatchObject({ statut: "arret", issue });
    expect(deps.dossier).not.toHaveBeenCalled();
  });

  it("mot-clé déjà possédé : arrêt avant le gardien", async () => {
    const deps = depsAvant({
      brief: vi.fn(async () => ({ statut: "refus" as const, motCle: "k", proprietaire: "/u" })),
    });
    const r = await avantEcriture(
      suiviAvec(() => 0),
      deps,
    );
    expect(r).toMatchObject({ statut: "arret", issue: "ecarte" });
    expect(deps.gardien).not.toHaveBeenCalled();
  });

  it("plafond atteint avant le stratège : aucun appel", async () => {
    const deps = depsAvant();
    const r = await avantEcriture(
      suiviAvec(() => PLAFOND_JOB_USD),
      deps,
    );
    expect(r).toMatchObject({ statut: "arret", issue: "plafond" });
    expect(deps.brief).not.toHaveBeenCalled();
  });

  it("une erreur de rôle = relecture humaine", async () => {
    const deps = depsAvant({ brief: vi.fn(async () => Promise.reject(new Error("boom"))) });
    const suivi = suiviAvec(() => 0);
    const r = await avantEcriture(suivi, deps);
    expect(r).toMatchObject({ statut: "arret", issue: "relecture_humaine" });
    expect((await suivi.journal("relecture_humaine", 0)).entrees[0]).toMatchObject({
      decision: "erreur",
    });
  });
});

describe("premiereEcriture", () => {
  it("plafond atteint : l'écriture n'est pas lancée", async () => {
    const ecrire = vi.fn();
    const r = await premiereEcriture(
      suiviAvec(() => 3.5),
      ecrire,
    );
    expect("arret" in r).toBe(true);
    expect(ecrire).not.toHaveBeenCalled();
  });
  it("sinon journalise le rôle", async () => {
    const suivi = suiviAvec(() => 0.5);
    const r = await premiereEcriture(suivi, async () => ({
      output: "a",
      decision: "x",
      coutUsd: 1,
    }));
    expect(r).toEqual({ output: "a" });
    expect((await suivi.journal("publier", 0)).entrees[0]).toMatchObject({
      role: "plan-redaction",
    });
  });
});

describe("apresEcriture", () => {
  it("chemin nominal : ordre des rôles et journal complet", async () => {
    const suivi = suiviAvec(() => 0.5);
    const d = depsFin([{ type: "publier" }]);
    const r = await apresEcriture(suivi, "t", d);
    expect(r).toMatchObject({ statut: "publier", output: "t+m+s", renvois: 0 });
    // La conformité reçoit le texte final (après l'éditeur SEO).
    expect(d.conformite).toHaveBeenCalledWith("t+m+s");
    const j = await suivi.journal("publier", 0);
    expect(j.entrees.map((e) => e.role)).toEqual([
      "verificateur-b",
      "mailleur",
      "editeur-seo",
      "conformite",
      "redacteur-en-chef",
    ]);
    expect(j.entrees.at(-1)?.coutUsd).toBe(0.1);
  });

  it("renvois bornés à 2 puis relecture humaine", async () => {
    const d = depsFin([renvoi, renvoi, renvoi, renvoi]);
    const r = await apresEcriture(
      suiviAvec(() => 0.5),
      "t",
      d,
    );
    expect(d.renvoyer).toHaveBeenCalledTimes(2);
    expect(d.enChef).toHaveBeenCalledTimes(3);
    expect(r).toMatchObject({ statut: "stop", issue: "relecture_humaine", renvois: 2 });
  });

  it("un renvoi puis publication", async () => {
    const d = depsFin([renvoi, { type: "publier" }]);
    const suivi = suiviAvec(() => 0.5);
    const r = await apresEcriture(suivi, "t", d);
    expect(r).toMatchObject({ statut: "publier", renvois: 1 });
    const j = await suivi.journal("publier", 1);
    expect(j.entrees.some((e) => e.role === "plan-redaction" && e.passe === 1)).toBe(true);
    expect(d.enChef).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ renvoisFaits: 1 }),
    );
  });

  it("plafond atteint pendant le circuit : arrêt avant l'appel payant suivant", async () => {
    let cout = 2.9;
    const d = depsFin([{ type: "publier" }], {
      verificateurB: vi.fn(async (o: string) => {
        cout = 3.2;
        return { output: o, decision: "ok", coutUsd: 0.3 };
      }),
    });
    const r = await apresEcriture(
      suiviAvec(() => cout),
      "t",
      d,
    );
    expect(r).toMatchObject({ statut: "stop", issue: "plafond" });
    expect(d.mailleur).not.toHaveBeenCalled();
    expect(d.enChef).not.toHaveBeenCalled();
  });

  it("le coût du rédacteur en chef (écrit au registre) est relu : un renvoi est refusé s'il fait dépasser le plafond", async () => {
    let cout = 0.5;
    const d = depsFin([renvoi], {
      enChef: vi.fn(async () => {
        cout = 3.4;
        return sortie(renvoi, 2.9);
      }),
    });
    const r = await apresEcriture(
      suiviAvec(() => cout),
      "t",
      d,
    );
    expect(r).toMatchObject({ statut: "stop", issue: "plafond" });
    expect(d.renvoyer).not.toHaveBeenCalled();
  });

  it.each([
    [{ type: "arret", blockCauses: ["Q3"] }, "ecarte"],
    [{ type: "relecture_humaine", blockCauses: ["x"] }, "relecture_humaine"],
    [{ type: "a_relire", blockCauses: ["Journée IA"] }, "a_relire"],
  ] as const)("décision %j → %s", async (decision, issue) => {
    const r = await apresEcriture(
      suiviAvec(() => 0),
      "t",
      depsFin([decision as DecisionEnChef]),
    );
    expect(r).toMatchObject({ statut: "stop", issue });
  });

  it("une erreur de rôle = relecture humaine, jamais publication", async () => {
    const d = depsFin([], { mailleur: vi.fn(async () => Promise.reject(new Error("réseau"))) });
    const r = await apresEcriture(
      suiviAvec(() => 0),
      "t",
      d,
    );
    expect(r).toMatchObject({ statut: "stop", issue: "relecture_humaine" });
  });

  it("lecture du registre en échec : relecture humaine (plafond non vérifiable)", async () => {
    const suivi = new SuiviEquipe(async () => Promise.reject(new Error("db")));
    const r = await apresEcriture(suivi, "t", depsFin([{ type: "publier" }]));
    expect(r).toMatchObject({ statut: "stop", issue: "relecture_humaine" });
  });
});
