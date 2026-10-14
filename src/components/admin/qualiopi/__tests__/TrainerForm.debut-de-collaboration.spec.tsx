/**
 * 🔴 2026-10-13 — « Début de collaboration » n'avait d'écran que pour un salarié.
 *
 * La date imprimée sur la fiche formateur versée au dossier (indicateur 21) se
 * saisissait dans le panneau du CONTRAT DE TRAVAIL, affiché pour le seul statut
 * « salarié ». Pour le dirigeant-formateur elle valait le 18/07/2026 — avant
 * l'immatriculation de la société (30/07/2026) — et aucun écran ne permettait
 * de la corriger.
 *
 * Elle se saisit désormais dans le formulaire d'identité, pour un dirigeant et
 * pour un sous-traitant. PAS pour un salarié : deux champs pour la même colonne
 * sur une même page se désynchronisent, et l'enregistrement de l'identité
 * écraserait la date posée dans le panneau du contrat.
 *
 * ⚠️ `vi.mock` remplace l'action AVANT le chargement (patron de
 * `TraineeForm.entreprise-et-consentements.spec.tsx`) : sans lui le fichier
 * échouerait au chargement en annonçant « no tests ».
 */

import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TrainerForm } from "../TrainerForm";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const updateTrainerAction = vi.fn();
vi.mock("@/server/actions/qualiopi/trainers", () => ({
  createTrainerAction: vi.fn(),
  updateTrainerAction: (...a: unknown[]) => updateTrainerAction(...a),
}));

type Statut = "salarie" | "sous_traitant" | "dirigeant";

function monter(statut: Statut, dateEmbauche = "2026-07-18") {
  return render(
    <TrainerForm
      mode="edit"
      baseHref="/fr/admin-x/qualiopi/formateurs"
      trainerId="t-1"
      initial={{
        nom: "Jullin",
        prenom: "Williams",
        email: "williams@example.test",
        telephone: null,
        statut,
        region: null,
        tarifJourneeHtCents: null,
        sousTraitantNda: null,
        dateEmbauche,
      }}
    />,
  );
}

async function enregistrer(): Promise<Record<string, unknown>> {
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
  await waitFor(() => expect(updateTrainerAction).toHaveBeenCalledTimes(1));
  return updateTrainerAction.mock.calls[0]![0] as Record<string, unknown>;
}

beforeEach(() => {
  updateTrainerAction.mockReset();
  updateTrainerAction.mockResolvedValue({ data: { id: "t-1" } });
});

describe("« Début de collaboration » dans le formulaire d'identité", () => {
  it.each<Statut>(["dirigeant", "sous_traitant"])(
    "se saisit pour un %s, prérempli avec la date en base",
    (statut) => {
      monter(statut);
      const champ = screen.getByLabelText("Début de collaboration") as HTMLInputElement;
      expect(champ.type).toBe("date");
      expect(champ.value).toBe("2026-07-18");
    },
  );

  it("envoie la date corrigée à l'action d'identité", async () => {
    monter("dirigeant");
    fireEvent.change(screen.getByLabelText("Début de collaboration"), {
      target: { value: "2026-07-30" },
    });
    expect(await enregistrer()).toMatchObject({ id: "t-1", dateEmbauche: "2026-07-30" });
  });

  it("la date est facultative : un champ vidé envoie `null`, qui l'efface", async () => {
    monter("dirigeant");
    fireEvent.change(screen.getByLabelText("Début de collaboration"), { target: { value: "" } });
    expect(await enregistrer()).toHaveProperty("dateEmbauche", null);
  });

  it("🔴 n'existe PAS pour un salarié, et son identité n'envoie aucune date", async () => {
    // Sa date d'entrée se saisit dans le panneau du contrat de travail. L'envoyer
    // d'ici écraserait, avec une valeur figée au montage, celle posée là-bas.
    monter("salarie");
    expect(screen.queryByLabelText("Début de collaboration")).toBeNull();
    expect(await enregistrer()).not.toHaveProperty("dateEmbauche");
  });

  it("n'apparaît pas à la création", () => {
    render(<TrainerForm mode="create" baseHref="/fr/admin-x/qualiopi/formateurs" />);
    expect(screen.queryByLabelText("Début de collaboration")).toBeNull();
  });
});
