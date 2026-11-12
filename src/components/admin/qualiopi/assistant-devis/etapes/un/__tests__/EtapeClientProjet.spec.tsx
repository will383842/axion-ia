import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useReducer } from "react";
import { describe, expect, it, vi } from "vitest";

import { ApercuDirect } from "../../../ApercuDirect";
import { etatInitial, reducteur } from "../../../etat";
import type { EtatAssistant, LigneAssistant } from "../../../types";
import type { ClientOption } from "../BlocClient";
import { EtapeClientProjet } from "../EtapeClientProjet";

const L = (id: string, patch: Partial<LigneAssistant> = {}): LigneAssistant => ({
  id,
  type: "libre",
  libelle: "",
  quantite: "1",
  prixEur: "",
  delaiSemaines: "",
  necessite: [],
  champsLibres: [],
  offreCode: "",
  designationDepuisOffre: false,
  ...patch,
});
const base = etatInitial({ validiteParDefaut: "2026-12-08", formulesActives: true });
const avec = (p: Partial<EtatAssistant>): EtatAssistant => ({ ...base, ...p });

const CLIENTS: ClientOption[] = [
  {
    id: "c1",
    numero: "AXI-CLI-001",
    raisonSociale: "SCI Invest Sun",
    type: "entreprise",
    adresse: null,
    contactNom: null,
    email: null,
  },
];

/** Les mêmes 3 lignes que le cas T4 de l'architecte (par groupe de taux, pas ligne par ligne). */
const T4 = [
  L("a", { libelle: "A", prixEur: "10,03" }),
  L("b", { libelle: "B", prixEur: "10,03" }),
  L("c", { libelle: "C", prixEur: "10,03" }),
  L("d", { libelle: "D", quantite: "2,3", prixEur: "123,45" }),
];
const nbsp = (t: string) => t.replace(/[  ]/g, " ");

describe("ApercuDirect", () => {
  it("totaux HT / TVA / TTC avec le taux reçu (T4 : 314,02 · 62,80 · 376,82)", () => {
    render(<ApercuDirect etat={avec({ lignes: T4 })} tvaStandardPct={20} />);
    const t = nbsp(document.body.textContent ?? "");
    expect(t).toContain("314,02");
    expect(t).toContain("62,80");
    expect(t).toContain("376,82");
  });

  it("le taux vient du paramètre : à 10 %, la TVA change et le libellé aussi", () => {
    render(
      <ApercuDirect
        etat={avec({ lignes: [L("a", { libelle: "A", prixEur: "100" })] })}
        tvaStandardPct={10}
      />,
    );
    const t = nbsp(document.body.textContent ?? "");
    expect(t).toContain("TVA 10 %");
    expect(t).toContain("10,00");
    expect(t).toContain("110,00");
    expect(t).not.toContain("TVA 20 %");
  });

  it("aucune mention « montants d'exemple »", () => {
    render(<ApercuDirect etat={avec({ lignes: T4 })} tvaStandardPct={20} />);
    expect(document.body.textContent).not.toMatch(/exemple/i);
  });

  it("une saisie illisible n'est pas comptée et l'aperçu le dit", () => {
    render(
      <ApercuDirect
        etat={avec({
          lignes: [
            L("a", { libelle: "A", prixEur: "100" }),
            L("b", { libelle: "B", prixEur: "12 €" }),
          ],
        })}
        tvaStandardPct={20}
      />,
    );
    expect(screen.getByText(/illisibles?.*pas compt/i)).toBeTruthy();
    expect(nbsp(document.body.textContent ?? "")).toContain("100,00");
  });

  it("montre l'intitulé, le nom du client et le total de chaque ligne", () => {
    render(
      <ApercuDirect
        etat={avec({
          intitule: "Mon projet",
          lignes: [L("a", { libelle: "Ligne A", prixEur: "50" })],
        })}
        tvaStandardPct={20}
        clientNom="SCI Invest Sun"
      />,
    );
    const t = nbsp(document.body.textContent ?? "");
    for (const m of ["Mon projet", "SCI Invest Sun", "Ligne A", "50,00"]) expect(t).toContain(m);
  });

  it("le total est annoncé une seule fois, au départ d'un champ, pas à chaque frappe", () => {
    render(
      <>
        <input aria-label="champ" />
        <ApercuDirect etat={avec({ lignes: T4 })} tvaStandardPct={20} />
      </>,
    );
    const aside = screen.getByRole("complementary", { name: /aperçu en direct/i });
    // Aucun montant ne vit dans une zone live.
    expect(aside.querySelectorAll("[aria-live]")).toHaveLength(1);
    const live = aside.querySelector('[aria-live="polite"]')!;
    expect(live.textContent).toBe("");
    expect(within(live as HTMLElement).queryByText(/Total HT/)).toBeNull();
    const champ = screen.getByLabelText("champ");
    champ.focus();
    fireEvent.change(champ, { target: { value: "a" } });
    expect(live.textContent).toBe("");
    fireEvent.blur(champ);
    expect(nbsp(live.textContent ?? "")).toMatch(/Total TTC du devis : .*€/);
  });
});

function Hote({ initial, aide }: { initial: EtatAssistant; aide?: React.ReactNode }) {
  const [e, dispatch] = useReducer(reducteur, initial);
  return (
    <EtapeClientProjet
      etat={e}
      dispatch={dispatch}
      clients={CLIENTS}
      offres={[]}
      tvaStandardPct={20}
      lireBandeau={vi.fn(async () => null)}
      creerClient={vi.fn()}
      aide={aide}
    />
  );
}

describe("EtapeClientProjet", () => {
  it("assemble modèle, client, mots du client, lignes et aperçu", () => {
    render(<Hote initial={avec({})} />);
    expect(screen.getByRole("radiogroup", { name: /que vendez-vous/i })).toBeTruthy();
    expect(screen.getByLabelText(/^client/i)).toBeTruthy();
    expect(screen.getByLabelText(/ce que le client vous a dit/i)).toBeTruthy();
    expect(screen.getByRole("heading", { name: /contenu du devis/i })).toBeTruthy();
    expect(screen.getByRole("complementary", { name: /aperçu en direct/i })).toBeTruthy();
  });

  it("le panneau « aide » est rendu à côté", () => {
    render(<Hote initial={avec({})} aide={<p>Ce que le client a dit du projet</p>} />);
    expect(screen.getByText("Ce que le client a dit du projet")).toBeTruthy();
  });

  it("aucun champ n'est pré-rempli depuis le projet", () => {
    render(<Hote initial={avec({ origine: { projetId: "p1" } })} />);
    expect((screen.getByLabelText(/intitulé/i) as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText(/résultat visé/i) as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText(/libellé/i) as HTMLInputElement).value).toBe("");
  });

  it("saisir un prix met l'aperçu à jour", async () => {
    render(<Hote initial={avec({})} />);
    fireEvent.change(screen.getByLabelText(/prix/i), { target: { value: "1000" } });
    const aside = screen.getByRole("complementary", { name: /aperçu en direct/i });
    await waitFor(() => expect(nbsp(aside.textContent ?? "")).toContain("1 000,00"));
    expect(within(aside).getByText(/TVA 20 %/)).toBeTruthy();
  });

  it("un contact créé apparaît dans la liste et dans l'aperçu", async () => {
    const creerClient = vi.fn(async () => ({ data: { id: "n1", numero: "AXI-CLI-009" } }));
    function H() {
      const [e, dispatch] = useReducer(reducteur, avec({}));
      return (
        <EtapeClientProjet
          etat={e}
          dispatch={dispatch}
          clients={CLIENTS}
          offres={[]}
          tvaStandardPct={20}
          lireBandeau={async () => null}
          creerClient={creerClient}
        />
      );
    }
    render(<H />);
    fireEvent.click(screen.getByRole("button", { name: /nouveau contact/i }));
    fireEvent.change(screen.getByLabelText(/raison sociale/i), {
      target: { value: "Nouvelle SARL" },
    });
    fireEvent.click(screen.getByRole("button", { name: /créer le contact/i }));
    const aside = screen.getByRole("complementary", { name: /aperçu en direct/i });
    await waitFor(() => expect(aside.textContent).toContain("Nouvelle SARL"));
  });
});
