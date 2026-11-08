import { fireEvent, render, screen, within } from "@testing-library/react";
import { useReducer } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { etatInitial, reducteur } from "../../../etat";
import type { OffreCatalogue } from "../../../lignes";
import type { EtatAssistant, LigneAssistant } from "../../../types";
import { BlocMotsDuClient } from "../BlocMotsDuClient";
import { ListeLignes } from "../ListeLignes";

// On mesure les rendus du VRAI `LigneContenu` (memo + comparateur réels, rien n'est recouvert) :
// `quantiteLue` est appelée une fois par rendu du corps de la ligne, avec sa quantité, que ce
// test rend distincte d'une ligne à l'autre (a=1, b=2, c=3). Retirer le comparateur de l'export
// réel fait donc grimper les compteurs de b et c à chaque frappe dans a.
const rendus = vi.hoisted(() => new Map<string, number>());
vi.mock("../../../calculs", async (importOriginal) => {
  const reel = await importOriginal<typeof import("../../../calculs")>();
  return {
    ...reel,
    quantiteLue: (q: string) => {
      rendus.set(q, (rendus.get(q) ?? 0) + 1);
      return reel.quantiteLue(q);
    },
  };
});

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

const etat = (lignes: LigneAssistant[]): EtatAssistant => ({
  ...etatInitial({ validiteParDefaut: "2026-12-08", formulesActives: true }),
  lignes,
});

const OFFRES: OffreCatalogue[] = [
  {
    tierId: null,
    code: "o1",
    titreFr: "Assistant de réponse",
    prixHtCents: 240000,
    noteDevisFr: "Note offre",
  },
  { tierId: null, code: "o2", titreFr: "Sur devis", prixHtCents: null, noteDevisFr: "" },
];

/** Monte la liste avec le vrai réducteur pour vérifier le comportement de bout en bout. */
const AUCUNE_OFFRE: OffreCatalogue[] = [];
function Hote({
  initial,
  offres = AUCUNE_OFFRE,
}: {
  initial: EtatAssistant;
  offres?: OffreCatalogue[];
}) {
  const [e, dispatch] = useReducer(reducteur, initial);
  return (
    <>
      <ListeLignes etat={e} dispatch={dispatch} offres={offres} />
      <div data-testid="etat">{JSON.stringify(e.lignes)}</div>
    </>
  );
}
const lignesDe = () => JSON.parse(screen.getByTestId("etat").textContent!) as LigneAssistant[];

describe("BlocMotsDuClient", () => {
  it("trois champs, dispatch d'un patch ; la valeur est facultative et rien n'est pré-rempli", () => {
    const dispatch = vi.fn();
    render(<BlocMotsDuClient etat={etat([L("a")])} dispatch={dispatch} />);
    const mots = screen.getByLabelText(/ce que le client vous a dit/i) as HTMLTextAreaElement;
    expect(mots.value).toBe("");
    fireEvent.change(mots, { target: { value: "Mes mots" } });
    expect(dispatch).toHaveBeenCalledWith({ type: "champs", patch: { motsDuClient: "Mes mots" } });
    fireEvent.change(screen.getByLabelText(/résultat visé/i), { target: { value: "R" } });
    expect(dispatch).toHaveBeenCalledWith({ type: "champs", patch: { resultatVise: "R" } });
    fireEvent.change(screen.getByLabelText(/valeur pour le client/i), { target: { value: "V" } });
    expect(dispatch).toHaveBeenCalledWith({ type: "champs", patch: { valeurClient: "V" } });
    expect(screen.getByText(/rien n'est inventé/i)).toBeTruthy();
  });
});

describe("ListeLignes", () => {
  it("ajoute une ligne de chaque type", () => {
    render(<Hote initial={etat([L("a")])} />);
    for (const [nom, type] of [
      [/\+ automatisation/i, "automatisation"],
      [/\+ formation/i, "formation"],
      [/\+ audit/i, "audit"],
      [/\+ site web/i, "site_web"],
      [/\+ ligne libre/i, "libre"],
    ] as const) {
      fireEvent.click(screen.getByRole("button", { name: nom }));
      expect(lignesDe().at(-1)!.type).toBe(type);
    }
    expect(lignesDe()).toHaveLength(6);
  });

  it("aucun choix facultative / indispensable en v1", () => {
    render(<Hote initial={etat([L("a")])} />);
    expect(document.body.textContent).not.toMatch(/facultative|indispensable/i);
  });

  it("saisie du libellé, de la quantité, du prix et du délai", () => {
    render(<Hote initial={etat([L("a")])} />);
    fireEvent.change(screen.getByLabelText(/libellé/i), { target: { value: "Relance" } });
    fireEvent.change(screen.getByLabelText(/quantité/i), { target: { value: "2,3" } });
    fireEvent.change(screen.getByLabelText(/prix/i), { target: { value: "123,45" } });
    fireEvent.change(screen.getByLabelText(/délai/i), { target: { value: "4" } });
    expect(lignesDe()[0]).toMatchObject({
      libelle: "Relance",
      quantite: "2,3",
      prixEur: "123,45",
      delaiSemaines: "4",
    });
  });

  it("délai : seuls les chiffres sont acceptés", () => {
    render(<Hote initial={etat([L("a", { delaiSemaines: "3" })])} />);
    fireEvent.change(screen.getByLabelText(/délai/i), { target: { value: "3x" } });
    expect(lignesDe()[0]!.delaiSemaines).toBe("3");
  });

  it("prix illisible : message, aria-invalid, valeur gardée telle quelle (jamais ramenée à 0)", () => {
    render(<Hote initial={etat([L("a", { prixEur: "2.400" })])} />);
    const prix = screen.getByLabelText(/prix/i);
    expect(prix.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(prix.getAttribute("aria-describedby")!)!.textContent).toMatch(
      /illisible/i,
    );
    expect((prix as HTMLInputElement).value).toBe("2.400");
  });

  it("quantité à plus de 2 décimales : message", () => {
    render(<Hote initial={etat([L("a", { quantite: "1,234" })])} />);
    expect(screen.getByLabelText(/quantité/i).getAttribute("aria-invalid")).toBe("true");
  });

  it("« démarre après » ne propose que les AUTRES lignes", () => {
    render(<Hote initial={etat([L("a", { libelle: "Alpha" }), L("b", { libelle: "Beta" })])} />);
    const premiere = screen.getAllByRole("group", { name: /démarre après/i })[0]!;
    const cases = within(premiere).getAllByRole("checkbox");
    expect(cases).toHaveLength(1);
    expect(within(premiere).getByLabelText(/beta/i)).toBeTruthy();
    expect(within(premiere).queryByLabelText(/alpha/i)).toBeNull();
  });

  it("refuse un cycle : la ligne qui dépend déjà de moi est grisée avec sa raison", () => {
    render(
      <Hote
        initial={etat([
          L("a", { libelle: "Alpha" }),
          L("b", { libelle: "Beta", necessite: ["a"] }),
        ])}
      />,
    );
    const groupeA = screen.getAllByRole("group", { name: /démarre après/i })[0]!;
    const caseB = within(groupeA).getByLabelText(/beta/i) as HTMLInputElement;
    expect(caseB.disabled).toBe(true);
    expect(document.getElementById(caseB.getAttribute("aria-describedby")!)!.textContent).toMatch(
      /cycle|dépend déjà/i,
    );
    fireEvent.click(caseB);
    expect(lignesDe()[0]!.necessite).toEqual([]);
  });

  it("cocher « démarre après » pose la dépendance (information de planning)", () => {
    render(<Hote initial={etat([L("a", { libelle: "Alpha" }), L("b", { libelle: "Beta" })])} />);
    const groupeB = screen.getAllByRole("group", { name: /démarre après/i })[1]!;
    fireEvent.click(within(groupeB).getByLabelText(/alpha/i));
    expect(lignesDe()[1]!.necessite).toEqual(["a"]);
  });

  it("champs libres : ajout, saisie, retrait", () => {
    render(<Hote initial={etat([L("a")])} />);
    fireEvent.click(screen.getByRole("button", { name: /ajouter un champ libre/i }));
    fireEvent.change(screen.getByLabelText(/nom du champ/i), { target: { value: "Langue" } });
    fireEvent.change(screen.getByLabelText(/valeur du champ/i), { target: { value: "Français" } });
    expect(lignesDe()[0]!.champsLibres).toEqual([{ nom: "Langue", valeur: "Français" }]);
    fireEvent.click(screen.getByRole("button", { name: /retirer le champ/i }));
    expect(lignesDe()[0]!.champsLibres).toEqual([]);
  });

  it("supprimer une ligne vide : immédiat ; remplie : confirmation d'abord", () => {
    render(<Hote initial={etat([L("a", { libelle: "Alpha", prixEur: "10" }), L("b")])} />);
    fireEvent.click(screen.getAllByRole("button", { name: /supprimer la ligne/i })[0]!);
    expect(lignesDe()).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: /confirmer la suppression/i }));
    expect(lignesDe().map((l) => l.id)).toEqual(["b"]);
  });

  it("supprimer une ligne retire les dépendances qui la visaient, avec message", () => {
    render(
      <Hote
        initial={etat([
          L("a", { libelle: "Alpha", prixEur: "10" }),
          L("b", { libelle: "Beta", necessite: ["a"] }),
        ])}
      />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: /supprimer la ligne/i })[0]!);
    fireEvent.click(screen.getByRole("button", { name: /confirmer la suppression/i }));
    expect(lignesDe()[0]!.necessite).toEqual([]);
    expect(screen.getByRole("status").textContent).toMatch(/Alpha/);
    expect(screen.getByRole("status").textContent).toMatch(/dépendance/i);
  });

  it("après suppression, le focus va à la ligne voisine", () => {
    render(
      <Hote
        initial={etat([L("a", { libelle: "Alpha", prixEur: "1" }), L("b", { libelle: "Beta" })])}
      />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: /supprimer la ligne/i })[0]!);
    fireEvent.click(screen.getByRole("button", { name: /confirmer la suppression/i }));
    expect(document.activeElement).toBe(screen.getByLabelText(/libellé/i));
  });

  it("Supprimer → Garder / Confirmer : le focus ne tombe jamais sur la page", () => {
    render(
      <Hote
        initial={etat([L("a", { libelle: "Alpha", prixEur: "1" }), L("b", { libelle: "Beta" })])}
      />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: /supprimer la ligne/i })[0]!);
    const garder = screen.getByRole("button", { name: /garder la ligne/i });
    expect(document.activeElement).toBe(garder);
    fireEvent.click(garder);
    expect(document.activeElement).toBe(
      screen.getAllByRole("button", { name: /supprimer la ligne 1/i })[0],
    );
    fireEvent.click(screen.getByRole("button", { name: /supprimer la ligne 1/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirmer la suppression/i }));
    expect(document.activeElement).not.toBe(document.body);
  });

  it("la dernière ligne ne peut pas être supprimée", () => {
    render(<Hote initial={etat([L("a")])} />);
    expect(
      (screen.getByRole("button", { name: /supprimer la ligne/i }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("offre du catalogue : reprend titre et prix, sans taux de TVA", () => {
    render(<Hote initial={etat([L("a")])} offres={OFFRES} />);
    fireEvent.change(screen.getByLabelText(/offre du catalogue/i), { target: { value: "o1" } });
    expect(lignesDe()[0]).toMatchObject({
      libelle: "Assistant de réponse",
      prixEur: "2400",
      offreCode: "o1",
    });
    expect(JSON.stringify(lignesDe()[0])).not.toMatch(/tva|taux/i);
    expect(screen.getByText("Note offre")).toBeTruthy();
  });

  it("offre sans prix ferme : le chiffrage existant est gardé et un message le dit", () => {
    render(<Hote initial={etat([L("a", { prixEur: "500", libelle: "Mien" })])} offres={OFFRES} />);
    fireEvent.change(screen.getByLabelText(/offre du catalogue/i), { target: { value: "o2" } });
    expect(lignesDe()[0]).toMatchObject({ prixEur: "500", libelle: "Mien" });
    expect(screen.getByText(/pas de prix ferme/i)).toBeTruthy();
  });

  it("choisir « Aucune » relâche les références sans effacer le chiffrage", () => {
    render(
      <Hote
        initial={etat([L("a", { offreCode: "o1", prixEur: "2400", libelle: "X" })])}
        offres={OFFRES}
      />,
    );
    fireEvent.change(screen.getByLabelText(/offre du catalogue/i), { target: { value: "" } });
    expect(lignesDe()[0]).toMatchObject({ offreCode: "", prixEur: "2400" });
  });

  it("pas de sélecteur d'offre quand le catalogue est vide", () => {
    render(<Hote initial={etat([L("a")])} />);
    expect(screen.queryByLabelText(/offre du catalogue/i)).toBeNull();
  });
});

describe("ListeLignes : rendus", () => {
  beforeEach(() => rendus.clear());

  it("une frappe dans la ligne 1 ne refait pas le rendu des autres lignes", () => {
    render(
      <Hote
        initial={etat([
          L("a", { quantite: "1" }),
          L("b", { quantite: "2" }),
          L("c", { quantite: "3" }),
        ])}
      />,
    );
    const avant = new Map(rendus);
    const prix = screen.getAllByLabelText(/prix/i)[0] as HTMLInputElement;
    fireEvent.change(prix, { target: { value: "120" } });
    fireEvent.change(prix, { target: { value: "1200" } });
    expect(lignesDe()[0]!.prixEur).toBe("1200");
    expect(rendus.get("1")).toBeGreaterThan(avant.get("1")!);
    expect(rendus.get("2")).toBe(avant.get("2"));
    expect(rendus.get("3")).toBe(avant.get("3"));
  });
});
