import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { FriseEtapes } from "../visuels/FriseEtapes";
import { FriseParcours } from "../visuels/FriseParcours";
import { MethodeCollaborateur } from "../MethodeCollaborateur";
import { ParcoursSection } from "../ParcoursSection";

const etapes = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    numero: String(i + 1),
    titre: `Étape ${i + 1}`,
    texte: "Texte court.",
  }));

function verifierMotionSafe(html: string) {
  const classes = html.match(/class="[^"]*"/g) ?? [];
  for (const c of classes) {
    for (const mot of c.replace(/^class="|"$/g, "").split(/\s+/)) {
      if (/(^|:)(transition|animate-)/.test(mot)) expect(mot).toMatch(/^motion-safe:/);
    }
  }
}

describe("FriseEtapes", () => {
  it("3 étapes : ol de 3 li, un h3 par étape, grille à 3 colonnes", () => {
    const { container } = render(<FriseEtapes etapes={etapes(3)} />);
    const ol = container.querySelector("ol");
    expect(ol?.children).toHaveLength(3);
    expect(container.querySelectorAll("h3")).toHaveLength(3);
    expect(ol?.className).toContain("lg:grid-cols-3");
    expect(ol?.className).toContain("lg:before:inset-x-[16%]");
  });
  it("5 étapes : grille à 5 colonnes, moments affichés", () => {
    const { container } = render(
      <FriseEtapes etapes={etapes(5).map((e) => ({ ...e, moment: "Matin" }))} ton="creme" />,
    );
    const ol = container.querySelector("ol");
    expect(ol?.children).toHaveLength(5);
    expect(ol?.className).toContain("sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5");
    expect(ol?.className).toContain("xl:before:inset-x-[10%]");
    expect(container.innerHTML).toContain("ring-sand");
    expect(container.textContent).toContain("Matin");
  });
  it("tout svg est décoratif, conclusion et « obtenu » rendus, aucune classe bleue", () => {
    const { container } = render(
      <FriseEtapes
        etapes={[{ ...etapes(1)[0]!, obtenu: "Un chiffrage" }, ...etapes(3).slice(1)]}
        conclusion="Le reste est abandonné."
      />,
    );
    for (const svg of container.querySelectorAll("svg")) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
    }
    expect(container.textContent).toContain("Un chiffrage");
    expect(container.textContent).toContain("Le reste est abandonné.");
    expect(container.innerHTML).not.toMatch(/text-primary|bg-primary|mocha-rich|ring-primary/);
    verifierMotionSafe(container.innerHTML);
  });
  it("sans étape : rien", () => {
    expect(render(<FriseEtapes etapes={[]} />).container.innerHTML).toBe("");
  });
});

describe("FriseParcours", () => {
  it("<time> seulement quand une année est fournie", () => {
    const { container } = render(
      <FriseParcours
        jalons={[
          { titre: "A", texte: "t", repere: "Depuis longtemps" },
          { titre: "B", texte: "t", annee: "2023" },
          { titre: "C", texte: "t", repere: "Aujourd'hui" },
        ]}
      />,
    );
    const temps = container.querySelectorAll("time");
    expect(temps).toHaveLength(1);
    expect(temps[0]?.getAttribute("datetime")).toBe("2023");
    expect(container.querySelectorAll("ol > li")).toHaveLength(3);
    expect(container.querySelectorAll("h3")).toHaveLength(3);
    expect(container.querySelector("ol")?.className).toContain("lg:grid-cols-3");
    verifierMotionSafe(container.innerHTML);
  });
  it("sans année : aucun <time>", () => {
    const { container } = render(<FriseParcours jalons={[{ titre: "A", texte: "t" }]} />);
    expect(container.querySelector("time")).toBeNull();
  });
  it("plus de 4 jalons : reste vertical", () => {
    const jalons = Array.from({ length: 5 }, (_, i) => ({ titre: `J${i}`, texte: "t" }));
    const { container } = render(<FriseParcours jalons={jalons} />);
    expect(container.querySelector("ol")?.className).not.toContain("lg:grid-cols");
  });
});

describe("sections", () => {
  it("MethodeCollaborateur : h2 puis h3, svg masqués", () => {
    const { container } = render(
      <MethodeCollaborateur donnees={{ titre: "Quelle méthode ?", etapes: etapes(3) }} />,
    );
    expect(container.querySelectorAll("h2")).toHaveLength(1);
    expect(container.querySelectorAll("h3")).toHaveLength(3);
  });
  it("ParcoursSection : h2 puis frise", () => {
    const { container } = render(
      <ParcoursSection
        donnees={{ titre: "Quel parcours ?", blocs: [{ titre: "A", texte: "t", annee: "2023" }] }}
      />,
    );
    expect(container.querySelectorAll("h2")).toHaveLength(1);
    expect(container.querySelectorAll("h3")).toHaveLength(1);
  });
});
