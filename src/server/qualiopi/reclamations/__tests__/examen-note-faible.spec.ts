/**
 * L09 — une note de 2/5 ou moins ouvre automatiquement un examen.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  etat: "actif" as "eteint" | "essai" | "actif",
  inscription: {
    estTestInterne: false,
    session: { id: "session-1", estTestInterne: false },
  } as null | { estTestInterne: boolean; session: { id: string; estTestInterne: boolean } },
  creer: vi.fn(async () => ({ id: "incident-1" })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { enrollment: { findUnique: vi.fn(async () => h.inscription) } },
}));
vi.mock("@/server/qualiopi/registres/incidents-service", () => ({ creerIncident: h.creer }));
vi.mock("@/server/qualiopi/reclamations/interrupteur", () => ({
  lireInterrupteurReclamations: vi.fn(async () => h.etat),
}));

import {
  LIBELLE_REPONDU_PAR_LIEN,
  notesFaibles,
  ouvrirExamenSiNoteFaible,
  texteOuvertureExamen,
} from "../examen-note-faible";

const BASE = {
  questionnaireId: "q-1",
  type: "satisfaction_chaud",
  enrollmentId: "enr-1",
  origine: "stagiaire" as const,
};

beforeEach(() => {
  h.etat = "actif";
  h.inscription = { estTestInterne: false, session: { id: "session-1", estTestInterne: false } };
  h.creer.mockClear();
});

describe("notesFaibles", () => {
  it("retient 1/5 et 2/5, jamais 3/5 ni une autre échelle", () => {
    expect(
      notesFaibles([
        { libelle: "a", valeur: 1, sur: 5 },
        { libelle: "b", valeur: 2, sur: 5 },
        { libelle: "c", valeur: 3, sur: 5 },
        { libelle: "d", valeur: 1, sur: 3 },
        { libelle: "e", valeur: 1.5, sur: 5 },
      ]).map((n) => n.libelle),
    ).toEqual(["a", "b"]);
  });
});

describe("ouvrirExamenSiNoteFaible", () => {
  it("2/5 : ouvre un incident « difficulté » rattaché à la session, depuis le questionnaire", async () => {
    expect(await ouvrirExamenSiNoteFaible({ ...BASE, noteGlobale: 2 })).toBe("incident-1");
    expect(h.creer).toHaveBeenCalledWith(
      expect.objectContaining({
        nature: "difficulte",
        origine: "questionnaire",
        declarant: "stagiaire",
        sessionId: "session-1",
        gravite: "mineur",
        noteOuverture: {
          texte: expect.stringContaining(`(${LIBELLE_REPONDU_PAR_LIEN})`),
          auteur: { id: null, nom: "Ouverture automatique (note de questionnaire)" },
        },
      }),
    );
  });

  it("1/5 à l'enquête entreprise : déclarant entreprise, gravité majeure", async () => {
    await ouvrirExamenSiNoteFaible({ ...BASE, type: "satisfaction_entreprise", noteGlobale: 1 });
    expect(h.creer).toHaveBeenCalledWith(
      expect.objectContaining({ declarant: "entreprise", gravite: "majeur" }),
    );
  });

  it("3/5, positionnement ou sans note : rien ne s'ouvre", async () => {
    await ouvrirExamenSiNoteFaible({ ...BASE, noteGlobale: 3 });
    await ouvrirExamenSiNoteFaible({ ...BASE, type: "positionnement", noteGlobale: 1 });
    await ouvrirExamenSiNoteFaible({ ...BASE });
    expect(h.creer).not.toHaveBeenCalled();
  });

  it("🔴 interrupteur éteint : rien ne s'ouvre", async () => {
    h.etat = "eteint";
    expect(await ouvrirExamenSiNoteFaible({ ...BASE, noteGlobale: 1 })).toBeNull();
    expect(h.creer).not.toHaveBeenCalled();
  });

  it("essai : seulement pour le banc d'essai", async () => {
    h.etat = "essai";
    await ouvrirExamenSiNoteFaible({ ...BASE, noteGlobale: 1 });
    expect(h.creer).not.toHaveBeenCalled();
    h.inscription = { estTestInterne: false, session: { id: "session-1", estTestInterne: true } };
    await ouvrirExamenSiNoteFaible({ ...BASE, noteGlobale: 1 });
    expect(h.creer).toHaveBeenCalledOnce();
  });

  it("ne lève jamais : une panne d'écriture rend null", async () => {
    h.creer.mockRejectedValueOnce(new Error("base injoignable"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(ouvrirExamenSiNoteFaible({ ...BASE, noteGlobale: 1 })).resolves.toBeNull();
  });

  it("une saisie par l'organisme le dit", () => {
    expect(
      texteOuvertureExamen({
        type: "satisfaction_froid",
        notes: [{ libelle: "note globale", valeur: 2, sur: 5 }],
        origine: "organisme",
      }),
    ).toMatch(
      /note globale : 2\/5 au questionnaire de satisfaction à froid \(saisi par l'organisme/,
    );
  });
});
