import { fireEvent, render, screen } from "@testing-library/react";
import { useReducer } from "react";
import { describe, expect, it } from "vitest";

import { etatInitial, reducteur } from "../../../etat";
import type { EtatAssistant } from "../../../types";
import { CarteFormuleA } from "../CarteFormuleA";
import { ChoixFormules } from "../ChoixFormules";
import { EtapeFormules } from "../EtapeFormules";

const TVA = 20;
const base: EtatAssistant = {
  ...etatInitial({ validiteParDefaut: "2026-12-08", formulesActives: true }),
  modele: "implementation",
  clientType: "entreprise",
  lignes: [
    {
      ...etatInitial({ validiteParDefaut: "x", formulesActives: true }).lignes[0]!,
      id: "a",
      libelle: "Assistant",
      quantite: "1",
      prixEur: "2 400",
    },
    {
      ...etatInitial({ validiteParDefaut: "x", formulesActives: true }).lignes[0]!,
      id: "b",
      libelle: "Formation",
      quantite: "2,3",
      prixEur: "123,45",
    },
  ],
};

function Hote({ initial = base, seul }: { initial?: EtatAssistant; seul?: "choix" | "carte" }) {
  const [e, dispatch] = useReducer(reducteur, initial);
  return (
    <>
      {seul === "choix" ? (
        <ChoixFormules etat={e} dispatch={dispatch} />
      ) : seul === "carte" ? (
        <CarteFormuleA etat={e} dispatch={dispatch} tvaStandardPct={TVA} />
      ) : (
        <EtapeFormules
          etape={2}
          etat={e}
          dispatch={dispatch}
          tvaStandardPct={TVA}
          avantagesPossibles={{ A: [], B: [] }}
          aSavoirPossibles={{ A: [], B: [] }}
          textePlafond="Texte"
        />
      )}
      <div data-testid="etat">{JSON.stringify(e)}</div>
    </>
  );
}
const etat = () => JSON.parse(screen.getByTestId("etat").textContent!) as EtatAssistant;

describe("ChoixFormules", () => {
  it("propose quatre choix exclusifs, dans un fieldset", () => {
    render(<Hote seul="choix" />);
    expect(screen.getByRole("group", { name: /Que proposez-vous au client/ })).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(4);
  });

  it("choisir A, B, les deux ou le prix unique écrit la proposition", () => {
    render(<Hote seul="choix" />);
    fireEvent.click(screen.getByRole("radio", { name: /Formule B seule/ }));
    expect(etat().proposition).toBe("B");
    fireEvent.click(screen.getByRole("radio", { name: /Les deux/ }));
    expect(etat().proposition).toBe("AB");
    fireEvent.click(screen.getByRole("radio", { name: /Formule A seule/ }));
    expect(etat().proposition).toBe("A");
    fireEvent.click(screen.getByRole("radio", { name: /Prix unique/ }));
    expect(etat().proposition).toBe("prix_unique");
  });

  it("particulier : les formules sont grisées et la raison est lue par aria-describedby", () => {
    render(<Hote seul="choix" initial={{ ...base, clientType: "particulier" }} />);
    const a = screen.getByRole("radio", { name: /Formule A seule/ }) as HTMLInputElement;
    expect(a.disabled).toBe(true);
    const id = a.getAttribute("aria-describedby")!;
    expect(document.getElementById(id)!.textContent).toMatch(/particulier/);
    expect((screen.getByRole("radio", { name: /Prix unique/ }) as HTMLInputElement).checked).toBe(
      true,
    );
  });

  it("formules éteintes : même grisage, avec sa raison", () => {
    render(<Hote seul="choix" initial={{ ...base, formulesActives: false }} />);
    const b = screen.getByRole("radio", { name: /Formule B seule/ }) as HTMLInputElement;
    expect(b.disabled).toBe(true);
    expect(document.getElementById(b.getAttribute("aria-describedby")!)!.textContent).toMatch(
      /pas activés/,
    );
  });
});

describe("EtapeFormules / carte A", () => {
  it("A seule affiche la carte A ; B seule la masque sans effacer ses données", () => {
    render(<Hote initial={{ ...base, proposition: "A" }} />);
    fireEvent.change(screen.getByLabelText(/Puis \(HT par mois\)/), {
      target: { value: "190" },
    });
    const avant = etat().achat;
    expect(screen.getByRole("region", { name: /Formule A/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /Formule B seule/ }));
    expect(screen.queryByRole("region", { name: /Formule A/ })).toBeNull();
    expect(etat().achat).toEqual(avant);
    fireEvent.click(screen.getByRole("radio", { name: /Formule A seule/ }));
    expect(screen.getByRole("region", { name: /Formule A/ })).toBeTruthy();
  });

  it("le prix de la mise en place est le total HT des lignes, en lecture seule", () => {
    render(<Hote seul="carte" />);
    const champ = screen.getByLabelText(/Prix de la mise en place/) as HTMLInputElement;
    expect(champ.readOnly).toBe(true);
    // 240 000 + round(2,3 × 12 345 = 28 393,5) -> 28 393 (cas T1 : pas 28 394)
    expect(champ.value.replace(/[\s  ]/g, "")).toBe("2683,93€");
  });

  it("hébergement chez Axion-IA : le mensuel est demandé, sans « mois offerts »", () => {
    render(<Hote seul="carte" />);
    expect(screen.queryByLabelText(/Hébergement \(HT par mois\)/)).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: /serveur d'Axion-IA/ }));
    const champ = screen.getByLabelText(/Hébergement \(HT par mois\)/) as HTMLInputElement;
    expect(champ.required).toBe(true);
    fireEvent.change(champ, { target: { value: "49" } });
    expect(etat().achat.hebergement).toBe("axion");
    expect(etat().achat.hebergementMensuelEur).toBe("49");
    expect(screen.queryByText(/Mois offerts/i)).toBeNull();
  });

  it("hébergement Axion-IA laissé vide : un message est relié au champ", () => {
    render(<Hote seul="carte" />);
    fireEvent.click(screen.getByRole("radio", { name: /serveur d'Axion-IA/ }));
    const champ = screen.getByLabelText(/Hébergement \(HT par mois\)/);
    expect(champ.getAttribute("aria-invalid")).toBe("true");
    const id = champ.getAttribute("aria-describedby");
    expect(id).toBeTruthy();
    expect(document.getElementById(id!)!.textContent).toMatch(/Saisissez/);
  });

  it("le forfait IA via Axion-IA est grisé avec sa raison, aucun champ de montant d'IA", () => {
    render(<Hote seul="carte" />);
    const r = screen.getByRole("radio", {
      name: /Via Axion-IA : forfait mensuel/,
    }) as HTMLInputElement;
    expect(r.disabled).toBe(true);
    expect(document.getElementById(r.getAttribute("aria-describedby")!)!.textContent).toMatch(
      /forfait IA n'a pas encore de place sur le devis/,
    );
    expect(screen.queryByLabelText(/Forfait \(HT par mois\)/)).toBeNull();
  });

  it("l'utilisation de l'IA est un choix : compte du client ou incluse N mois", () => {
    render(<Hote seul="carte" />);
    fireEvent.click(screen.getByRole("radio", { name: /Incluse pendant/ }));
    expect(etat().ia.achat.mode).toBe("incluse");
    fireEvent.change(screen.getByLabelText(/Nombre de mois/), { target: { value: "3" } });
    expect(etat().ia.achat.moisInclus).toBe("3");
  });

  it("la maintenance de la carte A écrit dans l'état partagé achat.maintenance", () => {
    render(<Hote seul="carte" />);
    fireEvent.change(screen.getByLabelText(/Puis \(HT par mois\)/), { target: { value: "190" } });
    expect(etat().achat.maintenance.mensuelEur).toBe("190");
  });

  it("aucun prix ni taux en dur : un autre taux ne change pas la mise en place (HT)", () => {
    render(<CarteFormuleA etat={base} dispatch={() => {}} tvaStandardPct={5.5} />);
    const champ = screen.getByLabelText(/Prix de la mise en place/) as HTMLInputElement;
    expect(champ.value.replace(/[\s  ]/g, "")).toBe("2683,93€");
  });

  it("prix unique : carte explicative, pas de carte A", () => {
    render(<Hote initial={{ ...base, proposition: "prix_unique" }} />);
    expect(screen.getByText(/un seul prix/)).toBeTruthy();
    expect(screen.queryByRole("region", { name: /Formule A/ })).toBeNull();
  });
});
