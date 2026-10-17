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

  describe("charge COMPLÈTE du vrai formulaire (MoyenRowActions)", () => {
    // Moyen créé le 16 à 14 h 30 (Paris), vérifié « le 16 » : la date stockée
    // est 2026-10-16T00:00Z, AVANT l'instant de création. Le formulaire renvoie
    // TOUS les champs, dont cette date, réduite au jour puis `new Date("AAAA-MM-JJ")`.
    const CREE_APRES_MIDI = new Date("2026-10-16T12:30:00.000Z");
    const LE_SOIR = new Date("2026-10-16T19:00:00.000Z");
    const STOCKEE = new Date("2026-10-16T00:00:00.000Z");
    const existant = () =>
      ligne({ createdAt: CREE_APRES_MIDI, dateVerification: STOCKEE, libelle: "Salle A" });
    const formulaire = (over: Record<string, unknown> = {}) => ({
      categorie: "salle",
      libelle: "Salle A",
      description: "",
      localisation: "Lyon",
      dateVerification: new Date("2026-10-16"),
      ...over,
    });

    it("date inchangée + libellé modifié : accepté, l'historique ne porte QUE le libellé", async () => {
      const f = faux(existant());
      await modifierMoyenMotive(f.client, "m1", formulaire({ libelle: "Salle B" }), {
        motif: "Salle renommée par le client",
        auteur: AUTEUR,
        maintenant: LE_SOIR,
      });
      expect(f.update).toHaveBeenCalledWith({
        where: { id: "m1" },
        data: formulaire({ libelle: "Salle B", dateVerification: undefined }),
      });
      expect(f.historique.mock.calls[0]?.[0].data).toMatchObject({
        avant: { libelle: "Salle A" },
        apres: { libelle: "Salle B" },
      });
      expect(f.historique.mock.calls[0]?.[0].data.apres).not.toHaveProperty("dateVerification");
    });

    it("rien de changé : « rien à changer », jamais « antérieure à la création »", async () => {
      const f = faux(existant());
      expect(
        await code(
          modifierMoyenMotive(f.client, "m1", formulaire(), {
            motif: "Enregistré sans changement",
            auteur: AUTEUR,
            maintenant: LE_SOIR,
          }),
        ),
      ).toBe("rien_a_changer");
      expect(f.historique).not.toHaveBeenCalled();
    });

    it("date stockée avec une heure : la renvoyer n'est pas un faux changement", async () => {
      // 23 h 30 Z le 16 = le 17 à Paris ; le formulaire affiche et renvoie le 17.
      const f = faux(
        ligne({
          createdAt: CREE,
          dateVerification: new Date("2026-10-15T23:30:00.000Z"),
        }),
      );
      await modifierMoyenMotive(
        f.client,
        "m1",
        formulaire({ libelle: "Salle B", dateVerification: new Date("2026-10-16") }),
        { motif: "Salle renommée par le client", auteur: AUTEUR, maintenant: LE_SOIR },
      );
      expect(f.historique.mock.calls[0]?.[0].data.apres).toEqual({ libelle: "Salle B" });
    });

    it("une date réellement changée reste validée (jour antérieur à la création)", async () => {
      const f = faux(existant());
      expect(
        await code(
          modifierMoyenMotive(
            f.client,
            "m1",
            formulaire({ dateVerification: new Date("2026-10-15") }),
            {
              motif: "Date corrigée après relecture",
              auteur: AUTEUR,
              maintenant: LE_SOIR,
            },
          ),
        ),
      ).toBe("date_anterieure_creation");
      expect(f.update).not.toHaveBeenCalled();
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
