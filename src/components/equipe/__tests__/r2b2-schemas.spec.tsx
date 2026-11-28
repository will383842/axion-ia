import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { VousEtes, type CarteVousEtes } from "../visuels/VousEtes";
import { PartoutEnFrance } from "../visuels/PartoutEnFrance";
import { Silhouettes } from "../visuels/Silhouettes";
import { NOMBRE_VILLES_PHARES, nomsRegions, villesPhares } from "@/lib/equipe/villes-phares";
import { getVille } from "@/content/villes";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, ...p }: { href: string }) => <a href={href} {...(p as object)} />,
}));

const INTERDITS_BLEUS = new RegExp(
  ["text-pri", "bg-pri", "ring-pri", "mocha-r", "halo-c"].map((m) => m + "[a-z]*").join("|"),
);

const carte = (id: string, extra: Partial<CarteVousEtes> = {}): CarteVousEtes => ({
  id,
  titre: `Vous êtes ${id}`,
  cout: "Les devis prennent des soirées entières.",
  action: "Nous mettons en place un modèle de devis assisté.",
  gain: "Vos devis partent le jour même.",
  ...extra,
});

const tailles = [
  carte("seul", { silhouettes: 1 }),
  carte("tpe", { silhouettes: 2 }),
  carte("pme", { silhouettes: 3 }),
];
const metiers = [
  carte("artisan", { icone: "btp", ton: "terracotta" }),
  carte("commerçant", { icone: "commerce", ton: "ochre" }),
  carte("industriel", { icone: "industrie", ton: "sage" }),
  carte("cabinet", { icone: "cabinet", ton: "plum" }),
  carte("hôtelier", { icone: "restauration", ton: "mocha" }),
  carte("transporteur", { icone: "transport" }),
];

const rendu = () =>
  render(
    <VousEtes
      surTitre="Pour qui"
      question="Votre entreprise ressemble-t-elle à l'une de celles-ci ?"
      reponse="Texte de test."
      tailles={tailles}
      metiers={metiers}
      autresSecteurs={["Associations"]}
      phraseAutres="Et tous les autres secteurs."
    />,
  );

describe("VousEtes", () => {
  it("un h3 par carte, dans des listes", () => {
    const { container } = rendu();
    expect(container.querySelectorAll("h3")).toHaveLength(tailles.length + metiers.length);
    expect(container.querySelectorAll("ul > li > div > h3").length).toBe(9);
    expect(container.querySelectorAll("h2")).toHaveLength(1);
  });

  it("les trois temps sont présents dans chaque carte", () => {
    const { container } = rendu();
    for (const li of Array.from(container.querySelectorAll("ul > li")).filter((l) =>
      l.querySelector("h3"),
    )) {
      const t = li.textContent ?? "";
      expect(t).toContain("Coût");
      expect(t).toContain("Action");
      expect(t).toContain("Gain");
    }
  });

  it("le gain est en terracotta foncé et en gras ; aucun bleu", () => {
    const { container } = rendu();
    const gains = container.querySelectorAll("p.text-terracotta-deep.font-bold");
    expect(gains).toHaveLength(9);
    expect(container.innerHTML).not.toMatch(INTERDITS_BLEUS);
  });

  it("aucun « % » ni « € » dans le texte rendu", () => {
    const { container } = rendu();
    expect(container.textContent).not.toMatch(/[%€]/);
  });

  it("aucun texte seulement dans un SVG ; SVG décoratifs", () => {
    const { container } = rendu();
    for (const svg of Array.from(container.querySelectorAll("svg"))) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.querySelector("text")).toBeNull();
      expect((svg.textContent ?? "").trim()).toBe("");
    }
  });

  it("animations sous motion-safe seulement", () => {
    const { container } = rendu();
    expect(container.innerHTML).not.toMatch(/(^|\s)transition(\s|")/);
  });

  it("masqué sans donnée", () => {
    const { container } = render(
      <VousEtes surTitre="x" question="q" reponse="r" tailles={[]} metiers={[]} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("Silhouettes : une à trois formes", () => {
    for (const n of [1, 2, 3] as const) {
      const { container } = render(<Silhouettes nombre={n} />);
      expect(container.querySelectorAll("circle")).toHaveLength(n);
    }
  });
});

describe("villesPhares", () => {
  const villes = villesPhares();

  it("12 au plus, triées par population décroissante", () => {
    expect(villes.length).toBeGreaterThan(0);
    expect(villes.length).toBeLessThanOrEqual(NOMBRE_VILLES_PHARES);
    for (let i = 1; i < villes.length; i++) {
      expect(villes[i - 1]!.population).toBeGreaterThanOrEqual(villes[i]!.population);
    }
  });

  it("les slugs existent et pointent vers la page de ville", () => {
    for (const v of villes) {
      expect(getVille(v.slug)).toBeDefined();
      expect(v.href).toBe(`/audit/par-ville/${v.slug}`);
    }
    expect(new Set(villes.map((v) => v.slug)).size).toBe(villes.length);
  });

  it("jamais plus que demandé", () => {
    expect(villesPhares(3)).toHaveLength(3);
    expect(villesPhares(99).length).toBeLessThanOrEqual(NOMBRE_VILLES_PHARES);
  });
});

describe("PartoutEnFrance", () => {
  const rendre = (phraseLieu?: string) =>
    render(
      <PartoutEnFrance
        surTitre="Partout en France"
        question="Williams Jullin intervient-il dans ma ville ?"
        reponse="Texte de test."
        regions={nomsRegions()}
        villes={villesPhares()}
        phraseLieu={phraseLieu}
        lienIndex={{ href: "/implantations", libelle: "Toutes les implantations" }}
      />,
    );

  it("liens vers les pages de ville, formulation « nous intervenons à »", () => {
    const { container } = rendre();
    const liens = container.querySelectorAll('a[href^="/audit/par-ville/"]');
    expect(liens.length).toBe(villesPhares().length);
    for (const a of Array.from(liens)) expect(a.textContent).toMatch(/^Nous intervenons à /);
    expect(container.querySelector('a[href="/implantations"]')).not.toBeNull();
    expect(container.textContent).not.toMatch(
      new RegExp(["bureau", "agence", "Gre" + "noble"].join("|"), "i"),
    );
  });

  it("carte décorative, sans texte ; h3 pour la liste", () => {
    const { container } = rendre(
      "Camille est basé dans le département du Rhône et intervient partout en France.",
    );
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.querySelector("text")).toBeNull();
    expect(container.querySelectorAll("h3")).toHaveLength(1);
    expect(container.textContent).toContain("intervient partout en France");
    expect(container.innerHTML).not.toMatch(INTERDITS_BLEUS);
  });
});
