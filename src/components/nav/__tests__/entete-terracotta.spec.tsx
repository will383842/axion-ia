/**
 * L'en-tête RESTE TERRACOTTA (correctif du 2026-11-11, après la PR 1916).
 *
 * La refonte (PR 1916) avait passé la barre en fond ivoire (`bg-bg`). Williams avait
 * demandé le contraire : « que le header reste orange, et surtout pas blanc ». Ce
 * fichier verrouille, sur le HTML RENDU :
 *
 *   1. la barre porte `bg-terracotta` (et jamais `bg-bg` / `bg-paper`), et sa
 *      sentinelle `data-tone="terracotta"` dit vrai ;
 *   2. les onglets posés sur la barre sont en `text-mocha-fg` (5,24:1), jamais en
 *      `text-fg` ni `text-mocha` (2,61:1 sur terracotta) ;
 *   3. « La Journée IA » reste un onglet DISTINCT, en pastille de contraste (moka),
 *      jamais orange sur orange ;
 *   4. le méga-menu et le tiroir mobile, eux, restent clairs.
 *
 * Les rapports de contraste sont mesurés par `scripts/check-contrast.ts`.
 */
import { readFileSync } from "node:fs";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";

import fr from "@/messages/fr.json";

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

import { Header } from "../Header";

let doc: Document;

beforeAll(async () => {
  const html = renderToStaticMarkup(await Header());
  doc = new DOMParser().parseFromString(html, "text/html");
});

const classes = (el: Element | null | undefined): string[] =>
  (el?.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);

describe("la barre de l'en-tête est terracotta", () => {
  it("🔴 fond `bg-terracotta`, bordure `terracotta-deep`, jamais ivoire ni blanc", () => {
    const header = doc.querySelector("header");
    const c = classes(header);
    expect(c).toContain("bg-terracotta");
    expect(c).toContain("border-terracotta-deep");
    expect(c).toContain("text-mocha-fg");
    for (const clair of ["bg-bg", "bg-paper", "bg-sand", "border-border"]) {
      expect(c, `la barre ne doit pas porter ${clair}`).not.toContain(clair);
    }
  });

  it("la sentinelle `data-tone` dit la couleur réelle", () => {
    const header = doc.querySelector("header");
    expect(header?.getAttribute("data-tone")).toBe("terracotta");
    expect(classes(header)).toContain(`bg-${header?.getAttribute("data-tone")}`);
  });

  it("🔴 les onglets de la barre sont en ivoire (`text-mocha-fg`), jamais en texte sombre", () => {
    const nav = doc.querySelector("header nav");
    const onglets = [...nav!.children].map((el) =>
      el.matches("a") ? el : el.querySelector("button"),
    );
    expect(onglets).toHaveLength(4);
    for (const o of onglets) {
      const c = classes(o);
      expect(c, o?.textContent ?? "").toContain("text-mocha-fg");
      expect(c).not.toContain("text-fg");
      expect(c).not.toContain("text-mocha");
      // Anneau de focus décalé sur le terracotta, pas sur l'ivoire d'avant.
      expect(c).toContain("focus-visible:ring-offset-terracotta");
    }
  });

  it("🔴 « La Journée IA » reste un onglet distinct, en pastille de contraste", () => {
    const nav = doc.querySelector("header nav");
    const journee = [...nav!.children]
      .filter((el) => el.matches("a"))
      .find((a) => a.textContent?.trim() === "La Journée IA");
    expect(journee, "onglet « La Journée IA » introuvable dans la barre").toBeDefined();
    expect(journee!.getAttribute("href")).toBe("/fr/journee-ia");
    const c = classes(journee);
    expect(c).toContain("bg-mocha");
    expect(c).toContain("rounded-full");
    // Jamais orange sur orange : aucun fond terracotta sur la pastille.
    expect(c.filter((k) => /^bg-terracotta/.test(k))).toEqual([]);
    // Son point de couleur se lit sur le moka.
    expect(classes(journee!.querySelector("span[aria-hidden]"))).toContain(
      "bg-terracotta-on-mocha",
    );
    // Les autres onglets n'ont PAS cette pastille : elle reste la seule mise en avant.
    const autres = [...nav!.children].filter((el) => el.matches("a")).filter((a) => a !== journee);
    for (const a of autres) expect(classes(a)).not.toContain("bg-mocha");
  });

  it("logo en badge ivoire ; loupe et « Nous écrire » en pastille ivoire texte terracotta ; « Réserver un appel » en bleu", () => {
    const logo = doc.querySelector("header a[aria-label$='accueil']");
    expect(classes(logo)).toEqual(expect.arrayContaining(["bg-paper", "text-fg"]));
    for (const cta of ["header-search", "header-secondary"]) {
      expect(classes(doc.querySelector(`[data-cta='${cta}']`))).toEqual(
        expect.arrayContaining(["bg-paper", "text-terracotta"]),
      );
    }
    for (const cta of ["header-primary", "header-primary-compact"]) {
      expect(classes(doc.querySelector(`[data-cta='${cta}']`))).toEqual(
        expect.arrayContaining([
          "bg-primary",
          "text-primary-fg",
          "focus-visible:ring-mocha-fg",
          "focus-visible:ring-offset-terracotta",
        ]),
      );
    }
  });

  it("le méga-menu et le tiroir mobile restent clairs", () => {
    const bouton = doc.querySelector("header nav button[aria-expanded]");
    const panneau = doc.getElementById(bouton!.getAttribute("aria-controls")!);
    expect(classes(panneau)).toContain("bg-paper");
    // Dans le tiroir, le CTA principal reste celui du fond clair.
    expect(classes(doc.querySelector("[data-cta='header-mobile-primary']"))).toContain(
      "focus-visible:ring-offset-bg",
    );
  });

  it("le bouton ☰ (posé sur la barre) est en ivoire", () => {
    const src = readFileSync("src/components/nav/MobileNav.tsx", "utf8");
    expect(src).toContain("border-mocha-fg text-mocha-fg");
    expect(src).not.toContain("border-fg-muted text-fg");
  });
});
