// @vitest-environment node
//
// Accusé de réception des « merci » (lot S4b). Base EN MÉMOIRE : le faux client applique les règles
// des UPDATE conditionnels à partir des VALEURS liées ; il ne prouve PAS la syntaxe SQL.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type Ligne = {
  id: string;
  jeton_empreinte: string;
  consenti_le: Date;
  merci_statut: string;
  conv_ref: string;
  updated_at?: Date;
};

const { bd } = vi.hoisted(() => ({
  bd: { contacts: [] as Ligne[], suppressions: 0 },
}));

vi.mock("@/lib/prisma", () => {
  const tx = {
    // Le faux client distingue les requêtes par leur TEXTE SQL (jamais par l'ordre des valeurs seul),
    // pour que la REPRISE et l'expiration de `reserverConfirmations` soient réellement exécutées.
    $executeRaw: async (sql: { sql: string; values: unknown[] }) => {
      const v = sql.values;
      let m = 0;
      if (sql.sql.includes("CASE")) {
        // REPRISE : [debutFenetre, aEnvoyer, expire, maintenant, reserve, seuil]
        const [debut, relance, expire, quand, ancien, seuil] = v as [
          Date,
          string,
          string,
          Date,
          string,
          Date,
        ];
        // Les statuts visés sont ceux liés ET tout littéral SQL ajouté (`IN ('reserve','envoye')`) :
        // une reprise élargie à `envoye` doit faire rougir les tests.
        const vises = [ancien, ...(sql.sql.match(/'(\w+)'/g) ?? []).map((x) => x.slice(1, -1))];
        for (const l of bd.contacts)
          if (vises.includes(l.merci_statut) && (l.updated_at ?? l.consenti_le) < seuil) {
            l.merci_statut = l.consenti_le >= debut ? relance : expire;
            l.updated_at = quand;
            m++;
          }
      } else if (!sql.sql.includes('"jeton_empreinte" =')) {
        // Expiration des a_envoyer hors fenêtre : [expire, maintenant, aEnvoyer, debut]
        const [statut, quand, ancien, debut] = v as [string, Date, string, Date];
        for (const l of bd.contacts)
          if (l.merci_statut === ancien && l.consenti_le < debut) {
            l.merci_statut = statut;
            l.updated_at = quand;
            m++;
          }
      } else if (sql.sql.includes(" IN (")) {
        // Terminal : [statut, quand, ref, reserve, a_envoyer]
        const [statut, quand, ref, s1, s2] = v as [string, Date, string, string, string];
        for (const l of bd.contacts)
          if (l.jeton_empreinte === ref && [s1, s2].includes(l.merci_statut)) {
            l.merci_statut = statut;
            l.updated_at = quand;
            m++;
          }
      } else {
        // Échec : [statut, quand, ref, reserve, debut, seuilReprise]
        const [statut, quand, ref, ancien, debut, seuil] = v as [
          string,
          Date,
          string,
          string,
          Date,
          Date,
        ];
        const dedans = sql.sql.includes('"consenti_le" >=');
        const ancienne = !sql.sql.includes('"updated_at" <');
        for (const l of bd.contacts)
          if (
            l.jeton_empreinte === ref &&
            l.merci_statut === ancien &&
            (dedans ? l.consenti_le >= debut : l.consenti_le < debut) &&
            (ancienne || (l.updated_at ?? l.consenti_le) < seuil)
          ) {
            l.merci_statut = statut;
            l.updated_at = quand;
            m++;
          }
      }
      return m;
    },
    $queryRaw: async (sql: { sql: string; values: unknown[] }) => {
      // Réservation (S4a) : [reserve, quand, a_envoyer, debut, limite]
      const [statut, quand, ancien, debut, limite] = sql.values as [
        string,
        Date,
        string,
        Date,
        number,
      ];
      const pris = bd.contacts
        .filter((l) => l.merci_statut === ancien && l.consenti_le >= debut)
        .slice(0, limite);
      for (const l of pris) {
        l.merci_statut = statut;
        l.updated_at = quand;
      }
      return pris.map((l) => ({ jeton_empreinte: l.jeton_empreinte, consenti_le: l.consenti_le }));
    },
  };
  const interdit = async () => {
    bd.suppressions++;
    throw new Error("interdit");
  };
  return {
    prisma: {
      $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
      contactGuideReseau: { delete: interdit, deleteMany: interdit },
    },
  };
});

import {
  accuserConfirmations,
  SchemaAccuse,
  recevoirAccuseConfirmations,
} from "../accuse-confirmations";
import { reserverConfirmations } from "../confirmations";
import { FENETRE_MERCI_H } from "../config";

const MAINTENANT = new Date("2026-11-11T12:00:00.000Z");
const il_y_a = (h: number) => new Date(MAINTENANT.getTime() - h * 3_600_000);
let n = 0;
function ajouter(p: Partial<Ligne> = {}): Ligne {
  n++;
  const l: Ligne = {
    id: `c${n}`,
    jeton_empreinte: String(n).padStart(64, "0"),
    consenti_le: il_y_a(1),
    merci_statut: "reserve",
    conv_ref: `conv-secrete-${n}`,
    updated_at: il_y_a(0.01),
    ...p,
  };
  bd.contacts.push(l);
  return l;
}

beforeEach(() => {
  bd.contacts.length = 0;
  bd.suppressions = 0;
  n = 0;
});
afterEach(() => expect(bd.suppressions).toBe(0));

describe("accusé", () => {
  it("envoye : la ligne ne ressort plus jamais, même après 10 min et plus", async () => {
    const l = ajouter({ merci_statut: "a_envoyer" });
    expect(await reserverConfirmations(MAINTENANT)).toHaveLength(1);
    await accuserConfirmations([{ ref: l.jeton_empreinte, issue: "envoye" }], MAINTENANT);
    expect(l.merci_statut).toBe("envoye");
    const plus_tard = new Date(MAINTENANT.getTime() + 3 * 3_600_000);
    expect(await reserverConfirmations(plus_tard)).toEqual([]);
    expect(l.merci_statut).toBe("envoye");
  });

  it("rejeu de l'accusé : sans effet, une ligne envoye ne change plus", async () => {
    const l = ajouter();
    await accuserConfirmations([{ ref: l.jeton_empreinte, issue: "envoye" }], MAINTENANT);
    const t = l.updated_at;
    for (const issue of ["envoye", "echec", "hors_fenetre"] as const)
      await accuserConfirmations(
        [{ ref: l.jeton_empreinte, issue }],
        new Date(MAINTENANT.getTime() + 60_000),
      );
    expect(l.merci_statut).toBe("envoye");
    expect(l.updated_at).toBe(t);
  });

  it("echec dans la fenêtre : la ligne ressort", async () => {
    const l = ajouter({ updated_at: il_y_a(1) });
    await accuserConfirmations([{ ref: l.jeton_empreinte, issue: "echec" }], MAINTENANT);
    expect(l.merci_statut).toBe("a_envoyer");
    expect(await reserverConfirmations(MAINTENANT)).toHaveLength(1);
  });

  it("echec hors fenêtre de 48 h : expire, ne ressort pas", async () => {
    const l = ajouter({ consenti_le: il_y_a(FENETRE_MERCI_H + 1), updated_at: il_y_a(1) });
    await accuserConfirmations([{ ref: l.jeton_empreinte, issue: "echec" }], MAINTENANT);
    expect(l.merci_statut).toBe("expire");
    expect(await reserverConfirmations(MAINTENANT)).toEqual([]);
  });

  it("hors_fenetre : la ligne est close et ne ressort plus", async () => {
    const l = ajouter();
    await accuserConfirmations([{ ref: l.jeton_empreinte, issue: "hors_fenetre" }], MAINTENANT);
    expect(l.merci_statut).toBe("hors_fenetre");
    expect(await reserverConfirmations(new Date(MAINTENANT.getTime() + 3_600_000))).toEqual([]);
  });

  it("ref inconnue ignorée sans erreur ; ligne écartée ou expirée jamais touchée", async () => {
    const e = ajouter({ merci_statut: "ecarte" });
    const x = ajouter({ merci_statut: "expire" });
    await expect(
      accuserConfirmations(
        [
          { ref: "f".repeat(64), issue: "envoye" },
          { ref: e.jeton_empreinte, issue: "envoye" },
          { ref: x.jeton_empreinte, issue: "echec" },
        ],
        MAINTENANT,
      ),
    ).resolves.toBeUndefined();
    expect(e.merci_statut).toBe("ecarte");
    expect(x.merci_statut).toBe("expire");
  });

  it("accusé tardif après reprise (a_envoyer) : envoye, plus de doublon", async () => {
    const l = ajouter({ merci_statut: "a_envoyer" });
    await accuserConfirmations([{ ref: l.jeton_empreinte, issue: "envoye" }], MAINTENANT);
    expect(l.merci_statut).toBe("envoye");
  });

  it("la reprise est RÉELLEMENT exécutée : une réservation de plus de 10 min repasse à a_envoyer puis ressort", async () => {
    const l = ajouter({ merci_statut: "reserve", updated_at: il_y_a(1) });
    const r = await reserverConfirmations(MAINTENANT);
    expect(r.map((x) => x.ref)).toEqual([l.jeton_empreinte]);
    expect(l.merci_statut).toBe("reserve");
    expect(l.updated_at).toEqual(MAINTENANT);
  });

  it("la reprise envoie à expire une réservation perdue hors fenêtre de 48 h", async () => {
    const l = ajouter({
      merci_statut: "reserve",
      consenti_le: il_y_a(FENETRE_MERCI_H + 1),
      updated_at: il_y_a(1),
    });
    expect(await reserverConfirmations(MAINTENANT)).toEqual([]);
    expect(l.merci_statut).toBe("expire");
  });

  it("une réservation de moins de 10 min n'est pas reprise", async () => {
    const l = ajouter({ merci_statut: "reserve", updated_at: il_y_a(0.01) });
    expect(await reserverConfirmations(MAINTENANT)).toEqual([]);
    expect(l.merci_statut).toBe("reserve");
  });

  it("« envoye » : même 3 h plus tard, la reprise (réellement exécutée) ne le reprend pas", async () => {
    const l = ajouter({ merci_statut: "reserve", updated_at: il_y_a(0.01) });
    await accuserConfirmations([{ ref: l.jeton_empreinte, issue: "envoye" }], MAINTENANT);
    const tard = new Date(MAINTENANT.getTime() + 3 * 3_600_000);
    l.updated_at = new Date(MAINTENANT.getTime() - 3_600_000); // ancien : la reprise le viserait s'il était reserve
    expect(await reserverConfirmations(tard)).toEqual([]);
    expect(l.merci_statut).toBe("envoye");
  });

  it("désordre : un echec TARDIF de R1 n'annule pas la réservation R2 en cours (pas de merci en double)", async () => {
    const l = ajouter({ merci_statut: "a_envoyer" });
    await reserverConfirmations(il_y_a(1)); // R1
    await reserverConfirmations(MAINTENANT); // reprise de R1 puis R2
    expect(l.merci_statut).toBe("reserve");
    // l'echec de R1 arrive maintenant : R2 est toute fraîche
    await accuserConfirmations([{ ref: l.jeton_empreinte, issue: "echec" }], MAINTENANT);
    expect(l.merci_statut).toBe("reserve");
    expect(await reserverConfirmations(MAINTENANT)).toEqual([]); // pas de R3
  });

  it("la reprise ne reprend jamais envoye / hors_fenetre", async () => {
    const a = ajouter({ merci_statut: "envoye", updated_at: il_y_a(100) });
    const b = ajouter({ merci_statut: "hors_fenetre", updated_at: il_y_a(100) });
    await reserverConfirmations(MAINTENANT);
    expect([a.merci_statut, b.merci_statut]).toEqual(["envoye", "hors_fenetre"]);
  });
});

describe("corps", () => {
  const ok = { ref: "a".repeat(64), issue: "envoye" };
  it("accepte 1 à 50 issues", () => {
    expect(SchemaAccuse.safeParse({ schemaVersion: 1, issues: [ok] }).success).toBe(true);
    expect(SchemaAccuse.safeParse({ schemaVersion: 1, issues: Array(50).fill(ok) }).success).toBe(
      true,
    );
  });
  it.each([
    { schemaVersion: 1, issues: [] },
    { schemaVersion: 1, issues: Array(51).fill(ok) },
    { schemaVersion: 2, issues: [ok] },
    { schemaVersion: 1, issues: [{ ref: "a", issue: "supprime" }] },
    { schemaVersion: 1, issues: [{ ...ok, adresse: "a@b.test" }] },
    { schemaVersion: 1, issues: [ok], extra: 1 },
  ])("refuse %j", (c) => {
    expect(SchemaAccuse.safeParse(c).success).toBe(false);
  });
});

describe("rien de personnel", () => {
  it("réponse et journaux sans donnée de personne", async () => {
    const sorties: string[] = [];
    for (const m of ["log", "info", "warn", "error", "debug"] as const)
      vi.spyOn(console, m).mockImplementation((...a: unknown[]) => {
        sorties.push(a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" "));
      });
    const l = ajouter();
    const r = await recevoirAccuseConfirmations({
      ok: true,
      corps: Buffer.from(
        JSON.stringify({ schemaVersion: 1, issues: [{ ref: l.jeton_empreinte, issue: "envoye" }] }),
      ),
      corpsSha256: "",
      horodatage: 0,
      nonce: "",
      methode: "POST",
      chemin: "/x",
      secret: "courant",
    });
    const texte = await r.text();
    expect(r.status).toBe(200);
    const tout = [texte, ...sorties].join("\n");
    expect(tout).not.toContain("@");
    expect(tout).not.toContain(l.jeton_empreinte);
    expect(tout).not.toContain(l.conv_ref);
    expect(sorties.join("")).toContain('"event":"guides_reseau_accuse_confirmations"');
    vi.restoreAllMocks();
  });
});
