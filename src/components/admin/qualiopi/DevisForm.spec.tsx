/**
 * DevisForm — champ « Conditions particulières » (devis classique) : création et édition.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({
  creer: vi.fn(),
  modifier: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: m.push, refresh: vi.fn() }) }));
vi.mock("@/server/actions/qualiopi/devis", () => ({
  createDevisAction: (...a: unknown[]) => m.creer(...a),
  lireBandeauAttributionAction: async () => null,
}));
vi.mock("@/server/actions/qualiopi/devis-formules", () => ({ creerDevisFormulesAction: vi.fn() }));
vi.mock("@/server/actions/qualiopi/devis-classique-modifier", () => ({
  modifierDevisClassiqueBrouillonAction: (...a: unknown[]) => m.modifier(...a),
}));

import { DevisForm, type DevisFormProps } from "./DevisForm";

const CLIENT = "550e8400-e29b-41d4-a716-446655440001";
const DEVIS = "550e8400-e29b-41d4-a716-446655440002";

const props = (extra: Partial<DevisFormProps> = {}): DevisFormProps => ({
  clients: [{ id: CLIENT, numero: "CLI-1", raisonSociale: "Acme" }],
  offres: [],
  basePath: "/fr/adm/qualiopi/devis",
  activites: [{ value: "formation", label: "Formation" }],
  defaultClientId: CLIENT,
  ...extra,
});

const edition = (cp: string | null) => ({
  devisId: DEVIS,
  attenduMajLe: "2026-11-08T10:00:00.000Z",
  lignes: [
    {
      designation: "Atelier IA",
      quantite: "1",
      prixUnitaireHtCents: "280000",
      offreTierId: "",
      offreCode: "",
      designationDepuisOffre: false,
    },
  ],
  activite: null,
  refClient: null,
  conditionsParticulieres: cp,
});

beforeEach(() => {
  m.creer.mockResolvedValue({ data: { id: DEVIS, numero: "AXI-DEV-2026-001" } });
  m.modifier.mockResolvedValue({ data: { id: DEVIS, majLe: "x" } });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const champ = () => screen.getByLabelText(/Conditions particulières/) as HTMLTextAreaElement;

async function remplirLigneCreation() {
  await userEvent.type(screen.getByLabelText(/Désignation/i), "Atelier IA");
  const q = screen.getByLabelText(/Qté/i);
  await userEvent.clear(q);
  await userEvent.type(q, "1");
  await userEvent.type(screen.getByLabelText(/PU HT/i), "2800");
}

describe("création", () => {
  it("le champ existe : textarea limité à 4000, aide et compteur", () => {
    render(<DevisForm {...props()} />);
    expect(champ().tagName).toBe("TEXTAREA");
    expect(champ().maxLength).toBe(4000);
    expect(
      screen.getByText(
        "Texte simple, imprimé tel quel sur le devis, au-dessus du renvoi aux conditions générales.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("0 / 4000")).toBeTruthy();
  });

  it("le compteur suit la saisie", () => {
    render(<DevisForm {...props()} />);
    fireEvent.change(champ(), { target: { value: "Paiement à 30 jours." } });
    expect(screen.getByText("20 / 4000")).toBeTruthy();
  });

  it("le texte est envoyé à createDevisAction", async () => {
    render(<DevisForm {...props()} />);
    await remplirLigneCreation();
    fireEvent.change(champ(), { target: { value: "Paiement à 30 jours." } });
    await userEvent.click(screen.getByRole("button", { name: "Créer le devis" }));
    await waitFor(() => expect(m.creer).toHaveBeenCalled());
    expect(m.creer.mock.calls[0]?.[0].conditionsParticulieres).toBe("Paiement à 30 jours.");
  });

  it("sans texte : la clé n'est pas envoyée (création inchangée)", async () => {
    render(<DevisForm {...props()} />);
    await remplirLigneCreation();
    await userEvent.click(screen.getByRole("button", { name: "Créer le devis" }));
    await waitFor(() => expect(m.creer).toHaveBeenCalled());
    expect("conditionsParticulieres" in m.creer.mock.calls[0]![0]).toBe(false);
    expect(m.modifier).not.toHaveBeenCalled();
  });

  it("mot sensible : avertissement NON bloquant, l'envoi part quand même", async () => {
    render(<DevisForm {...props()} />);
    await remplirLigneCreation();
    fireEvent.change(champ(), { target: { value: "Notre Certification est en cours." } });
    expect(
      screen.getByText(
        "Ce texte contient « certification » : ce mot ne doit pas figurer sur un devis pour le moment.",
      ),
    ).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Créer le devis" }));
    await waitFor(() => expect(m.creer).toHaveBeenCalled());
  });

  it("plus de 80 lignes : message affiché, rien n'est envoyé", async () => {
    render(<DevisForm {...props()} />);
    await remplirLigneCreation();
    const lignes = (n: number) => Array.from({ length: n }, (_, i) => `l${i}`).join("\n");
    fireEvent.change(champ(), { target: { value: lignes(81) } });
    await userEvent.click(screen.getByRole("button", { name: "Créer le devis" }));
    expect(
      await screen.findByText("Les conditions particulières ne peuvent pas dépasser 80 lignes."),
    ).toBeTruthy();
    expect(m.creer).not.toHaveBeenCalled();
  });

  it("80 lignes : accepté", async () => {
    render(<DevisForm {...props()} />);
    await remplirLigneCreation();
    const lignes = Array.from({ length: 80 }, (_, i) => `l${i}`).join("\n");
    fireEvent.change(champ(), { target: { value: lignes } });
    await userEvent.click(screen.getByRole("button", { name: "Créer le devis" }));
    await waitFor(() => expect(m.creer).toHaveBeenCalled());
  });

  it("le contrôle porte sur le texte normalisé (CRLF et sauts multiples)", async () => {
    render(<DevisForm {...props()} />);
    await remplirLigneCreation();
    const brut = Array.from({ length: 30 }, () => "x").join("\r\n\r\n\r\n\r\n\r\n");
    fireEvent.change(champ(), { target: { value: brut } });
    await userEvent.click(screen.getByRole("button", { name: "Créer le devis" }));
    await waitFor(() => expect(m.creer).toHaveBeenCalled());
  });

  it("texte neutre : aucun avertissement", () => {
    render(<DevisForm {...props()} />);
    fireEvent.change(champ(), { target: { value: "Paiement à 30 jours." } });
    expect(screen.queryByText(/ce mot ne doit pas figurer/)).toBeNull();
  });

  it("mode formules : le champ n'est pas proposé", async () => {
    render(<DevisForm {...props({ formules: { textes: [], tvaStandardPct: 20 } })} />);
    await userEvent.click(screen.getByLabelText(/Devis à formules/));
    expect(screen.queryByLabelText(/Conditions particulières/)).toBeNull();
  });
});

describe("édition", () => {
  it("pré-rempli depuis le devis", () => {
    render(<DevisForm {...props({ edition: edition("Acompte de 30 %.") })} />);
    expect(champ().value).toBe("Acompte de 30 %.");
  });

  it("enregistrer sans rien toucher : même texte renvoyé, jamais de financement ni d'estimation", async () => {
    render(<DevisForm {...props({ edition: edition("Acompte de 30 %.") })} />);
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer le brouillon" }));
    await waitFor(() => expect(m.modifier).toHaveBeenCalled());
    const input = m.modifier.mock.calls[0]![0].input;
    expect(input.conditionsParticulieres).toBe("Acompte de 30 %.");
    for (const cle of [
      "financementSuggere",
      "montantOpcoEstimeCents",
      "opcoEstimationOrigine",
      "opcoEstimationAvertissement",
      "resteAChargeCents",
      "nbParticipants",
      "modaliteOpco",
    ]) {
      expect(cle in input, cle).toBe(false);
    }
    expect(m.creer).not.toHaveBeenCalled();
  });

  it("texte vidé : la clé est envoyée à null (efface)", async () => {
    render(<DevisForm {...props({ edition: edition("Acompte de 30 %.") })} />);
    fireEvent.change(champ(), { target: { value: "" } });
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer le brouillon" }));
    await waitFor(() => expect(m.modifier).toHaveBeenCalled());
    const input = m.modifier.mock.calls[0]![0].input;
    expect("conditionsParticulieres" in input).toBe(true);
    expect(input.conditionsParticulieres).toBeNull();
  });

  it("devis sans texte : la clé est envoyée à null (toujours présente en édition)", async () => {
    render(<DevisForm {...props({ edition: edition(null) })} />);
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer le brouillon" }));
    await waitFor(() => expect(m.modifier).toHaveBeenCalled());
    expect(m.modifier.mock.calls[0]![0].input.conditionsParticulieres).toBeNull();
  });
});
