// @vitest-environment node

/**
 * ⛔ LE REJEU DES EFFACEMENTS REFAIT L'OPÉRATION D'ORIGINE (chantier visio,
 * PR 8 ; ADR 0056 ; runbook R33, étape 3 ter).
 *
 * Après une restauration, `rejouerEffacements` relit `effacements_journal` et
 * ré-efface ce qui est revenu. Deux défauts qu'il ne doit plus avoir :
 *
 *   1. un compte rendu SUPPRIMÉ à l'origine (versions à 90 jours, dossier
 *      échu, art. 17 quand la personne était la seule voix client) revenait
 *      en `a_regenerer` vide — un statut qui veut dire « réécriture proposée ».
 *      Il doit être supprimé de nouveau ; seul un compte rendu partagé avec
 *      d'autres voix est vidé et passe `a_regenerer` ;
 *   2. les questions adressées à une personne effacée et ses e-mails de suivi
 *      revenaient : ils ne sont pas journalisés ligne à ligne, mais se
 *      retrouvent à partir de la personne journalisée.
 *
 * Mutations qui font rougir : remettre un `updateMany` `a_regenerer` sur tous
 * les comptes rendus du journal ; retirer le bloc « Personnes effacées ».
 * Contre-témoin : à blanc, rien n'est écrit et le compte est non nul ; après
 * application, un second passage à blanc compte 0 (idempotence).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

type Ligne = Record<string, unknown>;

const etat = vi.hoisted(() => ({
  ecritures: 0,
  tables: {} as Record<string, Array<Record<string, unknown>>>,
}));

vi.mock("@/lib/prisma", () => {
  /** Filtre minimal : égalité, `in`, `not`, `NOT`, `OR` — ce que le rejeu emploie. */
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
        if ("not" in c) return v !== c["not"] && !(c["not"] === null && v === undefined);
        return true;
      }
      return v === cond;
    });
  const modele = (table: string) => ({
    findMany: async (args: { where?: Record<string, unknown> } = {}) =>
      (etat.tables[table] ?? []).filter((l) => correspond(l, args.where ?? {})),
    count: async (args: { where?: Record<string, unknown> } = {}) =>
      (etat.tables[table] ?? []).filter((l) => correspond(l, args.where ?? {})).length,
    updateMany: async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const cibles = (etat.tables[table] ?? []).filter((l) => correspond(l, args.where));
      for (const l of cibles) Object.assign(l, args.data);
      etat.ecritures += cibles.length;
      return { count: cibles.length };
    },
    deleteMany: async (args: { where: Record<string, unknown> }) => {
      const avant = etat.tables[table] ?? [];
      const restent = avant.filter((l) => !correspond(l, args.where));
      etat.tables[table] = restent;
      etat.ecritures += avant.length - restent.length;
      return { count: avant.length - restent.length };
    },
  });
  const noms = [
    "effacementJournal",
    "fait",
    "transcriptionSegment",
    "compteRendu",
    "clientContact",
    "clientContactAdresse",
    "rencontre",
    "projet",
    "rencontreParticipant",
    "questionnaireCadrage",
    "questionnaireQuestion",
    "emailSuivi",
    "projetContact",
    "preRemplissage",
    "enregistrementConsentement",
  ];
  const tx: Record<string, unknown> = Object.fromEntries(noms.map((n) => [n, modele(n)]));
  tx["$executeRawUnsafe"] = async () => 0;
  return {
    prisma: {
      ...tx,
      $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    },
  };
});

import { PERSONNE_EFFACEE, rejouerEffacements } from "../rgpd-erase";

const journal = (tableCible: string, ligneId: string, motif: string): Ligne => ({
  tableCible,
  ligneId,
  motif,
});

/** Base RESTAURÉE depuis un dump antérieur aux effacements journalisés. */
function restaurer(): void {
  etat.ecritures = 0;
  etat.tables = {
    effacementJournal: [
      journal("comptes_rendus", "cr-version-purgee", "conservation"),
      journal("comptes_rendus", "cr-dossier-echu", "conservation"),
      journal("comptes_rendus", "cr-seule-voix", "art17"),
      journal("comptes_rendus", "cr-partage", "art17"),
      journal("client_contacts", "alice", "art17"),
    ],
    compteRendu: [
      { id: "cr-version-purgee", rencontreId: "r-autre", contenu: "v1", statut: "remplace" },
      { id: "cr-dossier-echu", rencontreId: "r-echue", contenu: "ancien", statut: "valide" },
      { id: "cr-seule-voix", rencontreId: "r-alice", contenu: "Alice dit…", statut: "valide" },
      { id: "cr-partage", rencontreId: "r-partage", contenu: "Alice et Bob…", statut: "valide" },
      { id: "cr-temoin", rencontreId: "r-temoin", contenu: "hors journal", statut: "valide" },
    ],
    rencontreParticipant: [
      { id: "p1", rencontreId: "r-alice", role: "client", contactId: "alice", nomAffiche: "Alice" },
      {
        id: "p2",
        rencontreId: "r-partage",
        role: "client",
        contactId: "alice",
        nomAffiche: "Alice",
      },
      { id: "p3", rencontreId: "r-partage", role: "client", contactId: "bob", nomAffiche: "Bob" },
    ],
    clientContact: [
      { id: "alice", nom: "Alice", fonction: "DAF", telephone: "06" },
      { id: "bob", nom: "Bob", fonction: null, telephone: null },
    ],
    clientContactAdresse: [{ id: "a1", contactId: "alice", emailHash: "h:alice" }],
    questionnaireCadrage: [
      { id: "q-alice", contactDestinataireId: "alice" },
      { id: "q-bob", contactDestinataireId: "bob" },
    ],
    questionnaireQuestion: [
      { id: "qq1", questionnaireId: "q-alice", texte: "Votre budget ?", reponse: "10 k€" },
      { id: "qq2", questionnaireId: "q-bob", texte: "Vos délais ?", reponse: "juin" },
    ],
    emailSuivi: [
      { id: "e-alice", contactId: "alice" },
      { id: "e-bob", contactId: "bob" },
    ],
    preRemplissage: [
      { id: "pr1", cible: "email_suivi", cibleId: "e-alice", valeurProposee: "Chère Alice" },
    ],
    projetContact: [{ id: "pc1", contactId: "alice" }],
  };
}

const cr = (id: string) => etat.tables["compteRendu"]?.find((c) => c["id"] === id);

beforeEach(restaurer);

describe("le rejeu des effacements refait l'opération d'origine", () => {
  it("🔑 CONTRE-TÉMOIN : à blanc, rien n'est écrit et les cibles revenues sont comptées", async () => {
    const r = await rejouerEffacements();
    expect(etat.ecritures).toBe(0);
    expect(r.lues).toBe(5);
    expect(r.reappliquees).toBeGreaterThan(0);
  });

  it("🔴 un compte rendu supprimé par la conservation est SUPPRIMÉ de nouveau, pas vidé", async () => {
    await rejouerEffacements({ appliquer: true });
    expect(cr("cr-version-purgee")).toBeUndefined();
    expect(cr("cr-dossier-echu")).toBeUndefined();
  });

  it("🔴 art. 17, seule voix client : le compte rendu est supprimé", async () => {
    await rejouerEffacements({ appliquer: true });
    expect(cr("cr-seule-voix")).toBeUndefined();
  });

  it("🔴 art. 17, rencontre partagée : vidé et `a_regenerer`", async () => {
    await rejouerEffacements({ appliquer: true });
    expect(cr("cr-partage")).toMatchObject({ contenu: "", statut: "a_regenerer" });
    expect(cr("cr-temoin")).toMatchObject({ contenu: "hors journal", statut: "valide" });
  });

  it("🔴 les questions adressées à la personne effacée sont vidées, pas celles des autres", async () => {
    await rejouerEffacements({ appliquer: true });
    const q = etat.tables["questionnaireQuestion"] ?? [];
    expect(q.find((x) => x["id"] === "qq1")).toMatchObject({ texte: "", reponse: null });
    expect(q.find((x) => x["id"] === "qq2")).toMatchObject({ texte: "Vos délais ?" });
  });

  it("🔴 ses e-mails de suivi, ses rôles, ses adresses partent ; son nom est pseudonymisé", async () => {
    await rejouerEffacements({ appliquer: true });
    expect((etat.tables["emailSuivi"] ?? []).map((e) => e["id"])).toEqual(["e-bob"]);
    expect(etat.tables["preRemplissage"]?.[0]).toMatchObject({ valeurProposee: "" });
    expect(etat.tables["projetContact"]).toEqual([]);
    expect(etat.tables["clientContactAdresse"]).toEqual([]);
    const p = etat.tables["rencontreParticipant"] ?? [];
    expect(p.filter((x) => x["contactId"] === "alice").map((x) => x["nomAffiche"])).toEqual([
      PERSONNE_EFFACEE,
      PERSONNE_EFFACEE,
    ]);
    expect(p.find((x) => x["id"] === "p3")).toMatchObject({ nomAffiche: "Bob" });
  });

  it("🔑 idempotent : après application, un passage à blanc compte 0", async () => {
    await rejouerEffacements({ appliquer: true });
    const r = await rejouerEffacements();
    expect(r.reappliquees).toBe(0);
  });
});
