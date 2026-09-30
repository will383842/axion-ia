/**
 * ⛔ UNE COLLISION DE NUMÉRO NE LAISSE AUCUNE TRACE ORPHELINE (PR 7).
 *
 * Un devis ouvert depuis un projet écrit DEUX choses : le devis et son lien
 * `projet_devis`. Les deux vivent dans UNE transaction, À L'INTÉRIEUR de
 * `withNumberRetry` : si le numéro entre en collision (P2002), la transaction
 * est annulée et la reprise repart de zéro. Résultat : un devis, UN lien.
 *
 * Le même test garde la décision de Will du 29/09 : l'action n'écrit AUCUN
 * `PreRemplissage` (le devis s'ouvre vide, l'aide est à côté).
 *
 * Mutation qui rougit : sortir `lierDevisAuProjet` de la transaction (l'écrire
 * avec `prisma` au lieu de `tx`), ou placer `$transaction` hors de
 * `withNumberRetry` (la collision ferait échouer l'action).
 * Contre-témoin : sans projet, aucun lien n'est écrit.
 * Angle mort : la fausse base rejoue la sémantique transactionnelle ; la vraie
 * (contrainte `projet_devis_devis_meme_client`) est prouvée par Gate D.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { CLIENT, fausseBaseDevis, PROJET } from "./_devis-transactionnel";

const h = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return h.db;
  },
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: async () => ({
    userId: "55555555-5555-4555-8555-555555555555",
    role: "admin",
  }),
  requireHabilitation: async () => ({ userId: "u", role: "admin" }),
  logQualiopiActivity: async () => undefined,
}));
vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: async () => "assujetti",
}));
vi.mock("@/server/qualiopi/documents/documents-service", () => ({ generateDocument: vi.fn() }));
vi.mock("@/server/actions/qualiopi/documents", () => ({ genererConventionAction: vi.fn() }));
vi.mock("@/lib/telegram", () => ({ sendTelegram: vi.fn() }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn() }));

import { createDevisAction } from "../devis";

const LIGNE = { designation: "Formation fictive", quantite: 1, prixUnitaireHtCents: 100000 };

describe("⛔ une collision de numéro ne laisse aucune trace orpheline", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deux collisions puis succès : un devis, un lien, aucun pré-remplissage", async () => {
    const { db, etat } = fausseBaseDevis({ collisionsAuCreate: 2 });
    h.db = db;
    const r = await createDevisAction({ clientId: CLIENT, projetId: PROJET, lignes: [LIGNE] });
    expect("data" in r).toBe(true);
    expect(etat.devis).toHaveLength(1);
    expect(etat.projetDevis).toHaveLength(1);
    expect(etat.projetDevis[0]).toMatchObject({ projetId: PROJET, clientId: CLIENT });
    expect(etat.preRemplissages).toHaveLength(0);
  });

  it("contre-témoin : sans projet, aucun lien", async () => {
    const { db, etat } = fausseBaseDevis({ collisionsAuCreate: 0 });
    h.db = db;
    await createDevisAction({ clientId: CLIENT, lignes: [LIGNE] });
    expect(etat.devis).toHaveLength(1);
    expect(etat.projetDevis).toHaveLength(0);
  });
});
