// @vitest-environment node
//
// Réservation des « merci » (lot S4a). Base EN MÉMOIRE : le faux client lit les VALEURS liées de la
// requête (statuts, fenêtre, limite) et applique les règles du SQL ; il ne prouve PAS la syntaxe SQL
// (voir la description de la PR). Adresses fictives de domaine réservé .test. Aucune suppression.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type Ligne = {
  id: string;
  email_key: string;
  jeton_empreinte: string;
  consenti_le: Date;
  merci_statut: string;
  conv_ref: string;
  updated_at?: Date;
};

const { bd } = vi.hoisted(() => ({
  bd: {
    contacts: [] as Ligne[],
    oppositions: [] as string[],
    suppressions: 0,
    ecritures: [] as string[],
  },
}));

vi.mock("@/lib/prisma", () => {
  const tx = {
    $executeRaw: async (sql: { sql: string; values: unknown[] }) => {
      if (sql.sql.includes("CASE")) {
        // REPRISE : [debutFenetre, aEnvoyer, expire, maintenant, reserve, seuil]
        const [debut, relance, expire, quand, ancien, seuil] = sql.values as [
          Date,
          string,
          string,
          Date,
          string,
          Date,
        ];
        let m = 0;
        for (const l of bd.contacts) {
          if (l.merci_statut === ancien && (l.updated_at ?? l.consenti_le) < seuil) {
            l.merci_statut = l.consenti_le >= debut ? relance : expire;
            l.updated_at = quand;
            bd.ecritures.push(l.id);
            m++;
          }
        }
        return m;
      }
      const [statut, quand, ancien, debut] = sql.values as [string, Date, string, Date];
      let n = 0;
      for (const l of bd.contacts) {
        if (l.merci_statut === ancien && l.consenti_le < debut) {
          l.merci_statut = statut;
          l.updated_at = quand;
          bd.ecritures.push(l.id);
          n++;
        }
      }
      return n;
    },
    $queryRaw: async (sql: { sql: string; values: unknown[] }) => {
      const [statut, quand, ancien, debut, limite] = sql.values as [
        string,
        Date,
        string,
        Date,
        number,
      ];
      const pris = bd.contacts
        .filter(
          (l) =>
            l.merci_statut === ancien &&
            l.email_key !== "-" &&
            l.consenti_le >= debut &&
            !bd.oppositions.includes(l.email_key),
        )
        .sort((a, b) => a.consenti_le.getTime() - b.consenti_le.getTime())
        .slice(0, limite);
      for (const l of pris) {
        l.merci_statut = statut;
        l.updated_at = quand;
        bd.ecritures.push(l.id);
      }
      return pris.map((l) => ({ jeton_empreinte: l.jeton_empreinte, consenti_le: l.consenti_le }));
    },
  };
  const interdit = async () => {
    bd.suppressions++;
    throw new Error("interdit : aucune suppression");
  };
  return {
    prisma: {
      $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
      contactGuideReseau: { delete: interdit, deleteMany: interdit },
    },
  };
});

import { reserverConfirmations, recevoirDemandeConfirmations } from "../confirmations";
import { FENETRE_MERCI_H, LOT_MAX_CONFIRMATIONS } from "../config";
import { DELAI_REPRISE_RESERVATION_MIN } from "../confirmations";
import { hashEmailForLookup } from "@/lib/security/email-hash";

const MAINTENANT = new Date("2026-11-11T12:00:00.000Z");
const il_y_a = (h: number) => new Date(MAINTENANT.getTime() - h * 3_600_000);
let n = 0;
function ajouter(p: Partial<Ligne> & { adresse?: string }): Ligne {
  n++;
  const l: Ligne = {
    id: `c${n}`,
    email_key: hashEmailForLookup(p.adresse ?? `personne${n}@exemple.test`)!,
    jeton_empreinte: String(n).padStart(64, "0"),
    consenti_le: il_y_a(1),
    merci_statut: "a_envoyer",
    conv_ref: `conv-secrete-${n}`,
    ...p,
  };
  delete (l as { adresse?: string }).adresse;
  bd.contacts.push(l);
  return l;
}

beforeEach(() => {
  bd.contacts.length = 0;
  bd.oppositions.length = 0;
  bd.ecritures.length = 0;
  bd.suppressions = 0;
  n = 0;
});
afterEach(() => {
  expect(bd.suppressions).toBe(0);
});

describe("réservation", () => {
  it("5 · une ligne a_envoyer sort UNE fois ; deux appels simultanés ne se recoupent pas", async () => {
    for (let i = 0; i < 4; i++) ajouter({});
    const [a, b] = await Promise.all([
      reserverConfirmations(MAINTENANT, 3),
      reserverConfirmations(MAINTENANT, 3),
    ]);
    const refs = [...a, ...b].map((x) => x.ref);
    expect(refs).toHaveLength(4);
    expect(new Set(refs).size).toBe(4);
    expect(bd.contacts.every((l) => l.merci_statut === "reserve")).toBe(true);
    // Second appel : liste vide.
    expect(await reserverConfirmations(MAINTENANT)).toEqual([]);
  });

  it("5 · rend uniquement { ref: jeton_empreinte, valideLe: consenti_le }, plus anciens d'abord", async () => {
    const recent = ajouter({ consenti_le: il_y_a(1) });
    const ancien = ajouter({ consenti_le: il_y_a(5) });
    const r = await reserverConfirmations(MAINTENANT);
    expect(r).toEqual([
      { ref: ancien.jeton_empreinte, valideLe: ancien.consenti_le.toISOString() },
      { ref: recent.jeton_empreinte, valideLe: recent.consenti_le.toISOString() },
    ]);
    expect(Object.keys(r[0]!).sort()).toEqual(["ref", "valideLe"]);
  });

  it("la limite est bornée à LOT_MAX_CONFIRMATIONS", async () => {
    for (let i = 0; i < LOT_MAX_CONFIRMATIONS + 5; i++) ajouter({});
    expect(await reserverConfirmations(MAINTENANT, 9999)).toHaveLength(LOT_MAX_CONFIRMATIONS);
  });

  it("6 · adresse opposée après le POST de la page : absente, la ligne reste a_envoyer", async () => {
    const adresse = "opposee@exemple.test";
    const l = ajouter({ adresse });
    ajouter({});
    bd.oppositions.push(hashEmailForLookup(adresse)!); // même fonction des deux côtés
    const r = await reserverConfirmations(MAINTENANT);
    expect(r.map((x) => x.ref)).not.toContain(l.jeton_empreinte);
    expect(r).toHaveLength(1);
    expect(l.merci_statut).toBe("a_envoyer");
    expect(bd.ecritures).not.toContain(l.id);
    expect(bd.contacts).toContain(l);
  });

  it("6 · la casse et les espaces de l'adresse donnent la même empreinte des deux côtés", () => {
    expect(hashEmailForLookup("  Opposee@Exemple.TEST ")).toBe(
      hashEmailForLookup("opposee@exemple.test"),
    );
  });

  it.each(["ecarte", "ecartee", "reserve", "envoye", "hors_fenetre", "aucun", "expire"])(
    "7 · statut %s : absent et inchangé",
    async (statut) => {
      // `reserve` : réservation récente (< 10 min), sinon la reprise la relâche (testée plus bas).
      const l = ajouter({
        merci_statut: statut,
        updated_at: new Date(MAINTENANT.getTime() - 5 * 60_000),
      });
      expect(await reserverConfirmations(MAINTENANT)).toEqual([]);
      expect(l.merci_statut).toBe(statut);
    },
  );

  it("7 · marque email_key='-' : absente et inchangée", async () => {
    const l = ajouter({ email_key: "-" });
    expect(await reserverConfirmations(MAINTENANT)).toEqual([]);
    expect(l.merci_statut).toBe("a_envoyer");
  });

  it("8 · a_envoyer de plus de 48 h : passe à expire, absente, toujours en base", async () => {
    const vieille = ajouter({ consenti_le: il_y_a(FENETRE_MERCI_H + 1) });
    const limite = ajouter({ consenti_le: il_y_a(FENETRE_MERCI_H - 1) });
    const r = await reserverConfirmations(MAINTENANT);
    expect(r.map((x) => x.ref)).toEqual([limite.jeton_empreinte]);
    expect(vieille.merci_statut).toBe("expire");
    expect(bd.contacts).toContain(vieille);
  });
});

describe("reprise des réservations perdues", () => {
  const reserveDepuis = (min: number, p: Partial<Ligne> = {}) =>
    ajouter({
      merci_statut: "reserve",
      updated_at: new Date(MAINTENANT.getTime() - min * 60_000),
      ...p,
    });

  it("reserve depuis 11 min, dans la fenêtre : redevient a_envoyer et ressort", async () => {
    const l = reserveDepuis(11);
    const r = await reserverConfirmations(MAINTENANT);
    expect(r.map((x) => x.ref)).toEqual([l.jeton_empreinte]);
    expect(l.merci_statut).toBe("reserve"); // re-réservée
    expect(bd.ecritures.filter((id) => id === l.id)).toHaveLength(2); // reprise + réservation
    expect(DELAI_REPRISE_RESERVATION_MIN).toBe(10);
  });

  it("reserve depuis 5 min : inchangée, non proposée", async () => {
    const l = reserveDepuis(5);
    expect(await reserverConfirmations(MAINTENANT)).toEqual([]);
    expect(l.merci_statut).toBe("reserve");
    expect(bd.ecritures).not.toContain(l.id);
  });

  it("reserve hors fenêtre de 48 h : expire, absente, conservée", async () => {
    const l = reserveDepuis(60, { consenti_le: il_y_a(FENETRE_MERCI_H + 1) });
    expect(await reserverConfirmations(MAINTENANT)).toEqual([]);
    expect(l.merci_statut).toBe("expire");
    expect(bd.contacts).toContain(l);
  });

  it("envoye : ne bouge jamais, même ancienne", async () => {
    const l = ajouter({ merci_statut: "envoye", updated_at: il_y_a(100) });
    expect(await reserverConfirmations(MAINTENANT)).toEqual([]);
    expect(l.merci_statut).toBe("envoye");
    expect(bd.ecritures).not.toContain(l.id);
  });

  it("aucun DELETE pendant la reprise", async () => {
    reserveDepuis(30);
    reserveDepuis(30, { consenti_le: il_y_a(FENETRE_MERCI_H + 5) });
    await reserverConfirmations(MAINTENANT);
    expect(bd.suppressions).toBe(0);
  });
});

describe("9 · rien de personnel dans la réponse ni le journal", () => {
  it("ni '@', ni email_key, ni conv_ref", async () => {
    const sorties: string[] = [];
    for (const m of ["log", "info", "warn", "error", "debug"] as const) {
      vi.spyOn(console, m).mockImplementation((...a: unknown[]) => {
        sorties.push(a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" "));
      });
    }
    const l = ajouter({ adresse: "secrete@exemple.test" });
    const reponse = await recevoirDemandeConfirmations({
      ok: true,
      corps: Buffer.from(JSON.stringify({ schemaVersion: 1 })),
      corpsSha256: "",
      horodatage: 0,
      nonce: "",
      methode: "POST",
      chemin: "/x",
      secret: "courant",
    });
    const texte = await reponse.text();
    expect(reponse.status).toBe(200);
    const tout = [texte, ...sorties].join("\n");
    expect(tout).not.toContain("@");
    expect(tout).not.toContain(l.email_key);
    expect(tout).not.toContain(l.conv_ref);
    expect(sorties.join("")).toContain('"event":"guides_reseau_confirmations"');
    expect(sorties.join("")).toContain('"reservees":1');
    vi.restoreAllMocks();
  });
});
