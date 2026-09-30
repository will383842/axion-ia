// @vitest-environment node

/**
 * ⛔ LA FIN DE CONSERVATION EFFACE LA RENCONTRE ET SES PARTICIPANTS
 * (vérification finale V1, RGPD-02 ; ADR 0056).
 *
 * `purgerDossiersVisioEchus` vide faits, questions, e-mails de suivi et
 * comptes rendus ; `purgerPreuvesAccordEchues` supprime les preuves d'accord
 * cinq ans plus tard. Mais la RENCONTRE (titre, dates) et ses PARTICIPANTS
 * (nom affiché, empreinte d'adresse) restaient sans limite — alors que la
 * notice n'annonce que des durées finies, et que ce ne sont pas des pièces
 * légales.
 *
 * Désormais, quand l'échéance des preuves d'une rencontre est passée (fin du
 * dossier + 5 ans ; rencontre jamais rattachée : sa date + 3 + 5 ans), la
 * rencontre est SUPPRIMÉE — avec ou sans preuve —, ses participants, son
 * suivi et ses enregistrements suivent en cascade (clés `ON DELETE CASCADE`,
 * migration 20260928230000), et la suppression est journalisée
 * (`effacements_journal`, `rencontres`, motif `conservation`) pour le rejeu
 * après restauration.
 *
 * Mutation qui rougit : retirer le `rencontre.deleteMany` de
 * `purgerPreuvesAccordEchues` → 1er et 2e cas ; retirer la journalisation → 3e.
 * Contre-témoin : une rencontre dont l'échéance n'est pas passée (fiche
 * active, rencontre récente) reste, avec ses participants.
 * Angle mort : la cascade elle-même est celle de PostgreSQL (le faux Prisma
 * de ce test ne cascade pas) ; Gate D exerce les clés, pas ce scénario.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

type Ligne = Record<string, unknown>;

const etat = vi.hoisted(() => ({
  tables: {} as Record<string, Array<Record<string, unknown>>>,
}));

vi.mock("@/lib/prisma", () => {
  const correspond = (ligne: Record<string, unknown>, where: Record<string, unknown>): boolean =>
    Object.entries(where ?? {}).every(([cle, cond]) => {
      if (cle === "OR") {
        return (cond as Array<Record<string, unknown>>).some((c) => correspond(ligne, c));
      }
      if (cle === "NOT") return !correspond(ligne, cond as Record<string, unknown>);
      const v = ligne[cle];
      if (cond !== null && typeof cond === "object" && !(cond instanceof Date)) {
        const c = cond as Record<string, unknown>;
        if ("in" in c) return (c["in"] as unknown[]).includes(v);
        if ("not" in c) return c["not"] === null ? v !== null && v !== undefined : v !== c["not"];
        if ("lt" in c) return v instanceof Date && v < (c["lt"] as Date);
        return true;
      }
      return v === cond;
    });
  const lignes = (table: string) => etat.tables[table] ?? [];
  const modele = (table: string) => ({
    findMany: async (args: { where?: Record<string, unknown> } = {}) =>
      lignes(table).filter((l) => correspond(l, args.where ?? {})),
    groupBy: async (args: {
      by: string[];
      where?: Record<string, unknown>;
      _max: Record<string, true>;
    }) => {
      const cle = args.by[0] ?? "";
      const groupes = new Map<unknown, Ligne[]>();
      for (const l of lignes(table).filter((x) => correspond(x, args.where ?? {}))) {
        groupes.set(l[cle], [...(groupes.get(l[cle]) ?? []), l]);
      }
      return [...groupes].map(([k, ls]) => ({
        [cle]: k,
        _max: Object.fromEntries(
          Object.keys(args._max).map((champ) => [
            champ,
            ls
              .map((l) => l[champ])
              .filter((d): d is Date => d instanceof Date)
              .reduce<Date | null>((m, d) => (m === null || d > m ? d : m), null),
          ]),
        ),
      }));
    },
    deleteMany: async (args: { where: Record<string, unknown> }) => {
      const avant = lignes(table);
      etat.tables[table] = avant.filter((l) => !correspond(l, args.where));
      return { count: avant.length - (etat.tables[table]?.length ?? 0) };
    },
    createMany: async (args: { data: Ligne[] }) => {
      etat.tables[table] = [...lignes(table), ...args.data];
      return { count: args.data.length };
    },
  });
  const noms = [
    "rencontre",
    "fait",
    "factureFormation",
    "devis",
    "clientFusion",
    "enregistrementConsentement",
    "consentEvent",
    "effacementJournal",
  ];
  const tx: Record<string, unknown> = Object.fromEntries(noms.map((n) => [n, modele(n)]));
  tx["$executeRawUnsafe"] = async () => 0;
  return {
    prisma: { ...tx, $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) },
  };
});

import { purgerPreuvesAccordEchues } from "../rgpd-erase";

const d = (iso: string): Date => new Date(`${iso}T09:00:00.000Z`);
const MAINTENANT = d("2040-01-01");

function rencontre(id: string, clientId: string | null, debut: string): Ligne {
  return {
    id,
    clientId,
    statut: "tenu",
    debutPrevu: d(debut),
    debutReel: null,
    createdAt: d(debut),
  };
}

beforeEach(() => {
  etat.tables = {
    rencontre: [
      // Jamais rattachée, 2026 : fin 2029, preuves 2034 → échue.
      rencontre("r-orpheline-ancienne", null, "2026-10-01"),
      // Jamais enregistrée (aucune preuve), 2026 : échue aussi.
      rencontre("r-sans-preuve", null, "2026-11-01"),
      // Jamais rattachée, 2038 : fin 2041 → reste.
      rencontre("r-orpheline-recente", null, "2038-01-01"),
      // Prospect vu en 2039 : fin 2042 → reste.
      rencontre("r-fiche-active", "c-actif", "2039-06-01"),
    ],
    enregistrementConsentement: [
      { id: "ec-ancienne", rencontreId: "r-orpheline-ancienne", survenuLe: d("2026-10-01") },
      { id: "ec-active", rencontreId: "r-fiche-active", survenuLe: d("2039-06-01") },
    ],
    effacementJournal: [],
  };
});

const ids = (t: string) => (etat.tables[t] ?? []).map((l) => l["id"]);

describe("⛔ la fin de conservation efface la rencontre et ses participants", () => {
  it("🔴 une rencontre dont les preuves sont échues est supprimée, sa preuve aussi", async () => {
    const r = await purgerPreuvesAccordEchues(MAINTENANT);
    expect(ids("rencontre")).not.toContain("r-orpheline-ancienne");
    expect(ids("enregistrementConsentement")).toEqual(["ec-active"]);
    expect(r.preuves).toBe(1);
  });

  it("🔴 une rencontre SANS preuve d'accord (jamais enregistrée) ne reste pas non plus", async () => {
    const r = await purgerPreuvesAccordEchues(MAINTENANT);
    expect(ids("rencontre")).not.toContain("r-sans-preuve");
    expect(r.rencontres).toBe(2);
  });

  it("🔴 la suppression est journalisée pour le rejeu (rencontres, conservation)", async () => {
    await purgerPreuvesAccordEchues(MAINTENANT);
    const journal = etat.tables["effacementJournal"] ?? [];
    expect(journal.map((l) => [l["tableCible"], l["ligneId"], l["motif"]]).sort()).toEqual([
      ["rencontres", "r-orpheline-ancienne", "conservation"],
      ["rencontres", "r-sans-preuve", "conservation"],
    ]);
  });

  it("contre-témoin : une rencontre dont l'échéance n'est pas passée reste", async () => {
    await purgerPreuvesAccordEchues(MAINTENANT);
    expect(ids("rencontre")).toEqual(["r-orpheline-recente", "r-fiche-active"]);
  });

  it("contre-témoin : rien d'échu, rien d'écrit", async () => {
    const r = await purgerPreuvesAccordEchues(d("2030-01-01"));
    expect(r).toMatchObject({ preuves: 0, rencontres: 0 });
    expect(ids("rencontre")).toHaveLength(4);
    expect(etat.tables["effacementJournal"]).toEqual([]);
  });
});
