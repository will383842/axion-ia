import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { gzipSync } from "node:zlib";
import type { FichePublique } from "@/lib/equipe";
import { HAUTEUR_CARTE, LARGEUR_CARTE, projeter } from "@/lib/equipe";
import { CarteFrance } from "../CarteFrance";
import { preparerCarte } from "../carte-donnees";
import { FOND_FRANCE_PATH } from "../fond-france";

const fiche = (p: Partial<FichePublique> & { slug: string }): FichePublique => ({
  categorie: "specialiste-ia",
  estDirigeantPrincipal: false,
  accord: "n",
  fonction: "",
  reponseQui: "",
  afficherSurCarte: true,
  nom: p.slug.charAt(0).toUpperCase() + p.slug.slice(1),
  initiales: "X",
  ...p,
});

describe("projection : villes de référence dans le cadre", () => {
  const VILLES: ReadonlyArray<readonly [string, number, number]> = [
    ["Brest", 48.39, -4.49],
    ["Strasbourg", 48.57, 7.75],
    ["Perpignan", 42.69, 2.89],
    ["Nice", 43.7, 7.26],
    ["Lille", 50.63, 3.06],
    ["Ajaccio", 41.92, 8.74],
  ];
  it.each(VILLES)("%s tombe dans le viewBox", (_n, lat, lon) => {
    const p = projeter(lat, lon);
    expect(p).not.toBeNull();
    expect(p!.x).toBeGreaterThan(0);
    expect(p!.x).toBeLessThan(LARGEUR_CARTE);
    expect(p!.y).toBeGreaterThan(0);
    expect(p!.y).toBeLessThan(HAUTEUR_CARTE);
  });
  it("le nord est au-dessus du sud, l'ouest à gauche de l'est", () => {
    expect(projeter(50.63, 3.06)!.y).toBeLessThan(projeter(42.69, 2.89)!.y);
    expect(projeter(48.39, -4.49)!.x).toBeLessThan(projeter(48.57, 7.75)!.x);
  });
});

describe("fond de carte", () => {
  it("un seul tracé, ≤ 6 Ko brut et ≤ 2,5 Ko gzip", () => {
    expect(FOND_FRANCE_PATH.startsWith("M")).toBe(true);
    expect(Buffer.byteLength(FOND_FRANCE_PATH)).toBeLessThanOrEqual(6144);
    expect(gzipSync(FOND_FRANCE_PATH).length).toBeLessThanOrEqual(2560);
  });
});

describe("preparerCarte", () => {
  it("couronne : 3 personnes d'une même ville partagent un point et 3 décalages", () => {
    const d = preparerCarte([
      fiche({ slug: "a", ville: "Lyon", departement: "69" }),
      fiche({ slug: "b", ville: "Lyon", departement: "69" }),
      fiche({ slug: "c", ville: "Lyon", departement: "69" }),
    ]);
    expect(d.amas).toHaveLength(1);
    expect(d.amas[0]?.decalages).toHaveLength(3);
  });
  it("jusqu'à 6 : couronne ; au-delà : « +N » (pas de décalages)", () => {
    const n = (k: number) =>
      preparerCarte(
        Array.from({ length: k }, (_, i) =>
          fiche({ slug: `p${i}`, ville: "Lille", departement: "59" }),
        ),
      ).amas[0];
    expect(n(6)?.decalages).toHaveLength(6);
    expect(n(7)?.decalages).toBeNull();
  });
  it("Williams est exclu même s'il est passé en entrée, ainsi que les non-publiés sur la carte", () => {
    const d = preparerCarte([
      fiche({
        slug: "williams",
        estDirigeantPrincipal: true,
        categorie: "direction",
        departement: "69",
      }),
      fiche({ slug: "x", afficherSurCarte: false, departement: "69" }),
      fiche({ slug: "ok", departement: "69" }),
    ]);
    expect(d.total).toBe(1);
    expect(d.amas[0]?.personnes.map((f) => f.slug)).toEqual(["ok"]);
  });
  it("sans lieu exploitable : pas de point", () => {
    expect(preparerCarte([fiche({ slug: "a" })]).total).toBe(0);
  });
});

describe("CarteFrance (rendu HTML)", () => {
  const fiches = [
    fiche({
      slug: "camille",
      nom: "Camille",
      ville: "Brest",
      departement: "29",
      categorie: "direction",
    }),
    fiche({ slug: "paul", nom: "Paul", ville: "Nice", departement: "06", categorie: "apporteur" }),
    fiche({ slug: "lea", nom: "Léa", ville: "Lille", departement: "59", categorie: "developpeur" }),
    fiche({
      slug: "ines",
      nom: "Inès",
      ville: "Strasbourg",
      departement: "67",
      categorie: "partenaire",
    }),
  ];
  const rendu = () => render(<CarteFrance fiches={fiches} idTitre="titre-carte" />).container;

  it("SVG en groupe, lié au titre, viewBox fixe et ratio réservé, sans script", () => {
    const c = rendu();
    const svg = c.querySelector("svg[role='group']")!;
    expect(svg.getAttribute("aria-labelledby")).toBe("titre-carte");
    expect(svg.getAttribute("viewBox")).toBe(`0 0 ${LARGEUR_CARTE} ${HAUTEUR_CARTE}`);
    expect((svg.parentElement as HTMLElement).style.aspectRatio).toBeTruthy();
    expect(c.querySelector("script")).toBeNull();
    expect(c.querySelectorAll("svg path[d^='M']").length).toBeGreaterThanOrEqual(1);
  });
  it("un lien par personne, avec title et aria-label identiques « nom, catégorie, ville »", () => {
    const c = rendu();
    const liens = c.querySelectorAll("svg a");
    expect(liens).toHaveLength(4);
    const paul = c.querySelector("svg a[href='/fr/equipe/paul']")!;
    expect(paul.getAttribute("aria-label")).toBe("Paul, Apporteur d'affaires, Nice");
    expect(paul.querySelector("title")?.textContent).toBe("Paul, Apporteur d'affaires, Nice");
  });
  it("cibles de 12 de rayon, couleurs par jetons, pas de bleu", () => {
    const html = rendu().innerHTML;
    expect(html).toContain('r="12"');
    expect(html).toContain("var(--color-terracotta)");
    expect(html).toContain("var(--color-ochre)");
    expect(html).toContain("var(--color-sage)");
    expect(html).toContain("var(--color-mocha)");
    expect(html).not.toMatch(/blue|#[0-9a-f]{6}/i);
  });
  it("légende : une entrée par catégorie présente, avec son nombre", () => {
    const l = rendu().querySelector("ul[aria-label='Légende de la carte']")!;
    expect(l.querySelectorAll("li")).toHaveLength(4);
    expect(l.textContent).toContain("Apporteurs d'affaires");
    expect(l.textContent).toContain("(1)");
  });
  it("liste équivalente : régions puis villes, chaque nom est un lien HTML", () => {
    const c = rendu();
    const section = c.querySelector("section[aria-label='Bretagne']")!;
    expect(section.textContent).toContain("Brest");
    const lien = section.querySelector("a[href='/fr/equipe/camille']");
    expect(lien?.textContent).toBe("Camille");
    expect(c.querySelector("section[aria-label='Grand Est']")).not.toBeNull();
  });
  it("« +N » mène à l'ancre de la ville dans la liste", () => {
    const sept = Array.from({ length: 7 }, (_, i) =>
      fiche({ slug: `p${i}`, ville: "Lille", departement: "59" }),
    );
    const c = render(<CarteFrance fiches={sept} />).container;
    const plus = c.querySelector("svg a[href^='#']")!;
    expect(plus.textContent).toContain("+7");
    const ancre = plus.getAttribute("href")!.slice(1);
    expect(c.querySelector(`li#${ancre}`)).not.toBeNull();
    expect(c.querySelectorAll("svg a")).toHaveLength(1);
  });
  it("encart d'outre-mer seulement s'il y a une personne", () => {
    expect(rendu().querySelector("svg rect")).toBeNull();
    const c = render(
      <CarteFrance fiches={[fiche({ slug: "r", ville: "Saint-Denis", departement: "974" })]} />,
    ).container;
    expect(c.querySelector("svg rect")).not.toBeNull();
    expect(c.querySelector("section[aria-label='La Réunion']")).not.toBeNull();
  });
  it("aucun point : rien n'est rendu", () => {
    expect(render(<CarteFrance fiches={[]} />).container.innerHTML).toBe("");
  });
});
