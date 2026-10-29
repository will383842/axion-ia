/**
 * LOT A1 — EXPORT ART. 15 ET EFFACEMENT ART. 17 DES TÂCHES ET NOTES DE FICHE (2026-10-29).
 *
 * · l'effacement d'une personne neutralise l'intitulé et le `contactId` de SES tâches
 *   (`updateMany`, jamais de suppression), pas celles d'une autre personne ni d'une autre fiche ;
 * · l'export d'une personne rend ses tâches (intitulé, date, faite ou non) et rien d'autre ;
 * · une note n'est ni lue, ni déchiffrée, ni écrite par l'export et l'effacement : elle n'apparaît
 *   donc jamais en clair dans un journal.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({
  appels: [] as Array<{ table: string; op: string; args: unknown }>,
  // « Base » : deux personnes sur deux fiches, chacune avec une tâche.
  taches: [
    {
      id: "t-alice",
      clientId: "fiche-1",
      contactId: "contact-alice",
      intitule: "Rappeler Alice sur son budget",
      echeanceLe: new Date("2026-11-05"),
      faiteLe: null as Date | null,
    },
    {
      id: "t-bruno",
      clientId: "fiche-1",
      contactId: "contact-bruno",
      intitule: "Envoyer le devis à Bruno",
      echeanceLe: new Date("2026-11-06"),
      faiteLe: new Date("2026-11-01"),
    },
    {
      id: "t-autre-fiche",
      clientId: "fiche-2",
      contactId: "contact-carla",
      intitule: "Relancer Carla",
      echeanceLe: new Date("2026-11-07"),
      faiteLe: null as Date | null,
    },
  ],
}));

type Tache = (typeof etat.taches)[number];
const filtreContact = (where: { contactId?: { in: string[] } }) => (t: Tache) =>
  where.contactId !== undefined && t.contactId !== null && where.contactId.in.includes(t.contactId);

vi.mock("@/lib/security/email-hash", () => ({ hashEmailForLookup: (e: string) => `h:${e}` }));

vi.mock("@/lib/prisma", () => {
  const modele = (table: string, lignes: unknown[] = []) => ({
    findMany: async (args: unknown) => {
      etat.appels.push({ table, op: "findMany", args });
      return lignes;
    },
    updateMany: async (args: unknown) => {
      etat.appels.push({ table, op: "updateMany", args });
      return { count: 0 };
    },
    deleteMany: async (args: unknown) => {
      etat.appels.push({ table, op: "deleteMany", args });
      return { count: 0 };
    },
    createMany: async () => ({ count: 0 }),
  });
  const clientTache = {
    findMany: async (args: { where: { contactId?: { in: string[] } } }) => {
      etat.appels.push({ table: "clientTache", op: "findMany", args });
      return etat.taches.filter(filtreContact(args.where));
    },
    updateMany: async (args: {
      where: { contactId?: { in: string[] } };
      data: { contactId: null; intitule: string };
    }) => {
      etat.appels.push({ table: "clientTache", op: "updateMany", args });
      const cibles = etat.taches.filter(filtreContact(args.where));
      for (const t of cibles) Object.assign(t, args.data);
      return { count: cibles.length };
    },
    deleteMany: async (args: unknown) => {
      etat.appels.push({ table: "clientTache", op: "deleteMany", args });
      return { count: 0 };
    },
  };
  const contacts = [{ contactId: "contact-alice", emailHash: "h:alice@exemple.fr" }];
  const tx = {
    $executeRawUnsafe: async () => 0,
    clientContactAdresse: modele("clientContactAdresse", contacts),
    clientContact: {
      ...modele("clientContact", [
        {
          id: "contact-alice",
          nom: "Alice",
          fonction: null,
          telephone: null,
          statut: "actif",
          partiLe: null,
          oppositionIaLe: null,
          client: { raisonSociale: "Fiche 1" },
          adresses: [{ email: "alice@exemple.fr", nature: "pro", emailHash: "h:alice@exemple.fr" }],
        },
      ]),
    },
    rencontreParticipant: modele("rencontreParticipant"),
    rencontre: modele("rencontre"),
    transcriptionSegment: modele("transcriptionSegment"),
    enregistrement: modele("enregistrement"),
    transcription: modele("transcription"),
    fait: modele("fait"),
    faitEvenement: modele("faitEvenement"),
    preRemplissage: modele("preRemplissage"),
    compteRendu: modele("compteRendu"),
    questionnaireCadrage: modele("questionnaireCadrage"),
    questionnaireQuestion: modele("questionnaireQuestion"),
    questionnaireAvantAudit: modele("questionnaireAvantAudit"),
    questionnaireAvantAuditEnvoi: modele("questionnaireAvantAuditEnvoi"),
    emailSuivi: modele("emailSuivi"),
    projetContact: modele("projetContact"),
    projet: modele("projet"),
    enregistrementConsentement: modele("enregistrementConsentement"),
    effacementJournal: modele("effacementJournal"),
    clientTache,
    clientNote: modele("clientNote"),
    clientProfil: modele("clientProfil"),
    clientEtiquette: modele("clientEtiquette"),
  };
  return { prisma: { ...tx, $transaction: async (fn: (t: unknown) => unknown) => fn(tx) } };
});

import { exporterDossierClientPour } from "../rgpd-dossier-client";
import { effacerCibleParAdresses } from "../rgpd-erase";

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), "utf8");

beforeEach(() => {
  etat.appels = [];
  etat.taches[0] = {
    ...etat.taches[0]!,
    contactId: "contact-alice",
    intitule: "Rappeler Alice sur son budget",
  };
});

describe("art. 17 — les tâches de la personne sont neutralisées", () => {
  it("l'intitulé et le contactId de SES tâches sont remplacés, celles des autres restent", async () => {
    await effacerCibleParAdresses(["alice@exemple.fr"]);
    const alice = etat.taches.find((t) => t.id === "t-alice")!;
    expect(alice.contactId).toBeNull();
    expect(alice.intitule).toBe("Tâche d'une personne effacée");
    // la tâche reste : date et état intacts
    expect(alice.echeanceLe).toEqual(new Date("2026-11-05"));
    expect(alice.faiteLe).toBeNull();
    // une autre personne de la même fiche, et une autre fiche : intactes
    expect(etat.taches.find((t) => t.id === "t-bruno")).toMatchObject({
      contactId: "contact-bruno",
      intitule: "Envoyer le devis à Bruno",
    });
    expect(etat.taches.find((t) => t.id === "t-autre-fiche")).toMatchObject({
      contactId: "contact-carla",
      intitule: "Relancer Carla",
    });
  });

  it("aucune ligne n'est supprimée (tâches, notes, profil, étiquettes)", async () => {
    await effacerCibleParAdresses(["alice@exemple.fr"]);
    expect(etat.taches).toHaveLength(3);
    for (const table of ["clientTache", "clientNote", "clientProfil", "clientEtiquette"]) {
      expect(etat.appels.some((a) => a.table === table && a.op === "deleteMany")).toBe(false);
    }
  });

  it("l'effacement ne touche jamais les notes, le profil ni les étiquettes", async () => {
    await effacerCibleParAdresses(["alice@exemple.fr"]);
    for (const table of ["clientNote", "clientProfil", "clientEtiquette"]) {
      expect(etat.appels.filter((a) => a.table === table)).toEqual([]);
    }
  });
});

describe("art. 15 — l'export rend les tâches de la personne", () => {
  it("intitulé, date, faite ou non — et rien d'une autre personne ni d'une autre fiche", async () => {
    const r = await exporterDossierClientPour("alice@exemple.fr");
    expect(r.tachesVousConcernant).toEqual([
      {
        intitule: "Rappeler Alice sur son budget",
        echeanceLe: new Date("2026-11-05"),
        faiteLe: null,
      },
    ]);
    const serialise = JSON.stringify(r);
    expect(serialise).not.toContain("Bruno");
    expect(serialise).not.toContain("Carla");
    const lecture = etat.appels.find((a) => a.table === "clientTache" && a.op === "findMany");
    expect(lecture?.args).toMatchObject({ where: { contactId: { in: ["contact-alice"] } } });
  });
});

describe("les notes ne sortent jamais en clair", () => {
  it("l'export ne lit aucune note : exclusion déclarée, réponse manuelle sous un mois", async () => {
    await exporterDossierClientPour("alice@exemple.fr");
    expect(etat.appels.filter((a) => a.table === "clientNote")).toEqual([]);
    const src = lire("src/lib/rgpd-dossier-client.ts");
    expect(src).not.toMatch(/\.clientNote\./);
    expect(src).toMatch(/modele:\s*"ClientNote"[\s\S]{0,400}réponse manuelle sous un mois/);
  });

  it("ni l'export ni l'effacement n'écrivent ni ne journalisent le contenu d'une note", () => {
    for (const f of ["src/lib/rgpd-dossier-client.ts", "src/lib/rgpd-erase.ts"]) {
      expect(lire(f)).not.toMatch(/contenuChiffre|dechiffrerParole\([^)]*note/i);
      expect(lire(f)).not.toMatch(/\.(clientNote|clientProfil|clientEtiquette)\./);
    }
  });
});
