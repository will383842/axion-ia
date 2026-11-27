// Challenges d'apporteurs, côté espace : la règle et le règlement, RIEN D'AUTRE. Réservé aux
// apporteurs signés. Données FICTIVES. Aucun nombre propre à une personne, aucune barre, aucun
// « N sur M », aucune date de fin mise en avant.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  dossier: null as Record<string, unknown> | null,
  encart: null as Record<string, unknown> | null,
  reglement: null as Record<string, unknown> | null,
  lectureEchoue: false,
  passes: [] as Array<Record<string, unknown>>,
}));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/features/apporteurs-reseau/donnees", () => ({
  lireDossierParLien: vi.fn(async () => h.dossier),
}));
vi.mock("@/features/apporteurs-reseau/challenge-donnees", () => ({
  lireEncartChallenge: vi.fn(async () => {
    if (h.lectureEchoue) throw new Error("table absente");
    return h.encart;
  }),
  lireReglementChallenge: vi.fn(async (_id: string, _jour: string) => {
    if (h.lectureEchoue) throw new Error("table absente");
    return h.reglement;
  }),
  listerReglementsPasses: vi.fn(async () => {
    if (h.lectureEchoue) throw new Error("table absente");
    return h.passes;
  }),
}));

import { ID_DOSSIER_EXEMPLE } from "@/features/apporteurs-reseau/jeton";

import { EncartChallenge, lireEncartPourEspace } from "./EncartChallenge";

const rendre = async () =>
  EncartChallenge({ vue: await lireEncartPourEspace(), id: ID, jeton: "jeton-valide" });
import Page from "./reglement/[challengeId]/page";
import PagePassees from "./reglements/page";
import { lireReglementChallenge } from "@/features/apporteurs-reseau/challenge-donnees";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const CH = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const params = (id = ID, challengeId = CH) => ({
  params: Promise.resolve({ id, jeton: "jeton-valide", challengeId }),
});
const texte = (x: string) =>
  x
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ");

beforeEach(() => {
  h.dossier = { id: ID, prenom: "Ana", statut: "signe", restreint: false };
  h.passes = [];
  h.encart = {
    id: CH,
    titre: "Challenge de test",
    produit: "journee-ia",
    seuil: 10,
    primeHtCents: 200_000,
    debutLe: "2026-12-01",
    finLe: "2026-12-31",
  };
  h.reglement = {
    titre: "Challenge de test",
    reglement: "Rien n'est attendu de vous.\nLe seuil est de dix.",
    debutLe: "2026-12-01",
    finLe: "2026-12-31",
  };
  h.lectureEchoue = false;
  process.env.APPORTEUR_CHALLENGES_ESPACE_ENABLED = "true";
});

describe("encart", () => {
  it("dit la règle, rien n'est attendu, lien vers le règlement ; aucun compteur ni barre", async () => {
    const html = renderToStaticMarkup(await rendre());
    const t = texte(html);
    expect(t).toContain("Challenge de test");
    expect(t).toContain("Une prime de 2 000 € HT");
    expect(t).toContain("Rien n'est attendu de vous");
    expect(html).toContain(`/apporteur/dossier/${ID}/jeton-valide/challenge/reglement/${CH}"`);
    expect(html).not.toMatch(/<progress|role="progressbar"/i);
    expect(t).not.toMatch(/\d+ sur \d+|il vous reste|plus que|encore \d|J-\d/i);
    // les seuls nombres : ceux de la règle publiée (dix en lettres, 2 000 €, dates 2026)
    expect(
      t
        .replace(/Challenge de test/g, "")
        .match(/\d[\d\s]*/g)
        ?.map((x) => x.trim()),
    ).toEqual(["2 000", "1", "31", "2026"].map((x) => x));
  });
  it("le rendu est le même pour tous les apporteurs (aucune donnée personnelle lue)", async () => {
    const a = renderToStaticMarkup(await rendre());
    h.dossier = { id: "autre", prenom: "Bob", statut: "signe", restreint: false };
    const b = renderToStaticMarkup(await rendre());
    expect(a).toBe(b);
  });
  it.each(["TRUE", "1", " true "])("interrupteur « %s » : éteint, encart null", async (v) => {
    process.env.APPORTEUR_CHALLENGES_ESPACE_ENABLED = v;
    expect(await rendre()).toBeNull();
  });
  it("interrupteur éteint, aucun challenge publié, table illisible : rien", async () => {
    delete process.env.APPORTEUR_CHALLENGES_ESPACE_ENABLED;
    expect(await rendre()).toBeNull();
    process.env.APPORTEUR_CHALLENGES_ESPACE_ENABLED = "true";
    h.encart = null;
    expect(await rendre()).toBeNull();
    h.encart = {
      id: CH,
      titre: "x",
      produit: "journee-ia",
      seuil: 1,
      primeHtCents: 1,
      debutLe: "2026-12-01",
      finLe: "2026-12-31",
    };
    h.lectureEchoue = true;
    expect(await rendre()).toBeNull();
  });
});

describe("règlement : réservé aux apporteurs signés", () => {
  it("affiche le texte publié tel quel", async () => {
    const html = renderToStaticMarkup(await Page(params()));
    expect(texte(html)).toContain("Rien n'est attendu de vous. Le seuil est de dix.");
  });
  it.each(["TRUE", "1", " true "])("interrupteur « %s » : règlement 404", async (v) => {
    process.env.APPORTEUR_CHALLENGES_ESPACE_ENABLED = v;
    await expect(Page(params())).rejects.toThrow("NOT_FOUND");
  });
  const REFUS: ReadonlyArray<readonly [string, () => void, string]> = [
    [
      "jeton faux ou ancien",
      () => {
        h.dossier = null;
      },
      ID,
    ],
    [
      "restreint",
      () => {
        h.dossier = { id: ID, prenom: "Ana", statut: "signe", restreint: true };
      },
      ID,
    ],
    [
      "dossier en cours",
      () => {
        h.dossier = { id: ID, prenom: "Ana", statut: "dossier_en_cours", restreint: false };
      },
      ID,
    ],
    [
      "à vérifier",
      () => {
        h.dossier = { id: ID, prenom: "Ana", statut: "a_verifier", restreint: false };
      },
      ID,
    ],
    ["lien d'exemple", () => undefined, ID_DOSSIER_EXEMPLE],
    [
      "interrupteur éteint",
      () => {
        delete process.env.APPORTEUR_CHALLENGES_ESPACE_ENABLED;
      },
      ID,
    ],
    [
      "aucun challenge publié",
      () => {
        h.reglement = null;
      },
      ID,
    ],
    [
      "table illisible",
      () => {
        h.lectureEchoue = true;
      },
      ID,
    ],
  ];
  it.each(REFUS)("%s : 404 neutre", async (_c, preparer, id) => {
    preparer();
    await expect(Page(params(id))).rejects.toThrow("NOT_FOUND");
  });
});

describe("règlement : le challenge demandé, pas « le plus récent »", () => {
  it("transmet l'identifiant de l'adresse à la lecture", async () => {
    await Page(params());
    expect(lireReglementChallenge).toHaveBeenLastCalledWith(CH, expect.stringMatching(/^\d{4}-/));
  });
  it.each(["pas-un-uuid", "123", "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d/../x"])(
    "identifiant « %s » : 404 sans lecture",
    async (mauvais) => {
      vi.mocked(lireReglementChallenge).mockClear();
      await expect(Page(params(ID, mauvais))).rejects.toThrow("NOT_FOUND");
      expect(lireReglementChallenge).not.toHaveBeenCalled();
    },
  );
  it("un challenge archivé lisible dit « Challenge arrêté le … »", async () => {
    h.reglement = { ...h.reglement, arreteLe: "2026-12-15" };
    expect(texte(renderToStaticMarkup(await Page(params())))).toContain(
      "Challenge arrêté le 15/12/2026",
    );
  });
  it("un challenge en cours n'affiche aucune mention d'arrêt", async () => {
    h.reglement = { ...h.reglement, arreteLe: null };
    expect(texte(renderToStaticMarkup(await Page(params())))).not.toContain("arrêté");
  });
});

describe("règlements des challenges passés : titre et période seulement", () => {
  it("liste titre et période, liens vers chaque règlement, aucun chiffre personnel", async () => {
    h.passes = [
      { id: CH, titre: "Challenge d'automne", debutLe: "2026-09-01", finLe: "2026-10-31" },
    ];
    const html = renderToStaticMarkup(await PagePassees({ params: params().params }));
    const t = texte(html);
    expect(t).toContain("Challenge d'automne");
    expect(t).toContain("Du 01/09/2026 au 31/10/2026");
    expect(html).toContain(`/apporteur/dossier/${ID}/jeton-valide/challenge/reglement/${CH}`);
    expect(t).not.toMatch(/\d+ sur \d+|participant|classement|rang|il vous reste/i);
  });
  it("aucun challenge passé : phrase neutre", async () => {
    expect(texte(renderToStaticMarkup(await PagePassees({ params: params().params })))).toContain(
      "Aucun règlement de challenge passé",
    );
  });
  it.each([
    [
      "dossier introuvable",
      () => {
        h.dossier = null;
      },
    ],
    [
      "restreint",
      () => {
        h.dossier = { id: ID, statut: "signe", restreint: true };
      },
    ],
    [
      "non signé",
      () => {
        h.dossier = { id: ID, statut: "a_verifier", restreint: false };
      },
    ],
    [
      "interrupteur éteint",
      () => {
        delete process.env.APPORTEUR_CHALLENGES_ESPACE_ENABLED;
      },
    ],
    [
      "table illisible",
      () => {
        h.lectureEchoue = true;
      },
    ],
  ])("%s : 404 neutre", async (_c, preparer) => {
    preparer();
    await expect(PagePassees({ params: params().params })).rejects.toThrow("NOT_FOUND");
  });
});

describe("garde statique du dossier challenge", () => {
  const dossier = __dirname;
  const fichiers: string[] = [];
  const parcourir = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) parcourir(join(d, e.name));
      else if (/\.tsx?$/.test(e.name) && !/\.spec\./.test(e.name)) fichiers.push(join(d, e.name));
    }
  };
  parcourir(dossier);
  it("aucun <progress>, aucun « N sur M », aucun JavaScript client", () => {
    expect(fichiers.length).toBeGreaterThan(0);
    for (const f of fichiers) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/<progress|\d+ sur \d+|"use client"|useState|useEffect/);
    }
  });
});
