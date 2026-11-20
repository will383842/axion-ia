import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EmailEnvoi } from "../EmailEnvoi";
import type { DonneesApercuEmail, ModificationsEmail } from "../ApercuEmailDevis";

const ORIGINE = "Votre devis AXI-DEV-2026-001";
const DONNEES: DonneesApercuEmail = {
  a: "client@example.test",
  de: '"Axion-IA" <contact@axion-ia.com>',
  objet: ORIGINE,
  objetOrigine: ORIGINE,
  html: "<p>Bonjour Monsieur Dupont,</p>",
  piecesJointes: ["AXI-DEV-2026-001.pdf"],
  lienSignature: "créé à l'envoi",
  salutation: "Bonjour Monsieur Dupont,",
  adresseManquante: false,
};

function monter(
  donnees: Partial<DonneesApercuEmail> = {},
  over: Partial<React.ComponentProps<typeof EmailEnvoi>> = {},
) {
  const apercuEmail = vi.fn(
    async (m: ModificationsEmail): Promise<{ data: DonneesApercuEmail }> => ({
      data: { ...DONNEES, ...donnees, ...(m.sujet !== undefined ? { objet: m.sujet } : {}) },
    }),
  );
  const envoyer = vi.fn(async () => ({ data: { enCorbeille: true } }));
  render(
    <EmailEnvoi
      destinataire="client@example.test"
      envoyer={envoyer}
      apercuEmail={apercuEmail}
      lienFiche="/fr/admin/qualiopi/clients/c1/edit"
      {...over}
    />,
  );
  return { apercuEmail, envoyer };
}

const boutonEnvoi = () =>
  screen.getByRole("button", { name: /Envoyer au client/ }) as HTMLButtonElement;

describe("aperçu de l'e-mail du devis", () => {
  it("montre l'e-mail complet : lien créé à l'envoi, pièce jointe, cadre de hauteur fixe", async () => {
    monter();
    expect(screen.getByTestId("cadre-apercu-email").className).toMatch(/h-\[/);
    expect(
      await screen.findByText(/Bouton « Signer le devis en ligne » : lien créé à l'envoi/),
    ).toBeTruthy();
    await waitFor(() => expect(boutonEnvoi().disabled).toBe(false));
  });

  it("bouton désactivé sans adresse, avec le lien vers la fiche en nouvel onglet", async () => {
    monter({ a: "", adresseManquante: true });
    const lien = await screen.findByRole("link", { name: "Ajouter l'adresse sur la fiche" });
    expect(lien.getAttribute("target")).toBe("_blank");
    expect(lien.getAttribute("href")).toBe("/fr/admin/qualiopi/clients/c1/edit");
    expect(boutonEnvoi().disabled).toBe(true);
  });

  it("« Relire la fiche » relance l'aperçu et débloque l'envoi une fois l'adresse ajoutée", async () => {
    const { apercuEmail } = monter({ a: "", adresseManquante: true });
    await screen.findByRole("link", { name: "Ajouter l'adresse sur la fiche" });
    apercuEmail.mockResolvedValueOnce({ data: { ...DONNEES } });
    fireEvent.click(screen.getByRole("button", { name: "Relire la fiche" }));
    await waitFor(() => expect(apercuEmail).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(boutonEnvoi().disabled).toBe(false));
  });

  it("le clic transmet l'objet et le message modifiés (après actualisation)", async () => {
    const { apercuEmail, envoyer } = monter();
    await screen.findByLabelText("Objet");
    fireEvent.change(screen.getByLabelText("Objet"), {
      target: { value: "Votre devis sur mesure" },
    });
    fireEvent.change(screen.getByLabelText("Message personnel"), { target: { value: "Merci !" } });
    // Brouillon non montré : l'envoi attend.
    await waitFor(() => expect(boutonEnvoi().disabled).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "Actualiser l'aperçu" }));
    await waitFor(() =>
      expect(apercuEmail).toHaveBeenLastCalledWith({
        sujet: "Votre devis sur mesure",
        message: "Merci !",
      }),
    );
    await waitFor(() => expect(boutonEnvoi().disabled).toBe(false));
    fireEvent.click(boutonEnvoi());
    await waitFor(() =>
      expect(envoyer).toHaveBeenCalledWith({
        a: "client@example.test",
        sujet: "Votre devis sur mesure",
        message: "Merci !",
      }),
    );
  });

  it("« Revenir au texte d'origine » vide le message, rend l'objet d'origine et n'envoie rien de modifié", async () => {
    const { apercuEmail, envoyer } = monter();
    await screen.findByLabelText("Objet");
    fireEvent.change(screen.getByLabelText("Message personnel"), { target: { value: "Un mot" } });
    fireEvent.click(screen.getByRole("button", { name: "Actualiser l'aperçu" }));
    await waitFor(() => expect(apercuEmail).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "Revenir au texte d'origine" }));
    await waitFor(() => expect(apercuEmail).toHaveBeenCalledTimes(3));
    expect(apercuEmail).toHaveBeenLastCalledWith({});
    expect((screen.getByLabelText("Message personnel") as HTMLTextAreaElement).value).toBe("");
    expect((screen.getByLabelText("Objet") as HTMLInputElement).value).toBe(ORIGINE);
    await waitFor(() => expect(boutonEnvoi().disabled).toBe(false));
    fireEvent.click(boutonEnvoi());
    await waitFor(() => expect(envoyer).toHaveBeenCalledWith({ a: "client@example.test" }));
  });

  it("l'adresse reste en lecture seule", async () => {
    monter();
    await screen.findByLabelText("Objet");
    expect((screen.getByLabelText("À") as HTMLInputElement).readOnly).toBe(true);
  });

  it("aucun aperçu ni appel sans la prop (écran d'origine inchangé)", () => {
    render(<EmailEnvoi destinataire="x@example.test" envoyer={vi.fn()} />);
    expect(screen.queryByLabelText("Objet")).toBeNull();
    expect(screen.queryByTestId("apercu-email")).toBeNull();
  });
});
