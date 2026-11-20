import { beforeEach, describe, expect, it, vi } from "vitest";

import { offreFictive } from "@/server/qualiopi/devis/offre-fixtures.spec-util";
import type { OffreDevisV1 } from "@/server/qualiopi/devis/offre-devis";
import {
  MSG_FORMULES_PARTICULIER,
  MSG_INDEMNITE_SORTIE,
} from "@/server/qualiopi/devis/regles-commerciales";

const updateMany = vi.fn();
const findUnique = vi.fn();
const logActivity = vi.fn();
const formulesActives = vi.fn();
const outboxFindFirst = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailOutbox: { findFirst: (...a: unknown[]) => outboxFindFirst(...a) },
    devis: {
      updateMany: (...a: unknown[]) => updateMany(...a),
      findUnique: (...a: unknown[]) => findUnique(...a),
    },
  },
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn(async () => ({ userId: "adm-1" })),
  logQualiopiActivity: (...a: unknown[]) => logActivity(...a),
}));
vi.mock("@/server/qualiopi/devis/interrupteur-formules", () => ({
  formulesActives: (...a: unknown[]) => formulesActives(...a),
}));

import { modifierDevisBrouillonAction } from "./devis-formules";

const ID = "11111111-1111-4111-8111-111111111111";
const MAJ = "2026-11-06T10:00:00.000Z";

beforeEach(() => {
  updateMany.mockReset();
  findUnique.mockReset();
  logActivity.mockReset();
  formulesActives.mockReset();
  formulesActives.mockResolvedValue(true);
  outboxFindFirst.mockReset();
  outboxFindFirst.mockResolvedValue(null);
  findUnique.mockResolvedValue({ statut: "brouillon", client: { type: "entreprise" } });
});

/** D4 : l'indemnité de sortie d'un nouveau devis est à zéro (la fixture porte 5000, surchargée ici). */
const offreSansIndemnite = (): OffreDevisV1 => {
  const o = offreFictive();
  return { ...o, abonnement: { ...o.abonnement!, indemniteSortieTauxBps: 0 } };
};

const appel = (over: Record<string, unknown> = {}) =>
  modifierDevisBrouillonAction({ id: ID, attenduMajLe: MAJ, offre: offreSansIndemnite(), ...over });

describe("modifierDevisBrouillonAction", () => {
  it("interrupteur éteint : inerte, aucune écriture (seule lecture : le client du devis, cible de la garde)", async () => {
    formulesActives.mockResolvedValue(false);
    const r = await appel();
    expect("error" in r).toBe(true);
    expect(updateMany).not.toHaveBeenCalled();
    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ select: expect.objectContaining({ clientId: true }) }),
    );
  });
  it("un e-mail d'envoi du devis attend (a_valider ou approuve) : refus, aucune écriture", async () => {
    outboxFindFirst.mockResolvedValue({ id: "ob-1" });
    const r = await appel();
    expect(r).toEqual({
      error: "Un e-mail de ce devis attend validation : refusez-le avant de modifier le devis.",
    });
    expect(outboxFindFirst).toHaveBeenCalledWith({
      where: {
        template: "devis-envoi",
        entityType: "Devis",
        entityId: ID,
        OR: [
          { statut: "a_valider" },
          { statut: "approuve", approuveAt: { gte: expect.any(Date) } },
        ],
      },
      select: { id: true },
    });
    expect(updateMany).not.toHaveBeenCalled();
    expect(logActivity).not.toHaveBeenCalled();
  });
  it("identifiant ou date de lecture invalides : refus", async () => {
    expect("error" in (await appel({ id: "x" }))).toBe(true);
    expect("error" in (await appel({ attenduMajLe: "hier" }))).toBe(true);
    expect(updateMany).not.toHaveBeenCalled();
  });
  it("offre invalide : refus avant toute écriture", async () => {
    const r = await appel({ offre: { ...offreSansIndemnite(), extra: 1 } });
    expect("error" in r).toBe(true);
    expect(updateMany).not.toHaveBeenCalled();
  });
  it("verrou : brouillon, déjà une offre, et même version lue", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    const r = await appel();
    expect(r).toEqual({ data: { id: ID } });
    const arg = updateMany.mock.calls[0]![0];
    expect(arg.where).toMatchObject({
      id: ID,
      statut: "brouillon",
      updatedAt: new Date(MAJ),
      offreSha256: { not: null },
    });
    expect(arg.data.offreSha256).toMatch(/^[0-9a-f]{64}$/);
    // deux formules : lignes vides et total 0 jusqu'au choix du client
    expect(arg.data.lignes).toEqual([]);
    expect(arg.data.montantTotalHtCents).toBe(0);
    expect(logActivity).toHaveBeenCalledOnce();
  });
  it("une seule formule : lignes et total de cette formule", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    await appel({ offre: { ...offreSansIndemnite(), formulesProposees: ["achat"] } });
    const arg = updateMany.mock.calls[0]![0];
    expect(arg.data.montantTotalHtCents).toBe(120000);
    expect(arg.data.lignes).toHaveLength(2);
  });
  it("deux onglets : le premier enregistre, le second est refusé (version périmée)", async () => {
    let majCourante = MAJ;
    updateMany.mockImplementation(async (a: { where: { updatedAt: Date } }) => {
      if (a.where.updatedAt.toISOString() !== majCourante) return { count: 0 };
      majCourante = "2026-11-06T10:05:00.000Z";
      return { count: 1 };
    });
    findUnique.mockResolvedValue({ statut: "brouillon", client: { type: "entreprise" } });
    const [a, b] = [await appel(), await appel()];
    expect("data" in a).toBe(true);
    expect("error" in b && b.error).toMatch(/modifié ailleurs|rechargez/i);
    expect(logActivity).toHaveBeenCalledTimes(1);
  });
  it("un devis envoyé ne se modifie pas : message de révision", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    findUnique.mockResolvedValue({ statut: "envoye", client: { type: "entreprise" } });
    const r = await appel();
    expect("error" in r && r.error).toMatch(/révision|révis/i);
    expect(logActivity).not.toHaveBeenCalled();
  });
  it("devis introuvable : refus", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    findUnique.mockResolvedValue(null);
    expect("error" in (await appel())).toBe(true);
  });
  it("total hors borne : refus clair, pas d'écriture", async () => {
    const o = offreSansIndemnite();
    const gros = {
      ...o,
      formulesProposees: ["achat" as const],
      achat: {
        ...o.achat!,
        lignes: [{ libelle: "G", quantite: 1000, prixHtCents: 2_000_000_000, tauxTvaBps: 2000 }],
      },
    };
    const r = await appel({ offre: gros });
    expect("error" in r).toBe(true);
    expect(updateMany).not.toHaveBeenCalled();
  });
  it("D6 : devis d'un particulier — modification refusée, aucune écriture", async () => {
    findUnique.mockResolvedValue({ statut: "brouillon", client: { type: "particulier" } });
    const r = await appel();
    expect(r).toEqual({ error: MSG_FORMULES_PARTICULIER });
    expect(updateMany).not.toHaveBeenCalled();
    expect(logActivity).not.toHaveBeenCalled();
  });
  it("D4 : taux d'indemnité 5000 refusé à la modification, aucune écriture", async () => {
    const r = await appel({ offre: offreFictive() });
    expect(r).toEqual({ error: MSG_INDEMNITE_SORTIE });
    expect(updateMany).not.toHaveBeenCalled();
  });
  it("devis absent à la lecture du client : « Devis introuvable », aucune écriture", async () => {
    findUnique.mockResolvedValue(null);
    expect(await appel()).toEqual({ error: "Devis introuvable" });
    expect(updateMany).not.toHaveBeenCalled();
  });
});
