/**
 * Lot L08 (O4) — la console lit les réponses d'un questionnaire à chaud / à froid
 * QUESTION PAR QUESTION, pas seulement la note globale. Les cas décrivent ce que
 * lit l'administrateur.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

import { QuestionnairesSection, type QuestionnaireRow } from "../QuestionnairesSection";

function rendre(questionnaires: QuestionnaireRow[]) {
  return render(
    <QuestionnairesSection
      sessionId="s-1"
      debutSession="2026-09-05T07:00:00.000Z"
      questionnaires={questionnaires}
      genererAction={vi.fn(async () => ({ data: { crees: 0, total: 0 } }))}
      saisirReponsesAction={vi.fn(async () => ({ data: { id: "x" } }))}
      envoyerAction={vi.fn(async () => ({
        data: { questionnaireId: "q", envoyeAt: "2026-09-04T20:51:00.000Z" },
      }))}
    />,
  );
}

const CHAUD: QuestionnaireRow = {
  id: "q-chaud",
  traineeNom: "Camille Martin",
  type: "satisfaction_chaud",
  reponduAt: "2026-09-06T09:00:00.000Z",
  envoyeAt: "2026-09-05T20:00:00.000Z",
  noteGlobale: 4,
  positionnement: null,
  precisionSurFicheStagiaire: false,
  reponsesDetaillees: [
    { id: "noteGlobale", libelle: "Votre satisfaction globale", reponse: "4 / 5" },
    { id: "noteContenu", libelle: "Le contenu répondait à mes besoins", reponse: "5 / 5" },
    {
      id: "acquisParObjectif",
      libelle: "Votre niveau à l'issue de la formation",
      reponse: null,
      lignes: [
        { libelle: "Rédiger un prompt", reponse: "Je maîtrise" },
        { libelle: "Vérifier une réponse", reponse: null },
      ],
    },
    { id: "commentaire", libelle: "Votre commentaire", reponse: "Très utile." },
  ],
};

describe("QuestionnairesSection — réponses question par question", () => {
  it("affiche chaque question avec sa réponse, objectif par objectif", () => {
    rendre([CHAUD]);
    fireEvent.click(screen.getByRole("button", { name: /voir les réponses/i }));
    expect(screen.getByText("Le contenu répondait à mes besoins")).toBeTruthy();
    expect(screen.getByText("5 / 5")).toBeTruthy();
    expect(screen.getByText(/Rédiger un prompt — Je maîtrise/)).toBeTruthy();
    expect(screen.getByText("Très utile.")).toBeTruthy();
  });

  it("une question sans réponse se lit « Non renseigné »", () => {
    rendre([CHAUD]);
    fireEvent.click(screen.getByRole("button", { name: /voir les réponses/i }));
    expect(screen.getAllByText("Non renseigné").length).toBeGreaterThan(0);
  });

  it("éteint (aucune réponse détaillée) : pas de bouton, écran inchangé", () => {
    const { reponsesDetaillees: _omis, ...sansDetail } = CHAUD;
    rendre([sansDetail]);
    expect(screen.queryByRole("button", { name: /voir les réponses/i })).toBeNull();
  });
});
