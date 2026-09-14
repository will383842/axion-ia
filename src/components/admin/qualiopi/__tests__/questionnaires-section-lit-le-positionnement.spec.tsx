/**
 * Constats C2-03 / I10-02 (audit initial 2026-09-14) — la fiche session
 * n'affichait d'un positionnement répondu que « Répondu » et une date. Les
 * attentes, les niveaux par objectif et le « besoin d'adaptation » oui/non
 * n'étaient lisibles NULLE PART dans la console : l'auditrice qui demande
 * « montrez-moi le positionnement de cette stagiaire » ne pouvait rien voir.
 *
 * Les cas décrivent ce que lit l'administrateur, jamais l'implémentation.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

import { QuestionnairesSection, type QuestionnaireRow } from "../QuestionnairesSection";

const ok = vi.fn(async () => ({ data: { id: "x" } }));

function rendre(questionnaires: QuestionnaireRow[]) {
  return render(
    <QuestionnairesSection
      sessionId="s-1"
      debutSession="2026-09-05T07:00:00.000Z"
      questionnaires={questionnaires}
      genererAction={vi.fn(async () => ({ data: { crees: 0, total: 0 } }))}
      saisirReponsesAction={ok}
      envoyerAction={vi.fn(async () => ({
        data: { questionnaireId: "q", envoyeAt: "2026-09-04T20:51:00.000Z" },
      }))}
    />,
  );
}

const SANS_SAISIE_ORGANISME = {
  objectifsAtteints: null,
  pointsForts: null,
  axesAmelioration: null,
  commentaire: null,
};

const POSITIONNEMENT_REPONDU: QuestionnaireRow = {
  id: "q-pos",
  traineeNom: "Camille Martin",
  type: "positionnement",
  reponduAt: "2026-09-04T21:12:00.000Z",
  envoyeAt: "2026-09-04T20:51:00.000Z",
  noteGlobale: null,
  positionnement: {
    fonction: "Assistante de direction",
    secteur: "Immobilier",
    outilsUtilises: "ChatGPT",
    frequenceUsage: "Quelques fois par mois",
    attentes: "Gagner du temps sur les annonces",
    tacheVisee: "Les comptes rendus de visite",
    niveaux: [{ objectif: "Rédiger des annonces", niveau: 1, libelle: "Je découvre" }],
    besoinAdaptation: false,
    precisionAdaptationFournie: null,
    saisieAdmin: false,
    saisieOrganisme: SANS_SAISIE_ORGANISME,
  },
};

describe("QuestionnairesSection — le positionnement répondu se LIT", () => {
  it("le besoin d'adaptation déclaré se voit sur la ligne, sans rien ouvrir", () => {
    rendre([POSITIONNEMENT_REPONDU]);
    expect(screen.getByText(/Besoin d.adaptation déclaré\s*:\s*non/i)).toBeTruthy();
  });

  it("« Voir les réponses » affiche attentes, niveaux et date-heure de réponse, en lecture seule", () => {
    rendre([POSITIONNEMENT_REPONDU]);
    fireEvent.click(screen.getByRole("button", { name: /Voir les réponses/i }));

    expect(screen.getByText("Gagner du temps sur les annonces")).toBeTruthy();
    expect(screen.getByText("Les comptes rendus de visite")).toBeTruthy();
    expect(screen.getByText("Rédiger des annonces")).toBeTruthy();
    expect(screen.getByText("Je découvre")).toBeTruthy();
    // L'HEURE compte : l'auditrice compare la réponse au début de la session.
    expect(screen.getByText(/4 septembre 2026 à 23:12/)).toBeTruthy();
    // Lecture seule : aucun champ de saisie ne s'ouvre avec les réponses.
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("une saisie par l'organisme est signalée comme telle", () => {
    rendre([
      {
        ...POSITIONNEMENT_REPONDU,
        positionnement: {
          ...POSITIONNEMENT_REPONDU.positionnement!,
          besoinAdaptation: null,
          saisieAdmin: true,
        },
      },
    ]);
    // Cohérence PR 1083 : la question n'a pas été posée, ce n'est ni « non »
    // ni un oubli du stagiaire.
    expect(
      screen.getByText(/Besoin d.adaptation déclaré\s*:\s*non posée \(saisie par l.organisme\)/i),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Voir les réponses/i }));
    expect(screen.getByText(/Saisi par l.organisme, et non/i)).toBeTruthy();
  });

  it("la ligne dit si la réponse est arrivée AVANT le début de la session", () => {
    rendre([POSITIONNEMENT_REPONDU]);
    expect(screen.getByText("avant le début de la session")).toBeTruthy();
  });

  it("la ligne dit si la réponse est arrivée APRÈS le début de la session", () => {
    rendre([{ ...POSITIONNEMENT_REPONDU, reponduAt: "2026-09-05T08:00:00.000Z" }]);
    expect(screen.getByText("après le début de la session")).toBeTruthy();
  });

  it("une satisfaction n'expose aucun bouton de positionnement", () => {
    rendre([
      {
        ...POSITIONNEMENT_REPONDU,
        id: "q-sat",
        type: "satisfaction_chaud",
        noteGlobale: 4,
        positionnement: null,
      },
    ]);
    expect(screen.queryByRole("button", { name: /Voir les réponses/i })).toBeNull();
  });

  // ── Relecture de la PR 1090 : formes réelles ─────────────────────────────

  it("besoin déclaré avec une précision chiffrée : sa PRÉSENCE se dit, jamais « Non renseigné »", () => {
    rendre([
      {
        ...POSITIONNEMENT_REPONDU,
        positionnement: {
          ...POSITIONNEMENT_REPONDU.positionnement!,
          besoinAdaptation: true,
          precisionAdaptationFournie: true,
        },
      },
    ]);
    fireEvent.click(screen.getByRole("button", { name: /Voir les réponses/i }));
    expect(
      screen.getByText("Précision fournie — consultable par le super-administrateur"),
    ).toBeTruthy();
  });

  it("une saisie de l'organisme montre ce que l'organisme a réellement saisi", () => {
    rendre([
      {
        ...POSITIONNEMENT_REPONDU,
        positionnement: {
          ...POSITIONNEMENT_REPONDU.positionnement!,
          fonction: null,
          secteur: null,
          outilsUtilises: null,
          frequenceUsage: null,
          attentes: null,
          tacheVisee: null,
          niveaux: [],
          besoinAdaptation: null,
          saisieAdmin: true,
          saisieOrganisme: {
            objectifsAtteints: "Objectifs recueillis par téléphone",
            pointsForts: "Déjà à l'aise avec ChatGPT",
            axesAmelioration: "Rédaction des annonces",
            commentaire: "Appel téléphonique",
          },
        },
      },
    ]);
    fireEvent.click(screen.getByRole("button", { name: /Voir les réponses/i }));
    expect(screen.getByText("Objectifs recueillis par téléphone")).toBeTruthy();
    expect(screen.getByText("Déjà à l'aise avec ChatGPT")).toBeTruthy();
    expect(screen.getByText("Rédaction des annonces")).toBeTruthy();
    expect(screen.getByText("Appel téléphonique")).toBeTruthy();
  });

  it("le jour de la ligne est celui de PARIS, comme le panneau (rendu serveur en UTC)", () => {
    const tzAvant = process.env.TZ;
    process.env.TZ = "UTC";
    try {
      // 5 septembre à 00:30 à Paris = 4 septembre 22:30 UTC.
      rendre([{ ...POSITIONNEMENT_REPONDU, reponduAt: "2026-09-04T22:30:00.000Z" }]);
      expect(screen.getByText("05 septembre 2026")).toBeTruthy();
    } finally {
      if (tzAvant === undefined) delete process.env.TZ;
      else process.env.TZ = tzAvant;
    }
  });

  it("« Voir les réponses » désigne la ligne qu'il déplie (aria-controls)", () => {
    rendre([POSITIONNEMENT_REPONDU]);
    const bouton = screen.getByRole("button", { name: /Voir les réponses/i });
    const cible = bouton.getAttribute("aria-controls");
    expect(cible).toBeTruthy();
    fireEvent.click(bouton);
    const ligne = document.getElementById(cible!);
    expect(ligne).not.toBeNull();
    expect(ligne!.textContent).toContain("Gagner du temps sur les annonces");
  });
});
