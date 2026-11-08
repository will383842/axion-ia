import { fireEvent, render, screen, within } from "@testing-library/react";
import { useReducer } from "react";
import { describe, expect, it } from "vitest";

import { indemniteSortieMax } from "../../../calculs";
import { controlerEtape, reducteur } from "../../../etat";
import { etatT1, etatT2, etatT3, etatT4 } from "../../../fixtures";
import type { EtatAssistant } from "../../../types";
import { versSaisie } from "../../../vers-offre";
import { indemniteSortieAffichee } from "../../../../devis-formules/saisie";
import { ApercuClientVerra } from "../ApercuClientVerra";
import { BlocFinancement } from "../BlocFinancement";
import { EtapePaiement } from "../EtapePaiement";
import { PaiementA } from "../PaiementA";
import { PaiementB } from "../PaiementB";

const TVA = 20;
const nettoyer = (s: string) => s.replace(/[\s  ]/g, "");

function Hote({
  initial,
  vue = "etape",
  montants,
}: {
  initial: EtatAssistant;
  vue?: "etape" | "a" | "b" | "financement" | "verra";
  montants?: { A?: Array<number | null>; B?: Array<number | null> };
}) {
  const [e, dispatch] = useReducer(reducteur, initial);
  return (
    <>
      {vue === "a" ? (
        <PaiementA etat={e} dispatch={dispatch} montants={montants?.A} />
      ) : vue === "b" ? (
        <PaiementB etat={e} dispatch={dispatch} montants={montants?.B} />
      ) : vue === "financement" ? (
        <BlocFinancement etat={e} dispatch={dispatch} />
      ) : vue === "verra" ? (
        <ApercuClientVerra etat={e} tvaStandardPct={TVA} />
      ) : (
        <EtapePaiement
          etape={3}
          etat={e}
          dispatch={dispatch}
          tvaStandardPct={TVA}
          montantsPhases={montants}
        />
      )}
      <div data-testid="etat">{JSON.stringify(e)}</div>
    </>
  );
}
const etat = () => JSON.parse(screen.getByTestId("etat").textContent!) as EtatAssistant;

describe("EtapePaiement : onglets par formule", () => {
  it("A + B : deux onglets, un seul panneau affiché à la fois", () => {
    render(<Hote initial={etatT3()} />);
    const onglets = screen.getAllByRole("tab");
    expect(onglets.map((o) => o.textContent)).toEqual(["Formule A", "Formule B"]);
    expect(screen.getByRole("tabpanel", { name: /Formule A/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Formule B" }));
    expect(screen.getByRole("tabpanel", { name: /Formule B/ })).toBeTruthy();
    expect(screen.queryByRole("tabpanel", { name: /Formule A/ })).toBeNull();
  });

  it("une seule formule : un seul onglet", () => {
    render(<Hote initial={etatT2()} />);
    expect(screen.getAllByRole("tab")).toHaveLength(1);
    expect(screen.getByRole("tabpanel", { name: /Formule B/ })).toBeTruthy();
  });

  it("prix unique : rappel de l'échéancier puis financement, sans onglet de formule", () => {
    render(<Hote initial={etatT4()} />);
    expect(screen.queryByRole("tab", { name: /Formule/ })).toBeNull();
    expect(screen.getByLabelText(/Financement suggéré/)).toBeTruthy();
  });
});

describe("PaiementA", () => {
  it("rappelle les phases de l'étape 1b avec les montants du SERVEUR, sans les calculer", () => {
    const e = etatT1();
    render(<Hote initial={e} vue="a" montants={{ A: [134517, 134517, 179359] }} />);
    const liste = screen.getByRole("list", { name: /Phases/ });
    const lignes = within(liste).getAllByRole("listitem");
    expect(lignes.length).toBe(e.achat.phases.length);
    expect(nettoyer(lignes[0]!.textContent!)).toContain("1345,17€");
    expect(nettoyer(lignes[2]!.textContent!)).toContain("1793,59€");
  });

  it("sans montants du serveur : un tiret, jamais un montant inventé", () => {
    render(<Hote initial={etatT1()} vue="a" />);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("le rythme de maintenance se limite à 1, 2, 6 ou 12 mois (pas de trimestre)", () => {
    render(<Hote initial={etatT1()} vue="a" />);
    const boites = screen.getAllByRole("checkbox");
    expect(boites.map((b) => b.getAttribute("value"))).toEqual(["1", "2", "6", "12"]);
    expect(screen.queryByText(/trimestre/i)).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: /Tous les 6 mois/ }));
    expect(etat().achat.maintenance.periodes).toEqual([1, 6, 12]);
  });

  it("la dernière période ne peut pas être décochée", () => {
    render(<Hote initial={etatT1()} vue="a" />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Chaque mois/ }));
    const derniere = screen.getByRole("checkbox", { name: /Chaque année/ }) as HTMLInputElement;
    expect(derniere.disabled).toBe(true);
    expect(etat().achat.maintenance.periodes).toEqual([12]);
  });
});

describe("PaiementB", () => {
  it("échu / à échoir s'écrit dans l'état", () => {
    render(<Hote initial={etatT2()} vue="b" />);
    fireEvent.click(screen.getByRole("radio", { name: /terme échu/i }));
    expect(etat().abonnement.terme).toBe("echu");
    fireEvent.click(screen.getByRole("radio", { name: /À échoir/i }));
    expect(etat().abonnement.terme).toBe("a_echoir");
  });

  it("au plus quatre périodes, jamais zéro, avec une remise par période", () => {
    render(<Hote initial={etatT2()} vue="b" />);
    const periodes = screen.getAllByRole("checkbox", { name: /^(Chaque|Tous les)/ });
    expect(periodes).toHaveLength(4);
    fireEvent.click(screen.getByRole("checkbox", { name: /Tous les 6 mois/ }));
    expect(etat().abonnement.periodes.map((p) => p.mois)).toEqual([1, 6, 12]);
    fireEvent.change(screen.getByLabelText(/Remise pour 6 mois/), { target: { value: "3" } });
    expect(etat().abonnement.periodes.find((p) => p.mois === 6)!.remisePct).toBe("3");
    // la remise de 12 mois de T2 est conservée
    expect(etat().abonnement.periodes.find((p) => p.mois === 12)!.remisePct).toBe("5");
  });

  it("l'engagement doit être multiple de chaque période : même message que le schéma", () => {
    render(<Hote initial={etatT2()} vue="b" />);
    fireEvent.click(screen.getByRole("radio", { name: "3 mois" }));
    expect(screen.getByRole("alert").textContent).toBe(
      "L'engagement doit être un multiple de chaque période proposée.",
    );
    fireEvent.click(screen.getByRole("radio", { name: "12 mois" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("engagement minimal par période : mensuel NET × engagement (T2), pas le catalogue", () => {
    render(<Hote initial={etatT2()} vue="b" />);
    const txt = nettoyer(screen.getByRole("table", { name: /Périodes/ }).textContent!);
    expect(txt).toContain("2399,88€"); // période de 1 mois, 12 × 199,99
    expect(txt).toContain("2279,88€"); // période de 12 mois, 12 × 189,99
  });

  it("l'indemnité de sortie maximale est affichée en euros et égale celle du moteur", () => {
    const e = etatT2();
    const moteur = indemniteSortieAffichee(versSaisie(e, TVA).saisie);
    expect(moteur).toBe(119994);
    expect(indemniteSortieMax(e)).toBe(moteur);
    render(<Hote initial={e} vue="b" />);
    expect(nettoyer(screen.getByTestId("indemnite").textContent!)).toContain("1199,94€");
  });

  it("sans indemnité (taux 0) : aucun montant d'indemnité affiché", () => {
    const e = etatT2();
    render(
      <Hote initial={{ ...e, abonnement: { ...e.abonnement, indemniteTauxPct: "0" } }} vue="b" />,
    );
    expect(screen.queryByTestId("indemnite")).toBeNull();
  });

  it("reconduction et préavis sont des choix exclusifs", () => {
    render(<Hote initial={etatT2()} vue="b" />);
    fireEvent.click(screen.getByRole("radio", { name: /Se renouvelle chaque année/ }));
    expect(etat().abonnement.reconduction).toBe("annuelle");
    fireEvent.click(screen.getByRole("radio", { name: "2 mois de préavis" }));
    expect(etat().abonnement.preavisMois).toBe(2);
  });

  it("l'échéancier de B passe par l'éditeur de phases, avec les montants du serveur", () => {
    render(<Hote initial={etatT2()} vue="b" montants={{ B: [95000, 95000] }} />);
    expect(nettoyer(document.body.textContent!)).toContain("950,00€");
  });
});

describe("BlocFinancement", () => {
  it("propose direct, OPCO et France Travail, jamais le CPF", () => {
    render(<Hote initial={etatT4()} vue="financement" />);
    const options = within(screen.getByLabelText(/Financement suggéré/)).getAllByRole("option");
    expect(options.map((o) => o.getAttribute("value"))).toEqual([
      "",
      "direct",
      "opco",
      "france_travail",
    ]);
  });

  it("les champs OPCO n'apparaissent que si le financement est OPCO", () => {
    render(<Hote initial={etatT4()} vue="financement" />);
    expect(screen.queryByLabelText(/Modalité OPCO/)).toBeNull();
    fireEvent.change(screen.getByLabelText(/Financement suggéré/), { target: { value: "opco" } });
    expect(etat().financement.mode).toBe("opco");
    fireEvent.change(screen.getByLabelText(/Modalité OPCO/), { target: { value: "intra" } });
    fireEvent.change(screen.getByLabelText(/Nb\. stagiaires/), { target: { value: "8" } });
    fireEvent.change(screen.getByLabelText(/Durée \(heures\)/), { target: { value: "14" } });
    fireEvent.change(screen.getByLabelText(/Enveloppe OPCO restante/), {
      target: { value: "1000" },
    });
    fireEvent.change(screen.getByLabelText(/Début prévu de la session/), {
      target: { value: "2026-12-01" },
    });
    expect(etat().financement).toMatchObject({
      modaliteOpco: "intra",
      nbParticipants: "8",
      dureeHeures: "14",
      enveloppeRestante: "1000",
      dateDebutSession: "2026-12-01",
    });
    fireEvent.change(screen.getByLabelText(/Financement suggéré/), { target: { value: "direct" } });
    expect(screen.queryByLabelText(/Modalité OPCO/)).toBeNull();
  });
});

describe("ApercuClientVerra", () => {
  it("A + B : montants des deux formules, lus dans calculs.ts", () => {
    render(<Hote initial={etatT3()} vue="verra" />);
    const t = nettoyer(
      screen.getByRole("complementary", { name: /Ce que le client verra/ }).textContent!,
    );
    expect(t).toContain("FormuleA");
    expect(t).toContain("FormuleB");
    expect(t).toContain("4483,93€"); // lignes T1 (2 400 + 1 800 + 283,93)
    expect(t).toContain("1900,00€"); // mise en service saisie
    expect(t).toContain("199,99€");
  });

  it("A seule : rien de la formule B", () => {
    render(<Hote initial={etatT1()} vue="verra" />);
    const t = screen.getByRole("complementary", { name: /Ce que le client verra/ }).textContent!;
    expect(t).toContain("Formule A");
    expect(t).not.toContain("Formule B");
  });

  it("B seule : la mise en service est le total des lignes", () => {
    render(<Hote initial={etatT2()} vue="verra" />);
    const t = screen.getByRole("complementary", { name: /Ce que le client verra/ }).textContent!;
    expect(t).not.toContain("Formule A");
    expect(nettoyer(t)).toContain("1900,00€");
  });

  it("prix unique : le total des lignes seulement, aucune formule", () => {
    render(<Hote initial={etatT4()} vue="verra" />);
    const t = screen.getByRole("complementary", { name: /Ce que le client verra/ }).textContent!;
    expect(t).not.toContain("Formule");
    expect(nettoyer(t)).toContain("314,02€");
  });

  it("aucun montant d'exemple de la maquette", () => {
    render(<Hote initial={etatT4()} vue="verra" />);
    const t = nettoyer(document.body.textContent!);
    expect(t).not.toContain("4800€");
    expect(t).not.toContain("390€");
  });
});

describe("E15 : TVA, TTC et hébergement dans « ce que le client verra »", () => {
  it("prix unique : HT, TVA et TTC sont affichés", () => {
    render(<Hote initial={etatT4()} vue="verra" />);
    const t = nettoyer(
      screen.getByRole("complementary", { name: /Ce que le client verra/ }).textContent!,
    );
    expect(t).toContain("TVA");
    expect(t).toContain("TotalTTC");
    expect(t).toContain("314,02€");
  });

  it("formule A avec hébergement Axion-IA : le mensuel figure dans l'aperçu", () => {
    const e = etatT1();
    const init = {
      ...e,
      achat: { ...e.achat, hebergement: "axion" as const, hebergementMensuelEur: "45" },
    };
    render(<Hote initial={init} vue="verra" />);
    const t = nettoyer(
      screen.getByRole("complementary", { name: /Ce que le client verra/ }).textContent!,
    );
    expect(t).toContain("HébergementchezAxion-IA");
    expect(t).toContain("45,00€HT/mois");
    expect(t).toContain("TotalTTC");
  });
});

describe("E15 : onglets au clavier", () => {
  it("flèches, Début et Fin déplacent la sélection et le focus (tabIndex itinérant)", () => {
    render(<Hote initial={etatT3()} />);
    const [a, b] = screen.getAllByRole("tab") as [HTMLElement, HTMLElement];
    a.focus();
    fireEvent.keyDown(a, { key: "ArrowRight" });
    expect(b.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(b);
    expect(b.tabIndex).toBe(0);
    expect(a.tabIndex).toBe(-1);
    expect(screen.getByRole("tabpanel", { name: /Formule B/ })).toBeTruthy();
    fireEvent.keyDown(b, { key: "ArrowRight" });
    expect(a.getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(a, { key: "End" });
    expect(b.getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(b, { key: "Home" });
    expect(a.getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(a, { key: "ArrowLeft" });
    expect(b.getAttribute("aria-selected")).toBe("true");
  });
});

describe("E15 : remise et indemnité hors borne", () => {
  it("remise 150 : aria-invalid, message relié, étape 3 refusée", () => {
    render(<Hote initial={etatT3()} vue="b" />);
    const champ = screen.getAllByLabelText(/Remise pour/)[0] as HTMLInputElement;
    fireEvent.change(champ, { target: { value: "150" } });
    expect(champ.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(champ.getAttribute("aria-describedby")!)!.textContent).toMatch(
      /entre 0 et 100/,
    );
    expect(controlerEtape(etat(), 3).join(" ")).toMatch(/remise/i);
  });

  it("indemnité illisible ou > 100 : message visible et étape refusée", () => {
    render(<Hote initial={etatT3()} vue="b" />);
    const champ = screen.getByLabelText(/Indemnité de sortie/) as HTMLInputElement;
    fireEvent.change(champ, { target: { value: "abc" } });
    expect(champ.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
    expect(controlerEtape(etat(), 3).join(" ")).toMatch(/Indemnité/);
    fireEvent.change(champ, { target: { value: "120" } });
    expect(controlerEtape(etat(), 3).join(" ")).toMatch(/entre 0 et 100/);
  });
});
