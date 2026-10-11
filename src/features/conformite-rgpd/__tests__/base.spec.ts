// @vitest-environment node
// L'import écrit la BASE par upsert — et ne rouvre JAMAIS un écart corrigé dans la
// console. Base simulée en mémoire ; registre FICTIF.
import { describe, expect, it } from "vitest";

import { ecrireRegistreEnBase, fusionnerEcart, verifierCodes, type Auteur } from "../base";
import { validerRegistre, type Registre } from "../schema";

interface LigneT {
  id: string;
  cle: string;
  statut: "actif" | "archive";
  [k: string]: unknown;
}
interface LigneE {
  id: string;
  traitementId: string;
  code: string;
  statut: "ouvert" | "corrige";
  corrigeLe: Date | null;
  corrigeParId: string | null;
  corrigeParNom: string | null;
  [k: string]: unknown;
}

/** Une base minuscule : seules les méthodes qu'emploie `ecrireRegistreEnBase`. */
function baseEnMemoire() {
  const t: LigneT[] = [];
  const e: LigneE[] = [];
  let n = 0;
  const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
  const tx = {
    traitementRgpd: {
      findMany: async () =>
        t.map((x) => ({ ...x, ecarts: e.filter((y) => y.traitementId === x.id) })),
      upsert: async (a: {
        where: { cle: string };
        create: Omit<LigneT, "id">;
        update: Partial<LigneT>;
      }) => {
        const x = t.find((y) => y.cle === a.where.cle);
        if (x) {
          Object.assign(x, a.update);
          return { id: x.id };
        }
        const neuf = { ...a.create, id: id() } as LigneT;
        t.push(neuf);
        return { id: neuf.id };
      },
      updateMany: async (a: {
        where: { cle: { notIn: string[] }; statut: string };
        data: Partial<LigneT>;
      }) => {
        const cibles = t.filter(
          (x) => !a.where.cle.notIn.includes(x.cle) && x.statut === a.where.statut,
        );
        cibles.forEach((x) => Object.assign(x, a.data));
        return { count: cibles.length };
      },
    },
    ecartRgpd: {
      update: async (a: { where: { id: string }; data: Partial<LigneE> }) => {
        Object.assign(
          e.find((y) => y.id === a.where.id)!,
          a.data,
        );
      },
      create: async (a: { data: Omit<LigneE, "id"> }) => {
        e.push({ ...a.data, id: id() } as LigneE);
      },
    },
  };
  const client = {
    ...tx,
    $transaction: async (f: (x: typeof tx) => Promise<unknown>) => f(tx),
  };
  return { t, e, client: client as unknown as Parameters<typeof ecrireRegistreEnBase>[3] };
}

const AUTEUR: Auteur = { id: "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b", nom: "Admin Exemple" };
const T1 = new Date("2000-01-01T10:00:00Z");
const T2 = new Date("2000-02-01T10:00:00Z");

function registre(brut: unknown): Registre {
  const v = validerRegistre(brut);
  if (!v.ok) throw new Error(v.erreur);
  return v.registre;
}

const V1 = {
  traitements: [
    {
      id: "activite-a",
      nom: "Activité A",
      ecarts: [{ code: "A-1", gravite: "eleve", constat: "Constat A1" }, { gravite: "faible" }],
    },
    { id: "activite-b", nom: "Activité B" },
  ],
};

describe("Import du registre en base", () => {
  it("crée les activités et leurs écarts ; un écart sans code prend sa position", async () => {
    const b = baseEnMemoire();
    const bilan = await ecrireRegistreEnBase(registre(V1), AUTEUR, T1, b.client);
    expect(bilan).toEqual({ traitements: 2, ecarts: 2, archives: 0 });
    expect(b.t.map((x) => x.cle)).toEqual(["activite-a", "activite-b"]);
    expect(b.e.map((x) => x.code)).toEqual(["A-1", "#2"]);
    expect(b.e.every((x) => x.statut === "ouvert")).toBe(true);
  });

  it("🔑 un écart corrigé dans la console RESTE corrigé quand le fichier le dit ouvert", async () => {
    const b = baseEnMemoire();
    await ecrireRegistreEnBase(registre(V1), AUTEUR, T1, b.client);
    // Geste de la console : « Marquer corrigé ».
    const a1 = b.e.find((x) => x.code === "A-1")!;
    Object.assign(a1, {
      statut: "corrige",
      corrigeLe: T1,
      corrigeParId: "x",
      corrigeParNom: "Console",
    });

    const v2 = structuredClone(V1);
    v2.traitements[0]!.ecarts![0]!.constat = "Constat A1 reformulé";
    await ecrireRegistreEnBase(registre(v2), AUTEUR, T2, b.client);

    expect(b.e).toHaveLength(2); // upsert : pas de doublon
    const apres = b.e.find((x) => x.code === "A-1")!;
    expect(apres.statut).toBe("corrige");
    expect(apres.corrigeLe).toEqual(T1);
    expect(apres.corrigeParNom).toBe("Console");
    expect(apres.constat).toBe("Constat A1 reformulé");
  });

  it("un écart que le fichier dit corrigé passe corrigé, daté et signé de l'import", async () => {
    const b = baseEnMemoire();
    await ecrireRegistreEnBase(registre(V1), AUTEUR, T1, b.client);
    const v2 = structuredClone(V1) as {
      traitements: Array<{ ecarts?: Array<Record<string, unknown>> }>;
    };
    v2.traitements[0]!.ecarts![1]!.statut = "corrige";
    await ecrireRegistreEnBase(registre(v2), AUTEUR, T2, b.client);
    const e2 = b.e.find((x) => x.code === "#2")!;
    expect(e2).toMatchObject({ statut: "corrige", corrigeLe: T2, corrigeParNom: "Admin Exemple" });
  });

  it("une activité absente du fichier est ARCHIVÉE, pas effacée ; elle revient active ensuite", async () => {
    const b = baseEnMemoire();
    await ecrireRegistreEnBase(registre(V1), AUTEUR, T1, b.client);
    const sansB = { traitements: [V1.traitements[0]] };
    const bilan = await ecrireRegistreEnBase(registre(sansB), AUTEUR, T2, b.client);
    expect(bilan.archives).toBe(1);
    expect(b.t).toHaveLength(2);
    expect(b.t.find((x) => x.cle === "activite-b")!.statut).toBe("archive");
    await ecrireRegistreEnBase(registre(V1), AUTEUR, T2, b.client);
    expect(b.t.find((x) => x.cle === "activite-b")!.statut).toBe("actif");
  });

  it("un écart absent du nouveau fichier reste en base, tel quel", async () => {
    const b = baseEnMemoire();
    await ecrireRegistreEnBase(registre(V1), AUTEUR, T1, b.client);
    const v2 = { traitements: [{ id: "activite-a", nom: "Activité A" }, V1.traitements[1]] };
    await ecrireRegistreEnBase(registre(v2), AUTEUR, T2, b.client);
    expect(b.e).toHaveLength(2);
  });
});

describe("fusionnerEcart", () => {
  const fichier = { gravite: "moyen" as const, constat: null, correction: null };
  it("corrigé en base + ouvert dans le fichier → corrigé", () => {
    const r = fusionnerEcart(
      { statut: "corrige", corrigeLe: T1, corrigeParId: null, corrigeParNom: "Console" },
      { ...fichier, statut: "ouvert" },
      AUTEUR,
      T2,
    );
    expect(r).toMatchObject({ statut: "corrige", corrigeLe: T1, corrigeParNom: "Console" });
  });
  it("ouvert en base + ouvert dans le fichier → ouvert", () => {
    const r = fusionnerEcart(
      { statut: "ouvert", corrigeLe: null, corrigeParId: null, corrigeParNom: null },
      { ...fichier, statut: "ouvert" },
      AUTEUR,
      T2,
    );
    expect(r.statut).toBe("ouvert");
  });
});

describe("verifierCodes", () => {
  it("refuse deux écarts de même code dans une activité, pas dans deux activités", () => {
    expect(
      verifierCodes(
        registre({
          traitements: [
            { id: "a", nom: "A", ecarts: [{ code: "X", gravite: "faible" }] },
            { id: "b", nom: "B", ecarts: [{ code: "X", gravite: "faible" }] },
          ],
        }),
      ),
    ).toBeNull();
    expect(
      verifierCodes(
        registre({
          traitements: [
            {
              id: "a",
              nom: "A",
              ecarts: [
                { code: "X", gravite: "faible" },
                { code: "X", gravite: "moyen" },
              ],
            },
          ],
        }),
      ),
    ).toContain("code déjà utilisé");
  });
});
