/**
 * ADR 0060 — « Rouvrir le dossier » et « Clore à nouveau ».
 *
 *   - motif absent ou < 10 caractères → refus (zod) ;
 *   - sans l'habilitation `rouvrir_dossier` → refus, avec le message des habilitations ;
 *   - la réouverture n'agit que sur un dossier CLOS, et écrit un événement
 *     nommé (auteur figé) dans une transaction ;
 *   - le reverrouillage est refusé tant qu'il manque une attestation, et le
 *     refus NOMME le manque.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EntreeVerrouDossier, EtatVerrouDossier } from "../verrou-dossier";
import { empreinteMotDePasse } from "../mot-de-passe-reouverture";

const h = vi.hoisted(() => ({
  role: "super_admin",
  etat: null as unknown,
  entree: null as unknown,
  crees: [] as Array<Record<string, unknown>>,
  journal: [] as Array<Record<string, unknown>>,
}));

vi.mock("next/headers", () => ({ headers: async () => new Map<string, string>() }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/server/actions/knowledge/_guards", () => {
  const s = async () => ({ userId: "00000000-0000-4000-8000-00000000000a", role: h.role });
  return {
    requireAdminRead: s,
    requireAdminWrite: s,
    requireAdminPublish: s,
    requireAdminDelete: s,
    requireSuperAdmin: s,
  };
});
vi.mock("@/lib/prisma", () => {
  const tx = {
    sessionDossierEvenement: {
      create: async (args: { data: Record<string, unknown> }) => {
        h.crees.push(args.data);
        return { createdAt: new Date("2026-09-30T12:05:00Z") };
      },
    },
  };
  return {
    prisma: {
      $transaction: async (fn: (t: unknown) => unknown) => fn(tx),
      adminUser: { findUnique: async () => ({ name: "Williams Jullin" }) },
      activityLog: {
        create: async (args: { data: Record<string, unknown> }) => {
          h.journal.push(args.data);
          return {};
        },
      },
    },
  };
});
vi.mock("@/server/qualiopi/sessions/verrou-dossier", async (importOriginal) => {
  const reel = await importOriginal<typeof import("../verrou-dossier")>();
  return {
    ...reel,
    chargerEtatVerrou: async () => ({ statut: "realisee", etat: h.etat, entree: h.entree }),
  };
});

import {
  reverrouillerDossierSessionAction,
  rouvrirDossierSessionAction,
} from "@/server/actions/qualiopi/dossier-verrou";
import { MOTIF_REFUS } from "@/server/auth/habilitations";

const SESSION = "00000000-0000-4000-8000-000000000001";
const MAINTENANT = new Date("2026-09-30T12:00:00Z");

function entree(attestationB: boolean): EntreeVerrouDossier {
  return {
    statut: "realisee",
    realiseeLe: new Date("2026-09-10T16:00:00Z"),
    maintenant: MAINTENANT,
    evenements: [],
    inscriptions: [
      {
        id: "A",
        statut: "presente",
        stagiaire: "Simone Blanc",
        sortieAt: null,
        attestation: { type: "attestation", annuleeAt: null, createdAt: new Date("2026-09-12") },
        jetonEmargementValideJusquA: null,
      },
      {
        id: "B",
        statut: "presente",
        stagiaire: "Paul Martin",
        sortieAt: null,
        attestation: attestationB
          ? { type: "attestation", annuleeAt: null, createdAt: new Date("2026-09-12") }
          : null,
        jetonEmargementValideJusquA: null,
      },
    ],
  };
}

const CLOS: EtatVerrouDossier = { etat: "clos", depuis: new Date("2026-09-14T08:00:00Z") };
const ROUVERT: EtatVerrouDossier = {
  etat: "rouvert",
  depuis: new Date("2026-09-28T10:00:00Z"),
  par: "Williams Jullin",
  motif: "Correction de l'attestation",
};

// Mot de passe de TEST (jamais le vrai) et son empreinte, posée comme en prod.
const MDP = "mot-de-passe-de-test";
const EMPREINTE = empreinteMotDePasse(MDP, "00112233445566778899aabbccddeeff");

beforeEach(() => {
  vi.stubEnv("QUALIOPI_REOUVERTURE_MDP", EMPREINTE);
  h.role = "super_admin";
  h.etat = CLOS;
  h.entree = entree(true);
  h.crees.length = 0;
  h.journal.length = 0;
});

describe("rouvrirDossierSessionAction", () => {
  it.each([
    ["absent", undefined],
    ["vide", ""],
    ["de 9 caractères", "123456789"],
    ["fait d'espaces", "          "],
  ])("motif %s → refus, aucune écriture", async (_t, motif) => {
    const r = await rouvrirDossierSessionAction({
      sessionId: SESSION,
      motif: motif as string,
      motDePasse: MDP,
    });
    expect(r).toHaveProperty("error");
    expect(JSON.stringify(r)).toMatch(/10 caractères|Motif obligatoire|Required|Données invalides/);
    expect(h.crees).toEqual([]);
  });

  it.each(["responsable_qualite", "secretaire", "editor", "reader"])(
    "« %s » n'a pas l'habilitation → refus avec le message des habilitations",
    async (role) => {
      h.role = role;
      const r = await rouvrirDossierSessionAction({
        sessionId: SESSION,
        motif: "Correction de l'attestation de Paul",
        motDePasse: MDP,
      });
      expect(r).toEqual({ error: MOTIF_REFUS.rouvrir_dossier });
      expect(h.crees).toEqual([]);
    },
  );

  it("sur un dossier clos : écrit l'événement (auteur NOMMÉ, motif) puis le journal", async () => {
    const r = await rouvrirDossierSessionAction({
      sessionId: SESSION,
      motif: "  Correction de l'attestation de Paul  ",
      motDePasse: MDP,
    });
    expect(r).toEqual({ data: { sessionId: SESSION, depuis: "2026-09-30T12:05:00.000Z" } });
    expect(h.crees).toEqual([
      {
        sessionId: SESSION,
        type: "reouverture",
        motif: "Correction de l'attestation de Paul",
        auteurId: "00000000-0000-4000-8000-00000000000a",
        auteurNom: "Williams Jullin",
      },
    ]);
    expect(h.journal.map((j) => j["action"])).toEqual(["qualiopi.session.dossier.rouvert"]);
  });

  it("sur un dossier qui n'est pas clos : refus, rien d'écrit", async () => {
    h.etat = ROUVERT;
    const r = await rouvrirDossierSessionAction({
      sessionId: SESSION,
      motif: "Correction de l'attestation de Paul",
      motDePasse: MDP,
    });
    expect(JSON.stringify(r)).toMatch(/pas clos/);
    expect(h.crees).toEqual([]);
  });
});

describe("rouvrirDossierSessionAction — mot de passe de sécurité (2026-09-30)", () => {
  it("mot de passe incorrect → refus, rien d'écrit, tentative tracée SANS le mot de passe", async () => {
    const r = await rouvrirDossierSessionAction({
      sessionId: SESSION,
      motif: "Correction de l'attestation de Paul",
      motDePasse: "mauvais",
    });
    expect(JSON.stringify(r)).toMatch(/incorrect/);
    expect(h.crees).toEqual([]);
    expect(h.journal.map((j) => j["action"])).toEqual([
      "qualiopi.session.dossier.reouverture_refusee",
    ]);
    expect(JSON.stringify(h.journal)).not.toContain("mauvais");
  });

  it("variable absente → réouverture impossible (fermé par défaut)", async () => {
    vi.stubEnv("QUALIOPI_REOUVERTURE_MDP", "");
    const r = await rouvrirDossierSessionAction({
      sessionId: SESSION,
      motif: "Correction de l'attestation de Paul",
      motDePasse: MDP,
    });
    expect(JSON.stringify(r)).toMatch(/pas configuré/);
    expect(h.crees).toEqual([]);
  });

  it("le mot de passe n'est jamais écrit dans l'événement ni au journal", async () => {
    await rouvrirDossierSessionAction({
      sessionId: SESSION,
      motif: "Correction de l'attestation de Paul",
      motDePasse: MDP,
    });
    expect(JSON.stringify([h.crees, h.journal])).not.toContain(MDP);
  });
});

describe("reverrouillerDossierSessionAction", () => {
  it("sans l'habilitation → refus", async () => {
    h.role = "responsable_qualite";
    h.etat = ROUVERT;
    const r = await reverrouillerDossierSessionAction({ sessionId: SESSION });
    expect(r).toEqual({ error: MOTIF_REFUS.rouvrir_dossier });
  });

  it("🔴 refusé tant qu'il manque une attestation — et le refus NOMME le manque", async () => {
    h.etat = ROUVERT;
    h.entree = entree(false);
    const r = await reverrouillerDossierSessionAction({ sessionId: SESSION });
    expect(JSON.stringify(r)).toContain("Paul Martin — attestation à émettre");
    expect(h.crees).toEqual([]);
  });

  it("conditions réunies : écrit le reverrouillage (motif facultatif)", async () => {
    h.etat = ROUVERT;
    const r = await reverrouillerDossierSessionAction({ sessionId: SESSION });
    expect(r).toHaveProperty("data");
    expect(h.crees).toEqual([
      {
        sessionId: SESSION,
        type: "reverrouillage",
        motif: null,
        auteurId: "00000000-0000-4000-8000-00000000000a",
        auteurNom: "Williams Jullin",
      },
    ]);
  });

  it("un dossier non rouvert ne se « reclôt » pas", async () => {
    h.etat = CLOS;
    const r = await reverrouillerDossierSessionAction({ sessionId: SESSION });
    expect(JSON.stringify(r)).toMatch(/pas rouvert/);
    expect(h.crees).toEqual([]);
  });
});
