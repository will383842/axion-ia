import { fireEvent, render, screen } from "@testing-library/react";
import { useReducer } from "react";
import { describe, expect, it } from "vitest";

import { controlerEtape, etatInitial, reducteur } from "../../../etat";
import type { EtatAssistant } from "../../../types";
import { BlocAvantages } from "../BlocAvantages";
import { CarteFormuleB } from "../CarteFormuleB";
import { EtapeFormules } from "../EtapeFormules";
import { ServicesExterieurs } from "../ServicesExterieurs";

const TVA = 20;
const init = etatInitial({ validiteParDefaut: "2026-12-08", formulesActives: true });
const base: EtatAssistant = {
  ...init,
  modele: "implementation",
  clientType: "entreprise",
  proposition: "AB",
  lignes: [
    { ...init.lignes[0]!, id: "a", libelle: "Assistant", prixEur: "2 400" },
    { ...init.lignes[0]!, id: "b", libelle: "Relance", prixEur: "1 800" },
  ],
  abonnement: { ...init.abonnement, miseEnServiceSaisie: "1 900" },
};
const AVANTAGES = ["Rien à installer", "Mises à jour incluses"];
const PLAFOND = "Texte du plafond de la bibliothèque.";

function Hote({
  initial = base,
  vue,
}: {
  initial?: EtatAssistant;
  vue?: "b" | "avantages" | "services" | "etape";
}) {
  const [e, dispatch] = useReducer(reducteur, initial);
  return (
    <>
      {vue === "b" ? (
        <CarteFormuleB etat={e} dispatch={dispatch} tvaStandardPct={TVA} />
      ) : vue === "avantages" ? (
        <BlocAvantages
          formule="B"
          etat={e}
          dispatch={dispatch}
          avantagesPossibles={AVANTAGES}
          aSavoirPossibles={[]}
        />
      ) : vue === "services" ? (
        <ServicesExterieurs etat={e} dispatch={dispatch} textePlafond={PLAFOND} />
      ) : (
        <EtapeFormules
          etape={2}
          etat={e}
          dispatch={dispatch}
          tvaStandardPct={TVA}
          avantagesPossibles={{ A: ["Propriétaire"], B: AVANTAGES }}
          aSavoirPossibles={{ A: [], B: [] }}
          textePlafond={PLAFOND}
        />
      )}
      <div data-testid="etat">{JSON.stringify(e)}</div>
    </>
  );
}
const etat = () => JSON.parse(screen.getByTestId("etat").textContent!) as EtatAssistant;
const nettoyer = (s: string) => s.replace(/[\s  ]/g, "");

describe("CarteFormuleB", () => {
  it("A + B : la mise en service est un champ saisi", () => {
    render(<Hote vue="b" />);
    const c = screen.getByLabelText(/Mise en service et adaptation \(HT\)/) as HTMLInputElement;
    expect(c.readOnly).toBe(false);
    fireEvent.change(c, { target: { value: "2 000" } });
    expect(etat().abonnement.miseEnServiceSaisie).toBe("2 000");
  });

  it("B seule : la mise en service est le total des lignes, en lecture, et dit que le montant saisi ne s'applique pas", () => {
    render(<Hote vue="b" initial={{ ...base, proposition: "B" }} />);
    const c = screen.getByLabelText(/Mise en service/) as HTMLInputElement;
    expect(c.readOnly).toBe(true);
    expect(nettoyer(c.value)).toBe("4200,00€");
    const msg = screen.getByRole("note").textContent!;
    expect(nettoyer(msg)).toContain("1900,00€");
    expect(nettoyer(msg)).toContain("4200,00€");
    expect(msg).toMatch(/ne s'applique pas/);
    // la saisie est gardée
    expect(etat().abonnement.miseEnServiceSaisie).toBe("1 900");
  });

  it("B seule sans montant saisi : aucun message de bascule", () => {
    render(
      <Hote
        vue="b"
        initial={{
          ...base,
          proposition: "B",
          abonnement: { ...base.abonnement, miseEnServiceSaisie: "" },
        }}
      />,
    );
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("mensuel, niveau et IA incluse s'écrivent dans l'état, sans montant d'IA", () => {
    render(<Hote vue="b" />);
    fireEvent.change(screen.getByLabelText(/Abonnement mensuel \(HT\)/), {
      target: { value: "199,99" },
    });
    expect(etat().abonnement.mensuelCatalogueEur).toBe("199,99");
    fireEvent.click(screen.getByRole("radio", { name: "Pro" }));
    expect(etat().ia.abonnement.niveau).toBe("pro");
    fireEvent.click(screen.getByRole("radio", { name: /Incluse dans l'abonnement/ }));
    expect(etat().ia.abonnement.mode).toBe("incluse");
    expect(JSON.stringify(etat().ia)).not.toMatch(/Eur|Cents|forfait/i);
  });

  it("un mensuel illisible est signalé, jamais ramené à 0", () => {
    render(<Hote vue="b" />);
    const c = screen.getByLabelText(/Abonnement mensuel \(HT\)/);
    fireEvent.change(c, { target: { value: "12 €" } });
    expect(c.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText(/illisible/)).toBeTruthy();
    expect(etat().abonnement.mensuelCatalogueEur).toBe("12 €");
  });
});

describe("BlocAvantages", () => {
  it("ne propose que les textes reçus en props, et les coche dans l'état", () => {
    render(<Hote vue="avantages" />);
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    fireEvent.click(screen.getByRole("checkbox", { name: "Rien à installer" }));
    expect(etat().avantages.B).toEqual(["Rien à installer"]);
    fireEvent.click(screen.getByRole("checkbox", { name: "Rien à installer" }));
    expect(etat().avantages.B).toEqual([]);
  });

  it("sans texte reçu, rien n'est inventé", () => {
    const { container } = render(
      <BlocAvantages
        formule="A"
        etat={base}
        dispatch={() => {}}
        avantagesPossibles={[]}
        aSavoirPossibles={[]}
      />,
    );
    expect(container.querySelectorAll("input")).toHaveLength(0);
  });
});

describe("ServicesExterieurs", () => {
  it("ajoute un service, le règle facultatif, puis le retire", () => {
    render(<Hote vue="services" />);
    fireEvent.click(screen.getByRole("button", { name: /Ajouter un service/ }));
    fireEvent.change(screen.getByLabelText(/Nom du service 1/), { target: { value: "Serveur" } });
    expect(etat().servicesTiers).toHaveLength(1);
    expect(etat().servicesTiers[0]).toMatchObject({ nom: "Serveur", obligatoire: true });
    fireEvent.click(screen.getByRole("radio", { name: /Facultatif/ }));
    expect(etat().servicesTiers[0]!.obligatoire).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: /Retirer le service 1/ }));
    expect(etat().servicesTiers).toEqual([]);
  });

  it("estimation vide : « selon l'offre du fournisseur » ; estimation saisie : en centimes", () => {
    render(<Hote vue="services" />);
    fireEvent.click(screen.getByRole("button", { name: /Ajouter un service/ }));
    expect(etat().servicesTiers[0]!.estimationHtCents).toBeNull();
    expect(screen.getByText(/selon l'offre du fournisseur/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Estimation du service 1/), {
      target: { value: "12,50" },
    });
    expect(etat().servicesTiers[0]!.estimationHtCents).toBe(1250);
    fireEvent.change(screen.getByLabelText(/Estimation du service 1/), {
      target: { value: "" },
    });
    expect(etat().servicesTiers[0]!.estimationHtCents).toBeNull();
  });

  it("une estimation illisible est refusée avec un message et n'écrase pas l'état", () => {
    render(<Hote vue="services" />);
    fireEvent.click(screen.getByRole("button", { name: /Ajouter un service/ }));
    fireEvent.change(screen.getByLabelText(/Estimation du service 1/), {
      target: { value: "12,505" },
    });
    expect(screen.getByRole("alert").textContent).toMatch(/illisible/);
    expect(etat().servicesTiers[0]!.estimationHtCents).toBeNull();
  });

  it("plafond : case à cocher, montant en centimes, texte de la bibliothèque", () => {
    render(<Hote vue="services" />);
    expect(etat().plafondAConfirmer).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: /plafond/i }));
    fireEvent.change(screen.getByLabelText(/Plafond \(HT\)/), { target: { value: "500" } });
    expect(etat().plafondAConfirmer).toEqual({ montantHtCents: 50000, texte: PLAFOND });
    fireEvent.click(screen.getByRole("checkbox", { name: /plafond/i }));
    expect(etat().plafondAConfirmer).toBeNull();
  });

  it("retirer un autre service : le champ restant affiche SON estimation, pas l'ancienne", () => {
    render(<Hote vue="services" />);
    const ajout = screen.getByRole("button", { name: /Ajouter un service/ });
    fireEvent.click(ajout);
    fireEvent.click(ajout);
    fireEvent.change(screen.getByLabelText(/Estimation du service 1/), {
      target: { value: "100" },
    });
    fireEvent.change(screen.getByLabelText(/Estimation du service 2/), {
      target: { value: "200" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Retirer le service 1/ }));
    expect(etat().servicesTiers[0]!.estimationHtCents).toBe(20000);
    expect((screen.getByLabelText(/Estimation du service 1/) as HTMLInputElement).value).toBe(
      "200",
    );
  });

  it("plafond vidé case cochée : l'ancienne valeur ne reste pas, l'erreur est visible et bloque l'étape", () => {
    render(<Hote vue="services" />);
    fireEvent.click(screen.getByRole("checkbox", { name: /plafond/i }));
    fireEvent.change(screen.getByLabelText(/Plafond \(HT\)/), { target: { value: "500" } });
    fireEvent.change(screen.getByLabelText(/Plafond \(HT\)/), { target: { value: "" } });
    expect(etat().plafondAConfirmer).toBeNull();
    const champ = screen.getByLabelText(/Plafond \(HT\)/);
    expect(champ.getAttribute("aria-invalid")).toBe("true");
    const id = champ.getAttribute("aria-describedby")!;
    expect(document.getElementById(id)!.textContent).toMatch(/Saisissez un montant/);
    expect(controlerEtape(etat(), 2).join(" ")).toMatch(/Plafond/);
  });

  it("plafond illisible (« 1.500 ») : plus d'ancienne valeur, erreur visible, étape refusée", () => {
    render(<Hote vue="services" />);
    fireEvent.click(screen.getByRole("checkbox", { name: /plafond/i }));
    fireEvent.change(screen.getByLabelText(/Plafond \(HT\)/), { target: { value: "500" } });
    fireEvent.change(screen.getByLabelText(/Plafond \(HT\)/), { target: { value: "1.500" } });
    expect(etat().plafondAConfirmer).toBeNull();
    expect(screen.getByRole("alert").textContent).toMatch(/illisible/);
    expect(controlerEtape(etat(), 2).join(" ")).toMatch(/Plafond/);
  });

  it("estimation illisible : l'étape 2 est refusée", () => {
    render(<Hote vue="services" />);
    fireEvent.click(screen.getByRole("button", { name: /Ajouter un service/ }));
    fireEvent.change(screen.getByLabelText(/Estimation du service 1/), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText(/Estimation du service 1/), {
      target: { value: "12,505" },
    });
    expect(etat().servicesTiers[0]!.estimationHtCents).toBeNull();
    expect(controlerEtape(etat(), 2).join(" ")).toMatch(/Service extérieur 1/);
  });
});

describe("EtapeFormules avec B", () => {
  it("les deux cartes, les avantages reçus en props et les services extérieurs s'affichent", () => {
    render(<Hote />);
    expect(screen.getByRole("region", { name: /Formule A/ })).toBeTruthy();
    expect(screen.getByRole("region", { name: /Formule B/ })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Rien à installer" })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Propriétaire" })).toBeTruthy();
    expect(screen.getByRole("region", { name: /Services extérieurs/ })).toBeTruthy();
  });

  it("A seule masque la carte B sans effacer ses données", () => {
    render(<Hote />);
    fireEvent.change(screen.getByLabelText(/Abonnement mensuel/), { target: { value: "390" } });
    const avant = etat().abonnement;
    fireEvent.click(screen.getByRole("radio", { name: /Formule A seule/ }));
    expect(screen.queryByRole("region", { name: /Formule B/ })).toBeNull();
    expect(etat().abonnement).toEqual(avant);
  });
});
