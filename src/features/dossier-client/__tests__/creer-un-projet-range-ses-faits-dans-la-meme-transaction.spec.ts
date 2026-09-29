/**
 * ⛔ Créer un projet range ses faits DANS LA MÊME TRANSACTION (plan §3.13
 * point 1 bis) : `Projet`, `ProjetEvenement(cree)`, `ProjetContact`, et chaque
 * fait coché `a_ranger` → `projet` avec son `FaitEvenement(deplace)`.
 *
 * Base en mémoire dont la transaction ANNULE tout sur une exception, et qui
 * compte les écritures faites HORS transaction.
 *
 * Mutations qui font rougir :
 *   · écrire le projet par `db.projet.create` (hors `tx`) : une écriture hors
 *     transaction est comptée, et le projet survit à l'échec ;
 *   · retirer le contrôle « fait d'un autre client » : le fait étranger est
 *     rangé (ici la base en mémoire n'a pas les clés composées de la vraie).
 * Contre-témoin : un rangement valide range TOUS les faits cochés et journalise.
 * Angle mort : la vraie base ajoute les clés composées et le CHECK de portée
 * (Gate D, PR 2) ; ce test ne prouve que le code.
 */

import { describe, expect, it } from "vitest";
import { creerProjet, ErreurCreationProjet } from "../creer-projet";

interface Etat {
  projets: Array<{ id: string; numero: string; clientId: string; titre: string }>;
  evenementsProjet: Array<Record<string, unknown>>;
  contactsProjet: Array<Record<string, unknown>>;
  faits: Array<{ id: string; clientId: string | null; portee: string; projetId: string | null }>;
  evenementsFait: Array<Record<string, unknown>>;
}

function base(faits: Etat["faits"]) {
  let etat: Etat = {
    projets: [],
    evenementsProjet: [],
    contactsProjet: [],
    faits,
    evenementsFait: [],
  };
  let n = 0;
  let horsTransaction = 0;
  let enTransaction = false;
  const ecrire = () => {
    if (!enTransaction) horsTransaction += 1;
  };
  const tx = {
    projet: {
      async findMany() {
        return etat.projets.map((p) => ({ numero: p.numero }));
      },
      async create(args: { data: { numero: string; clientId: string; titre: string } }) {
        ecrire();
        n += 1;
        const p = { id: `prj-${n}`, ...args.data };
        etat.projets.push(p);
        return { id: p.id, numero: p.numero };
      },
    },
    projetEvenement: {
      async create(args: { data: Record<string, unknown> }) {
        ecrire();
        etat.evenementsProjet.push(args.data);
        return args.data;
      },
    },
    projetContact: {
      async create(args: { data: Record<string, unknown> }) {
        ecrire();
        etat.contactsProjet.push(args.data);
        return args.data;
      },
    },
    fait: {
      async findUnique(args: { where: { id: string } }) {
        const f = etat.faits.find((x) => x.id === args.where.id);
        return f ? { ...f } : null;
      },
      async update(args: { where: { id: string }; data: { portee: string; projetId: string } }) {
        ecrire();
        const f = etat.faits.find((x) => x.id === args.where.id);
        if (!f) throw new Error("fait introuvable");
        Object.assign(f, args.data);
        return f;
      },
    },
    faitEvenement: {
      async create(args: { data: Record<string, unknown> }) {
        ecrire();
        etat.evenementsFait.push(args.data);
        return args.data;
      },
    },
  };
  const db = {
    ...tx,
    get etat() {
      return etat;
    },
    get horsTransaction() {
      return horsTransaction;
    },
    async $transaction<T>(fn: (t: typeof tx) => Promise<T>): Promise<T> {
      const instantane = JSON.stringify(etat);
      enTransaction = true;
      try {
        return await fn(tx);
      } catch (e) {
        etat = JSON.parse(instantane) as Etat;
        throw e;
      } finally {
        enTransaction = false;
      }
    },
  };
  return db;
}

const CLIENT = "cl-1";
const AUTRE = "cl-2";

describe("⛔ créer un projet range ses faits dans la même transaction", () => {
  it("projet, événement, personnes et faits rangés — tout dans la transaction", async () => {
    const db = base([
      { id: "f1", clientId: CLIENT, portee: "a_ranger", projetId: null },
      { id: "f2", clientId: CLIENT, portee: "a_ranger", projetId: null },
    ]);
    const r = await creerProjet(db as never, {
      clientId: CLIENT,
      titre: "Formation IA des RH",
      contacts: [{ contactId: "c1", role: "decideur" }],
      faitsARangerIds: ["f1", "f2"],
      parAdminId: "admin-1",
      maintenant: new Date("2026-10-02T09:00:00Z"),
    });
    expect(r.numero).toBe("AXI-PRJ-2026-001");
    expect(r.faitsRanges).toBe(2);
    expect(db.horsTransaction).toBe(0);
    expect(db.etat.evenementsProjet).toEqual([
      expect.objectContaining({ projetId: r.id, action: "cree" }),
    ]);
    expect(db.etat.contactsProjet).toEqual([
      expect.objectContaining({
        projetId: r.id,
        contactId: "c1",
        clientId: CLIENT,
        role: "decideur",
      }),
    ]);
    for (const f of db.etat.faits) {
      expect(f).toEqual(expect.objectContaining({ portee: "projet", projetId: r.id }));
    }
    expect(db.etat.evenementsFait).toHaveLength(2);
    expect(db.etat.evenementsFait[0]).toEqual(
      expect.objectContaining({
        action: "deplace",
        ancienPortee: "a_ranger",
        nouveauPortee: "projet",
      }),
    );
  });

  it("un fait d'un AUTRE client fait tout échouer : aucun projet, aucun fait rangé", async () => {
    const db = base([
      { id: "f1", clientId: CLIENT, portee: "a_ranger", projetId: null },
      { id: "f-etranger", clientId: AUTRE, portee: "a_ranger", projetId: null },
    ]);
    await expect(
      creerProjet(db as never, {
        clientId: CLIENT,
        titre: "Projet",
        faitsARangerIds: ["f1", "f-etranger"],
        parAdminId: null,
      }),
    ).rejects.toBeInstanceOf(ErreurCreationProjet);
    expect(db.etat.projets).toEqual([]);
    expect(db.etat.evenementsProjet).toEqual([]);
    expect(db.etat.faits.find((f) => f.id === "f1")?.portee).toBe("a_ranger");
    expect(db.etat.evenementsFait).toEqual([]);
  });

  it("un fait déjà rangé fait aussi tout échouer", async () => {
    const db = base([{ id: "f1", clientId: CLIENT, portee: "projet", projetId: "ailleurs" }]);
    await expect(
      creerProjet(db as never, {
        clientId: CLIENT,
        titre: "P",
        faitsARangerIds: ["f1"],
        parAdminId: null,
      }),
    ).rejects.toThrow(/déjà rangé/);
    expect(db.etat.projets).toEqual([]);
  });

  it("le numéro suit la série de l'année", async () => {
    const db = base([]);
    const maintenant = new Date("2026-10-02T09:00:00Z");
    await creerProjet(db as never, { clientId: CLIENT, titre: "A", parAdminId: null, maintenant });
    const deuxieme = await creerProjet(db as never, {
      clientId: CLIENT,
      titre: "B",
      parAdminId: null,
      maintenant,
    });
    expect(deuxieme.numero).toBe("AXI-PRJ-2026-002");
  });

  it("un titre vide est refusé avant toute écriture", async () => {
    const db = base([]);
    await expect(
      creerProjet(db as never, { clientId: CLIENT, titre: "   ", parAdminId: null }),
    ).rejects.toThrow(/titre/);
    expect(db.etat.projets).toEqual([]);
  });
});
