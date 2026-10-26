/**
 * LA LANDING DU TOUR EST UNE PAGE DE CONVERSION (refonte du 2026-10-26).
 *
 * Trafic visé : un post Facebook ou Instagram, sur téléphone, dans le navigateur
 * intégré, en 4G. Ce qui doit tenir, en plus de `le-tour-est-ouvert.spec.ts` :
 *
 *   · UNE seule action, « Participer », vers la visio du Tour ; aucun menu ;
 *   · quatre emplacements de bouton, ceux que la console connaît (tdf-heros,
 *     tdf-bandeau, tdf-final, tdf-collant) — pas un de plus ;
 *   · le suivi d'arrivée (`utm_*` seulement) passe de la page aux boutons, puis
 *     de `/fr/appel/…` à Calendly — exécuté, pas lu ;
 *   · le bouton collant ne se montre qu'entre le bouton du héros et l'appel final ;
 *   · le JavaScript reste minimal : aucun `next/image`, `next/script`, ni
 *     composant d'interface partagé qui tirerait du JS ; la FAQ est un
 *     `details` natif ; les animations sont en CSS et respectent le mouvement
 *     réduit ;
 *   · CLS nul : chaque dessin et la photo portent largeur et hauteur NUMÉRIQUES ;
 *   · aucune animation en boucle infinie ;
 *   · le vocabulaire : aucun mot du cyclisme, aucun emoji, aucun chiffre hors
 *     de ceux du concept (5 entreprises, 2 à 4 h, 4 h, 30 minutes).
 *
 * Angle mort assumé : jsdom n'a pas de mise en page. « Le bouton tient dans le
 * premier écran à 360 px » se vérifie dans un navigateur (cf. la PR), pas ici.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { avecUtmContent, lireSuiviArrivee } from "@/server/calendly/choix-rendez-vous";

import {
  CHEMIN_RENDEZ_VOUS,
  EMPLACEMENTS_CTA,
  FAQ,
  FONDATEUR,
  LIBELLE_CTA,
  MICRO_TEXTE_CTA,
  lienRendezVous,
  toutLeTexte,
} from "../contenu";
import { PiloteCta } from "../_composants/PiloteCta";
import {
  CarteFrance,
  Coche,
  Fleche,
  IllustrationConstat,
  IllustrationMoment,
  Jauge,
  PictoSecteur,
} from "../_composants/Visuels";

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
    // Exactement les quatre que la console connaît, chacun une fois — aucun inventé.
    expect([...emplacements].sort()).toEqual([...EMPLACEMENTS_CTA].sort());
    expect(EMPLACEMENTS_CTA).toEqual(["tdf-heros", "tdf-bandeau", "tdf-final", "tdf-collant"]);
    expect(code).not.toContain("tdf-etapes");
    // Les seuls autres liens : la fiche du fondateur et le pied de page.
    const autres = [...code.matchAll(/href=\{([^}]+)\}/g)].map((m) => m[1]);
    expect(autres).toEqual(["lienRendezVous(depuis)", "FONDATEUR.chemin", "l.href"]);
  });

  it("le bandeau du héros porte la petite pilule « Participer » (tdf-bandeau), 44 px minimum", () => {
    const code = sansCommentaires(PAGE);
    const bandeau = code.slice(code.indexOf("<header"), code.indexOf("</header>"));
    expect(bandeau).toMatch(/<BoutonParticiper\s+depuis="tdf-bandeau"\s+compact\s*\/>/);
    expect(bandeau).toContain("ml-auto");
    // Le bandeau est AVANT le H1 : c'est bien celui du haut de page.
    expect(code.indexOf("</header>")).toBeLessThan(code.indexOf("<h1"));
    // La pilule compacte garde une zone tactile de 44 px et porte `data-tdf-cta` (utm recopiés).
    const compact = CSS.match(/\.boutonCompact\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(compact).toMatch(/min-height:\s*2\.75rem/);
    expect(code).toMatch(/data-tdf-cta=""/);
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
        <h2 id="final" />
        <div id="collant" />
        <PiloteCta idHeros="heros" idFinal="final" idCollant="collant" />
      </>,
    );
    return container.querySelector("a") as HTMLAnchorElement;
  }

  it("les utm_* d'un post Facebook sont recopiés sur le bouton, le fbclid et les valeurs invalides abandonnés", () => {
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
    // `/fr/appel/…` ne lit pas le fbclid : il n'est plus recopié.
    expect(url.searchParams.get("fbclid")).toBeNull();
    expect(sansCommentaires(lire(`${DOSSIER}/_composants/PiloteCta.tsx`))).not.toMatch(/fbclid/i);

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

  it("une valeur hors forme n'est pas recopiée", () => {
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

describe("🔴 le bouton collant : entre le bouton du héros et l'appel final", () => {
  type Entree = { target: Element; isIntersecting: boolean; top: number };
  let rappel: ((entrees: IntersectionObserverEntry[]) => void) | null = null;
  const observees: Element[] = [];

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    rappel = null;
    observees.length = 0;
  });

  function monter() {
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: (entrees: IntersectionObserverEntry[]) => void) {
          rappel = cb;
        }
        observe(el: Element) {
          observees.push(el);
        }
        disconnect() {}
      },
    );
    const { container } = render(
      <>
        <a href={lienRendezVous("tdf-heros")} id="heros" data-tdf-cta="">
          {LIBELLE_CTA}
        </a>
        <h2 id="final" />
        <div id="collant" data-visible="false" />
        <PiloteCta idHeros="heros" idFinal="final" idCollant="collant" />
      </>,
    );
    const el = (id: string) => container.querySelector(`#${id}`) as HTMLElement;
    const signaler = (...entrees: Entree[]) =>
      act(() =>
        rappel?.(
          entrees.map(
            (e) =>
              ({
                target: e.target,
                isIntersecting: e.isIntersecting,
                boundingClientRect: { top: e.top },
              }) as unknown as IntersectionObserverEntry,
          ),
        ),
      );
    return { heros: el("heros"), final: el("final"), collant: el("collant"), signaler };
  }

  it("observe les DEUX cibles : le bouton du héros et l'appel final", () => {
    const { heros, final } = monter();
    expect(observees).toEqual([heros, final]);
  });

  it("caché au héros, visible au milieu, caché dès que l'appel final est à l'écran (et après)", () => {
    const { heros, final, collant, signaler } = monter();
    // Arrivée : le héros est à l'écran, l'appel final loin en dessous.
    signaler(
      { target: heros, isIntersecting: true, top: 200 },
      { target: final, isIntersecting: false, top: 4000 },
    );
    expect(collant.dataset["visible"]).toBe("false");
    expect(collant.hasAttribute("inert")).toBe(true);
    // Le bouton du héros passe au-dessus de l'écran : le collant apparaît.
    signaler({ target: heros, isIntersecting: false, top: -80 });
    expect(collant.dataset["visible"]).toBe("true");
    expect(collant.hasAttribute("inert")).toBe(false);
    // L'appel final entre à l'écran : le collant se cache (un seul rappel, pour la cible finale).
    signaler({ target: final, isIntersecting: true, top: 500 });
    expect(collant.dataset["visible"]).toBe("false");
    expect(collant.hasAttribute("inert")).toBe(true);
    // Plus bas, l'appel final est passé au-dessus (pied de page) : toujours caché.
    signaler({ target: final, isIntersecting: false, top: -300 });
    expect(collant.dataset["visible"]).toBe("false");
    // On remonte au milieu de la page : il revient.
    signaler({ target: final, isIntersecting: false, top: 2500 });
    expect(collant.dataset["visible"]).toBe("true");
  });

  it("la page câble l'appel final par son id, celui du titre de la dernière section", () => {
    const code = sansCommentaires(PAGE);
    expect(code).toMatch(/const ID_APPEL_FINAL = "tdf-appel-final";/);
    expect(code).toContain("id={ID_APPEL_FINAL}");
    expect(code).toMatch(/<PiloteCta[^>]*idFinal=\{ID_APPEL_FINAL\}/);
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

  it("la FAQ est un accordéon natif details/summary, six fois, sans titre DANS le summary", () => {
    expect(PAGE).toContain("<details");
    expect(PAGE).toContain("<summary>");
    expect(PAGE).toMatch(/FAQ\.questions\.map/);
    expect(FAQ.questions).toHaveLength(6);
    // Un `summary` a le rôle de bouton : un titre à l'intérieur y est invalide.
    for (const m of PAGE.matchAll(/<summary>([\s\S]*?)<\/summary>/g)) {
      expect(m[1]).not.toMatch(/<h[1-6]\b/);
      expect(m[1]).toContain("{q.question}");
    }
  });

  it("toute animation s'arrête sous prefers-reduced-motion", () => {
    const anime = [...CSS.matchAll(/\.([A-Za-z]+)\s*\{[^}]*animation:/g)].map((m) => m[1]);
    expect(anime.length).toBeGreaterThan(2);
    const reduit = CSS.slice(CSS.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduit.length).toBeGreaterThan(0);
    for (const classe of anime) expect(reduit, classe).toContain(`.${classe}`);
    expect(reduit).toContain("animation: none");
    // Aucune boucle sans fin : chaque animation se joue un nombre FINI de fois, puis s'arrête.
    expect(CSS).not.toMatch(/infinite/);
    const declarations = [...CSS.matchAll(/\banimation:\s*([^;]+);/g)].map((m) => m[1] ?? "");
    const jouees = declarations.filter((d) => d.trim() !== "none");
    expect(jouees.length).toBe(new Set(anime).size);
    for (const d of jouees) {
      expect(d, d).toMatch(/\s2\s+both$/);
    }
    // Les animations ne touchent pas la mise en page.
    for (const bloc of CSS.matchAll(/@keyframes[^{]+\{([\s\S]*?)\n\}/g)) {
      expect(bloc[1]).not.toMatch(/\b(width|height|top|left|margin|padding)\s*:/);
    }
  });

  it("chaque dessin SVG, RENDU, porte une largeur et une hauteur numériques et un viewBox", () => {
    const { container } = render(
      <>
        <Jauge />
        <CarteFrance titre="Carte" titreId="t" />
        <CarteFrance titre="Carte" titreId="t2" surSombre />
        {[0, 1, 2].map((i) => (
          <IllustrationMoment key={`m${i}`} index={i} />
        ))}
        {[0, 1, 2].map((i) => (
          <IllustrationConstat key={`c${i}`} index={i} />
        ))}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <PictoSecteur key={`s${i}`} index={i} />
        ))}
        <Fleche />
        <Coche />
        <Coche taille={40} surSombre />
      </>,
    );
    const svgs = [...container.querySelectorAll("svg")];
    expect(svgs).toHaveLength(20);
    for (const svg of svgs) {
      for (const dim of ["width", "height"]) {
        const v = svg.getAttribute(dim) ?? "";
        expect(v, `${dim}="${v}"`).toMatch(/^\d+(\.\d+)?$/);
        expect(Number(v)).toBeGreaterThan(0);
      }
      const vb = (svg.getAttribute("viewBox") ?? "").split(/\s+/).map(Number);
      expect(vb).toHaveLength(4);
      // Le rapport largeur/hauteur est celui du viewBox : la place réservée est la bonne.
      const rapport = Number(svg.getAttribute("width")) / Number(svg.getAttribute("height"));
      expect(rapport).toBeCloseTo((vb[2] ?? 0) / (vb[3] ?? 1), 2);
    }
    cleanup();
  });

  it("la photo porte width ET height numériques (littéraux), carrés comme l'image affichée", () => {
    const imgs = [...PAGE.matchAll(/<img\b([\s\S]*?)\/>/g)].map((m) => m[1] ?? "");
    expect(imgs).toHaveLength(1);
    const img = imgs[0] ?? "";
    const largeur = img.match(/\swidth=\{(\d+)\}/)?.[1];
    const hauteur = img.match(/\sheight=\{(\d+)\}/)?.[1];
    expect(largeur).toBe("160");
    expect(hauteur).toBe("160");
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

  it("« gratuit » n'est dit que de l'audit et de la formation : la visio est « sans engagement »", () => {
    expect(MICRO_TEXTE_CTA).toBe("Visio de 30 minutes · sans engagement");
    expect(texte).not.toMatch(/visio[^.]*gratuite|gratuite et sans engagement/i);
    // La phrase est écrite UNE fois (contenu.ts) ; la page la cite sous ses deux grands boutons.
    expect(PAGE.match(/\{MICRO_TEXTE_CTA\}/g)).toHaveLength(2);
  });

  it("ni promesse de résultat ni construction du slogan d'Axion (« partout… sauf »)", () => {
    expect(texte).not.toMatch(/\bpartout\b/i);
    expect(texte).not.toMatch(/\bsauf\b/i);
    expect(texte).not.toMatch(/d[èe]s le lendemain|ce que vous ne voyez plus|gagner du temps/i);
  });

  it("la carte ne nomme aucune ville et le dit", () => {
    expect(VISUELS).not.toMatch(/<text\b/);
    expect(texte).toMatch(/ne représentent pas des villes annoncées/);
  });
});
