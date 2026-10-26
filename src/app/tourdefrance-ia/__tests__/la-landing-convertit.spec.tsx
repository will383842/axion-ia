/**
 * LA LANDING DU TOUR EST UNE PAGE DE CONVERSION (refonte du 2026-10-26).
 *
 * Trafic visé : un post Facebook ou Instagram, sur téléphone, dans le navigateur
 * intégré, en 4G. Ce qui doit tenir, en plus de `le-tour-est-ouvert.spec.ts` :
 *
 *   · UNE seule action, « Participer », vers la visio du Tour ; aucun menu ;
 *   · le suivi d'arrivée (`utm_*`, `fbclid`) passe de la page aux boutons, puis
 *     de `/fr/appel/…` à Calendly — exécuté, pas lu ;
 *   · le JavaScript reste minimal : aucun `next/image`, `next/script`, ni
 *     composant d'interface partagé qui tirerait du JS ; la FAQ est un
 *     `details` natif ; les animations sont en CSS et respectent le mouvement
 *     réduit ;
 *   · CLS nul : chaque dessin et la photo portent largeur et hauteur ;
 *   · le vocabulaire : aucun mot du cyclisme, aucun emoji, aucun chiffre hors
 *     de ceux du concept (5 entreprises, 2 à 4 h, 4 h, 30 minutes).
 *
 * Angle mort assumé : jsdom n'a pas de mise en page. « Le bouton tient dans le
 * premier écran à 360 px » se vérifie dans un navigateur (cf. la PR), pas ici.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { avecUtmContent, lireSuiviArrivee } from "@/server/calendly/choix-rendez-vous";

import {
  CHEMIN_RENDEZ_VOUS,
  FONDATEUR,
  LIBELLE_CTA,
  lienRendezVous,
  toutLeTexte,
} from "../contenu";
import { PiloteCta } from "../_composants/PiloteCta";

const RACINE = process.cwd();
const DOSSIER = "src/app/tourdefrance-ia";
const lire = (chemin: string) => readFileSync(join(RACINE, chemin), "utf8");
const sansCommentaires = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ");

const PAGE = lire(`${DOSSIER}/page.tsx`);
const VISUELS = lire(`${DOSSIER}/_composants/Visuels.tsx`);
const CSS = lire(`${DOSSIER}/tour.module.css`);
const SOURCES = [PAGE, VISUELS, lire(`${DOSSIER}/contenu.ts`)].join("\n");

describe("🔑 une seule action : Participer", () => {
  it("le libellé unique est « Participer », et il mène à la visio du Tour", () => {
    expect(LIBELLE_CTA).toBe("Participer");
    expect(lienRendezVous("tdf-heros")).toBe(`${CHEMIN_RENDEZ_VOUS}?depuis=tdf-heros`);
  });

  it("chaque lien de la page qui n'est pas du pied de page est un bouton Participer", () => {
    const code = sansCommentaires(PAGE);
    // Tous les boutons passent par le même composant, avec un emplacement `tdf-…`.
    const emplacements = [...code.matchAll(/<BoutonParticiper\s+depuis="([^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(emplacements).toEqual(["tdf-heros", "tdf-etapes", "tdf-final", "tdf-collant"]);
    for (const e of emplacements) expect(e).toMatch(/^tdf-[a-z-]+$/);
    // Les seuls autres liens : la fiche du fondateur et le pied de page.
    const autres = [...code.matchAll(/href=\{([^}]+)\}/g)].map((m) => m[1]);
    expect(autres).toEqual(["lienRendezVous(depuis)", "FONDATEUR.chemin", "l.href"]);
  });

  it("aucun menu de navigation, aucun carrousel, aucun défilement horizontal", () => {
    expect(PAGE).not.toMatch(/<nav\b/);
    expect(SOURCES).not.toMatch(/carousel|carrousel|swiper|embla|slick|scroll-snap|snap-x/i);
    expect(PAGE).not.toMatch(/overflow-x-(auto|scroll)/);
    expect(lire(`${DOSSIER}/layout.tsx`)).toContain("overflow-x-clip");
  });

  it("le héros dit l'offre, sa condition et le bouton AVANT le dessin (ordre de lecture)", () => {
    const i = (s: string) => PAGE.indexOf(s);
    expect(i("<h1")).toBeGreaterThan(-1);
    expect(i("<h1")).toBeLessThan(i("{HEROS.sousTitre}"));
    expect(i("{HEROS.condition}")).toBeLessThan(i("id={ID_CTA_HEROS}"));
    expect(i("id={ID_CTA_HEROS}")).toBeLessThan(i("<CarteFrance"));
  });
});

describe("🔴 le suivi d'arrivée passe jusqu'à Calendly", () => {
  afterEach(() => {
    cleanup();
    window.history.replaceState(null, "", "/");
  });

  function rendreAvec(query: string): HTMLAnchorElement {
    window.history.replaceState(null, "", `/tourdefrance-ia${query}`);
    const { container } = render(
      <>
        <a href={lienRendezVous("tdf-heros")} id="heros" data-tdf-cta="">
          {LIBELLE_CTA}
        </a>
        <div id="collant" />
        <PiloteCta idHeros="heros" idCollant="collant" />
      </>,
    );
    return container.querySelector("a") as HTMLAnchorElement;
  }

  it("utm_* et fbclid d'un post Facebook sont recopiés sur le bouton, valeurs invalides abandonnées", () => {
    const lien = rendreAvec(
      "?utm_source=facebook&utm_medium=paid-social&utm_campaign=tour-ia&utm_content=post-3&fbclid=IwAR0Zx_9-ab&utm_term=ignore",
    );
    const url = new URL(lien.getAttribute("href") ?? "", "https://axion-ia.com");
    expect(url.pathname).toBe(CHEMIN_RENDEZ_VOUS);
    expect(url.searchParams.get("depuis")).toBe("tdf-heros");
    expect(url.searchParams.get("utm_source")).toBe("facebook");
    expect(url.searchParams.get("utm_medium")).toBe("paid-social");
    expect(url.searchParams.get("utm_campaign")).toBe("tour-ia");
    expect(url.searchParams.get("utm_content")).toBe("post-3");
    expect(url.searchParams.get("fbclid")).toBe("IwAR0Zx_9-ab");

    // …puis `/fr/appel/tour-de-france-ia` les relit, et Calendly les reçoit.
    const suivi = lireSuiviArrivee(Object.fromEntries(url.searchParams));
    expect(suivi).toMatchObject({
      utm_source: "facebook",
      utm_campaign: "tour-ia",
      depuis: "tdf-heros",
    });
    const calendly = new URL(avecUtmContent("https://calendly.com/axion-ia/tour", suivi));
    expect(calendly.searchParams.get("utm_source")).toBe("facebook");
    expect(calendly.searchParams.get("utm_medium")).toBe("paid-social");
    expect(calendly.searchParams.get("utm_campaign")).toBe("tour-ia");
    expect(calendly.searchParams.get("utm_content")).toBe("post-3");
    expect(calendly.searchParams.get("utm_term")).toBe("tdf-heros");
  });

  it("une valeur hors forme n'est pas recopiée (ni utm, ni fbclid)", () => {
    const lien = rendreAvec("?utm_source=%3Cscript%3E&fbclid=a%20b%3Cc");
    const url = new URL(lien.getAttribute("href") ?? "", "https://axion-ia.com");
    expect(url.searchParams.get("utm_source")).toBeNull();
    expect(url.searchParams.get("fbclid")).toBeNull();
    expect(url.searchParams.get("depuis")).toBe("tdf-heros");
  });

  it("aucun pixel, aucun script tiers, aucune mesure ajoutée", () => {
    expect(SOURCES).not.toMatch(/fbq\(|connect\.facebook|plausible\(|gtag\(|<script[^>]+src=/i);
  });
});

describe("🔴 le JavaScript reste minimal, le rendu stable (CLS nul)", () => {
  it("aucun module qui tirerait du JS client : next/image, next/script, UI partagée", () => {
    const imports = [...SOURCES.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1] ?? "");
    for (const i of imports) {
      expect(i).not.toMatch(
        /^next\/(image|script|dynamic|link)$|@\/components\/|@radix-ui|framer|motion/,
      );
    }
  });

  it("la FAQ est un accordéon natif details/summary, six fois", () => {
    expect(PAGE).toContain("<details");
    expect(PAGE).toContain("<summary>");
    expect(PAGE).toMatch(/FAQ\.questions\.map/);
  });

  it("toute animation s'arrête sous prefers-reduced-motion", () => {
    const anime = [...CSS.matchAll(/\.([A-Za-z]+)\s*\{[^}]*animation:/g)].map((m) => m[1]);
    expect(anime.length).toBeGreaterThan(2);
    const reduit = CSS.slice(CSS.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduit.length).toBeGreaterThan(0);
    for (const classe of anime) expect(reduit, classe).toContain(`.${classe}`);
    expect(reduit).toContain("animation: none");
    // Les animations ne touchent pas la mise en page.
    for (const bloc of CSS.matchAll(/@keyframes[^{]+\{([\s\S]*?)\n\}/g)) {
      expect(bloc[1]).not.toMatch(/\b(width|height|top|left|margin|padding)\s*:/);
    }
  });

  it("chaque dessin SVG et la photo portent largeur et hauteur", () => {
    const svgs = [...VISUELS.matchAll(/<svg\b([\s\S]*?)>/g)].map((m) => m[1] ?? "");
    expect(svgs.length).toBeGreaterThan(5);
    for (const attributs of svgs) {
      expect(attributs).toMatch(/width|\{\.\.\.communs\}/);
      expect(attributs).toMatch(/height|\{\.\.\.communs\}/);
      expect(attributs).toMatch(/viewBox|\{\.\.\.communs\}/);
    }
    const img = PAGE.match(/<img\b([\s\S]*?)\/>/)?.[1] ?? "";
    expect(img).toMatch(/width=\{160\}/);
    expect(img).toMatch(/height=\{160\}/);
    expect(img).toContain('loading="lazy"');
  });

  it("la photo du fondateur est la photo publique du site, servie par l'optimiseur aux largeurs par défaut", () => {
    expect(existsSync(join(RACINE, "public", FONDATEUR.photo))).toBe(true);
    // C'est bien la photo publiée par la page « À propos » (même fichier, autre format).
    expect(lire("src/app/[locale]/a-propos/page.tsx")).toContain(
      "/illustrations/home-founder-william.",
    );
    // Les largeurs demandées existent dans `imageSizes` PAR DÉFAUT, que la config ne redéfinit pas.
    const config = lire("next.config.ts");
    expect(config).not.toMatch(/imageSizes|deviceSizes|qualities|unoptimized/);
    const largeurs = PAGE.match(/LARGEURS_PHOTO = \[([^\]]+)\]/)?.[1] ?? "";
    for (const l of largeurs.split(",").map((s) => Number(s.trim()))) {
      expect([16, 32, 48, 64, 96, 128, 256, 384]).toContain(l);
    }
    expect(PAGE).toContain("&q=75");
  });
});

describe("🔴 le vocabulaire de la landing", () => {
  const texte = toutLeTexte();

  it("aucun mot du cyclisme, aucune action interdite, aucun emoji", () => {
    // Le texte seul pour « col » : les sources portent des classes `flex-col`.
    expect(texte).not.toMatch(/\bcol\b/i);
    const interdits: RegExp[] = [
      /sprint/i,
      /\bmaillot/i,
      /\bpeloton/i,
      /\bjaune\b/i,
      /candidater/i,
      /r[ée]server/i,
      /\bdevis\b/i,
      /certifi[ée]/i,
      /\bsignature\b/i,
      /\bobligatoire\b/i,
      /[ée]tincelle/i,
      /\p{Extended_Pictographic}/u,
    ];
    for (const motif of interdits) {
      expect(texte, String(motif)).not.toMatch(motif);
      // Sources sans commentaires : ceux du dépôt portent des repères (🔑, 🔴).
      expect(sansCommentaires(SOURCES), String(motif)).not.toMatch(motif);
    }
  });

  it("aucun chiffre hors de ceux du concept : pas de compteur, pas de statistique", () => {
    const chiffres = new Set(texte.match(/\d+/g) ?? []);
    for (const c of chiffres) expect(["1", "2", "3", "4", "5", "30"], c).toContain(c);
  });

  it("la carte ne nomme aucune ville et le dit", () => {
    expect(VISUELS).not.toMatch(/<text\b/);
    expect(texte).toMatch(/ne représentent pas des villes annoncées/);
  });
});
