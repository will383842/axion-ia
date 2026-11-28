import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { ficheDepuisWilliams, fichePublique } from "@/lib/equipe";
import { ProfilCollaborateur } from "../ProfilCollaborateur";

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

function rendre() {
  const { fiche, contenu } = ficheDepuisWilliams();
  const publique = fichePublique(fiche);
  if (!publique) throw new Error("fiche refusée");
  return render(<ProfilCollaborateur fiche={publique} contenu={contenu} />);
}

const titres = (c: HTMLElement) =>
  Array.from(c.querySelectorAll("h1,h2,h3,h4,h5,h6")).map(
    (h) => `${h.tagName} ${(h.textContent ?? "").replace(/\s+/g, " ").trim()}`,
  );

describe("fiche Williams rendue — plan des titres", () => {
  it("un seul H1 (le nom), et le plan v4 dans l'ordre", () => {
    const { container } = rendre();
    const h = titres(container);
    expect(h.filter((t) => t.startsWith("H1 "))).toEqual(["H1 Williams Jullin"]);
    const h2 = h.filter((t) => t.startsWith("H2 "));
    expect(h2).toEqual([
      "H2 Williams Jullin en bref",
      "H2 Votre entreprise avant et après l'IA",
      "H2 Une transformation sans chamboulement",
      "H2 La Journée IA : la porte d'entrée",
      "H2 Après la Journée IA : l'équipe d'Axion-IA fait tout le reste",
      "H2 La méthode : Chiffrer, Essayer, Trancher",
      "H2 Parcours de Williams Jullin",
      "H2 Ce que Williams Jullin constate sur le terrain",
      "H2 Questions fréquentes sur Williams Jullin",
      "H2 Parler de votre entreprise avec Williams Jullin",
    ]);
  });

  it("les H3 sont les cinq services, les étapes, les jalons puis les huit questions ; aucun H4", () => {
    const { container } = rendre();
    const h3 = titres(container).filter((t) => t.startsWith("H3 "));
    // Cinq tuiles « sans chamboulement », cinq étapes de la Journée IA, puis les services (la transformation, mise en avant, en premier).
    expect(h3.slice(0, 5)).toEqual([
      "H3 Vos outils restent en place.",
      "H3 Une étape à la fois.",
      "H3 Vous décidez à chaque étape.",
      "H3 Vos équipes sont embarquées, pas bousculées.",
      "H3 Vous n'avez rien à piloter côté technique.",
    ]);
    expect(h3.slice(10, 15)).toEqual([
      "H3 Transformation de l'entreprise avec l'IA",
      "H3 Mise en place et solutions IA sur mesure",
      "H3 Automatisation des tâches répétitives",
      "H3 Formation des équipes à l'IA",
      "H3 Coaching IA du dirigeant",
    ]);
    // 5 tuiles + 5 étapes de la Journée IA + 5 services + 3 étapes de la méthode + 3 jalons du parcours + 8 questions.
    expect(h3).toHaveLength(5 + 5 + 5 + 3 + 3 + 8);
    expect(titres(container).some((t) => /^H[4-6] /.test(t))).toBe(false);
  });

  it("jamais de niveau sauté", () => {
    const { container } = rendre();
    let precedent = 0;
    for (const t of titres(container)) {
      const n = Number(t[1]);
      expect(n, t).toBeLessThanOrEqual(precedent + 1);
      precedent = n;
    }
  });
});

describe("fiche Williams rendue — accessibilité et contenu", () => {
  it("réponse de tête : speakable, itemprop, data-answer", () => {
    const { container } = rendre();
    const r = container.querySelector(".speakable[data-answer]");
    expect(r?.getAttribute("itemprop")).toBe("text");
    expect(r?.textContent).toMatch(/^Williams Jullin dirige Axion-IA, la startup française/);
  });

  it("date visible dans une balise <time> égale à la date de révision", () => {
    const { container } = rendre();
    const t = container.querySelector("time");
    expect(t?.getAttribute("datetime")).toBe("2026-11-27T00:00:00.000Z");
    expect(t?.textContent).toBe("27 novembre 2026");
  });

  it("le portrait a un alt et une légende ; la pastille de catégorie porte un libellé", () => {
    const { container } = rendre();
    expect(container.querySelector("figure img")?.getAttribute("alt")).toMatch(/Williams Jullin/);
    expect(container.querySelector("figcaption")?.textContent).toMatch(/Williams Jullin/);
    expect(container.textContent).toContain("Direction");
  });

  it("les réponses de la FAQ sont dans le HTML initial (<details> sans JavaScript)", () => {
    const { container } = rendre();
    const d = container.querySelectorAll("details");
    expect(d).toHaveLength(8);
    expect(d[0]?.querySelector("summary h3")).not.toBeNull();
    expect(d[0]?.textContent).toMatch(/startup française/);
  });

  it("aucun mot interdit dans le HTML", () => {
    const { container } = rendre();
    expect(container.textContent).not.toMatch(/Grenoble|freelance|agence|€|restructuration/i);
  });

  it("les liens internes de la page ne mènent pas vers une page de tarifs", () => {
    const { container } = rendre();
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs.filter((h) => /tarif/i.test(h ?? ""))).toEqual([]);
  });
});

describe("section sans données", () => {
  it("un contenu minimal ne rend aucun H2 vide ni section absente", () => {
    const { fiche, contenu } = ficheDepuisWilliams();
    const publique = fichePublique(fiche)!;
    const {
      avantApres: _a,
      rassurance: _r,
      porteEntree: _p,
      services: _s,
      methode: _m,
      parcours: _pa,
      citations: _c,
      faits: _f,
      ...reste
    } = contenu;
    const mini = { ...reste, faq: [] };
    const { container } = render(<ProfilCollaborateur fiche={publique} contenu={mini} />);
    expect(titres(container).filter((t) => t.startsWith("H2 "))).toEqual([
      "H2 Williams Jullin en bref",
      "H2 Parler de votre entreprise avec Williams Jullin",
    ]);
  });
});
