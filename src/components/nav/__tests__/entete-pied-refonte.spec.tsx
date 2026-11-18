/**
 * Refonte en-tête/pied du 2026-11-11 — ce que la maquette validée par Williams
 * engage, vérifié sur le HTML RENDU (pas sur le code source) :
 *
 *   1. la barre porte 4 onglets, dans l'ordre Accueil · La Journée IA ·
 *      Nos prestations · Tarifs ;
 *   2. le seul montant de l'en-tête et du pied est celui de la Journée IA, lu dans
 *      `pricing.ts` (jamais écrit en dur) ;
 *   3. aucun mot que la charte proscrit (Company Brain) n'y apparaît ;
 *   4. chaque lien interne mène à une route qui existe sous `src/app`.
 *
 * On rend les composants serveur (`await Header()`) puis l'arbre avec
 * `renderToStaticMarkup`. Seuls les points d'entrée du routeur sont simulés : le
 * `Link` de next-intl rend un `<a>` portant le chemin INTERNE (préfixé `/fr`), le
 * tiroir Radix rend ses enfants à plat (son contenu est donc vérifié aussi).
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";

import fr from "@/messages/fr.json";
import { JOURNEE_IA_TIER, formatTierPrice } from "@/content/pricing";

type Href = string | { pathname: string; query?: Record<string, string> };

function versUrl(href: Href): string {
  if (typeof href === "string")
    return href.startsWith("/") ? `/fr${href === "/" ? "" : href}` : href;
  const q = href.query ? `?${new URLSearchParams(href.query).toString()}` : "";
  return `/fr${href.pathname === "/" ? "" : href.pathname}${q}`;
}

function traduire(cle: string): string {
  const v = cle.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], fr);
  return typeof v === "string" ? v : cle;
}

vi.mock("next-intl/server", () => ({
  getLocale: vi.fn(async () => "fr"),
  getTranslations: vi.fn(async () => traduire),
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (k: string) => traduire(`common.${k}`),
}));
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/",
  Link: ({
    href,
    children,
    prefetch: _prefetch,
    ...rest
  }: {
    href: Href;
    children: ReactNode;
    prefetch?: boolean;
    [k: string]: unknown;
  }) => (
    <a href={versUrl(href)} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    prefetch: _prefetch,
    ...rest
  }: {
    href: string;
    children: ReactNode;
    prefetch?: boolean;
    [k: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
// Le tiroir Radix : on rend son contenu à plat pour le vérifier aussi.
vi.mock("../MobileNav", () => ({
  MobileNav: ({ children }: { children: ReactNode }) => <div data-tiroir="">{children}</div>,
}));
// Le badge tire l'authentification (next-auth) à l'import : sans objet ici.
vi.mock("@/components/qualiopi/QualiopiBadge", () => ({ QualiopiBadge: () => null }));
vi.mock("@/server/reviews/presence", () => ({ avisPublies: vi.fn(async () => false) }));

import { Header } from "../Header";
import { Footer } from "../Footer";

let enTete = "";
let pied = "";

beforeAll(async () => {
  delete process.env["QUALIOPI_CERTIFICATION_OBTENUE"];
  enTete = renderToStaticMarkup(await Header());
  pied = renderToStaticMarkup(await Footer());
});

function analyser(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

/** Texte visible + textes accessibles (aria-label, alt, title). */
function textes(html: string): string {
  const doc = analyser(html);
  const attributs = [...doc.querySelectorAll("[aria-label],[alt],[title]")].flatMap((el) =>
    ["aria-label", "alt", "title"].map((a) => el.getAttribute(a) ?? ""),
  );
  return [doc.body.textContent ?? "", ...attributs].join(" \n ").replace(/[  ]/g, " ");
}

describe("en-tête — les 4 onglets de la maquette", () => {
  it("Accueil · La Journée IA · Nos prestations · Tarifs, dans cet ordre", () => {
    const nav = analyser(enTete).querySelector("header nav");
    expect(nav, "navigation principale introuvable").not.toBeNull();
    const onglets = [...nav!.children].map((el) =>
      (el.matches("a") ? el : el.querySelector("button"))?.textContent?.trim(),
    );
    expect(onglets).toEqual(["Accueil", "La Journée IA", "Nos prestations", "Tarifs"]);
  });

  it("« Nos prestations » est un bouton de divulgation, et son panneau liste les 5 services + AI Act", () => {
    const doc = analyser(enTete);
    const bouton = doc.querySelector("header nav button[aria-expanded]");
    expect(bouton?.getAttribute("aria-expanded")).toBe("false");
    const panneau = doc.getElementById(bouton!.getAttribute("aria-controls")!);
    expect(panneau?.hasAttribute("hidden")).toBe(true);
    const liens = [...panneau!.querySelectorAll("li a")].map((a) => a.getAttribute("href"));
    expect(liens).toEqual([
      "/fr/audit",
      "/fr/formations",
      "/fr/implementation",
      "/fr/un-a-un",
      "/fr/sites-web-augmentes",
      "/fr/faq/ai-act-2026",
    ]);
  });

  it("les boutons de rendez-vous disent tous d'où l'on vient", () => {
    const appels = [...analyser(enTete).querySelectorAll("a[href^='/fr/appel']")].map((a) =>
      a.getAttribute("href"),
    );
    expect(appels.length).toBeGreaterThanOrEqual(4);
    for (const h of appels) expect(h).toMatch(/[?&]depuis=entete(-[a-z]+)?\b/);
    const contacts = [...analyser(enTete).querySelectorAll("a[href^='/fr/contact']")];
    for (const a of contacts)
      expect(a.getAttribute("href")).toBe("/fr/contact?depuis=entete-ecrire");
  });
});

describe("aucun montant autre que celui de la Journée IA", () => {
  const PRIX = formatTierPrice(JOURNEE_IA_TIER, "fr").replace(/[  ]/g, " ");
  const MONTANT = /\d[\d  .,]*\s*(?:€|euros?\b|EUR\b)/gi;

  it("TÉMOIN : le prix de la Journée IA est bien affiché par l'en-tête", () => {
    expect(PRIX).toBe("1 490 € HT");
    expect(textes(enTete)).toContain(PRIX);
  });

  it.each([
    ["en-tête", () => enTete],
    ["pied de page", () => pied],
  ])("%s", (_nom, html) => {
    const montants = [...textes(html()).matchAll(MONTANT)].map((m) => m[0].trim());
    for (const m of montants) expect(PRIX.startsWith(m.replace(/\s+/g, " "))).toBe(true);
  });
});

describe("aucun mot proscrit par la charte", () => {
  const INTERDITS: ReadonlyArray<RegExp> = [
    /conforme/i,
    /conformité/i,
    /certifié/i,
    /certificat/i,
    /qualiopi/i,
    /\bCPF\b/,
    /\bOPCO\b/i,
    /financement/i,
    /offert/i,
    /amende/i,
    /\bETI\b/,
    /\b(?:TPE|PME)\s*[/-]\s*(?:TPE|PME)\b/,
    /saas/i,
    /no-?code/i,
    /grenoble/i,
  ];

  it.each([
    ["en-tête", () => enTete],
    ["pied de page", () => pied],
  ])("%s", (_nom, html) => {
    const t = textes(html());
    const trouves = INTERDITS.filter((re) => re.test(t)).map(String);
    expect(trouves).toEqual([]);
  });
});

// ── Chaque lien interne mène à une route existante ──────────────────────────

const APP = path.resolve(process.cwd(), "src/app");

/** Dossiers enfants d'un dossier de routes, groupes `(x)` traversés. */
function enfants(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) =>
      /^\(.+\)$/.test(d.name) ? enfants(path.join(dir, d.name)) : [path.join(dir, d.name)],
    );
}

/**
 * Segments dynamiques ACCEPTÉS, un par un. Un `[x]` à la racine de `[locale]`
 * avalerait n'importe quelle URL (le témoin plus bas l'a montré) : on n'accepte un
 * segment dynamique que là où le contenu visé est vérifié à part.
 */
const DYNAMIQUES_VERIFIES: Readonly<Record<string, string>> = {
  faq: "[slug]", // `/faq/ai-act-2026` — entrée vérifiée dans `transversal.ts` ci-dessous
  equipe: "[slug]", // `/equipe/williams` — fiche statique vérifiée ci-dessous
};

function routeExiste(dir: string, segments: string[], parent = ""): boolean {
  if (segments.length === 0) {
    return ["page.tsx", "page.ts", "route.ts"].some((f) => existsSync(path.join(dir, f)));
  }
  const [tete, ...reste] = segments;
  const candidats = enfants(dir);
  const exact = candidats.find((c) => path.basename(c) === tete);
  if (exact && routeExiste(exact, reste, tete)) return true;
  const dynamique = DYNAMIQUES_VERIFIES[parent];
  const repli = dynamique ? candidats.find((c) => path.basename(c) === dynamique) : undefined;
  return repli !== undefined && routeExiste(repli, reste, tete);
}

function resoudre(url: string): boolean {
  const chemin = url.split(/[?#]/)[0]!;
  // Fichiers servis à la racine (plan du site) : `app/sitemap.xml/route.ts` ou `app/sitemap.ts`.
  if (chemin === "/sitemap.xml") {
    return existsSync(path.join(APP, "sitemap.ts")) || routeExiste(APP, ["sitemap.xml"]);
  }
  const segments = chemin.split("/").filter(Boolean);
  if (segments[0] === "fr") return routeExiste(path.join(APP, "[locale]"), segments.slice(1));
  return routeExiste(APP, segments);
}

describe("chaque lien mène à une route qui existe", () => {
  it.each([
    ["en-tête", () => enTete],
    ["pied de page", () => pied],
  ])("%s", (_nom, html) => {
    const internes = [...analyser(html()).querySelectorAll("a[href]")]
      .map((a) => a.getAttribute("href")!)
      .filter((h) => h.startsWith("/"));
    // TÉMOIN : le parcours lit bien des liens.
    expect(internes.length).toBeGreaterThan(10);
    const morts = [...new Set(internes)].filter((h) => !resoudre(h));
    expect(morts).toEqual([]);
  });

  it("la page AI Act existe bien dans la FAQ (`/faq/[slug]`)", () => {
    const transversal = readFileSync(
      path.resolve(process.cwd(), "src/content/transversal.ts"),
      "utf8",
    );
    expect(transversal).toContain('id: "ai-act-2026"');
  });

  it("la fiche du fondateur est servie sans base de données (`/equipe/williams`)", () => {
    const page = readFileSync(
      path.resolve(process.cwd(), "src/app/[locale]/equipe/[slug]/page.tsx"),
      "utf8",
    );
    expect(page).toContain('slug === "williams"');
  });

  it("TÉMOIN : une route inventée est bien refusée", () => {
    expect(resoudre("/fr/page-qui-n-existe-pas")).toBe(false);
    expect(resoudre("/fr/journee-ia")).toBe(true);
  });
});

describe("pied de page — mentions de la maquette", () => {
  it("déclaration d'activité, prix HT, régions, contact", () => {
    const t = textes(pied);
    expect(t).toContain(
      "Enregistré sous le numéro 84381100438. Cet enregistrement ne vaut pas agrément de l'État.",
    );
    expect(t).toContain("Prix hors taxes. Prestations réservées aux professionnels.");
    expect(t).toContain("Partout en France, dans vos locaux ou à distance : toutes nos régions");
    expect(t).toContain("contact@axion-ia.com");
    expect(t).toContain("LinkedIn");
  });

  it("aucune date de mise à jour écrite en dur", () => {
    expect(textes(pied)).not.toMatch(/mise à jour le/i);
  });
});
