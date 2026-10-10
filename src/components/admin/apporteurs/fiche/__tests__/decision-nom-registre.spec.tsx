/**
 * Contresignature (décision de Will, 10/10) : quand le nom du contrat ne correspond à
 * personne au registre, l'aperçu affiche l'alerte en rouge et le bouton final attend la case
 * « J'ai vérifié… ». La case cochée est transmise au serveur, qui la revérifie.
 */

import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ apercu: vi.fn(), appliquer: vi.fn() }));
vi.mock("@/features/apporteurs-reseau/actions-apporteurs", () => ({
  apercuDecisionAction: (i: unknown) => h.apercu(i),
  appliquerDecisionAction: (i: unknown) => h.appliquer(i),
}));

import { DecisionDossier } from "../DecisionDossier";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const EMAIL = { destinataire: "claire@exemple.fr", sujet: "Votre contrat", html: "<p>ok</p>" };
const ALERTE =
  "Le nom du contrat (Claire Martin) ne correspond à personne dans le registre pour ce SIRET : personnes trouvées : PAUL DURAND, gérant. Vérifiez la pièce d'identité et le RIB avant de contresigner.";

beforeEach(() => {
  vi.clearAllMocks();
  h.appliquer.mockResolvedValue({ ok: true, message: "Contrat contresigné et envoyé." });
});

describe("DecisionDossier : nom absent du registre", () => {
  it("alerte en rouge, bouton bloqué jusqu'à la case, puis la case part au serveur", async () => {
    h.apercu.mockResolvedValue({ ok: true, email: EMAIL, alerteNom: ALERTE });
    const u = userEvent.setup();
    render(<DecisionDossier apporteurId={ID} />);
    await u.click(screen.getByRole("button", { name: "Oui, contresigner" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(ALERTE);
    const envoyer = screen.getByRole("button", { name: "Contresigner et envoyer le contrat" });
    expect(envoyer).toBeDisabled();

    await u.click(
      screen.getByRole("checkbox", {
        name: "J'ai vérifié : cette personne a bien le droit d'engager cette entreprise",
      }),
    );
    expect(envoyer).toBeEnabled();
    await u.click(envoyer);
    expect(h.appliquer).toHaveBeenCalledWith(
      expect.objectContaining({ apporteurId: ID, decision: "contresigner", nomVerifie: true }),
    );
  });

  it("sans alerte : ni case ni blocage", async () => {
    h.apercu.mockResolvedValue({ ok: true, email: EMAIL });
    const u = userEvent.setup();
    render(<DecisionDossier apporteurId={ID} />);
    await u.click(screen.getByRole("button", { name: "Oui, contresigner" }));
    const envoyer = await screen.findByRole("button", {
      name: "Contresigner et envoyer le contrat",
    });
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(envoyer).toBeEnabled();
    await u.click(envoyer);
    expect(h.appliquer).toHaveBeenCalledWith(expect.objectContaining({ nomVerifie: false }));
  });
});
