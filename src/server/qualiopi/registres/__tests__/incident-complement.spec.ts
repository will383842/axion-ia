/**
 * L09 — un incident déclaré se complète ou se décide, il ne se réécrit pas.
 */
import { describe, expect, it } from "vitest";
import { planifierComplement, type IncidentActuel } from "../incident-complement";

const MAINTENANT = new Date("2026-10-17T09:30:00.000Z");

const VIERGE: IncidentActuel = {
  statut: "ouvert",
  nature: null,
  declarant: null,
  origine: null,
  sessionId: null,
  trainerId: null,
  sousTraitantId: null,
  faitIntervenant: null,
  actionCorrective: "",
};

describe("planifierComplement — compléter, jamais réécrire", () => {
  it("renseigne une qualification vide et l'écrit dans la note", () => {
    const r = planifierComplement(
      VIERGE,
      { nature: "alea", declarant: "formateur", origine: "telephone" },
      MAINTENANT,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data).toEqual({ nature: "alea", declarant: "formateur", origine: "telephone" });
    expect(r.note).toContain("La nature : Aléa.");
    expect(r.note).toContain("Le déclarant : Formateur.");
    expect(r.note).toContain("L'origine : Téléphone.");
  });

  it("refuse de réécrire une nature déjà posée", () => {
    const r = planifierComplement(
      { ...VIERGE, nature: "alea" },
      { nature: "difficulte" },
      MAINTENANT,
    );
    expect(r).toEqual({ ok: false, erreur: expect.stringMatching(/ne se réécrit pas/) });
  });

  it("une valeur identique n'est pas une réécriture, mais seule elle n'enregistre rien", () => {
    const r = planifierComplement({ ...VIERGE, nature: "alea" }, { nature: "alea" }, MAINTENANT);
    expect(r).toEqual({ ok: false, erreur: "Rien à enregistrer." });
  });

  it("refuse de réécrire une action corrective, accepte de la poser", () => {
    const pose = planifierComplement(
      VIERGE,
      { actionCorrective: "Doubler la connexion" },
      MAINTENANT,
    );
    expect(pose.ok && pose.data.actionCorrective).toBe("Doubler la connexion");
    const reecrit = planifierComplement(
      { ...VIERGE, actionCorrective: "Doubler la connexion" },
      { actionCorrective: "Autre chose" },
      MAINTENANT,
    );
    expect(reecrit.ok).toBe(false);
  });

  it("garde la mise en cause univoque et motivée", () => {
    expect(planifierComplement(VIERGE, { trainerId: "t" }, MAINTENANT)).toEqual({
      ok: false,
      erreur: "Précisez le fait reproché à l'intervenant",
    });
    expect(
      planifierComplement(
        { ...VIERGE, trainerId: "t", faitIntervenant: "retard" },
        { sousTraitantId: "s" },
        MAINTENANT,
      ).ok,
    ).toBe(false);
  });
});

describe("planifierComplement — une décision est motivée, datée par le serveur", () => {
  it("refuse un changement de statut sans motif", () => {
    const r = planifierComplement(VIERGE, { statut: "resolu" }, MAINTENANT);
    expect(r.ok).toBe(false);
    expect(planifierComplement(VIERGE, { statut: "resolu", motif: "court" }, MAINTENANT).ok).toBe(
      false,
    );
  });

  it("résout avec la date serveur et écrit la décision en tête de note", () => {
    const r = planifierComplement(
      VIERGE,
      { statut: "resolu", motif: "Salle de repli trouvée et testée" },
      MAINTENANT,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data).toEqual({ statut: "resolu", resoluAt: MAINTENANT });
    expect(r.note.split("\n")[0]).toBe(
      "Décision : statut « Ouvert » → « Résolu ». Motif : Salle de repli trouvée et testée",
    );
  });

  it("une réouverture efface la date de résolution de la colonne — la note la garde", () => {
    const r = planifierComplement(
      { ...VIERGE, statut: "resolu" },
      { statut: "en_cours", motif: "Le problème est revenu le lendemain" },
      MAINTENANT,
    );
    expect(r.ok && r.data.resoluAt).toBeNull();
    expect(r.ok && r.note).toMatch(/^Réouverture : statut « Résolu » → « En cours »/);
  });
});
