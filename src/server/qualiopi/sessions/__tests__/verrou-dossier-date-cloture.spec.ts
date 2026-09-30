/**
 * ADR 0060 — LA DATE DE CLÔTURE NE PRÉCÈDE JAMAIS UNE PREUVE.
 *
 * Revue de la PR #1245 : la date « depuis » d'un dossier clos était le maximum
 * de (réalisation, attestations, sorties). Or la condition (c) interdit toute
 * clôture tant qu'un jeton d'émargement vit (fin + 48 h), et le chargeur ne
 * lisait que les jetons ENCORE valides. Attestations émises le 10/09, un
 * stagiaire signe le 11/09 : le ZIP annonçait « Dossier clos le 10/09 : les
 * preuves sont figées » à côté d'une signature du 11/09.
 */

import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ ligne: null as unknown, selects: [] as unknown[] }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: {
      findUnique: async (a: { select: unknown }) => {
        h.selects.push(a.select);
        return h.ligne;
      },
    },
    sessionDossierEvenement: { findMany: async () => [] },
  },
}));

import {
  chargerEtatVerrou,
  etatVerrouDossier,
  messageDossierClos,
  type InscriptionVerrouEntree,
} from "../verrou-dossier";

const REALISEE = new Date("2026-09-09T16:00:00Z");
const ATTESTATION = new Date("2026-09-10T08:00:00Z");
const SIGNATURE = new Date("2026-09-11T09:00:00Z");
const JETON_EXPIRE = new Date("2026-09-11T18:00:00Z");
const MAINTENANT = new Date("2026-09-30T12:00:00Z");

function inscription(p: Partial<InscriptionVerrouEntree> = {}): InscriptionVerrouEntree {
  return {
    id: "A",
    statut: "presente",
    stagiaire: "Simone Blanc",
    sortieAt: null,
    attestation: { type: "attestation", annuleeAt: null, createdAt: ATTESTATION },
    jetonEmargementValideJusquA: null,
    ...p,
  };
}

describe("ADR 0060 — date de clôture du dossier", () => {
  it("🔴 prédicat : la clôture date au plus tôt de la fin de la fenêtre d'émargement", () => {
    const etat = etatVerrouDossier({
      statut: "realisee",
      realiseeLe: REALISEE,
      inscriptions: [inscription({ emargementFermeLe: JETON_EXPIRE })],
      evenements: [],
      maintenant: MAINTENANT,
    });
    expect(etat).toEqual({ etat: "clos", depuis: JETON_EXPIRE });
  });

  it("sans trace d'émargement, rien ne change (témoin)", () => {
    const etat = etatVerrouDossier({
      statut: "realisee",
      realiseeLe: REALISEE,
      inscriptions: [inscription()],
      evenements: [],
      maintenant: MAINTENANT,
    });
    expect(etat).toEqual({ etat: "clos", depuis: ATTESTATION });
  });

  it("🔴 chargeur : un jeton EXPIRÉ et une signature postérieure aux attestations reculent la date de clôture", async () => {
    h.selects.length = 0;
    h.ligne = {
      id: "S1",
      statut: "realisee",
      transitions: [{ createdAt: REALISEE }],
      enrollments: [
        {
          id: "A",
          statut: "presente",
          sortieAt: null,
          trainee: { prenom: "Simone", nom: "Blanc" },
          attestationDocument: { type: "attestation", annuleeAt: null, createdAt: ATTESTATION },
          emargementTokens: [{ expiresAt: JETON_EXPIRE, revokedAt: null }],
          emargementSignatures: [{ signeAt: SIGNATURE }],
        },
      ],
    };
    const lu = await chargerEtatVerrou("S1", undefined, MAINTENANT);
    expect(lu?.etat).toEqual({ etat: "clos", depuis: JETON_EXPIRE });
    expect(messageDossierClos(JETON_EXPIRE)).toContain("Dossier clos le 11/09/2026");
    // Le chargeur lit TOUS les jetons non révoqués, pas seulement les valides.
    const select = h.selects[0] as {
      enrollments: { select: { emargementTokens: { where?: Record<string, unknown> } } };
    };
    expect(select.enrollments.select.emargementTokens.where?.["expiresAt"]).toBeUndefined();
  });

  it("chargeur : un jeton encore VALIDE garde le dossier à recueillir (condition c inchangée)", async () => {
    h.ligne = {
      id: "S1",
      statut: "realisee",
      transitions: [{ createdAt: REALISEE }],
      enrollments: [
        {
          id: "A",
          statut: "presente",
          sortieAt: null,
          trainee: { prenom: "Simone", nom: "Blanc" },
          attestationDocument: { type: "attestation", annuleeAt: null, createdAt: ATTESTATION },
          emargementTokens: [{ expiresAt: new Date("2026-10-01T18:00:00Z"), revokedAt: null }],
          emargementSignatures: [],
        },
      ],
    };
    const lu = await chargerEtatVerrou("S1", undefined, MAINTENANT);
    expect(lu?.etat.etat).toBe("a_recueillir");
  });

  it("chargeur : un jeton révoqué ferme la fenêtre à sa révocation", async () => {
    const revoque = new Date("2026-09-10T20:00:00Z");
    h.ligne = {
      id: "S1",
      statut: "realisee",
      transitions: [{ createdAt: REALISEE }],
      enrollments: [
        {
          id: "A",
          statut: "presente",
          sortieAt: null,
          trainee: { prenom: "Simone", nom: "Blanc" },
          attestationDocument: { type: "attestation", annuleeAt: null, createdAt: ATTESTATION },
          emargementTokens: [{ expiresAt: new Date("2026-10-01T18:00:00Z"), revokedAt: revoque }],
          emargementSignatures: [],
        },
      ],
    };
    const lu = await chargerEtatVerrou("S1", undefined, MAINTENANT);
    expect(lu?.etat).toEqual({ etat: "clos", depuis: revoque });
  });
});
