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
  lireReglementChallenge: vi.fn(async () => {
    if (h.lectureEchoue) throw new Error("table absente");
    return h.reglement;
  }),
}));

import { ID_DOSSIER_EXEMPLE } from "@/features/apporteurs-reseau/jeton";

import { EncartChallenge, lireEncartPourEspace } from "./EncartChallenge";

const rendre = async () =>
  EncartChallenge({ vue: await lireEncartPourEspace(), id: ID, jeton: "jeton-valide" });
import Page from "./reglement/page";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const params = (id = ID) => ({ params: Promise.resolve({ id, jeton: "jeton-valide" }) });
const texte = (x: string) =>
  x
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ");

beforeEach(() => {
  h.dossier = { id: ID, prenom: "Ana", statut: "signe", restreint: false };
  h.encart = {
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
    expect(html).toContain(`/apporteur/dossier/${ID}/jeton-valide/challenge/reglement`);
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
  it("interrupteur éteint, aucun challenge publié, table illisible : rien", async () => {
    delete process.env.APPORTEUR_CHALLENGES_ESPACE_ENABLED;
    expect(await rendre()).toBeNull();
    process.env.APPORTEUR_CHALLENGES_ESPACE_ENABLED = "true";
    h.encart = null;
    expect(await rendre()).toBeNull();
    h.encart = {
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
