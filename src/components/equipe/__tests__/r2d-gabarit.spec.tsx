/**
 * Lot R2d — assemblage : rendu complet de la fiche de Williams et de fiches de collaborateurs
 * fictives (une par catégorie). Les mots interdits se cherchent dans le TEXTE rendu, jamais dans
 * le HTML brut (les attributs contiennent des `%` légitimes).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { buildGrapheCollaborateur } from "@/lib/seo/collaborateur-jsonld";
import { MODELES, ficheDepuisWilliams, fichePublique } from "@/lib/equipe";
import { ficheDepuisMembre, type MembrePublic } from "@/lib/equipe/depuis-membre";
import { ProfilCollaborateur } from "../ProfilCollaborateur";

vi.mock("next/image", () => ({
  default: ({ fill: _f, priority: _p, unoptimized: _u, ...props }: Record<string, unknown>) => (
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

const D = new Date("2026-11-20T10:00:00Z");
const REPONSE_PERSO =
  "Camille accompagne depuis plusieurs années des dirigeants de petites entreprises qui veulent comprendre ce que l'IA peut changer dans leur quotidien, sans jargon, avec des exemples tirés de leurs propres dossiers et un point d'étape à chaque fois.";

function membre(category: string, sur: Partial<MembrePublic> = {}): MembrePublic {
  return {
    slug: "camille",
    category,
    firstName: "Camille",
    organizationName: null,
    jobTitle: "Collaboratrice",
    headline: REPONSE_PERSO,
    bioMd: null,
    skills: ["Automatisation", "Formation"],
    languages: ["français", "anglais"],
    categoryAnswers: null,
    questionnaireVersion: null,
    linkedinUrl: "https://www.linkedin.com/in/camille-durand/",
    websiteUrl: null,
    citySlug: null,
    departmentCode: "38",
    locationLabel: null,
    latitude: null,
    longitude: null,
    showOnMap: false,
    photoKind: "avatar",
    photoUrl256: null,
    photoUrl1024: null,
    photoAlt: null,
    photoConsentAt: null,
    linkedinConsentAt: D,
    publishedAt: D,
    updatedAt: D,
    ...sur,
  };
}

type Cas = {
  nom: string;
  vue: ReturnType<typeof render>;
  graphe: ReadonlyArray<Record<string, unknown>>;
};

function williams(): Cas {
  const { fiche, contenu } = ficheDepuisWilliams({ financementPublic: false });
  const publique = fichePublique(fiche)!;
  return {
    nom: "Williams",
    vue: render(<ProfilCollaborateur fiche={publique} contenu={contenu} indexable />),
    graphe: buildGrapheCollaborateur(publique, contenu, { indexable: true }) as never,
  };
}

function collaborateur(
  category: string,
  { indexable = true, sur = {} as Partial<MembrePublic> } = {},
): Cas {
  const { fiche, contenu } = ficheDepuisMembre(membre(category, sur));
  const publique = fichePublique(fiche)!;
  return {
    nom: `${category}${indexable ? "" : " (non indexable)"}`,
    vue: render(<ProfilCollaborateur fiche={publique} contenu={contenu} indexable={indexable} />),
    graphe: buildGrapheCollaborateur(publique, contenu, { indexable }) as never,
  };
}

const CATEGORIES = ["specialiste_ia", "developpeur", "apporteur", "autres"] as const;
const normal = (t: string | null) => (t ?? "").replace(/\s+/g, " ").trim();
const texte = (c: HTMLElement) => normal(c.textContent);
const IDS_CATEGORIE = Array.from(
  new Set(Object.values(MODELES).flatMap((m) => m.sections.map((x) => x.id))),
);
const IDS_ORDRE = [
  "en-bref",
  "vous-etes",
  "avant-apres",
  "rassurance",
  "methode",
  "journee-ia",
  ...IDS_CATEGORIE,
  "services",
  "parcours",
  "constats",
  "partout-en-france",
  "faq",
  "appel",
];

function verifierGabarit(c: Cas) {
  const racine = c.vue.container;
  // Un seul H1 ; aucun H3 avant le premier H2 ; aucun titre vide.
  expect(racine.querySelectorAll("h1")).toHaveLength(1);
  const titres = Array.from(racine.querySelectorAll("h1,h2,h3"));
  const premierH2 = titres.findIndex((h) => h.tagName === "H2");
  const premierH3 = titres.findIndex((h) => h.tagName === "H3");
  expect(premierH2).toBeGreaterThan(-1);
  if (premierH3 !== -1) expect(premierH3).toBeGreaterThan(premierH2);
  for (const h of titres) expect(normal(h.textContent)).not.toBe("");
  // Aucun bloc vide : chaque section à H2 porte du texte en plus de son titre.
  for (const s of Array.from(racine.querySelectorAll("section"))) {
    const h2 = s.querySelector("h2");
    if (!h2) continue;
    expect(normal(s.textContent).replace(normal(h2.textContent), "").length).toBeGreaterThan(20);
  }
  // Ordre des sections conforme au plan (sous-suite de l'ordre de référence), sans doublon d'id.
  const ids = Array.from(racine.querySelectorAll("section[id]")).map((s) => s.id);
  expect(new Set(ids).size).toBe(ids.length);
  let curseur = -1;
  for (const id of ids) {
    const rang = IDS_ORDRE.indexOf(id);
    expect(rang, `id ${id} hors plan`).toBeGreaterThan(-1);
    expect(rang, `id ${id} dans le désordre`).toBeGreaterThan(curseur);
    curseur = rang;
  }
  expect(ids.at(-1)).toBe("appel");
  // Deux fonds foncés (foncé ou terracotta) ne se touchent jamais.
  const fonds = Array.from(racine.querySelectorAll("[data-fond]")).map((e) =>
    e.getAttribute("data-fond"),
  );
  expect(fonds[0]).toBe("fonce");
  for (let i = 1; i < fonds.length; i++) {
    const sombre = (f: string | null) => f === "fonce" || f === "terracotta";
    expect(sombre(fonds[i - 1] ?? null) && sombre(fonds[i] ?? null), `fonds ${i - 1}/${i}`).toBe(
      false,
    );
  }
  // FAQ visible = FAQPage du graphe, au caractère près ; aucune question reprise d'un H2.
  const visibles = Array.from(racine.querySelectorAll("details")).map((d) => ({
    q: normal(d.querySelector("[data-faq-q]")?.textContent ?? ""),
    r: normal(d.querySelector("[data-faq-a]")?.textContent ?? ""),
  }));
  const faqLd = c.graphe.find((n) => n["@type"] === "FAQPage") as
    { mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }> } | undefined;
  if (faqLd) {
    expect(
      faqLd.mainEntity.map((e) => ({ q: normal(e.name), r: normal(e.acceptedAnswer.text) })),
    ).toEqual(visibles);
  }
  const h2s = new Set(Array.from(racine.querySelectorAll("h2")).map((h) => normal(h.textContent)));
  for (const v of visibles) expect(h2s.has(v.q), `FAQ en double avec un H2 : ${v.q}`).toBe(false);
  // Les `details` sont fermés par défaut.
  for (const d of Array.from(racine.querySelectorAll("details")))
    expect(d.hasAttribute("open")).toBe(false);
  // Les svg sont décoratifs (masqués) : aucun texte lisible. Seul l'avatar à initiales (fiche sans
  // photo) est une image nommée (`role="img"` + libellé) ; ses lettres sont elles-mêmes masquées.
  for (const svg of Array.from(racine.querySelectorAll("svg"))) {
    const copie = svg.cloneNode(true) as SVGElement;
    for (const m of Array.from(copie.querySelectorAll('[aria-hidden="true"]'))) m.remove();
    expect(normal(copie.textContent)).toBe("");
    if (svg.getAttribute("aria-hidden") !== "true") {
      expect(svg.getAttribute("role")).toBe("img");
      expect(svg.getAttribute("aria-label")).toBeTruthy();
    }
  }
  // Mots et classes interdits, dans le TEXTE rendu ; classes dans le HTML.
  const t = texte(racine);
  expect(t).not.toMatch(/Grenoble|freelance|Aucun gain garanti/i);
  expect(t).not.toMatch(/[%€]/);
  expect(racine.innerHTML).not.toMatch(
    /text-primary|bg-primary|ring-primary|halo-cool|accent-purple|mocha-rich/,
  );
  // Chaque bouton d'action a un anneau de focus non bleu.
  for (const a of Array.from(racine.querySelectorAll("a[data-cta]"))) {
    expect(a.className).toMatch(/focus-visible:ring-(terracotta|mocha-fg)/);
  }
  // Aucune image sans dimensions : le portrait est dans un conteneur à ratio fixe.
  expect(racine.querySelector("figure [class*='aspect-square']")).not.toBeNull();
}

describe("R2d — fiche de Williams", () => {
  let c: Cas;
  beforeEach(() => {
    c = williams();
  });
  it("gabarit complet, dans l'ordre du plan", () => {
    verifierGabarit(c);
    expect(Array.from(c.vue.container.querySelectorAll("section[id]")).map((s) => s.id)).toEqual([
      "en-bref",
      "vous-etes",
      "avant-apres",
      "rassurance",
      "methode",
      "journee-ia",
      "services",
      "parcours",
      "constats",
      "partout-en-france",
      "faq",
      "appel",
    ]);
  });
  it("« Vous êtes » remplace « Pour quelles entreprises » et garde pastilles et lien", () => {
    const racine = c.vue.container;
    const section = racine.querySelector("#vous-etes");
    expect(section).not.toBeNull();
    expect(racine.querySelector("#pour-qui")).toBeNull();
    expect(section?.textContent).toContain("Et tous les autres secteurs");
    expect(section?.querySelector('a[href="/formations/secteurs"]')).not.toBeNull();
    expect(section?.textContent).toContain("BTP et artisanat");
  });
  it("« Partout en France » : 12 villes au plus, liens vers les pages de ville", () => {
    const section = c.vue.container.querySelector("#partout-en-france");
    const liens = Array.from(section?.querySelectorAll("a") ?? []).map((a) =>
      a.getAttribute("href"),
    );
    const villes = liens.filter((h) => /^\/implantations\/[^/]+\/[^/]+$/.test(h ?? ""));
    expect(villes.length).toBeGreaterThan(0);
    expect(villes.length).toBeLessThanOrEqual(12);
    expect(liens).toContain("/implantations");
  });
  it("pied de fiche et appel final", () => {
    const racine = c.vue.container;
    const pied = racine.querySelector('nav[aria-label="Pour aller plus loin"]');
    expect(pied).not.toBeNull();
    expect(pied?.querySelector('a[href="/equipe"]')).not.toBeNull();
    expect(racine.querySelector("#appel h2")?.textContent).toBe("Parlons de votre entreprise");
    expect(racine.querySelectorAll("time")).toHaveLength(1);
  });
  it("le nom complet est celui de Williams ; aucune icône inconnue (cercle neutre) dans les cartes", () => {
    const racine = c.vue.container;
    expect(racine.querySelector("h1")?.textContent).toBe("Williams Jullin");
    expect(racine.querySelectorAll("#vous-etes h3")).toHaveLength(11);
  });
});

describe.each(CATEGORIES)("R2d — fiche de collaborateur fictive (%s)", (categorie) => {
  let c: Cas;
  beforeEach(() => {
    c = collaborateur(categorie);
  });
  it("gabarit complet, blocs communs présents (indexable, réponse personnelle)", () => {
    verifierGabarit(c);
    const racine = c.vue.container;
    expect(racine.querySelector("#en-bref [data-reponse-section]")?.textContent).toBe(
      REPONSE_PERSO,
    );
    expect(racine.querySelector("#partout-en-france")).not.toBeNull();
  });
  it("prénom seul : aucun nom de famille, ni e-mail", () => {
    const t = texte(c.vue.container);
    expect(t).not.toMatch(/Durand/);
    expect(t).not.toMatch(/[\w.-]+@[\w-]+\.[a-z]+/i);
    expect(JSON.stringify(c.graphe)).not.toMatch(/Durand/);
  });
  it("le département s'écrit par son nom, jamais « département 38 »", () => {
    const t = texte(c.vue.container);
    expect(t).toContain("Camille travaille dans l'Isère et intervient partout en France.");
    expect(t).not.toMatch(/département\s*\d/i);
  });
});

describe("R2d — blocs communs seulement sur une fiche indexable avec réponse personnelle", () => {
  it("fiche non indexable : ni « Vous êtes », ni présence, ni villes", () => {
    const c = collaborateur("apporteur", { indexable: false });
    verifierGabarit(c);
    expect(c.vue.container.querySelector("#vous-etes")).toBeNull();
    expect(c.vue.container.querySelector("#partout-en-france")).toBeNull();
  });
  it("fiche indexable sans réponse personnelle : mêmes blocs absents", () => {
    const c = collaborateur("apporteur", { sur: { headline: "Courte phrase." } });
    verifierGabarit(c);
    expect(c.vue.container.querySelector("#vous-etes")).toBeNull();
    expect(c.vue.container.querySelector("#partout-en-france")).toBeNull();
  });
  it("apporteur : secteurs et lien sous « Vous êtes », aucun montant ni commission", () => {
    const c = collaborateur("apporteur");
    const racine = c.vue.container;
    expect(racine.querySelector("#vous-etes")?.textContent).toMatch(/Et tous les autres|secteur/i);
    expect(texte(racine)).not.toMatch(/commission|rémunér|taux/i);
  });
});

describe("R2d — aucun JavaScript client dans le gabarit", () => {
  it('aucun "use client" hors questionnaire/', () => {
    const racine = join(process.cwd(), "src/components/equipe");
    const fichiers: string[] = [];
    const parcourir = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        // `FormulaireRetrait` (client, formulaire de retrait) n'est pas dans la fiche.
        if (e.name === "__tests__" || e.name === "questionnaire") continue;
        if (e.name === "FormulaireRetrait.tsx") continue;
        const chemin = join(dir, e.name);
        if (e.isDirectory()) parcourir(chemin);
        else if (/\.(tsx?|ts)$/.test(e.name)) fichiers.push(chemin);
      }
    };
    parcourir(racine);
    const fautifs = fichiers.filter((f) => /["']use client["']/.test(readFileSync(f, "utf8")));
    expect(fautifs).toEqual([]);
  });
});
