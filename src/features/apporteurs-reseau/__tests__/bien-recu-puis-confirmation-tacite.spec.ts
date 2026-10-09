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

const etat = vi.hoisted(() => ({
  ligne: null as unknown as Ligne,
  envoyes: [] as unknown[],
  rebond: null as "hard" | "soft" | null,
}));

// Contrat 2.6 : présentations d'avant la 2.6 (sans établissement), elles couvrent l'entreprise.
vi.mock("../etablissement-presentation", async (orig) => {
  const vrai = await orig<typeof import("../etablissement-presentation")>();
  return {
    ...vrai,
    lireEtablissements: async (ids: readonly string[]) =>
      new Map(ids.map((id) => [id, vrai.AVANT_2_6] as const)),
    lireSiretsDevis: async () => new Map(),
    lireDecisionsAAttribuer: async () => new Map(),
    ouvrirAAttribuer: vi.fn(async () => true),
    enregistrerEtablissement: vi.fn(async () => undefined),
  };
});
vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: (v: unknown) => v,
  encryptPii: (v: unknown) => v,
}));
vi.mock("@/lib/security/email-hash", () => ({ hashEmailForLookup: (v: string) => v }));
vi.mock("../annuaire", () => ({
  lireEntrepriseParSiren: vi.fn(),
  lireEtablissementParSiret: vi.fn(),
}));
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
vi.mock("@/lib/prisma", () => {
  const prisma = {
    $transaction: async (f: (t: unknown) => unknown) => f(prisma),
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
          where: {
            statut?: unknown;
            contactEnvoyeAt?: { not?: null; lte?: Date } | null;
            recueAt?: { lte?: Date };
          };
        }) => {
          // Contact envoyé : `contactEnvoyeAt: { not: null }` + OR [contact ≤ seuil, reçue ≤ seuil].
          const ou = (a.where as { OR?: Array<Record<string, { lte?: Date }>> }).OR;
          if (a.where.statut === "reservee" && ou) {
            const l = etat.ligne;
            if (l.statut !== "reservee" || !l.contactEnvoyeAt) return [];
            const ok = ou.some(
              (o) =>
                (o.contactEnvoyeAt?.lte && l.contactEnvoyeAt! <= o.contactEnvoyeAt.lte) ||
                (o.recueAt?.lte && l.recueAt <= o.recueAt.lte),
            );
            return ok ? [{ id: l.id, contactEnvoyeAt: l.contactEnvoyeAt, recueAt: l.recueAt }] : [];
          }
          const c = a.where.contactEnvoyeAt;
          // Art. 3.2 (2026-10-08) : déclarations JAMAIS contactées, reçues avant le seuil.
          if (a.where.statut === "reservee" && c === null && a.where.recueAt?.lte) {
            const l = etat.ligne;
            return l.statut === "reservee" &&
              l.contactEnvoyeAt === null &&
              l.recueAt <= a.where.recueAt.lte
              ? [{ id: l.id, recueAt: l.recueAt, denomination: l.denomination }]
              : [];
          }
          if (a.where.statut !== "reservee" || !c || !c.lte) return [];
          const l = etat.ligne;
          return l.statut === "reservee" && l.contactEnvoyeAt && l.contactEnvoyeAt <= c.lte
            ? [{ id: l.id, contactEnvoyeAt: l.contactEnvoyeAt, recueAt: l.recueAt }]
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
    // Rebond de l'e-mail de prise de contact : `hard` seul bloque (le filtre est dans la requête).
    emailLog: {
      findMany: vi.fn(async (a: { where: { bounceType?: string } }) =>
        etat.rebond !== null && etat.rebond === a.where.bounceType
          ? [{ entityId: etat.ligne.id }]
          : [],
      ),
    },
    factureFormation: { findMany: vi.fn(async () => []) },
    commissionApporteur: { findMany: vi.fn(async () => []), groupBy: vi.fn(async () => []) },
    pieceApporteur: { findMany: vi.fn(async () => []) },
    devis: { findMany: vi.fn(async () => []) },
    apporteurReseau: { findMany: vi.fn(async () => []) },
  };
  return { prisma };
});

import { passerReseauApporteurs } from "../passage-quotidien";
import { appliquerReponse } from "../presentations";

const BIEN_RECU_LE = new Date("2026-10-05T09:00:00Z");
const opts = { civilite: "" as const, nomFamille: "" };

beforeEach(() => {
  etat.envoyes = [];
  etat.rebond = null;
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

  // 🔴 2026-10-08 (relecture de a1) : ce test disait « jamais confirmée tacitement ». Le contrat
  // 2.3 dit l'inverse : art. 3.2, « la Société prend contact avec la personne déclarée dans les
  // 30 jours de l'enregistrement de la déclaration ; à défaut, le délai de confirmation ci-dessus
  // court à compter de l'expiration de ce délai » ; art. 2.8, ces délais « ne sont ni suspendus
  // ni prorogés » par la période de démarrage, et le retard de la Société « ne prive l'Apporteur
  // d'aucun droit ». Une déclaration jamais contactée est donc réputée confirmée à J+60.
  it("déclaration jamais contactée : pas encore confirmée à J+59", async () => {
    // recueAt = 04/10/2026 00:00 → J+59 = 02/12/2026.
    const bilan = await passerReseauApporteurs(new Date("2026-12-02T08:00:00Z"));
    expect(bilan.confirmeesTacites).toBe(0);
    expect(etat.ligne.statut).toBe("reservee");
  });

  it("déclaration jamais contactée : réputée confirmée à J+60 (art. 3.2 et 2.8)", async () => {
    const bilan = await passerReseauApporteurs(new Date("2026-12-03T08:00:00Z"));
    expect(bilan.confirmeesTacites).toBe(1);
    expect(etat.ligne.statut).toBe("confirmee");
    expect(etat.ligne.confirmationTacite).toBe(true);
    expect(etat.ligne.confirmeeAt).toEqual(new Date("2026-12-03T00:00:00Z"));
    expect(etat.ligne.protegeeJusquAt).toEqual(new Date("2027-04-04T00:00:00Z"));
  });

  it("29 jours après « Bien reçu » : pas encore confirmée", async () => {
    await appliquerReponse("P1", "bien_recu", opts, BIEN_RECU_LE);
    const bilan = await passerReseauApporteurs(new Date("2026-11-03T08:00:00Z"));
    expect(bilan.confirmeesTacites).toBe(0);
    expect(etat.ligne.statut).toBe("reservee");
  });

  it("30 jours après « Bien reçu » : confirmée tacitement, date = contact + 30 jours, 6 mois depuis la déclaration", async () => {
    await appliquerReponse("P1", "bien_recu", opts, BIEN_RECU_LE);
    const bilan = await passerReseauApporteurs(new Date("2026-11-05T09:30:00Z"));
    expect(bilan.confirmeesTacites).toBe(1);
    expect(etat.ligne.statut).toBe("confirmee");
    expect(etat.ligne.confirmationTacite).toBe(true);
    expect(etat.ligne.confirmeeAt).toEqual(new Date("2026-11-04T09:00:00Z"));
    // Contrat 2.2 (art. 3.4) : six mois à compter de la DÉCLARATION (recueAt du 04/10).
    expect(etat.ligne.protegeeJusquAt).toEqual(new Date("2027-04-04T00:00:00Z"));
  });

  it("le passage de lendemain ne reconfirme pas une présentation déjà confirmée", async () => {
    await appliquerReponse("P1", "bien_recu", opts, BIEN_RECU_LE);
    await passerReseauApporteurs(new Date("2026-11-05T09:30:00Z"));
    const bilan = await passerReseauApporteurs(new Date("2026-11-06T09:30:00Z"));
    expect(bilan.confirmeesTacites).toBe(0);
  });

  it("rebond hard de la prise de contact : pas de confirmation à J+30", async () => {
    await appliquerReponse("P1", "bien_recu", opts, BIEN_RECU_LE);
    etat.rebond = "hard";
    const bilan = await passerReseauApporteurs(new Date("2026-11-05T09:30:00Z"));
    expect(bilan.confirmeesTacites).toBe(0);
    expect(etat.ligne.statut).toBe("reservee");
  });

  it("rebond soft : confirmation à J+30 comme d'habitude", async () => {
    await appliquerReponse("P1", "bien_recu", opts, BIEN_RECU_LE);
    etat.rebond = "soft";
    const bilan = await passerReseauApporteurs(new Date("2026-11-05T09:30:00Z"));
    expect(bilan.confirmeesTacites).toBe(1);
    expect(etat.ligne.statut).toBe("confirmee");
  });

  // Relecture de a1 (08/10) : un contact EN RETARD ne repousse pas l'échéance (art. 3.2, 2.8).
  it("contact envoyé à J+45 : confirmée à J+60 de la déclaration, pas à contact + 30", async () => {
    // recueAt = 04/10/2026 → contact le 18/11 (J+45) → échéance 03/12 (J+60), pas le 18/12.
    etat.ligne.contactEnvoyeAt = new Date("2026-11-18T00:00:00Z");
    const avant = await passerReseauApporteurs(new Date("2026-12-02T08:00:00Z"));
    expect(avant.confirmeesTacites).toBe(0);
    const bilan = await passerReseauApporteurs(new Date("2026-12-03T08:00:00Z"));
    expect(bilan.confirmeesTacites).toBe(1);
    expect(etat.ligne.confirmeeAt).toEqual(new Date("2026-12-03T00:00:00Z"));
  });
});
