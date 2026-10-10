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

import {
  MAX_RETOURS_VSL,
  ajouterRetourVsl,
  avancerVslEtape2,
  completerRetourVsl,
  etapeVsl,
  lireRetoursVsl,
  lireVsl,
  majMessageVsl,
  majVslCible,
} from "../lead-vsl-details";

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
    const patch = JSON.parse(
      String(ecriture?.valeurs.find((v) => String(v).includes("etapeAtteinte"))),
    ) as Record<string, unknown>;
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
    const patch = JSON.parse(
      String(executes[1]?.valeurs.find((v) => String(v).includes("etapeAtteinte"))),
    ) as Record<string, unknown>;
    expect(patch["suspect"]).toBe(true);
  });
});

describe("message de la fiche (console)", () => {
  it("l'étape 2 réécrit details.message dans la MÊME instruction, quand un message est fourni", async () => {
    ligneVerrouillee = [{ vsl: { etapeAtteinte: 1 } }];
    await avancerVslEtape2({
      id: "11111111-1111-4111-8111-111111111111",
      telephoneChiffre: "enc:06",
      reponseId: "5-20",
      suspect: false,
      maintenant: new Date("2026-10-05T10:05:00Z"),
      message: "Inscription terminée",
    });
    expect(executes[1]?.texte).toContain("'{message}'");
    expect(executes[1]?.valeurs).toContain(JSON.stringify("Inscription terminée"));
  });

  it("sans message fourni, details.message n'est pas touché (valeur JSON null écartée par le CASE)", async () => {
    ligneVerrouillee = [{ vsl: { etapeAtteinte: 1 } }];
    await avancerVslEtape2({
      id: "11111111-1111-4111-8111-111111111111",
      telephoneChiffre: null,
      reponseId: "5-20",
      suspect: false,
      maintenant: new Date(),
    });
    expect(executes[1]?.valeurs).toContain("null");
    expect(executes[1]?.texte).toContain("WHEN");
  });

  it("majMessageVsl ne vise QUE les lignes qui portent un bloc vsl", async () => {
    await majMessageVsl("11111111-1111-4111-8111-111111111111", "Échange réservé");
    const sql = executes[0]?.texte ?? "";
    expect(sql).toContain("details ? 'vsl'");
    expect(sql).toContain("'{message}'");
    expect(executes[0]?.valeurs).toContain(JSON.stringify("Échange réservé"));
  });
});

// P2 (2026-10-10) — la trace d'une personne DÉJÀ CONNUE revenue par la publicité.
describe("ajouterRetourVsl", () => {
  it("ajoute UNE entrée bornée aux 10 plus récentes, sans toucher au reste de la fiche", async () => {
    await ajouterRetourVsl("11111111-1111-4111-8111-111111111111", {
      le: "2026-10-10T08:00:00.000Z",
      etape: 1,
      utm: { content: "annonce-42" },
    });
    expect(executes).toHaveLength(1);
    const sql = executes[0]?.texte ?? "";
    expect(sql).toContain("'{retoursVsl}'");
    expect(sql).toContain("LIMIT ?");
    expect(executes[0]?.valeurs).toContain(MAX_RETOURS_VSL);
    expect(MAX_RETOURS_VSL).toBe(10);
    // Ni étape, ni statut, ni nom, ni téléphone, ni archivage, ni date de mise à jour.
    expect(sql).not.toMatch(/contact_phone|contact_name|status|archived_at|updated_at|'\{vsl\}'/);
    expect(sql).not.toMatch(/SET details = \?/);
  });
});

describe("completerRetourVsl", () => {
  const base = {
    id: "11111111-1111-4111-8111-111111111111",
    le: "2026-10-10T08:00:00.000Z",
    telephoneChiffre: "enc:07",
    reponseId: "moins-5",
    suspect: false,
    maintenant: new Date("2026-10-10T08:01:00Z"),
  };
  const retours = (r: unknown[]) => {
    ligneVerrouillee = [{ retours: r } as unknown as { vsl: unknown }];
  };

  it("complète l'entrée DÉSIGNÉE par l'heure du jeton, jamais le téléphone de la fiche", async () => {
    retours([
      { le: "2026-10-09T08:00:00.000Z", etape: 1 },
      { le: base.le, etape: 1 },
      { le: "2026-10-10T09:00:00.000Z", etape: 1 },
    ]);
    expect(await completerRetourVsl(base)).toBe("complete");
    expect(executes[0]?.texte).toContain("FOR UPDATE");
    const ecriture = executes[1];
    expect(ecriture?.valeurs).toContainEqual(["retoursVsl", "1"]);
    expect(ecriture?.texte).not.toMatch(/contact_phone|updated_at/);
    const patch = JSON.parse(
      String(ecriture?.valeurs.find((v) => String(v).includes("telephone"))),
    ) as Record<string, unknown>;
    expect(patch).toEqual({
      etape: 2,
      e2: "2026-10-10T08:01:00.000Z",
      reponse: "moins-5",
      telephone: "enc:07",
    });
  });

  it("déjà complétée : rien n'est réécrit (aucune seconde notification)", async () => {
    retours([{ le: base.le, etape: 2 }]);
    expect(await completerRetourVsl(base)).toBe("deja");
    expect(executes).toHaveLength(1);
  });

  it("entrée absente (sortie des 10, ou jeton d'un autre moment) : rien n'est écrit", async () => {
    retours([{ le: "2026-10-01T00:00:00.000Z", etape: 1 }]);
    expect(await completerRetourVsl(base)).toBe("introuvable");
    retours(null as unknown as unknown[]);
    expect(await completerRetourVsl(base)).toBe("introuvable");
    expect(executes.filter((e) => e.texte.startsWith("UPDATE"))).toHaveLength(0);
  });
});

describe("lireRetoursVsl", () => {
  it("lit défensivement", () => {
    expect(lireRetoursVsl(null)).toEqual([]);
    expect(lireRetoursVsl({ retoursVsl: "x" })).toEqual([]);
    expect(lireRetoursVsl({ retoursVsl: [{ le: "a", etape: 1 }, null, 3] })).toEqual([
      { le: "a", etape: 1 },
    ]);
  });
});
