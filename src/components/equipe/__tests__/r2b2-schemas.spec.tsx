import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { VousEtes, type CarteVousEtes } from "../visuels/VousEtes";
import { PartoutEnFrance } from "../visuels/PartoutEnFrance";
import { Silhouettes } from "../visuels/Silhouettes";
import { NOMBRE_VILLES_PHARES, nomsRegions, villesPhares } from "@/lib/equipe/villes-phares";
import { AvantApres, PorteEntree, Rassurance } from "../BlocsTransformation";
import { MetiersCollaborateur } from "../MetiersCollaborateur";
import { CitationsTerrain } from "../CitationsTerrain";
import { GARANTIE_PHRASE } from "@/content/journee-ia-commun";
import { WILLIAMS_SERVICES } from "@/content/equipe/williams";
import { getVille } from "@/content/villes";
import { hasVilleCopy, isVilleIndexable } from "@/content/villes/core";
import { getRegion } from "@/content/regions";

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
    expect(container.innerHTML).not.toMatch(/(^|\s)hover:-?translate/);
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

  it("chaque lien pointe vers une page /implantations existante et indexable", () => {
    for (const v of villes) {
      const ville = getVille(v.slug);
      expect(ville).toBeDefined();
      expect(getRegion(ville!.region)).toBeDefined();
      expect(v.href).toBe(`/implantations/${ville!.region}/${v.slug}`);
      expect(isVilleIndexable(v.slug)).toBe(true);
      expect(hasVilleCopy(v.slug)).toBe(true);
      expect(v.href).not.toContain("/audit/");
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
    const liens = container.querySelectorAll(
      'a[href^="/implantations/"][href*="/"]:not([href="/implantations"])',
    );
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

describe("AvantApres, Rassurance, PorteEntree, MetiersCollaborateur, CitationsTerrain", () => {
  const fiche = {
    avantApres: {
      titre: "Qu'est-ce qui change ?",
      lignes: [
        { avant: "Avant un", apres: "Après un" },
        { avant: "Avant deux", apres: "Après deux" },
      ],
      phrase: "Phrase de synthèse.",
    },
    rassurance: {
      titre: "Sans tout chambouler ?",
      accroche: "Accroche.",
      points: ["a", "b", "c", "d", "e"].map((x) => ({ titre: `T${x}`, texte: `Texte ${x}` })),
    },
    porteEntree: {
      titre: "La Journée IA ?",
      accroche: "Accroche.",
      points: [1, 2, 3].map((x) => ({
        titre: `Étape ${x}`,
        texte: x === 3 ? `Texte ${x} ${GARANTIE_PHRASE}` : `Texte ${x}`,
      })),
      bouton: "Réserver",
      lien: { href: "/journee-ia", libelle: "Tout savoir" },
    },
    services: {
      titre: "Que faisons-nous ?",
      intro: "Intro.",
      items: [1, 2, 3].map((x) => ({
        id: `s${x}`,
        nom: `Service ${x}`,
        texte: `Texte ${x}`,
        liens: [{ href: `/services/${x}`, libelle: `Voir ${x}` }],
        ...(x === 3 ? { enAvant: true } : {}),
      })),
    },
    citations: { titre: "Constats ?", items: ["Un.", "Deux.", "Trois."] },
  };

  it("AvantApres : table sémantique avec rôles ARIA", () => {
    const { container } = render(<AvantApres donnees={fiche.avantApres} />);
    expect(container.querySelector("table caption")).not.toBeNull();
    const th = container.querySelectorAll('thead th[scope="col"]');
    expect(th).toHaveLength(2);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(2);
    expect(container.querySelector('table[role="table"]')).not.toBeNull();
    expect(container.querySelectorAll('[role="row"]').length).toBe(3);
    expect(container.querySelectorAll('[role="columnheader"]')).toHaveLength(2);
    expect(container.querySelectorAll('[role="cell"]')).toHaveLength(4);
    expect(container.textContent).toContain("Avant deux");
    expect(container.textContent).toContain("Phrase de synthèse.");
    expect(container.querySelectorAll("h2")).toHaveLength(1);
  });

  it("Rassurance : cinq tuiles avec un h3 chacune", () => {
    const { container } = render(<Rassurance donnees={fiche.rassurance} />);
    expect(container.querySelectorAll("ul > li")).toHaveLength(5);
    expect(container.querySelectorAll("h3")).toHaveLength(5);
    expect(container.querySelector("section")?.getAttribute("data-fond")).toBe("fonce");
  });

  it("PorteEntree : garantie importée, bouton terracotta, moments et chiffres", () => {
    const { container } = render(
      <PorteEntree
        donnees={fiche.porteEntree}
        moments={["Matin", "Après-midi", "Ensuite"]}
        chiffres={[{ valeur: "4 h", libelle: "de formation pratique" }]}
      />,
    );
    expect(container.textContent).toContain(GARANTIE_PHRASE);
    expect(container.textContent).toContain("Matin");
    expect(container.textContent).toContain("de formation pratique");
    const cta = container.querySelector("[data-cta]");
    expect(cta?.className).toContain("focus-visible:ring-terracotta");
    expect(container.querySelectorAll("ol > li")).toHaveLength(3);
  });

  it("services : la carte mise en avant est la première", () => {
    const { container } = render(<MetiersCollaborateur donnees={fiche.services} />);
    const cartes = container.querySelectorAll("article");
    expect(cartes).toHaveLength(3);
    expect(cartes[0]!.hasAttribute("data-service-vedette")).toBe(true);
    expect(cartes[0]!.querySelector("h3")?.textContent).toBe("Service 3");
    expect(container.querySelectorAll("h3")).toHaveLength(3);
  });

  it("services de Williams : la transformation est la carte mise en avant, sans doublon", () => {
    const { container } = render(<MetiersCollaborateur donnees={WILLIAMS_SERVICES} />);
    const cartes = container.querySelectorAll("article");
    expect(cartes[0]!.getAttribute("id")).toBe("transformation");
    expect(container.querySelectorAll("[data-service-vedette]")).toHaveLength(1);
  });

  it("services sans carte désignée : aucune mise en avant", () => {
    const items = fiche.services.items.map(({ enAvant: _e, ...s }: Record<string, unknown>) => s);
    const { container } = render(
      <MetiersCollaborateur donnees={{ ...fiche.services, items: items as never }} />,
    );
    expect(container.querySelectorAll("[data-service-vedette]")).toHaveLength(0);
  });

  it("CitationsTerrain : une grande citation, les autres en grille, attribution", () => {
    const { container } = render(<CitationsTerrain donnees={fiche.citations} auteur="Marie" />);
    expect(container.querySelectorAll("blockquote")).toHaveLength(3);
    expect(container.querySelectorAll("cite")).toHaveLength(3);
    expect(container.querySelector("cite")?.textContent).toBe("Marie");
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("aucune classe bleue ni mocha-rich ; animations sous motion-safe", () => {
    const racines = [
      render(<AvantApres donnees={fiche.avantApres} />).container,
      render(<Rassurance donnees={fiche.rassurance} />).container,
      render(<PorteEntree donnees={fiche.porteEntree} />).container,
      render(<MetiersCollaborateur donnees={fiche.services} />).container,
      render(<CitationsTerrain donnees={fiche.citations} auteur="Marie" />).container,
    ];
    const html = racines.map((r) => r.innerHTML).join(" ");
    expect(html).not.toMatch(
      /mocha-rich|text-primary|bg-primary|ring-primary|halo-cool|accent-purple/,
    );
    // Le Cta (règle prefers-reduced-motion de globals.css) est exclu : il porte data-cta.
    for (const racine of racines) {
      for (const el of Array.from(racine.querySelectorAll("[class]"))) {
        if (el.closest("[data-cta]")) continue;
        const classes = (el.getAttribute("class") ?? "").split(/\s+/);
        for (const c of classes) {
          if (/^(?:group-hover:)?(?:transition(?:-[\w]+)?|translate-x-1|animate-[\w-]+)$/.test(c)) {
            throw new Error(`animation hors motion-safe : ${c}`);
          }
        }
      }
    }
    expect(html).not.toMatch(
      new RegExp(["Gre" + "noble", "freelance", "Aucun gain garanti"].join("|"), "i"),
    );
  });
});
