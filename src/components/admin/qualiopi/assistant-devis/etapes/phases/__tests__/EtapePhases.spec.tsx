import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useReducer } from "react";
import { describe, expect, it } from "vitest";

import { etatInitial, reducteur } from "../../../etat";
import type { EtatAssistant, LigneAssistant } from "../../../types";
import { BlocMaintenance } from "../BlocMaintenance";
import { EtapePhases } from "../EtapePhases";

const L = (id: string, patch: Partial<LigneAssistant> = {}): LigneAssistant => ({
  id,
  type: "libre",
  libelle: id,
  quantite: "1",
  prixEur: "10",
  delaiSemaines: "",
  necessite: [],
  champsLibres: [],
  offreCode: "",
  designationDepuisOffre: false,
  ...patch,
});
const base = etatInitial({ validiteParDefaut: "2026-12-08", formulesActives: true });

const TEXTE_DELAIS = "Texte de la bibliothèque sur les délais.";
const PHRASE_GARANTIE = "Phrase de garantie de la bibliothèque.";

function Hote({
  initial = base,
  avecChangement = false,
}: {
  initial?: EtatAssistant;
  avecChangement?: boolean;
}) {
  const [e, dispatch] = useReducer(reducteur, initial);
  return (
    <>
      <EtapePhases
        etape="1b"
        etat={e}
        dispatch={dispatch}
        texteDelais={TEXTE_DELAIS}
        phraseGarantie={PHRASE_GARANTIE}
      />
      {avecChangement ? (
        <button
          type="button"
          onClick={() =>
            dispatch({ type: "ligne_modifier", id: "a", patch: { delaiSemaines: "4" } })
          }
        >
          changer-delai
        </button>
      ) : null}
      {avecChangement ? (
        <button
          type="button"
          onClick={() =>
            dispatch({ type: "ligne_modifier", id: "a", patch: { delaiSemaines: "" } })
          }
        >
          vider-delai
        </button>
      ) : null}
      <div data-testid="etat">{JSON.stringify(e)}</div>
    </>
  );
}
const etat = () => JSON.parse(screen.getByTestId("etat").textContent!) as EtatAssistant;

describe("EtapePhases", () => {
  it("assemble l'éditeur de phases, les délais, la maintenance et la garantie", () => {
    render(<Hote />);
    expect(screen.getByRole("button", { name: /complet \(6 phases\)/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /délais estimatifs, pas garantis/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /la maintenance/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /notre garantie/i })).toBeTruthy();
  });

  it("modifier un modèle de phases met l'état de la formule A à jour", () => {
    render(<Hote />);
    fireEvent.click(screen.getByRole("button", { name: /court \(3 phases\)/i }));
    expect(etat().achat.phases.map((p) => p.pourcentage)).toEqual(["30", "40", "30"]);
  });

  it("la phrase des délais vient de la bibliothèque, est modifiable, et on peut y revenir", async () => {
    render(<Hote />);
    const champ = screen.getByLabelText(
      /phrase affichée sur le devis pour les délais/i,
    ) as HTMLTextAreaElement;
    await waitFor(() => expect(champ.value).toBe(TEXTE_DELAIS));
    fireEvent.change(champ, { target: { value: "Ma version" } });
    expect(etat().delais.texte).toBe("Ma version");
    fireEvent.click(screen.getByRole("button", { name: /revenir au texte d'origine/i }));
    expect(etat().delais.texte).toBe(TEXTE_DELAIS);
  });

  it("un texte déjà écrit n'est jamais remplacé par celui de la bibliothèque", async () => {
    render(<Hote initial={{ ...base, delais: { texte: "Déjà écrit", fourchette: "" } }} />);
    await waitFor(() => expect(screen.getByTestId("etat")).toBeTruthy());
    expect(etat().delais.texte).toBe("Déjà écrit");
  });

  it("une phrase des délais vidée (Ctrl+A puis effacement) reste vide, mais on peut y revenir", async () => {
    render(<Hote />);
    const champ = screen.getByLabelText(
      /phrase affichée sur le devis pour les délais/i,
    ) as HTMLTextAreaElement;
    await waitFor(() => expect(champ.value).toBe(TEXTE_DELAIS));
    fireEvent.change(champ, { target: { value: "" } });
    await waitFor(() => expect(screen.getByTestId("etat")).toBeTruthy());
    expect(champ.value).toBe("");
    expect(etat().delais.texte).toBe("");
    fireEvent.click(screen.getByRole("button", { name: /revenir au texte d'origine/i }));
    expect(etat().delais.texte).toBe(TEXTE_DELAIS);
  });

  it("un brouillon rouvert avec une phrase vidée ne la remplit pas", async () => {
    render(
      <Hote
        initial={{
          ...base,
          delais: { texte: "", fourchette: "", touche: true },
          garantie: { afficher: true, jours: "", phrase: "", touche: true },
        }}
      />,
    );
    await waitFor(() => expect(screen.getByTestId("etat")).toBeTruthy());
    expect(etat().delais.texte).toBe("");
    expect(etat().garantie.phrase).toBe("");
  });

  it("garantie : phrase vidée reste vide, et le bouton la rétablit", async () => {
    render(<Hote />);
    const champ = screen.getByLabelText(/phrase de garantie affichée/i) as HTMLTextAreaElement;
    await waitFor(() => expect(champ.value).toBe(PHRASE_GARANTIE));
    fireEvent.change(champ, { target: { value: "" } });
    expect(champ.value).toBe("");
    expect(etat().garantie.phrase).toBe("");
    fireEvent.click(screen.getByRole("button", { name: /revenir à la phrase d'origine/i }));
    expect(etat().garantie.phrase).toBe(PHRASE_GARANTIE);
  });

  it("fourchette cochée : vider les délais ne la décoche pas en silence, un message le dit", async () => {
    render(<Hote initial={{ ...base, lignes: [L("a", { delaiSemaines: "2" })] }} avecChangement />);
    fireEvent.click(screen.getByLabelText(/afficher une fourchette/i));
    expect(etat().delais.fourchette).toBe("2 semaines");
    fireEvent.click(screen.getByRole("button", { name: "vider-delai" }));
    await waitFor(() => expect(screen.getByTestId("etat")).toBeTruthy());
    expect(etat().delais.fourchette).toBe("2 semaines");
    expect((screen.getByLabelText(/afficher une fourchette/i) as HTMLInputElement).checked).toBe(
      true,
    );
    expect(screen.getByText(/conservée telle quelle/i)).toBeTruthy();
  });

  it("fourchette : cochée, elle vient des délais des lignes (chemin le plus long → tout à la suite)", () => {
    const lignes = [
      L("a", { delaiSemaines: "2" }),
      L("b", { delaiSemaines: "3", necessite: ["a"] }),
      L("c", { delaiSemaines: "1" }),
    ];
    render(<Hote initial={{ ...base, lignes }} />);
    fireEvent.click(screen.getByLabelText(/afficher une fourchette/i));
    expect(etat().delais.fourchette).toBe("5 à 6 semaines");
    fireEvent.click(screen.getByLabelText(/afficher une fourchette/i));
    expect(etat().delais.fourchette).toBe("");
  });

  it("fourchette : suit les lignes quand on les modifie après l'avoir cochée", async () => {
    render(<Hote initial={{ ...base, lignes: [L("a", { delaiSemaines: "2" })] }} avecChangement />);
    fireEvent.click(screen.getByLabelText(/afficher une fourchette/i));
    expect(etat().delais.fourchette).toBe("2 semaines");
    fireEvent.click(screen.getByRole("button", { name: "changer-delai" }));
    await waitFor(() => expect(etat().delais.fourchette).toBe("4 semaines"));
  });

  it("fourchette impossible sans aucun délai de ligne : case désactivée avec sa raison", () => {
    render(<Hote />);
    const c = screen.getByLabelText(/afficher une fourchette/i) as HTMLInputElement;
    expect(c.disabled).toBe(true);
    expect(document.getElementById(c.getAttribute("aria-describedby")!)!.textContent).toMatch(
      /délai/i,
    );
  });

  it("total des semaines des phases annoncé", () => {
    const phases = [
      {
        id: "p1",
        libelle: "A",
        pourcentage: "50",
        declencheur: "signature" as const,
        livrable: "",
        delaiSemaines: "2",
      },
      {
        id: "p2",
        libelle: "B",
        pourcentage: "50",
        declencheur: "livraison" as const,
        livrable: "",
        delaiSemaines: "3",
      },
    ];
    render(<Hote initial={{ ...base, achat: { ...base.achat, phases } }} />);
    expect(screen.getByText(/5 semaines/)).toBeTruthy();
  });

  it("garantie décochée : les champs disparaissent mais la saisie est gardée", () => {
    render(
      <Hote
        initial={{ ...base, garantie: { afficher: true, jours: "30", phrase: "Ma phrase" } }}
      />,
    );
    fireEvent.click(screen.getByLabelText(/afficher la garantie sur le devis/i));
    expect(etat().garantie.afficher).toBe(false);
    expect(screen.queryByLabelText(/durée \(jours/i)).toBeNull();
    expect(etat().garantie.jours).toBe("30");
    fireEvent.click(screen.getByLabelText(/afficher la garantie sur le devis/i));
    expect((screen.getByLabelText(/durée \(jours/i) as HTMLInputElement).value).toBe("30");
  });

  it("garantie : durée en chiffres seulement, phrase de la bibliothèque proposée", async () => {
    render(<Hote />);
    fireEvent.change(screen.getByLabelText(/durée \(jours/i), { target: { value: "30x" } });
    expect(etat().garantie.jours).toBe("");
    fireEvent.change(screen.getByLabelText(/durée \(jours/i), { target: { value: "45" } });
    expect(etat().garantie.jours).toBe("45");
    await waitFor(() => expect(etat().garantie.phrase).toBe(PHRASE_GARANTIE));
  });

  it("la maintenance saisie en 1b est la MÊME que celle de la carte A (un seul état)", () => {
    function Deux() {
      const [e, dispatch] = useReducer(reducteur, base);
      return (
        <>
          <section aria-label="en 1b">
            <BlocMaintenance etat={e} dispatch={dispatch} />
          </section>
          <section aria-label="carte A">
            <BlocMaintenance etat={e} dispatch={dispatch} />
          </section>
        </>
      );
    }
    render(<Deux />);
    const [en1b, carteA] = screen.getAllByLabelText(/puis \(ht par mois\)/i) as HTMLInputElement[];
    fireEvent.change(en1b!, { target: { value: "190" } });
    expect(carteA!.value).toBe("190");
  });
});

describe("BlocMaintenance", () => {
  it("obligatoire / facultative en vrais boutons radio", () => {
    render(<Hote />);
    fireEvent.click(screen.getByRole("radio", { name: /obligatoire/i }));
    expect(etat().achat.maintenance.regle).toBe("obligatoire");
    fireEvent.click(screen.getByRole("radio", { name: /facultative/i }));
    expect(etat().achat.maintenance.regle).toBe("facultative");
  });

  it("montant illisible : message, valeur gardée ; aucun champ « mois offerts » (le moteur n'en a pas)", () => {
    render(
      <Hote
        initial={{
          ...base,
          achat: { ...base.achat, maintenance: { ...base.achat.maintenance, mensuelEur: "19O" } },
        }}
      />,
    );
    const c = screen.getByLabelText(/puis \(ht par mois\)/i);
    expect(c.getAttribute("aria-invalid")).toBe("true");
    expect((c as HTMLInputElement).value).toBe("19O");
    expect(document.body.textContent).not.toMatch(/mois offerts/i);
  });

  it("durée minimale : texte libre du brouillon", () => {
    render(<Hote />);
    fireEvent.change(screen.getByLabelText(/durée minimale/i), { target: { value: "12 mois" } });
    expect(etat().achat.maintenance.dureeMinimale).toBe("12 mois");
  });
});
