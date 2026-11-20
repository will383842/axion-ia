import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { liensApresEnvoi } from "../liens-apres-envoi";
import { EmailEnvoi } from "../EmailEnvoi";

describe("liensApresEnvoi", () => {
  it("dérive le préfixe admin de l'URL courante", () => {
    expect(liensApresEnvoi("/fr/admin-x/qualiopi/devis/new", "d1")).toEqual({
      hrefDevis: "/fr/admin-x/qualiopi/devis/d1",
      hrefEmails: "/fr/admin-x/qualiopi/emails",
    });
  });
  it("URL inconnue ou absente : aucun lien", () => {
    expect(liensApresEnvoi(null, "d1")).toBeNull();
    expect(liensApresEnvoi("/autre", "d1")).toBeNull();
  });
});

describe("EmailEnvoi — après l'envoi", () => {
  it("liens « Ouvrir le devis » et « Ouvrir les e-mails à valider »", async () => {
    const envoyer = vi.fn(async () => ({ data: { enCorbeille: true as const } }));
    render(
      <EmailEnvoi
        destinataire="c@example.test"
        envoyer={envoyer}
        hrefDevis="/fr/a/qualiopi/devis/d1"
        hrefEmails="/fr/a/qualiopi/emails"
      />,
    );
    expect(screen.queryByRole("link", { name: "Ouvrir le devis" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Envoyer au client/ }));
    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Ouvrir le devis" }).getAttribute("href")).toBe(
        "/fr/a/qualiopi/devis/d1",
      ),
    );
    expect(
      screen.getByRole("link", { name: "Ouvrir les e-mails à valider" }).getAttribute("href"),
    ).toBe("/fr/a/qualiopi/emails");
  });
});
