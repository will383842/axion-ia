/**
 * L'EXPORT ART. 15 NE CONTIENT QUE LES PAROLES DU DEMANDEUR (chantier visio,
 * PR 2 ; plan §3.15, V7-10).
 *
 * Jeu à DEUX participants côté client : Alice (qui demande son export) et
 * Bruno. La base rend volontairement les segments et les faits des deux
 * (le code ne doit pas se fier au seul filtre de la requête). Attendu :
 *   · les paroles d'Alice sont rendues, celles de Bruno jamais ;
 *   · un fait dont Alice est le SUJET mais que Bruno a dit (« c'est Alice qui
 *     décide ») est rendu en ÉNONCÉ SEUL : la citation est la phrase de Bruno ;
 *   · un fait qu'Alice a dit est rendu avec sa citation (ses propres mots) ;
 *   · un fait de Bruno sur quelqu'un d'autre n'apparaît pas ;
 *   · rien n'est rendu chiffré.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const CLE_INITIALE = process.env["PII_ENCRYPTION_KEY"];
process.env["PII_ENCRYPTION_KEY"] = "c".repeat(64);

const donnees = vi.hoisted(() => ({
  segments: [] as unknown[],
  faits: [] as unknown[],
}));

vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: (e: string) => `h:${e.trim().toLowerCase()}`,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    clientContactAdresse: { findMany: async () => [{ contactId: "contact-alice" }] },
    clientContact: {
      findMany: async () => [
        {
          id: "contact-alice",
          nom: "Alice Martin",
          fonction: "DRH",
          telephone: null,
          statut: "actif",
          partiLe: null,
          oppositionIaLe: null,
          client: { raisonSociale: "Entreprise Fictive" },
          adresses: [{ email: "alice@exemple.fr", nature: "pro", emailHash: "h:alice@exemple.fr" }],
        },
      ],
    },
    rencontreParticipant: {
      findMany: async () => [
        { id: "p-alice", role: "client", voixValideeLe: new Date("2026-10-01"), rencontreId: "r1" },
      ],
    },
    rencontre: {
      findMany: async () => [
        {
          id: "r1",
          titre: "Rendez-vous du 1er octobre",
          debutReel: new Date("2026-10-01"),
          debutPrevu: null,
        },
      ],
    },
    projetContact: { findMany: async () => [] },
    projet: { findMany: async () => [] },
    transcriptionSegment: { findMany: async () => donnees.segments },
    fait: { findMany: async () => donnees.faits },
    enregistrementConsentement: {
      findMany: async () => [
        { type: "declaration_axion", survenuLe: new Date("2026-10-01"), versionTexte: "v1" },
      ],
    },
    questionnaireCadrage: { findMany: async () => [] },
    questionnaireQuestion: { findMany: async () => [] },
    emailSuivi: { findMany: async () => [] },
  },
}));

import { chiffrerParole } from "../chiffrer-parole";
import { exporterDossierClientPour } from "../rgpd-dossier-client";

const ENREGISTREMENT = { enregistrement: { rencontreId: "r1" } };

beforeAll(() => {
  process.env["PII_ENCRYPTION_KEY"] = "c".repeat(64);
});
afterAll(() => {
  if (CLE_INITIALE === undefined) delete process.env["PII_ENCRYPTION_KEY"];
  else process.env["PII_ENCRYPTION_KEY"] = CLE_INITIALE;
});

beforeEach(() => {
  donnees.segments = [
    {
      participantId: "p-alice",
      debutMs: 1_000,
      texte: chiffrerParole("Nous voulons former douze personnes."),
      transcription: ENREGISTREMENT,
    },
    {
      participantId: "p-bruno",
      debutMs: 2_000,
      texte: chiffrerParole("PAROLE-DE-BRUNO : mon arrêt maladie."),
      transcription: ENREGISTREMENT,
    },
  ];
  donnees.faits = [
    {
      type: "decideur",
      enonce: chiffrerParole("Alice décide de l'achat."),
      citation: chiffrerParole("CITATION-DE-BRUNO : c'est Alice qui décide"),
      constateLe: new Date("2026-10-01"),
      contactSujetId: "contact-alice",
      contactLocuteurId: null,
      participantLocuteurId: "p-bruno",
    },
    {
      type: "nb_participants",
      enonce: chiffrerParole("Douze personnes à former."),
      citation: chiffrerParole("nous voulons former douze personnes"),
      constateLe: new Date("2026-10-01"),
      contactSujetId: null,
      contactLocuteurId: null,
      participantLocuteurId: "p-alice",
    },
    {
      type: "budget",
      enonce: chiffrerParole("FAIT-DE-BRUNO-SUR-UN-AUTRE"),
      citation: chiffrerParole("CITATION-DE-BRUNO-SUR-UN-AUTRE"),
      constateLe: new Date("2026-10-01"),
      contactSujetId: "contact-bruno",
      contactLocuteurId: null,
      participantLocuteurId: "p-bruno",
    },
  ];
});

describe("l'export ne contient que les paroles du demandeur", () => {
  it("rend les paroles d'Alice et jamais celles de Bruno", async () => {
    const ex = await exporterDossierClientPour("alice@exemple.fr");
    expect(ex.paroles.map((p) => p.texte)).toEqual(["Nous voulons former douze personnes."]);
    expect(JSON.stringify(ex)).not.toContain("PAROLE-DE-BRUNO");
  });

  it("un fait sur Alice dit par Bruno : énoncé seul, jamais la citation de Bruno", async () => {
    const ex = await exporterDossierClientPour("alice@exemple.fr");
    expect(ex.faitsVousConcernant).toEqual([
      { type: "decideur", enonce: "Alice décide de l'achat.", constateLe: new Date("2026-10-01") },
    ]);
    expect(JSON.stringify(ex)).not.toContain("CITATION-DE-BRUNO");
  });

  it("un fait dit par Alice : énoncé et citation", async () => {
    const ex = await exporterDossierClientPour("alice@exemple.fr");
    expect(ex.vosPropos).toHaveLength(1);
    expect(ex.vosPropos[0]?.citation).toBe("nous voulons former douze personnes");
  });

  it("un fait de Bruno sur un autre n'apparaît pas", async () => {
    const ex = await exporterDossierClientPour("alice@exemple.fr");
    expect(JSON.stringify(ex)).not.toContain("FAIT-DE-BRUNO-SUR-UN-AUTRE");
  });

  it("rien n'est rendu chiffré, et la fiche, la rencontre et la preuve d'accord y sont", async () => {
    const ex = await exporterDossierClientPour("alice@exemple.fr");
    expect(JSON.stringify(ex)).not.toContain("enc:v1:");
    expect(ex.personnes[0]?.nom).toBe("Alice Martin");
    expect(ex.rencontres[0]?.titre).toBe("Rendez-vous du 1er octobre");
    expect(ex.preuvesAccord[0]?.type).toBe("declaration_axion");
    expect(ex.avertissements).toEqual([]);
  });

  it("un texte indéchiffrable est DIT dans l'export, jamais rendu chiffré", async () => {
    donnees.segments = [
      {
        participantId: "p-alice",
        debutMs: 1,
        texte: "enc:v1:00:00:00",
        transcription: ENREGISTREMENT,
      },
    ];
    const ex = await exporterDossierClientPour("alice@exemple.fr");
    expect(ex.paroles).toEqual([]);
    expect(ex.avertissements.join(" ")).toContain("paroles");
  });
});
