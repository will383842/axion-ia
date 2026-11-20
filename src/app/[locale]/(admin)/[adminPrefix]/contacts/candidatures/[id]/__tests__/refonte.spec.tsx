import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { Film } from "lucide-react";
import {
  TuilesCandidature,
  CarteEtat,
  PastilleEtat,
  EncadreTeinte,
  tonDeEtat,
} from "../FicheVisuelle";

const PAGE = "src/app/[locale]/(admin)/[adminPrefix]/contacts/candidatures/[id]/page.tsx";

describe("tuiles de la fiche candidature", () => {
  it("affiche un grand chiffre et un libellé court par tuile", () => {
    render(
      <TuilesCandidature
        tuiles={[
          { libelle: "Travaux à voir", valeur: 3, ton: "success", icone: Film },
          { libelle: "Entretiens", valeur: 0, ton: "default", icone: Film },
        ]}
      />,
    );
    const liste = screen.getByRole("list", { name: /Chiffres clés/ });
    const items = within(liste).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByText("3")).toBeTruthy();
    expect(within(items[0]!).getByText("Travaux à voir")).toBeTruthy();
    expect(within(items[1]!).getByText("0")).toBeTruthy();
  });
});

describe("cartes et pastilles", () => {
  it("pastille d'état large avec icône et libellé franc", () => {
    const { container } = render(<PastilleEtat etat="rejetee" />);
    expect(screen.getByText("Refusée")).toBeTruthy();
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.querySelector(".admin-badge-plein--destructive")).not.toBeNull();
  });

  it("la carte porte une bordure gauche colorée selon l'état", () => {
    const { container } = render(<CarteEtat ton={tonDeEtat("mort")}>x</CarteEtat>);
    expect(container.firstElementChild?.className).toContain("border-l-4");
    expect(container.firstElementChild?.className).toContain("admin-destructive");
  });

  it("encadré teinté : motif en gras, pas d'italique", () => {
    const { container } = render(
      <EncadreTeinte ton="error" titre="Motif :">
        virus
      </EncadreTeinte>,
    );
    expect(screen.getByText("Motif :").tagName).toBe("STRONG");
    expect(container.innerHTML).not.toContain("italic");
  });
});

describe("source de la brique : pas de couleur Tailwind par défaut", () => {
  it("FicheVisuelle.tsx n'emploie que les jetons admin", () => {
    expect(readFileSync(PAGE.replace("page.tsx", "FicheVisuelle.tsx"), "utf8")).not.toMatch(
      /\b(?:bg|text|border)-(?:red|green|blue|amber|yellow|gray|slate|zinc)-\d{2,3}\b/,
    );
  });
});

const INTERDIT = /qualiopi|opco|financement|prise en charge|certification|cpf/i;
function chainesVisibles(s: string): string[] {
  const nu = s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const out: string[] = [];
  for (const m of nu.matchAll(/"([^"\n]*)"|`([^`]*)`/g)) out.push(m[1] ?? m[2] ?? "");
  for (const m of nu.matchAll(/>([^<>{}\n]+)</g)) out.push(m[1] ?? "");
  return out;
}
describe("garde de vocabulaire", () => {
  it("FicheVisuelle.tsx (nouveau) ne contient aucun mot réservé", () => {
    const f = PAGE.replace("page.tsx", "FicheVisuelle.tsx");
    expect(chainesVisibles(readFileSync(f, "utf8")).filter((c) => INTERDIT.test(c))).toEqual([]);
  });
});
