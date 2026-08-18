/**
 * Lot 1bis — le guidage AVANT la création.
 *
 * Les deux tests qui doivent rougir :
 *
 * 1. **Aucune formation publiée** : le message existait (« Publiez d'abord une
 *    formation ») mais ne portait AUCUN lien. La phrase était juste, et
 *    laissait quand même chercher où aller.
 * 2. **Aucun client enregistré** : le bloc Client disparaissait ENTIÈREMENT
 *    (`clients.length > 0 && …`). L'utilisateur ne voyait pas un champ vide, il
 *    ne voyait pas le champ — donc rien ne lui apprenait que sans client il
 *    n'aura ni convention, ni facture, ni dossier de financement.
 *
 * Critère du plan : *chaque état vide bloquant porte le lien vers l'action
 * exacte.* Un état vide sans CTA = rouge.
 */

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SessionForm } from "../SessionForm";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/server/actions/qualiopi/sessions", () => ({
  createSessionAction: vi.fn(),
}));

vi.mock("@/server/actions/qualiopi/sessions-recurrentes", () => ({
  createRecurringSessionsAction: vi.fn(),
}));

const LIENS = {
  formations: "/fr/admin-x/qualiopi/formations/new",
  clients: "/fr/admin-x/qualiopi/clients/new",
  formateurs: "/fr/admin-x/qualiopi/formateurs",
};

const FORMATION = { id: "f-1", titre: "IA appliquée", numero: "AXI-FOR-001" };
const CLIENT = { id: "c-1", raisonSociale: "Acme", numero: "AXI-CLI-001" };

describe("aucune formation publiée", () => {
  it("porte un LIEN vers la création de formation, pas seulement une phrase", () => {
    render(<SessionForm formations={[]} clients={[CLIENT]} liensPrerequis={LIENS} />);

    const lien = screen.getByRole("link", { name: /créer une formation/i });
    expect(lien).toHaveAttribute("href", LIENS.formations);
  });

  it("nomme la donnée absente ET sa conséquence", () => {
    render(<SessionForm formations={[]} clients={[CLIENT]} liensPrerequis={LIENS} />);
    // « une session se rattache toujours à une formation » : le POURQUOI, sans
    // quoi l'utilisateur ne sait pas si c'est un bug ou une règle.
    expect(screen.getByText(/se rattache toujours à une formation/i)).toBeInTheDocument();
  });

  it("le bouton de soumission reste désactivé — la garde existante n'est pas levée", () => {
    render(<SessionForm formations={[]} clients={[CLIENT]} liensPrerequis={LIENS} />);
    const boutons = screen.getAllByRole("button");
    const soumettre = boutons.find((b) => /créer/i.test(b.textContent ?? ""));
    expect(soumettre).toBeDisabled();
  });
});

describe("aucun client enregistré", () => {
  it("le champ Client RESTE VISIBLE — il disparaissait entièrement", () => {
    render(<SessionForm formations={[FORMATION]} clients={[]} liensPrerequis={LIENS} />);
    // Le défaut : `clients.length > 0 &&` effaçait le bloc. On ne pouvait pas
    // soupçonner l'existence du champ, donc encore moins son absence de valeur.
    expect(screen.getByLabelText(/client/i)).toBeInTheDocument();
  });

  it("porte un lien vers la création de client", () => {
    render(<SessionForm formations={[FORMATION]} clients={[]} liensPrerequis={LIENS} />);
    const lien = screen.getByRole("link", { name: /créer un client/i });
    expect(lien).toHaveAttribute("href", LIENS.clients);
  });

  it("dit les TROIS conséquences en aval, pas seulement « aucun client »", () => {
    render(<SessionForm formations={[FORMATION]} clients={[]} liensPrerequis={LIENS} />);
    const message = screen.getByText(/aucun client enregistré/i);
    expect(message.textContent).toMatch(/convention/i);
    expect(message.textContent).toMatch(/facture/i);
    expect(message.textContent).toMatch(/dossier de financement/i);
  });

  it("le select est neutralisé mais présent — un select vide et actif ment", () => {
    render(<SessionForm formations={[FORMATION]} clients={[]} liensPrerequis={LIENS} />);
    expect(screen.getByLabelText(/client/i)).toBeDisabled();
  });
});

describe("rien ne change quand les prérequis sont là", () => {
  it("aucun message de prérequis n'apparaît", () => {
    render(<SessionForm formations={[FORMATION]} clients={[CLIENT]} liensPrerequis={LIENS} />);
    expect(screen.queryByRole("link", { name: /créer une formation/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /créer un client/i })).toBeNull();
  });

  it("le select Client est utilisable", () => {
    render(<SessionForm formations={[FORMATION]} clients={[CLIENT]} liensPrerequis={LIENS} />);
    expect(screen.getByLabelText(/client/i)).not.toBeDisabled();
  });
});

describe("sans `liensPrerequis` — repli de compatibilité", () => {
  it("garde l'ancien message plutôt que de ne rien dire", () => {
    // Ce composant a d'autres points de montage : leur retirer le message
    // existant au motif qu'ils n'ont pas encore les URLs serait une régression.
    render(<SessionForm formations={[]} clients={[CLIENT]} />);
    expect(screen.getByText(/publiez d'abord une formation/i)).toBeInTheDocument();
  });
});
