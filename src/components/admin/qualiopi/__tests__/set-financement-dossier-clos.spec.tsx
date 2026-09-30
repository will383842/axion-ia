/**
 * 🔴 ADR 0060 / PR 1249 — sur un dossier CLOS, le suivi financier (statut OPCO,
 * n° de dossier, subrogation) doit pouvoir s'ENREGISTRER.
 *
 * Défaut démontré en revue : le sélecteur du type était désactivé, mais
 * `handleSubmit` envoyait toujours `financementType` (initialisé depuis la base,
 * donc jamais vide), et `ftDispositif` / `cpfPayeurResteCharge` quand leur bloc
 * était affiché. Or `setFinancementSessionAction` appelle `assertDossierOuvert`
 * dès que l'un de ces champs est PRÉSENT : refus DOSSIER_CLOS à tous les coups.
 *
 * Le test précédent ne vérifiait que l'attribut `disabled`. Celui-ci SOUMET le
 * formulaire et lit ce qui part vraiment au serveur.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
}));

const a = vi.hoisted(() => ({
  setFinancementSessionAction: vi.fn(),
  validerAccordOpcoAction: vi.fn(),
}));
vi.mock("@/server/actions/qualiopi/financements", () => ({
  setFinancementSessionAction: (...x: unknown[]) => a.setFinancementSessionAction(...x),
  validerAccordOpcoAction: (...x: unknown[]) => a.validerAccordOpcoAction(...x),
}));

import { DossierVerrouProvider } from "@/features/admin-qualiopi/session-hub/DossierVerrouProvider";
import { SetFinancementForm } from "../SetFinancementForm";

const SESSION = "11111111-1111-4111-8111-111111111111";
const CHAMPS_CONTRACTUELS = ["financementType", "ftDispositif", "cpfPayeurResteCharge"];

type Base = React.ComponentProps<typeof SetFinancementForm>;
const base: Base = {
  sessionId: SESSION,
  financementType: "opco",
  opcoStatut: "demande_en_cours",
  opcoSubrogation: false,
  numeroDossierOpco: null,
  ftDispositif: null,
  cpfPayeurResteCharge: null,
  conventionTripartiteSigneeAt: null,
  ftPoeiOffreEmploiNumero: null,
  ftPoeiAccordFinancementAt: null,
  ftPoeiEngagementSigneAt: null,
};

function rendre(props: Partial<Base>, fige: boolean) {
  return render(
    <DossierVerrouProvider fige={fige} etat={fige ? "clos" : "en_cours"}>
      <SetFinancementForm {...base} {...props} />
    </DossierVerrouProvider>,
  );
}

async function enregistrer(): Promise<Record<string, unknown>> {
  fireEvent.click(screen.getByRole("button", { name: /^Enregistrer le financement$/ }));
  await waitFor(() => expect(a.setFinancementSessionAction).toHaveBeenCalledTimes(1));
  return a.setFinancementSessionAction.mock.calls[0]![0] as Record<string, unknown>;
}

beforeEach(() => {
  refresh.mockReset();
  a.setFinancementSessionAction.mockReset();
  a.setFinancementSessionAction.mockResolvedValue({ data: { id: SESSION } });
  a.validerAccordOpcoAction.mockReset();
});
afterEach(cleanup);

describe("🔴 dossier CLOS — le suivi OPCO s'enregistre sans toucher au contractuel", () => {
  it("OPCO : n° de dossier + statut + subrogation partent, le TYPE ne part pas", async () => {
    rendre({}, true);
    fireEvent.change(screen.getByLabelText("Numéro de dossier OPCO"), {
      target: { value: "OPCO-2026-42" },
    });
    fireEvent.change(screen.getByLabelText("Statut OPCO"), { target: { value: "accord_recu" } });
    const envoi = await enregistrer();
    for (const c of CHAMPS_CONTRACTUELS) expect(envoi).not.toHaveProperty(c);
    expect(envoi).toMatchObject({
      sessionId: SESSION,
      numeroDossierOpco: "OPCO-2026-42",
      opcoStatut: "accord_recu",
      opcoSubrogation: false,
    });
    expect(await screen.findByText(/^Financement mis à jour\./)).toBeTruthy();
  });

  it("France Travail : le dispositif figé ne part pas non plus", async () => {
    rendre({ financementType: "france_travail", ftDispositif: "poei" }, true);
    const envoi = await enregistrer();
    for (const c of CHAMPS_CONTRACTUELS) expect(envoi).not.toHaveProperty(c);
  });

  it("CPF (historique) : le payeur du reste à charge figé ne part pas", async () => {
    rendre({ financementType: "cpf", cpfPayeurResteCharge: "stagiaire" }, true);
    const envoi = await enregistrer();
    for (const c of CHAMPS_CONTRACTUELS) expect(envoi).not.toHaveProperty(c);
  });
});

describe("TÉMOIN — dossier ouvert : les champs contractuels partent bien", () => {
  it("OPCO : le type est envoyé", async () => {
    rendre({}, false);
    const envoi = await enregistrer();
    expect(envoi).toMatchObject({ financementType: "opco" });
  });

  it("France Travail : type et dispositif sont envoyés", async () => {
    rendre({ financementType: "france_travail", ftDispositif: "aif" }, false);
    const envoi = await enregistrer();
    expect(envoi).toMatchObject({ financementType: "france_travail", ftDispositif: "aif" });
  });

  it("CPF : le payeur est envoyé", async () => {
    rendre({ financementType: "cpf", cpfPayeurResteCharge: "employeur" }, false);
    const envoi = await enregistrer();
    expect(envoi).toMatchObject({ financementType: "cpf", cpfPayeurResteCharge: "employeur" });
  });
});
