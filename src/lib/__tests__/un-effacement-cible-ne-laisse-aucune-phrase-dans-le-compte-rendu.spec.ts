/**
 * ⛔ UN EFFACEMENT CIBLÉ NE LAISSE AUCUNE PHRASE DANS LE COMPTE RENDU
 * (chantier visio, PR 2 ; plan §3.15, vérification V5-C7).
 *
 * Le compte rendu est un bloc chiffré qui reprend les phrases des
 * participants. Effacer les segments et les faits d'une personne sans toucher
 * au compte rendu laisserait ses mots dans le document que Will relit. Donc :
 *   · rencontre où elle a parlé avec d'autres → comptes rendus `a_regenerer`,
 *     contenu VIDÉ (une réécriture sans elle est proposée ensuite) ;
 *   · rencontre où elle était la SEULE interlocutrice côté client → comptes
 *     rendus SUPPRIMÉS ;
 *   · ses segments supprimés, ses faits vidés (`efface`, journal gardé) ;
 *   · tout cela sous le drapeau d'effacement, posé AVANT la première écriture.
 *
 * Mutation qui fait rougir : retirer le bloc « 3. Les comptes rendus » de
 * `effacerCibleParAdresses`.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

type Ligne = Record<string, unknown>;

const etat = vi.hoisted(() => ({
  appels: [] as Array<{ table: string; op: string; args: unknown }>,
  tables: {} as Record<string, Array<Record<string, unknown>>>,
}));

vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: (e: string) => `h:${e.trim().toLowerCase()}`,
}));

vi.mock("@/lib/prisma", () => {
  /** Filtre minimal : égalité, `in`, `not`, OR — ce que l'effaceur emploie. */
  const correspond = (ligne: Record<string, unknown>, where: Record<string, unknown>): boolean =>
    Object.entries(where ?? {}).every(([cle, cond]) => {
      if (cle === "OR") {
        return (cond as Array<Record<string, unknown>>).some((c) => correspond(ligne, c));
      }
      const v = ligne[cle];
      if (cond !== null && typeof cond === "object" && !(cond instanceof Date)) {
        const c = cond as Record<string, unknown>;
        if ("in" in c) return (c["in"] as unknown[]).includes(v);
        if ("not" in c) return v !== c["not"];
        return true;
      }
      return v === cond;
    });
  const modele = (table: string) => ({
    findMany: async (args: { where?: Record<string, unknown> } = {}) => {
      etat.appels.push({ table, op: "findMany", args });
      return (etat.tables[table] ?? []).filter((l) => correspond(l, args.where ?? {}));
    },
    updateMany: async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      etat.appels.push({ table, op: "updateMany", args });
      const cibles = (etat.tables[table] ?? []).filter((l) => correspond(l, args.where));
      for (const l of cibles) Object.assign(l, args.data);
      return { count: cibles.length };
    },
    deleteMany: async (args: { where: Record<string, unknown> }) => {
      etat.appels.push({ table, op: "deleteMany", args });
      const avant = etat.tables[table] ?? [];
      const restent = avant.filter((l) => !correspond(l, args.where));
      etat.tables[table] = restent;
      return { count: avant.length - restent.length };
    },
    createMany: async (args: unknown) => {
      etat.appels.push({ table, op: "createMany", args });
      return { count: 0 };
    },
  });
  const tx = {
    $executeRawUnsafe: async (sql: string) => {
      etat.appels.push({ table: "$", op: "executeRawUnsafe", args: sql });
      return 0;
    },
    clientContactAdresse: modele("clientContactAdresse"),
    clientContact: modele("clientContact"),
    rencontreParticipant: modele("rencontreParticipant"),
    transcriptionSegment: modele("transcriptionSegment"),
    fait: modele("fait"),
    faitEvenement: modele("faitEvenement"),
    preRemplissage: modele("preRemplissage"),
    compteRendu: modele("compteRendu"),
    questionnaireCadrage: modele("questionnaireCadrage"),
    questionnaireQuestion: modele("questionnaireQuestion"),
    emailSuivi: modele("emailSuivi"),
    projetContact: modele("projetContact"),
    effacementJournal: modele("effacementJournal"),
  };
  return {
    prisma: {
      ...tx,
      $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    },
  };
});

import { effacerCibleParAdresses } from "../rgpd-erase";

function charger(tables: Record<string, Ligne[]>): void {
  etat.appels = [];
  etat.tables = Object.fromEntries(
    Object.entries(tables).map(([k, v]) => [k, v.map((l) => ({ ...l }))]),
  );
}

beforeEach(() => {
  charger({
    clientContactAdresse: [
      { id: "adr-1", contactId: "contact-alice", emailHash: "h:alice@exemple.fr" },
      { id: "adr-2", contactId: "contact-alice", emailHash: "h:alice.perso@exemple.fr" },
    ],
    clientContact: [{ id: "contact-alice", nom: "Alice Martin", fonction: "DRH" }],
    rencontreParticipant: [
      // r1 : Alice ET Bruno côté client.
      {
        id: "p-alice-1",
        rencontreId: "r1",
        role: "client",
        emailHash: "h:alice@exemple.fr",
        contactId: "contact-alice",
      },
      {
        id: "p-bruno-1",
        rencontreId: "r1",
        role: "client",
        emailHash: "h:bruno@exemple.fr",
        contactId: null,
      },
      { id: "p-will-1", rencontreId: "r1", role: "axion", emailHash: null, contactId: null },
      // r2 : Alice seule côté client (retrouvée par sa SECONDE adresse).
      {
        id: "p-alice-2",
        rencontreId: "r2",
        role: "client",
        emailHash: "h:alice.perso@exemple.fr",
        contactId: null,
      },
      { id: "p-will-2", rencontreId: "r2", role: "axion", emailHash: null, contactId: null },
    ],
    transcriptionSegment: [
      { transcriptionId: "t1", ordre: 1, participantId: "p-alice-1", texte: "enc:v1:alice" },
      { transcriptionId: "t1", ordre: 2, participantId: "p-bruno-1", texte: "enc:v1:bruno" },
      { transcriptionId: "t2", ordre: 1, participantId: "p-alice-2", texte: "enc:v1:alice2" },
    ],
    fait: [
      {
        id: "f-alice",
        rencontreId: "r1",
        statut: "valide",
        participantLocuteurId: "p-alice-1",
        contactSujetId: null,
        contactLocuteurId: null,
        enonce: "enc:v1:x",
        citation: "enc:v1:y",
      },
      {
        id: "f-bruno",
        rencontreId: "r1",
        statut: "valide",
        participantLocuteurId: "p-bruno-1",
        contactSujetId: null,
        contactLocuteurId: null,
        enonce: "enc:v1:z",
        citation: "enc:v1:w",
      },
    ],
    compteRendu: [
      { id: "cr-r1", rencontreId: "r1", statut: "valide", contenu: "enc:v1:bloc-avec-ses-phrases" },
      { id: "cr-r2", rencontreId: "r2", statut: "valide", contenu: "enc:v1:bloc-r2" },
    ],
    preRemplissage: [],
    questionnaireCadrage: [],
    questionnaireQuestion: [],
    emailSuivi: [],
    projetContact: [],
  });
});

describe("un effacement ciblé ne laisse aucune phrase dans le compte rendu", () => {
  it("rencontre partagée : le compte rendu est vidé et passe à régénérer", async () => {
    await effacerCibleParAdresses(["alice@exemple.fr"]);
    const cr = etat.tables["compteRendu"]?.find((c) => c["id"] === "cr-r1");
    expect(cr?.["statut"]).toBe("a_regenerer");
    expect(cr?.["contenu"]).toBe("");
  });

  it("rencontre où elle était seule côté client : le compte rendu est supprimé", async () => {
    const r = await effacerCibleParAdresses(["alice@exemple.fr"]);
    expect(etat.tables["compteRendu"]?.find((c) => c["id"] === "cr-r2")).toBeUndefined();
    expect(r.comptesRendusSupprimes).toBe(1);
    expect(r.comptesRendusARegenerer).toBe(1);
  });

  it("ses segments partent, pas ceux de Bruno", async () => {
    await effacerCibleParAdresses(["alice@exemple.fr"]);
    const restent = (etat.tables["transcriptionSegment"] ?? []).map((s) => s["participantId"]);
    expect(restent).toEqual(["p-bruno-1"]);
  });

  it("ses faits sont vidés et marqués effacés ; celui de Bruno reste", async () => {
    await effacerCibleParAdresses(["alice@exemple.fr"]);
    const fa = etat.tables["fait"]?.find((f) => f["id"] === "f-alice");
    const fb = etat.tables["fait"]?.find((f) => f["id"] === "f-bruno");
    expect(fa).toMatchObject({ statut: "efface", enonce: "", citation: null });
    expect(fb).toMatchObject({ statut: "valide", enonce: "enc:v1:z" });
  });

  it("le drapeau d'effacement est posé AVANT la première écriture", async () => {
    await effacerCibleParAdresses(["alice@exemple.fr"]);
    const iDrapeau = etat.appels.findIndex((a) => a.op === "executeRawUnsafe");
    const iEcriture = etat.appels.findIndex((a) =>
      ["updateMany", "deleteMany", "createMany"].includes(a.op),
    );
    expect(iDrapeau).toBeGreaterThanOrEqual(0);
    expect(String(etat.appels[iDrapeau]?.args)).toMatch(/SET LOCAL axion\.effacement_rgpd/);
    expect(iDrapeau).toBeLessThan(iEcriture);
  });

  it("son nom disparaît de la fiche et ses adresses partent en dernier", async () => {
    await effacerCibleParAdresses(["alice@exemple.fr"]);
    expect(etat.tables["clientContact"]?.[0]?.["nom"]).toBe("Personne effacée");
    expect(etat.tables["clientContactAdresse"]).toEqual([]);
    const derniere = etat.appels.filter((a) => a.op !== "findMany").at(-1);
    expect(derniere?.table).toBe("clientContactAdresse");
  });

  it("une adresse inconnue n'écrit rien", async () => {
    const r = await effacerCibleParAdresses(["inconnue@exemple.fr"]);
    expect(r.faits).toBe(0);
    expect(etat.appels.some((a) => a.op !== "findMany")).toBe(false);
  });
});
