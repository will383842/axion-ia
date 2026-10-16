/**
 * Tests — moyens/moyens-historique.ts (chantier QNC, lot L07).
 * Motif exigé, date antérieure refusée, historique écrit dans la transaction.
 */

import { describe, expect, it, vi } from "vitest";

import { MoyenRefuse, modifierMoyenMotive, type ClientMoyens } from "./moyens-historique";

const CREE = new Date("2026-10-01T09:00:00.000Z");
const MAINTENANT = new Date("2026-10-16T10:00:00.000Z");
const AUTEUR = { id: "00000000-0000-4000-8000-000000000001", nom: "Responsable qualité" };

function ligne(over: Record<string, unknown> = {}) {
  return {
    id: "m1",
    categorie: "salle",
    libelle: "Salle A",
    description: "",
    localisation: "Lyon",
    actif: true,
    dateVerification: null,
    createdAt: CREE,
    ...over,
  };
}

function faux(existant: ReturnType<typeof ligne> | null) {
  const update = vi.fn().mockResolvedValue(ligne());
  const historique = vi.fn().mockResolvedValue({});
  const tx = {
    moyenPedagogique: { findUnique: vi.fn().mockResolvedValue(existant), update },
    moyenPedagogiqueHistorique: { create: historique },
  };
  const client = {
    $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  } as unknown as ClientMoyens;
  return { client, update, historique };
}

async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "aucun refus";
  } catch (e) {
    return e instanceof MoyenRefuse ? e.code : "autre erreur";
  }
}

describe("modifierMoyenMotive", () => {
  it("refuse sans motif, sans rien écrire ni même ouvrir la transaction", async () => {
    const f = faux(ligne());
    const tx = vi.spyOn(f.client, "$transaction");
    expect(
      await code(
        modifierMoyenMotive(
          f.client,
          "m1",
          { libelle: "B" },
          { motif: undefined, auteur: AUTEUR, maintenant: MAINTENANT },
        ),
      ),
    ).toBe("motif_requis");
    expect(
      await code(
        modifierMoyenMotive(
          f.client,
          "m1",
          { libelle: "B" },
          { motif: "court", auteur: AUTEUR, maintenant: MAINTENANT },
        ),
      ),
    ).toBe("motif_requis");
    expect(tx).not.toHaveBeenCalled();
    expect(f.update).not.toHaveBeenCalled();
    expect(f.historique).not.toHaveBeenCalled();
  });

  it("refuse une date de vérification antérieure à la création de la ligne", async () => {
    const f = faux(ligne());
    const c = await code(
      modifierMoyenMotive(
        f.client,
        "m1",
        { dateVerification: new Date("2026-09-30T00:00:00Z") },
        { motif: "Contrôle de la salle", auteur: AUTEUR, maintenant: MAINTENANT },
      ),
    );
    expect(c).toBe("date_anterieure_creation");
    expect(f.update).not.toHaveBeenCalled();
    expect(f.historique).not.toHaveBeenCalled();
  });

  it("refuse une date dans le futur", async () => {
    const f = faux(ligne());
    const c = await code(
      modifierMoyenMotive(
        f.client,
        "m1",
        { dateVerification: new Date("2026-11-01T00:00:00Z") },
        { motif: "Contrôle de la salle", auteur: AUTEUR, maintenant: MAINTENANT },
      ),
    );
    expect(c).toBe("date_future");
  });

  it("écrit la modification ET l'historique avant/après/motif/auteur", async () => {
    const f = faux(ligne());
    await modifierMoyenMotive(
      f.client,
      "m1",
      { libelle: "Salle B", dateVerification: new Date("2026-10-15T08:00:00Z") },
      { motif: "  Changement de salle pour travaux  ", auteur: AUTEUR, maintenant: MAINTENANT },
    );
    expect(f.update).toHaveBeenCalledOnce();
    expect(f.historique).toHaveBeenCalledWith({
      data: {
        moyenId: "m1",
        avant: { libelle: "Salle A", dateVerification: null },
        apres: { libelle: "Salle B", dateVerification: "2026-10-15T08:00:00.000Z" },
        motif: "Changement de salle pour travaux",
        auteurId: AUTEUR.id,
        auteurNom: AUTEUR.nom,
      },
    });
  });

  it("désactiver = actif:false avec motif et historique, jamais de suppression", async () => {
    const f = faux(ligne());
    await modifierMoyenMotive(
      f.client,
      "m1",
      { actif: false },
      { motif: "Salle fermée définitivement", auteur: AUTEUR, maintenant: MAINTENANT },
    );
    expect(f.update).toHaveBeenCalledWith({ where: { id: "m1" }, data: { actif: false } });
    expect(f.historique.mock.calls[0]?.[0].data).toMatchObject({
      avant: { actif: true },
      apres: { actif: false },
    });
  });

  it("refuse un moyen introuvable et une demande qui ne change rien", async () => {
    expect(
      await code(
        modifierMoyenMotive(
          faux(null).client,
          "x",
          { libelle: "B" },
          { motif: "Motif suffisant", auteur: AUTEUR, maintenant: MAINTENANT },
        ),
      ),
    ).toBe("introuvable");
    const f = faux(ligne());
    expect(
      await code(
        modifierMoyenMotive(
          f.client,
          "m1",
          { libelle: "Salle A" },
          { motif: "Motif suffisant", auteur: AUTEUR, maintenant: MAINTENANT },
        ),
      ),
    ).toBe("rien_a_changer");
    expect(f.historique).not.toHaveBeenCalled();
  });
});
