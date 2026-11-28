import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { buildGrapheCollaborateur } from "@/lib/seo/collaborateur-jsonld";
import { fichePublique, ficheDepuisWilliams, FORMULATIONS_INTERDITES, MODELES } from "@/lib/equipe";
import { ficheDepuisMembre, type MembrePublic } from "@/lib/equipe/depuis-membre";
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

const D = new Date("2026-11-01T10:00:00Z");

function membre(category: string, sur: Partial<MembrePublic> = {}): MembrePublic {
  return {
    slug: "camille",
    category,
    firstName: "Camille",
    organizationName: null,
    jobTitle: "Collaboratrice",
    headline: "Camille travaille avec des TPE et PME sur leurs projets du quotidien.",
    bioMd: null,
    skills: [],
    languages: [],
    categoryAnswers: null,
    questionnaireVersion: null,
    linkedinUrl: null,
    websiteUrl: null,
    citySlug: null,
    departmentCode: "69",
    locationLabel: "Lyon",
    latitude: 45.76,
    longitude: 4.84,
    showOnMap: true,
    photoKind: "avatar",
    photoUrl256: null,
    photoUrl1024: null,
    photoAlt: null,
    photoConsentAt: null,
    linkedinConsentAt: null,
    publishedAt: D,
    updatedAt: D,
    ...sur,
  };
}

function rendre(m: MembrePublic) {
  const { fiche, contenu } = ficheDepuisMembre(m);
  const publique = fichePublique(fiche)!;
  const vue = render(<ProfilCollaborateur fiche={publique} contenu={contenu} />);
  const h2 = Array.from(vue.container.querySelectorAll("h2")).map((h) =>
    (h.textContent ?? "").replace(/\s+/g, " ").trim(),
  );
  const boutons = Array.from(vue.container.querySelectorAll("a[data-cta]")).map((a) => ({
    texte: (a.textContent ?? "").trim(),
    href: a.getAttribute("href"),
  }));
  const graphe = buildGrapheCollaborateur(publique, contenu, {
    // Le JSON-LD FAQ n'existe que pour une fiche indexable : on le force ici pour le vérifier.
    indexable: true,
  });
  return { ...vue, h2, boutons, contenu, graphe };
}

function verifierPlan(c: HTMLElement) {
  expect(c.querySelectorAll("h1")).toHaveLength(1);
  for (const h of Array.from(c.querySelectorAll("h1,h2,h3"))) {
    expect((h.textContent ?? "").trim()).not.toBe("");
  }
  // Aucune section rendue sans contenu : chaque <section> à titre H2 porte du texte en plus du titre.
  for (const s of Array.from(c.querySelectorAll("section"))) {
    const h2 = s.querySelector("h2");
    if (!h2) continue;
    const reste = (s.textContent ?? "").replace(h2.textContent ?? "", "").trim();
    expect(reste.length).toBeGreaterThan(0);
  }
}

const jsonFaq = (graphe: ReadonlyArray<unknown>) =>
  JSON.stringify(graphe.filter((n) => (n as { "@type"?: string })["@type"] === "FAQPage"));

describe("sections propres — spécialiste IA", () => {
  it("sections, boutons, plan", () => {
    const r = rendre(membre("specialiste_ia", { skills: ["Droit", "Santé"] }));
    expect(r.h2).toEqual(
      expect.arrayContaining([
        "Les formations et accompagnements animés par Camille",
        "Les métiers et secteurs que Camille connaît",
      ]),
    );
    expect(r.boutons.map((b) => b.texte)).toEqual(
      expect.arrayContaining(["Demander une formation", "Réserver un Diagnostic IA"]),
    );
    expect(r.boutons.find((b) => b.texte === "Réserver un Diagnostic IA")?.href).toBe("/appel");
    verifierPlan(r.container);
  });
  it("sans données : pas de section « métiers et secteurs »", () => {
    const r = rendre(membre("specialiste_ia"));
    expect(r.h2.some((t) => t.startsWith("Les métiers et secteurs"))).toBe(false);
    verifierPlan(r.container);
  });
});

describe("sections propres — développeur", () => {
  it("sections, bouton unique, technologies seulement avec données", () => {
    const sans = rendre(membre("developpeur"));
    expect(sans.h2).toEqual(
      expect.arrayContaining([
        "Ce que Camille construit pour les entreprises",
        "Sécurité et confidentialité des données",
      ]),
    );
    expect(sans.h2.some((t) => t.startsWith("Technologies et méthodes"))).toBe(false);
    verifierPlan(sans.container);
    const avec = rendre(membre("developpeur", { skills: ["TypeScript"] }));
    expect(avec.h2).toContain("Technologies et méthodes de Camille");
    expect(avec.container.textContent).toContain("TypeScript");
    expect(avec.boutons.map((b) => b.texte)).toEqual(["Parler d'un projet", "Parler d'un projet"]);
    expect(avec.boutons[0]?.href).toBe("/contact");
    verifierPlan(avec.container);
  });
});

describe("sections propres — apporteur d'affaires", () => {
  it("sections et boutons", () => {
    const r = rendre(membre("apporteur"));
    expect(r.h2).toEqual(
      expect.arrayContaining([
        "Le rôle de Camille : mettre en relation, pas vendre",
        "Vous avez été contacté par Camille ?",
        "Devenir apporteur d'affaires",
      ]),
    );
    expect(r.boutons.map((b) => b.texte)).toEqual(
      expect.arrayContaining(["Réserver un Diagnostic IA avec Axion-IA", "Devenir apporteur"]),
    );
    expect(r.boutons.some((b) => /avec Camille/.test(b.texte))).toBe(false);
    expect(r.container.querySelector('a[href="/devenir-commercial-ia"]')).not.toBeNull();
    verifierPlan(r.container);
  });
  it.each(["apporteur", "specialiste_ia", "developpeur", "autres"])(
    "%s : aucun montant, commission, pourcentage, prime ni vérification",
    (cat) => {
      const r = rendre(membre(cat));
      const texte = r.container.textContent ?? "";
      const faq = jsonFaq(r.graphe);
      for (const t of [texte, faq, JSON.stringify(Object.values(MODELES))]) {
        expect(t).not.toMatch(/€|\d\s*%|%|\$/);
        expect(t).not.toMatch(
          /commission|prime|challenge|palier|taux|tarif|freelance|vérifi|nous vous confirmons/i,
        );
        for (const re of FORMULATIONS_INTERDITES) expect(t).not.toMatch(re);
      }
    },
  );
  it("FAQ modèle : visible en HTML ET dans le JSON-LD", () => {
    const r = rendre(membre("apporteur"));
    expect(r.container.textContent).toContain("Quel est le lien entre Camille et Axion-IA ?");
    expect(jsonFaq(r.graphe)).toContain("salarié");
  });
});

describe("sections propres — partenaire", () => {
  it("sections, bouton, plan", () => {
    const r = rendre(membre("autres"));
    expect(r.h2).toEqual(
      expect.arrayContaining([
        "Ce que Camille apporte aux missions Axion-IA",
        "Comment Camille travaille avec l'équipe",
      ]),
    );
    expect(r.boutons.map((b) => b.texte)).toContain("Contact");
    expect(r.boutons.find((b) => b.texte === "Contact")?.href).toBe("/contact");
    verifierPlan(r.container);
  });
});

describe("FAQ modèle et direction", () => {
  it.each(["specialiste_ia", "developpeur", "apporteur", "autres"])(
    "%s : 3 à 5 questions, prénom seul",
    (cat) => {
      const r = rendre(membre(cat));
      expect(r.contenu.faq.length).toBeGreaterThanOrEqual(3);
      expect(r.contenu.faq.length).toBeLessThanOrEqual(5);
      expect(JSON.stringify(r.contenu.faq)).not.toContain("{prenom}");
    },
  );
  it("direction : aucune section ni FAQ modèle ni bouton propre", () => {
    const { contenu } = ficheDepuisMembre(membre("direction"));
    expect(contenu.sectionsCategorie).toBeUndefined();
    expect(contenu.faq).toEqual([]);
    expect(contenu.appelFinal.actions).toBeUndefined();
  });
});

describe("Williams : boutons par défaut inchangés", () => {
  it("data-cta et ordre historiques, aucune section de catégorie", () => {
    const { fiche, contenu } = ficheDepuisWilliams();
    const vue = render(<ProfilCollaborateur fiche={fichePublique(fiche)!} contenu={contenu} />);
    const cta = Array.from(vue.container.querySelectorAll("a[data-cta]")).map((a) =>
      a.getAttribute("data-cta"),
    );
    expect(cta).toEqual([
      "equipe-williams-hero-appel",
      "equipe-williams-hero-contact",
      "equipe-journee-ia-appel",
      "equipe-williams-cta-appel",
      "equipe-williams-cta-contact",
    ]);
    expect(contenu.sectionsCategorie).toBeUndefined();
  });
});
