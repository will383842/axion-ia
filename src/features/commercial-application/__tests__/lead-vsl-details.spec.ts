/**
 * Écriture CIBLÉE de `details.vsl` : ce qu'elle écrit, et surtout ce qu'elle ne
 * touche pas (risque n°9 de l'architecture — `details` réécrit en entier).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

type Appel = { texte: string; valeurs: unknown[] };
const executes: Appel[] = [];
let ligneVerrouillee: Array<{ vsl: unknown }> = [];

function texteSql(chaines: TemplateStringsArray): string {
  return chaines.join("?").replace(/\s+/g, " ").trim();
}

const tx = {
  $queryRaw: vi.fn(async (c: TemplateStringsArray, ...v: unknown[]) => {
    executes.push({ texte: texteSql(c), valeurs: v });
    return ligneVerrouillee;
  }),
  $executeRaw: vi.fn(async (c: TemplateStringsArray, ...v: unknown[]) => {
    executes.push({ texte: texteSql(c), valeurs: v });
    return 1;
  }),
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $executeRaw: (c: TemplateStringsArray, ...v: unknown[]) => tx.$executeRaw(c, ...v),
    $transaction: async (f: (t: typeof tx) => Promise<unknown>) => f(tx),
  },
}));

import { avancerVslEtape2, etapeVsl, lireVsl, majVslCible } from "../lead-vsl-details";

beforeEach(() => {
  executes.length = 0;
  tx.$queryRaw.mockClear();
  tx.$executeRaw.mockClear();
  ligneVerrouillee = [{ vsl: { etapeAtteinte: 1, atteinte: { e1: "2026-10-05T10:00:00.000Z" } } }];
});

describe("lireVsl / etapeVsl", () => {
  it("lit défensivement : tout ce qui n'est pas un bloc vsl rend null", () => {
    for (const v of [null, undefined, 12, "x", [], {}, { vsl: null }, { vsl: [] }, { vsl: "x" }]) {
      expect(lireVsl(v)).toBeNull();
    }
    expect(etapeVsl({})).toBeNull();
  });

  it("un bloc sans marqueur n'a que l'étape 1 ; l'étape 2 est lue telle quelle", () => {
    expect(etapeVsl({ vsl: {} })).toBe(1);
    expect(etapeVsl({ vsl: { etapeAtteinte: 2 } })).toBe(2);
  });
});

describe("majVslCible", () => {
  it("écrit CE BLOC par une seule instruction, sans relire ni réécrire le reste de details", async () => {
    await majVslCible("11111111-1111-4111-8111-111111111111", { jetonVuLe: "2026-10-05" });
    expect(executes).toHaveLength(1);
    const sql = executes[0]?.texte ?? "";
    expect(sql).toContain("jsonb_set");
    expect(sql).toContain("'{vsl}'");
    // Fusion du bloc existant, jamais un remplacement de `details`.
    expect(sql).toContain("COALESCE(details -> 'vsl'");
    expect(sql).not.toMatch(/SET details = \?/);
    expect(executes[0]?.valeurs).toContain(JSON.stringify({ jetonVuLe: "2026-10-05" }));
  });
});

describe("avancerVslEtape2", () => {
  const base = {
    id: "11111111-1111-4111-8111-111111111111",
    telephoneChiffre: "enc:06",
    reponseId: "5-20",
    suspect: false,
    maintenant: new Date("2026-10-05T10:05:00Z"),
  };

  it("verrouille la ligne, puis écrit le téléphone et le bloc en une transaction", async () => {
    const issue = await avancerVslEtape2(base);
    expect(issue).toBe("avance");
    expect(executes[0]?.texte).toContain("FOR UPDATE");
    const ecriture = executes[1];
    expect(ecriture?.texte).toContain("contact_phone = COALESCE(contact_phone");
    const patch = JSON.parse(String(ecriture?.valeurs[0])) as Record<string, unknown>;
    expect(patch["etapeAtteinte"]).toBe(2);
    // L'heure de l'étape 1 est conservée, celle de l'étape 2 s'ajoute.
    expect(patch["atteinte"]).toEqual({
      e1: "2026-10-05T10:00:00.000Z",
      e2: "2026-10-05T10:05:00.000Z",
    });
    expect(patch["question"]).toEqual({ id: "dirigeants-connus", reponse: "5-20" });
    expect(patch).not.toHaveProperty("suspect");
  });

  it("ne remplace JAMAIS un téléphone déjà enregistré (COALESCE)", async () => {
    await avancerVslEtape2(base);
    expect(executes[1]?.texte).toMatch(/contact_phone = COALESCE\(contact_phone, \?\)/);
  });

  it("étape la plus avancée gagne : un lead déjà à l'étape 2 n'est ni réécrit ni rejoué", async () => {
    ligneVerrouillee = [{ vsl: { etapeAtteinte: 2 } }];
    const issue = await avancerVslEtape2(base);
    expect(issue).toBe("deja");
    expect(executes).toHaveLength(1); // le verrou seulement, aucune écriture
  });

  it("ligne introuvable ou effacée : rien n'est écrit", async () => {
    ligneVerrouillee = [];
    expect(await avancerVslEtape2(base)).toBe("introuvable");
    expect(executes).toHaveLength(1);
  });

  it("marque le bloc « suspect » quand c'est le cas", async () => {
    await avancerVslEtape2({ ...base, suspect: true });
    const patch = JSON.parse(String(executes[1]?.valeurs[0])) as Record<string, unknown>;
    expect(patch["suspect"]).toBe(true);
  });
});
