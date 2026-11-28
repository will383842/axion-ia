import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { ficheDepuisWilliams, fichePublique } from "@/lib/equipe";
import { ActionsFiche } from "../ActionsFiche";
import { HeroCollaborateur } from "../HeroCollaborateur";
import { BandeauAppel } from "../visuels/BandeauAppel";
import { ChiffresCles } from "../visuels/ChiffresCles";
import { EnteteQuestion } from "../visuels/EnteteQuestion";
import { GrilleEnBref } from "../visuels/GrilleEnBref";
import { ICONES_FICHE, iconeDe } from "../visuels/icones";
import { SectionFiche } from "../visuels/SectionFiche";

vi.mock("next/image", () => ({
  default: ({ fill: _f, priority: _p, ...props }: Record<string, unknown>) => (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img {...(props as object)} />
  ),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: { href: string; children?: unknown }) => (
    <a href={href} {...(props as object)}>
      {children as never}
    </a>
  ),
}));

function williams() {
  const { fiche, contenu } = ficheDepuisWilliams();
  const publique = fichePublique(fiche);
  if (!publique) throw new Error("fiche refusée");
  return { fiche: publique, contenu };
}

const INTERDITS = /text-primary|bg-primary|ring-primary|halo-cool|accent-purple|mocha-rich/;

describe("EnteteQuestion", () => {
  it("un seul h2 relié par aria-labelledby, réponse en data-reponse-section, pas de data-answer", () => {
    const { container } = render(
      <SectionFiche
        id="en-bref"
        entete={{ surTitre: "En bref", question: "Qui est X ?", reponse: "X est une personne." }}
      >
        <p>contenu</p>
      </SectionFiche>,
    );
    const h2 = container.querySelectorAll("h2");
    expect(h2).toHaveLength(1);
    const section = container.querySelector("section");
    expect(section?.getAttribute("aria-labelledby")).toBe(h2[0]?.id);
    expect(container.querySelectorAll("[data-reponse-section]")).toHaveLength(1);
    expect(container.querySelector("[data-answer]")).toBeNull();
    expect(section?.getAttribute("data-fond")).toBe("clair");
  });
  it("sans réponse : pas de paragraphe de réponse", () => {
    const { container } = render(<EnteteQuestion id="x" surTitre="S" question="Q ?" />);
    expect(container.querySelector("[data-reponse-section]")).toBeNull();
  });
  it("tons foncé et terracotta : data-fond et texte ivoire", () => {
    const f = render(
      <SectionFiche id="a" ton="fonce">
        x
      </SectionFiche>,
    ).container.querySelector("section");
    expect(f?.getAttribute("data-fond")).toBe("fonce");
    const t = render(
      <SectionFiche id="b" ton="terracotta">
        x
      </SectionFiche>,
    ).container.querySelector("section");
    expect(t?.getAttribute("data-fond")).toBe("terracotta");
    expect(t?.className).toContain("bg-terracotta-deep");
  });
});

describe("ChiffresCles", () => {
  it("ne rend rien avec 0 ou 1 chiffre", () => {
    expect(renderToStaticMarkup(<ChiffresCles chiffres={[]} />)).toBe("");
    expect(
      renderToStaticMarkup(<ChiffresCles chiffres={[{ valeur: "30+", libelle: "ans" }]} />),
    ).toBe("");
  });
  it("rend une liste étiquetée de chiffres, icônes masquées", () => {
    const { container } = render(
      <ChiffresCles
        chiffres={[
          { valeur: "30+", libelle: "ans", icone: "experience" },
          { valeur: "2023", libelle: "depuis" },
        ]}
      />,
    );
    expect(container.querySelector("ul")?.getAttribute("aria-label")).toBe("Chiffres clés");
    expect(container.querySelectorAll("li")).toHaveLength(2);
    for (const s of container.querySelectorAll("svg")) {
      expect(s.getAttribute("aria-hidden")).toBe("true");
    }
  });
});

describe("GrilleEnBref", () => {
  const lignes = [
    { terme: "Fonction", valeur: "Dirigeant", icone: "fonction" },
    { terme: "Zone", valeur: "France", icone: "zone" },
    { terme: "Autre", valeur: "Valeur", icone: "inconnue" },
  ];
  it("une dl avec autant de dt et de dd que de lignes", () => {
    const { container } = render(<GrilleEnBref lignes={lignes} jeton="sage" />);
    expect(container.querySelectorAll("dl")).toHaveLength(1);
    expect(container.querySelectorAll("dt")).toHaveLength(3);
    expect(container.querySelectorAll("dd")).toHaveLength(3);
  });
  it("icône inconnue : repli, sans erreur", () => {
    expect(iconeDe("inconnue")).toBe(iconeDe(undefined));
    expect(iconeDe("zone")).toBe(ICONES_FICHE.zone);
    expect(iconeDe("toString")).toBe(iconeDe(undefined));
  });
  it("lien vérifiable : rel conservé, mention nouvel onglet", () => {
    const { container } = render(
      <GrilleEnBref
        lignes={lignes}
        jeton="terracotta"
        lien={{ href: "https://exemple.test/p", libelle: "Profil", rel: "me noopener" }}
      />,
    );
    const a = container.querySelector("a");
    expect(a?.getAttribute("rel")).toBe("me noopener");
    expect(a?.textContent).toContain("(nouvel onglet)");
  });
});

describe("héros", () => {
  it("un seul h1, phrase data-answer + speakable, portrait prioritaire, aucun bleu", () => {
    const { fiche, contenu } = williams();
    const { container } = render(
      <HeroCollaborateur
        fiche={fiche}
        contenu={contenu}
        chiffres={[
          { valeur: "30+", libelle: "ans" },
          { valeur: "2023", libelle: "depuis" },
        ]}
      />,
    );
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    const p = container.querySelector("p[data-answer]");
    expect(p?.classList.contains("speakable")).toBe(true);
    expect(container.querySelectorAll("[data-answer]")).toHaveLength(1);
    expect(container.querySelector("figure img, figure svg")).not.toBeNull();
    expect(container.querySelector("header")?.getAttribute("data-fond")).toBe("fonce");
    expect(container.querySelector("ul[aria-label='Chiffres clés']")).not.toBeNull();
    expect(container.innerHTML).not.toMatch(INTERDITS);
    expect(container.querySelector("time")?.getAttribute("datetime")).toBe(contenu.dateMiseAJour);
  });
  it("sans chiffres : pas de rangée de chiffres", () => {
    const { fiche, contenu } = williams();
    const { container } = render(<HeroCollaborateur fiche={fiche} contenu={contenu} />);
    expect(container.querySelector("ul[aria-label='Chiffres clés']")).toBeNull();
  });
});

describe("boutons : anneau de focus jamais bleu", () => {
  it.each(["clair", "fonce", "terracotta"] as const)("fond %s", (fond) => {
    const { fiche, contenu } = williams();
    const { container } = render(
      <ActionsFiche fiche={fiche} contenu={contenu} emplacement="cta" fond={fond} />,
    );
    const liens = container.querySelectorAll("a");
    expect(liens.length).toBeGreaterThan(0);
    for (const a of liens) {
      expect(a.className).toMatch(/focus-visible:ring-(terracotta|mocha-fg)/);
      expect(a.className).not.toContain("ring-primary");
    }
    if (fond === "terracotta") {
      expect(liens[0]?.className).toContain("bg-fg");
    } else {
      expect(liens[0]?.className).toContain("bg-terracotta");
    }
  });
});

describe("BandeauAppel", () => {
  it("h2 relié, fond terracotta foncé, réassurance en liste, svg masqués", () => {
    const { container } = render(
      <BandeauAppel
        titre="Parlons"
        texte="Un texte."
        reassurance={["45 minutes", "Sans engagement"]}
      >
        <button type="button">Réserver</button>
      </BandeauAppel>,
    );
    expect(container.querySelectorAll("h2")).toHaveLength(1);
    expect(container.querySelector("section")?.getAttribute("aria-labelledby")).toBe(
      container.querySelector("h2")?.id,
    );
    expect(container.querySelectorAll("li")).toHaveLength(2);
    for (const s of container.querySelectorAll("svg")) {
      expect(s.getAttribute("aria-hidden")).toBe("true");
    }
    expect(container.innerHTML).not.toMatch(INTERDITS);
  });
  it("pas de réassurance : pas de liste", () => {
    const { container } = render(
      <BandeauAppel titre="T" texte="x">
        <button type="button">Écrire</button>
      </BandeauAppel>,
    );
    expect(container.querySelector("ul")).toBeNull();
  });
});

describe("animations", () => {
  it("toute transition ou animation des briques est sous motion-safe", () => {
    const { container } = render(
      <GrilleEnBref lignes={[{ terme: "A", valeur: "B" }]} jeton="terracotta" />,
    );
    for (const el of container.querySelectorAll("[class]")) {
      const cls = el.getAttribute("class") ?? "";
      if (/(^|\s)(transition|animate-)/.test(cls)) throw new Error(`hors motion-safe : ${cls}`);
    }
  });
});
