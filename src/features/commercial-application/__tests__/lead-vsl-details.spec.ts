/**
 * Écriture CIBLÉE de `details.vsl` : ce qu'elle écrit, et surtout ce qu'elle ne
 * touche pas (risque n°9 de l'architecture — `details` réécrit en entier).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

type Appel = { texte: string; valeurs: unknown[] };
const executes: Appel[] = [];
let ligneVerrouillee: Array<Record<string, unknown>> = [];

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
  ajouterRetourVsl,
  completerRetourVsl,
  lireRetoursVsl,
  RETOURS_VSL_MAX,
  avancerVslEtape2,
  etapeVsl,
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

describe("🔴 retours d'une personne DÉJÀ CONNUE — trace bornée, rien d'autre (R3, 2026-10-10)", () => {
  const ID = "22222222-2222-4222-8222-222222222222";
  const LE = "2026-10-10T09:00:00.000Z";
  const retour = (le: string, etape: 1 | 2 = 1) => ({ le, etape, consentPub: true });
  const ecrit = () => JSON.parse(String(executes[1]?.valeurs[0])) as Array<Record<string, unknown>>;

  it("étape 1 : AJOUTE une trace sous verrou, et n'écrit QUE `details.retoursVsl`", async () => {
    ligneVerrouillee = [{ retours: null }];
    const issue = await ajouterRetourVsl(ID, {
      le: LE,
      etape: 1,
      utm: { source: "facebook", campaign: "apporteurs-vsl-2026-10", content: "ad-42" },
      consentPub: true,
    });
    expect(issue).toBe("ecrit");
    const [lecture, ecriture] = executes;
    // Verrou, et JAMAIS sur un lead vidéo (qui suit son propre bloc `vsl`).
    expect(lecture?.texte).toContain("FOR UPDATE");
    expect(lecture?.texte).toContain("NOT (COALESCE(details, '{}'::jsonb) ? 'vsl')");
    expect(ecriture?.texte).toContain("'{retoursVsl}'");
    // Ni téléphone principal, ni nom, ni statut, ni archivage, ni date de mise à jour.
    expect(ecriture?.texte).not.toMatch(
      /contact_phone|contact_name|contact_email|status|archived|deleted|updated_at|'\{vsl\}'|'\{etape\}'/,
    );
    expect(ecrit()).toEqual([
      {
        le: LE,
        etape: 1,
        utm: { source: "facebook", campaign: "apporteurs-vsl-2026-10", content: "ad-42" },
        consentPub: true,
      },
    ]);
  });

  it("dix retours au plus, les plus récents", async () => {
    ligneVerrouillee = [
      { retours: Array.from({ length: RETOURS_VSL_MAX }, (_, i) => retour(`2026-10-0${i}`)) },
    ];
    await ajouterRetourVsl(ID, retour(LE));
    const r = ecrit();
    expect(r).toHaveLength(RETOURS_VSL_MAX);
    expect(r.at(-1)?.["le"]).toBe(LE);
    expect(r[0]?.["le"]).toBe("2026-10-01");
  });

  it("fiche absente, effacée ou lead vidéo : « introuvable », rien n'est écrit", async () => {
    ligneVerrouillee = [];
    expect(await ajouterRetourVsl(ID, retour(LE))).toBe("introuvable");
    expect(executes).toHaveLength(1);
  });

  it("étape 2 : complète LE retour de son étape 1, téléphone CHIFFRÉ dans la trace seulement", async () => {
    ligneVerrouillee = [{ retours: [retour("2026-10-09T09:00:00.000Z"), retour(LE)] }];
    const issue = await completerRetourVsl({
      id: ID,
      le: LE,
      maintenant: new Date("2026-10-10T09:01:00.000Z"),
      dirigeants: "5-20",
      telephoneChiffre: "enc:06 12 34 56 78",
    });
    expect(issue).toBe("ecrit");
    expect(executes[1]?.texte).not.toMatch(/contact_phone/);
    const r = ecrit();
    expect(r[0]).toEqual(retour("2026-10-09T09:00:00.000Z"));
    expect(r[1]).toEqual({
      le: LE,
      etape: 2,
      consentPub: true,
      e2: "2026-10-10T09:01:00.000Z",
      dirigeants: "5-20",
      telephoneChiffre: "enc:06 12 34 56 78",
    });
  });

  it("étape 2 déjà complétée (double clic) : « deja », aucune écriture", async () => {
    ligneVerrouillee = [{ retours: [retour(LE, 2)] }];
    const issue = await completerRetourVsl({
      id: ID,
      le: LE,
      maintenant: new Date(),
      dirigeants: "5-20",
      telephoneChiffre: "enc:x",
    });
    expect(issue).toBe("deja");
    expect(executes).toHaveLength(1);
  });

  it("étape 2 sans trace d'étape 1 (écriture ratée) : un retour est ajouté", async () => {
    ligneVerrouillee = [{ retours: [] }];
    await completerRetourVsl({
      id: ID,
      le: LE,
      maintenant: new Date("2026-10-10T09:01:00.000Z"),
      dirigeants: "moins-5",
      telephoneChiffre: null,
    });
    expect(ecrit()).toEqual([
      expect.objectContaining({ le: LE, etape: 2, consentPub: null, dirigeants: "moins-5" }),
    ]);
  });

  it("lireRetoursVsl lit défensivement", () => {
    for (const v of [null, {}, { retoursVsl: "x" }, { retoursVsl: [1, null, {}] }]) {
      expect(lireRetoursVsl(v)).toEqual([]);
    }
  });
});
