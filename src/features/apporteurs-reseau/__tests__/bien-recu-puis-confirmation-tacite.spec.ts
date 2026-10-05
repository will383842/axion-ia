/**
 * « Bien reçu » enregistre `contactEnvoyeAt` ; trente jours plus tard, l'étape (a) du passage
 * quotidien confirme la présentation (confirmation réputée acquise) et ouvre les 6 mois de
 * protection. Une même ligne en mémoire traverse les deux, comme en base.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Ligne = {
  id: string;
  siren: string;
  apporteurId: string;
  statut: "reservee" | "confirmee" | "deja_connue" | "hors_champ";
  contactEnvoyeAt: Date | null;
  confirmationTacite: boolean;
  confirmeeAt: Date | null;
  protegeeJusquAt: Date | null;
  denomination: string;
  recueAt: Date;
  personneNom: string;
  personneEmail: string;
};

const etat = vi.hoisted(() => ({ ligne: null as unknown as Ligne, envoyes: [] as unknown[] }));

vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: (v: unknown) => v,
  encryptPii: (v: unknown) => v,
}));
vi.mock("@/lib/security/email-hash", () => ({ hashEmailForLookup: (v: string) => v }));
vi.mock("../annuaire", () => ({ lireEntrepriseParSiren: vi.fn() }));
vi.mock("../jeton", () => ({ urlDossier: () => null }));
vi.mock("../alerte-vigilance", () => ({ alerterPiecesVigilanceDeposees: vi.fn(async () => 0) }));
vi.mock("../commissions", () => ({
  libererSiPiecesValides: vi.fn(async () => 0),
  relancerVigilance: vi.fn(async () => false),
  demanderVigilance: vi.fn(async () => "deja"),
  dejaEnvoye: vi.fn(async () => true),
  piecesVigilanceValides: vi.fn(async () => true),
  statutApresVigilance: vi.fn(async () => ({ statut: "due", demander: false })),
}));
vi.mock("../envois", () => ({
  apercu: vi.fn(),
  avecTexteLibre: (p: Record<string, unknown>) => p,
  envoyer: vi.fn(async (e: unknown) => {
    etat.envoyes.push(e);
    return "envoye";
  }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    presentationEntreprise: {
      findUnique: vi.fn(async (a: { include?: unknown }) =>
        a.include
          ? {
              ...etat.ligne,
              apporteur: { id: "APP1", prenom: "Ana", nom: "Bel", email: "ana@x.fr" },
            }
          : etat.ligne,
      ),
      // Étape (a) : `contactEnvoyeAt: { not: null, lte: seuil }` ; le reste rend vide.
      findMany: vi.fn(
        async (a: {
          where: { statut?: unknown; contactEnvoyeAt?: { not?: null; lte?: Date } };
        }) => {
          const c = a.where.contactEnvoyeAt;
          if (a.where.statut !== "reservee" || !c || !c.lte) return [];
          const l = etat.ligne;
          return l.statut === "reservee" && l.contactEnvoyeAt && l.contactEnvoyeAt <= c.lte
            ? [{ id: l.id, contactEnvoyeAt: l.contactEnvoyeAt }]
            : [];
        },
      ),
      updateMany: vi.fn(
        async (a: {
          where: { id?: string; statut?: string; contactEnvoyeAt?: null };
          data: object;
        }) => {
          const l = etat.ligne;
          if (a.where.statut && l.statut !== a.where.statut) return { count: 0 };
          if (a.where.contactEnvoyeAt === null && l.contactEnvoyeAt !== null) return { count: 0 };
          Object.assign(l, a.data);
          return { count: 1 };
        },
      ),
      update: vi.fn(async () => ({})),
    },
    factureFormation: { findMany: vi.fn(async () => []) },
    commissionApporteur: { findMany: vi.fn(async () => []), groupBy: vi.fn(async () => []) },
    pieceApporteur: { findMany: vi.fn(async () => []) },
    devis: { findMany: vi.fn(async () => []) },
    apporteurReseau: { findMany: vi.fn(async () => []) },
  },
}));

import { passerReseauApporteurs } from "../passage-quotidien";
import { appliquerReponse } from "../presentations";

const BIEN_RECU_LE = new Date("2026-10-05T09:00:00Z");
const opts = { civilite: "" as const, nomFamille: "" };

beforeEach(() => {
  etat.envoyes = [];
  etat.ligne = {
    id: "P1",
    siren: "123456782",
    apporteurId: "APP1",
    statut: "reservee",
    contactEnvoyeAt: null,
    confirmationTacite: false,
    confirmeeAt: null,
    protegeeJusquAt: null,
    denomination: "Acme",
    recueAt: new Date("2026-10-04T00:00:00Z"),
    personneNom: "Durand",
    personneEmail: "d@acme.fr",
  };
});

describe("« Bien reçu » puis confirmation réputée acquise à 30 jours", () => {
  it("« Bien reçu » enregistre contactEnvoyeAt à la date du clic et envoie les deux e-mails", async () => {
    const r = await appliquerReponse("P1", "bien_recu", opts, BIEN_RECU_LE);
    expect(r.ok).toBe(true);
    expect(etat.ligne.contactEnvoyeAt).toEqual(BIEN_RECU_LE);
    expect(etat.ligne.statut).toBe("reservee");
    expect(etat.envoyes).toHaveLength(2);
  });

  it("une déclaration du formulaire (reservee, sans contact) n'est jamais confirmée tacitement", async () => {
    const bilan = await passerReseauApporteurs(new Date("2027-03-01T08:00:00Z"));
    expect(bilan.confirmeesTacites).toBe(0);
    expect(etat.ligne.statut).toBe("reservee");
  });

  it("29 jours après « Bien reçu » : pas encore confirmée", async () => {
    await appliquerReponse("P1", "bien_recu", opts, BIEN_RECU_LE);
    const bilan = await passerReseauApporteurs(new Date("2026-11-03T08:00:00Z"));
    expect(bilan.confirmeesTacites).toBe(0);
    expect(etat.ligne.statut).toBe("reservee");
  });

  it("30 jours après « Bien reçu » : confirmée tacitement, date = contact + 30 jours, 6 mois de protection", async () => {
    await appliquerReponse("P1", "bien_recu", opts, BIEN_RECU_LE);
    const bilan = await passerReseauApporteurs(new Date("2026-11-05T09:30:00Z"));
    expect(bilan.confirmeesTacites).toBe(1);
    expect(etat.ligne.statut).toBe("confirmee");
    expect(etat.ligne.confirmationTacite).toBe(true);
    expect(etat.ligne.confirmeeAt).toEqual(new Date("2026-11-04T09:00:00Z"));
    expect(etat.ligne.protegeeJusquAt).toEqual(new Date("2027-05-04T09:00:00Z"));
  });

  it("le passage de lendemain ne reconfirme pas une présentation déjà confirmée", async () => {
    await appliquerReponse("P1", "bien_recu", opts, BIEN_RECU_LE);
    await passerReseauApporteurs(new Date("2026-11-05T09:30:00Z"));
    const bilan = await passerReseauApporteurs(new Date("2026-11-06T09:30:00Z"));
    expect(bilan.confirmeesTacites).toBe(0);
  });
});
