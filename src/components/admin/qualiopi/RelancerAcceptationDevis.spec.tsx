/**
 * Deux alertes DISTINCTES : « acceptation non enregistrée » et « plans non proposés ».
 * Le second ne parle ni d'acceptation manquante, ni de plan à créer à la main.
 */
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { RelancerAcceptationDevis } from "./RelancerAcceptationDevis";

const rendre = (cas: "acceptation" | "plans" | "confirmation-classique") =>
  renderToStaticMarkup(
    <RelancerAcceptationDevis
      cas={cas}
      documentGenereId="d"
      relancerAction={async () => ({ ok: true, devisAcceptes: 1 })}
    />,
  );

describe("RelancerAcceptationDevis", () => {
  it("cas « acceptation » : texte d'acceptation non enregistrée", () => {
    const html = rendre("acceptation");
    expect(html).toContain("acceptation n&#x27;a pas été enregistrée");
    expect(html).toContain("Relancer l&#x27;acceptation");
  });

  it("cas « plans » : texte exact, bouton « Relancer la proposition des plans », rien à créer à la main", () => {
    const html = rendre("plans");
    expect(html).toContain("plans récurrents attendus n&#x27;ont pas été proposés");
    expect(html).toContain("Relancer la proposition des plans");
    expect(html).not.toContain("aucune formule retenue");
    expect(html).not.toContain("acceptation n&#x27;a pas été enregistrée");
    expect(html).not.toContain("à la main");
  });

  it("cas « confirmation-classique » : titre, explication et bouton propres", () => {
    const html = rendre("confirmation-classique");
    expect(html).toContain("Confirmation de commande non préparée");
    expect(html).toContain(
      "Ce devis est signé par les deux parties, mais l&#x27;e-mail de confirmation de commande n&#x27;a pas été préparé. Vérifiez que la fiche du client a une adresse e-mail, puis relancez. L&#x27;e-mail attendra votre validation avant de partir.",
    );
    expect(html).toContain("Préparer la confirmation de commande");
    expect(html).not.toContain("acceptation n&#x27;a pas été enregistrée");
  });

  it("affiche le message de succès dans une zone de statut, puis rafraîchit", async () => {
    const action = vi.fn(async () => ({
      ok: true as const,
      devisAcceptes: 1,
      message: "Confirmation de commande préparée : elle attend votre validation.",
    }));
    render(
      <RelancerAcceptationDevis
        cas="confirmation-classique"
        documentGenereId="d"
        relancerAction={action}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Préparer la confirmation de commande" }));
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain("Confirmation de commande préparée"),
    );
    expect(action).toHaveBeenCalledWith({ documentGenereId: "d" });
  });
});
