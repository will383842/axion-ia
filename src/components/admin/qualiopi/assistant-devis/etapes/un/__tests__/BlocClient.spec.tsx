import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { etatInitial } from "../../../etat";
import type { EtatAssistant } from "../../../types";
import { BlocClient, type ClientOption } from "../BlocClient";
import { ChoixModele } from "../ChoixModele";
import { NouveauContact } from "../NouveauContact";

const CLIENTS: ClientOption[] = [
  {
    id: "c1",
    numero: "AXI-CLI-001",
    raisonSociale: "SCI Invest Sun",
    type: "entreprise",
    adresse: "1 rue du Test, 69000 Lyon",
    contactNom: "Alice Test",
    email: "alice@example.test",
  },
  {
    id: "c2",
    numero: "AXI-CLI-002",
    raisonSociale: "Jean Particulier",
    type: "particulier",
    adresse: null,
    contactNom: null,
    email: null,
  },
];

const neuf = (patch: Partial<EtatAssistant> = {}): EtatAssistant => ({
  ...etatInitial({ validiteParDefaut: "2026-12-08", formulesActives: true }),
  ...patch,
});

describe("ChoixModele", () => {
  it("affiche les modèles en groupe radio et dispatche le choix", () => {
    const dispatch = vi.fn();
    render(<ChoixModele etat={neuf()} dispatch={dispatch} />);
    const groupe = screen.getByRole("radiogroup", { name: /que vendez-vous/i });
    expect(groupe).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    fireEvent.click(screen.getByRole("radio", { name: /mise en place d'une ia/i }));
    expect(dispatch).toHaveBeenCalledWith({ type: "modele", modele: "implementation" });
  });

  it("coche le modèle courant", () => {
    render(<ChoixModele etat={neuf({ modele: "audit" })} dispatch={() => {}} />);
    expect((screen.getByRole("radio", { name: /audit/i }) as HTMLInputElement).checked).toBe(true);
  });
});

describe("BlocClient", () => {
  const base = { clients: CLIENTS, lireBandeau: vi.fn(async () => null), creerClient: vi.fn() };

  it("choisir un client dispatche son id et son type lu sur la fiche", () => {
    const dispatch = vi.fn();
    render(<BlocClient {...base} etat={neuf()} dispatch={dispatch} />);
    fireEvent.change(screen.getByLabelText(/^client/i), { target: { value: "c2" } });
    expect(dispatch).toHaveBeenCalledWith({ type: "client", id: "c2", clientType: "particulier" });
  });

  it("encadré nominatif : raison sociale, adresse, contact, e-mail issus des props", () => {
    render(
      <BlocClient
        {...base}
        etat={neuf({ clientId: "c1", clientType: "entreprise" })}
        dispatch={() => {}}
      />,
    );
    const encadre = screen.getByRole("group", { name: /destinataire du devis/i });
    for (const t of [
      "SCI Invest Sun",
      "1 rue du Test, 69000 Lyon",
      "Alice Test",
      "alice@example.test",
    ]) {
      expect(encadre.textContent).toContain(t);
    }
    expect(screen.queryByText(/ne reçoit qu'un prix unique/i)).toBeNull();
  });

  it("Professionnel / Particulier est lu sur la fiche, pas cliquable", () => {
    render(
      <BlocClient
        {...base}
        etat={neuf({ clientId: "c1", clientType: "entreprise" })}
        dispatch={() => {}}
      />,
    );
    expect(screen.getByText("Professionnel")).toBeTruthy();
    expect(screen.queryByRole("radio", { name: /particulier/i })).toBeNull();
  });

  it("client particulier : note « prix unique », sans promesse de clause de rétractation", () => {
    render(
      <BlocClient
        {...base}
        etat={neuf({ clientId: "c2", clientType: "particulier", modele: "implementation" })}
        dispatch={() => {}}
      />,
    );
    expect(screen.getByText("Particulier")).toBeTruthy();
    expect(screen.getByRole("note").textContent).toMatch(/prix unique/i);
    expect(document.body.textContent).not.toMatch(/rétractation ajoutée/i);
  });

  it("particulier avec l'interrupteur des formules éteint : la note est celle du particulier", () => {
    render(
      <BlocClient
        {...base}
        etat={neuf({
          clientId: "c2",
          clientType: "particulier",
          modele: "implementation",
          formulesActives: false,
        })}
        dispatch={() => {}}
      />,
    );
    expect(screen.getByRole("note").textContent).toMatch(/particulier/i);
    expect(screen.getByRole("note").textContent).not.toMatch(/activés/i);
  });

  it("bandeau Partners : affiché pour le client courant, jamais celui d'un autre", async () => {
    const lireBandeau = vi.fn(async (id: string) => (id === "c1" ? "Texte Partners" : null));
    const { rerender } = render(
      <BlocClient
        {...base}
        lireBandeau={lireBandeau}
        etat={neuf({ clientId: "c1", clientType: "entreprise" })}
        dispatch={() => {}}
      />,
    );
    await waitFor(() => expect(screen.getByText("Texte Partners")).toBeTruthy());
    rerender(
      <BlocClient
        {...base}
        lireBandeau={lireBandeau}
        etat={neuf({ clientId: "c2", clientType: "particulier" })}
        dispatch={() => {}}
      />,
    );
    expect(screen.queryByText("Texte Partners")).toBeNull();
    expect(lireBandeau).toHaveBeenCalledWith("c2");
  });

  it("un échec de lecture du bandeau n'affiche rien et ne bloque pas", async () => {
    const lireBandeau = vi.fn(async () => {
      throw new Error("panne");
    });
    render(
      <BlocClient
        {...base}
        lireBandeau={lireBandeau}
        etat={neuf({ clientId: "c1", clientType: "entreprise" })}
        dispatch={() => {}}
      />,
    );
    await waitFor(() => expect(lireBandeau).toHaveBeenCalled());
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("intitulé et validité dispatchent un patch de champs", () => {
    const dispatch = vi.fn();
    render(<BlocClient {...base} etat={neuf()} dispatch={dispatch} />);
    fireEvent.change(screen.getByLabelText(/intitulé/i), { target: { value: "Assistant mails" } });
    expect(dispatch).toHaveBeenCalledWith({
      type: "champs",
      patch: { intitule: "Assistant mails" },
    });
    fireEvent.change(screen.getByLabelText(/valable jusqu/i), { target: { value: "2026-12-20" } });
    expect(dispatch).toHaveBeenCalledWith({ type: "champs", patch: { validite: "2026-12-20" } });
  });

  it("validité hors J+7..J+90 : message, bornes posées sur le champ", () => {
    render(
      <BlocClient
        {...base}
        aujourdhui="2026-11-08"
        etat={neuf({ validite: "2026-11-10" })}
        dispatch={() => {}}
      />,
    );
    const champ = screen.getByLabelText(/valable jusqu/i) as HTMLInputElement;
    expect(champ.min).toBe("2026-11-15");
    expect(champ.max).toBe("2027-02-06");
    expect(champ.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").textContent).toMatch(/7 et 90 jours/);
  });

  it("« + Nouveau contact » crée le client puis le sélectionne", async () => {
    const dispatch = vi.fn();
    const creerClient = vi.fn(async () => ({ data: { id: "c9", numero: "AXI-CLI-009" } }));
    render(<BlocClient {...base} creerClient={creerClient} etat={neuf()} dispatch={dispatch} />);
    fireEvent.click(screen.getByRole("button", { name: /nouveau contact/i }));
    fireEvent.change(screen.getByLabelText(/raison sociale/i), {
      target: { value: "Nouvelle SARL" },
    });
    fireEvent.change(screen.getByLabelText(/nom du contact/i), { target: { value: "Bob" } });
    fireEvent.change(screen.getByLabelText(/e-mail du contact/i), {
      target: { value: "bob@example.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: /créer le contact/i }));
    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith({ type: "client", id: "c9", clientType: "entreprise" }),
    );
    expect(creerClient).toHaveBeenCalledWith({
      type: "entreprise",
      raisonSociale: "Nouvelle SARL",
      contactNom: "Bob",
      contactEmail: "bob@example.test",
    });
    expect(screen.getByRole("option", { name: /Nouvelle SARL/ })).toBeTruthy();
  });
});

describe("NouveauContact", () => {
  it("raison sociale vide : refus local, aucun appel", () => {
    const creer = vi.fn();
    render(<NouveauContact creerClient={creer} onCree={() => {}} onAnnuler={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /créer le contact/i }));
    expect(creer).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/raison sociale/i);
  });

  it("erreur du serveur affichée telle quelle, aucun client ajouté", async () => {
    const onCree = vi.fn();
    const creer = vi.fn(async () => ({ error: "Même SIREN : fiche existante." }));
    render(<NouveauContact creerClient={creer} onCree={onCree} onAnnuler={() => {}} />);
    fireEvent.change(screen.getByLabelText(/raison sociale/i), { target: { value: "X" } });
    fireEvent.click(screen.getByRole("button", { name: /créer le contact/i }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Même SIREN"));
    expect(onCree).not.toHaveBeenCalled();
  });

  it("double clic : un seul appel", async () => {
    let fin: (v: { data: { id: string; numero: string } }) => void = () => {};
    const creer = vi.fn(
      () => new Promise<{ data: { id: string; numero: string } }>((r) => (fin = r)),
    );
    render(<NouveauContact creerClient={creer} onCree={() => {}} onAnnuler={() => {}} />);
    fireEvent.change(screen.getByLabelText(/raison sociale/i), { target: { value: "X" } });
    const b = screen.getByRole("button", { name: /créer le contact/i });
    fireEvent.click(b);
    fireEvent.click(b);
    expect(creer).toHaveBeenCalledTimes(1);
    fin({ data: { id: "n", numero: "N" } });
  });
});
