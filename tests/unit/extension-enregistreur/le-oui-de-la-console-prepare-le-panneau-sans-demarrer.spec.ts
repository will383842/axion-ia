/**
 * « Enregistrer cette visio ? » → « Oui, enregistrer » (extension 1.3.0, 2026-10-01).
 *
 *   · le relais (script de contenu, console seulement) transmet l'identifiant
 *     du lien cliqué, et rien d'autre de la page ;
 *   · le service worker le mémorise 30 minutes, puis l'oublie ;
 *   · le panneau PRÉ-SÉLECTIONNE le rendez-vous et met « Démarrer » en avant,
 *     sans jamais démarrer : la capture exige toujours le clic « Démarrer » au
 *     moment de l'annonce (annonce + accord avant toute capture) ;
 *   · « Non, sans enregistrement » efface la mémoire.
 *
 * 1.4.0 (02/10) : le relais porte aussi « Relier à ma console », SEULEMENT sur
 * la page ouverte par la liaison (`?relier=`) : il y lit l'élément masqué posé
 * par la console (`data-relier-*`) et rien d'autre. Ailleurs, il ne lit rien.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";

import { describe, expect, it } from "vitest";

import { VERSION_EXTENSION } from "../../../extensions/enregistreur-meet/lib/constantes.js";
import {
  ATTRIBUT_NON,
  ATTRIBUT_OUI,
  DUREE_MEMOIRE_MS,
  memoriserVisio,
  messageAccepte,
  preselection,
  visioMemorisee,
} from "../../../extensions/enregistreur-meet/lib/visio-a-enregistrer.js";
import { DOSSIER_EXTENSION, sansCommentaires } from "./outils";

const lire = (f: string) => readFileSync(join(DOSSIER_EXTENSION, f), "utf8");
const ID_EXT = "extension-axion";
const CONSOLE = { id: ID_EXT, tab: { id: 7, windowId: 3 }, origin: "https://axion-ia.com" };

/** Exécute le relais dans un bac à sable et rend le clic simulé et les messages partis. */
function relais() {
  let ecouteur: ((ev: unknown) => void) | null = null;
  const envoyes: unknown[] = [];
  const document = {
    addEventListener: (type: string, f: (ev: unknown) => void, capture: boolean) => {
      expect(type).toBe("click");
      expect(capture).toBe(true);
      ecouteur = f;
    },
  };
  const chrome = {
    runtime: {
      sendMessage: (m: unknown) => {
        envoyes.push(m);
        return Promise.resolve();
      },
    },
  };
  runInNewContext(lire("relais-console.js"), {
    document,
    chrome,
    location: { search: "" },
    URLSearchParams,
  });
  const element = (attrs: Record<string, string>) => ({
    getAttribute: (n: string) => (n in attrs ? attrs[n] : null),
  });
  const cliquer = (cible: ReturnType<typeof element> | null, isTrusted = true) =>
    ecouteur?.({ isTrusted, target: { closest: () => cible } });
  return { cliquer, element, envoyes };
}

describe("le relais de la console", () => {
  it("« Oui » transmet l'identifiant ; « Non » demande l'oubli ; ailleurs, rien", () => {
    const r = relais();
    r.cliquer(r.element({ [ATTRIBUT_OUI]: "evt_1" }));
    r.cliquer(r.element({ [ATTRIBUT_NON]: "" }));
    r.cliquer(null);
    expect(r.envoyes).toEqual([
      { type: "visio_a_enregistrer", identifiant: "evt_1" },
      { type: "visio_sans_enregistrement" },
    ]);
  });

  it("un clic SIMULÉ par la page (isTrusted faux) ne relaie rien", () => {
    const r = relais();
    r.cliquer(r.element({ [ATTRIBUT_OUI]: "evt_1" }), false);
    r.cliquer(r.element({ [ATTRIBUT_NON]: "" }), false);
    expect(r.envoyes).toEqual([]);
  });

  it("le relais ne lit rien d'autre de la page et n'y injecte rien", () => {
    const code = sansCommentaires(lire("relais-console.js"));
    expect(code).not.toMatch(
      /textContent|innerText|innerHTML|\.value\b|cookie|localStorage|appendChild|insertAdjacent|fetch/,
    );
    // 1.4.0 — exceptions NOMMÉES de la liaison : l'adresse n'est lue que pour
    // `?relier=`, et le seul élément cherché porte les attributs de liaison.
    expect([...code.matchAll(/location(\.\w+)?/g)].map((m) => m[0])).toEqual(["location.search"]);
    expect([...code.matchAll(/querySelector(All)?\(([^\n]*)\);/g)].map((m) => m[2])).toEqual([
      "`[${NONCE}][${JETON}]:not([${ETAT}])`",
    ]);
    expect(code).toContain(ATTRIBUT_OUI);
    expect(code).toContain(ATTRIBUT_NON);
  });

  it("liaison : sur `?relier=`, l'élément masqué part au service worker, la réponse est marquée", async () => {
    const attrs: Record<string, string> = {
      "data-relier-nonce": "a".repeat(32),
      "data-relier-jeton": "b".repeat(64),
    };
    const el = {
      getAttribute: (n: string) => attrs[n] ?? null,
      setAttribute: (n: string, v: string) => {
        attrs[n] = v;
      },
    };
    const envoyes: unknown[] = [];
    runInNewContext(lire("relais-console.js"), {
      document: {
        addEventListener: () => undefined,
        documentElement: {},
        querySelector: () => (attrs["data-relier-etat"] ? null : el),
      },
      chrome: {
        runtime: {
          sendMessage: (m: unknown) => {
            envoyes.push(m);
            return Promise.resolve({ ok: true });
          },
        },
      },
      location: { search: `?relier=${"a".repeat(32)}` },
      URLSearchParams,
      MutationObserver: class {
        observe() {}
      },
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(envoyes).toEqual([
      { type: "jeton_relie", nonce: "a".repeat(32), jeton: "b".repeat(64) },
    ]);
    expect(attrs["data-relier-etat"]).toBe("ok");
  });

  it("ailleurs que sur `?relier=` : aucun élément n'est cherché", () => {
    let cherche = 0;
    runInNewContext(lire("relais-console.js"), {
      document: {
        addEventListener: () => undefined,
        querySelector: () => {
          cherche++;
          return null;
        },
      },
      chrome: { runtime: { sendMessage: () => Promise.resolve() } },
      location: { search: "?onglet=rendez-vous" },
      URLSearchParams,
    });
    expect(cherche).toBe(0);
  });

  it("le manifeste ne le déclare que sur axion-ia.com, en version 1.4.0", () => {
    const m = JSON.parse(lire("manifest.json"));
    expect(m.content_scripts).toEqual([
      { matches: ["https://axion-ia.com/*"], js: ["relais-console.js"], run_at: "document_idle" },
    ]);
    expect(m.version).toBe("1.4.0");
    // 1.4.0 (02/10) : « Relier à ma console » ; le « Oui, enregistrer » est de la 1.3.0.
    expect(VERSION_EXTENSION).toBe("1.4.0");
  });
});

describe("le service worker n'accepte du relais que ses deux messages", () => {
  it("de la console : les deux messages, l'identifiant borné", () => {
    expect(
      messageAccepte({ type: "visio_a_enregistrer", identifiant: "evt_1" }, CONSOLE, ID_EXT),
    ).toBe("relais");
    expect(messageAccepte({ type: "visio_sans_enregistrement" }, CONSOLE, ID_EXT)).toBe("relais");
    expect(
      messageAccepte({ type: "visio_a_enregistrer", identifiant: "<script>" }, CONSOLE, ID_EXT),
    ).toBe("refuse");
  });

  it("un onglet ne pilote jamais l'enregistreur (démarrer, accord…)", () => {
    for (const type of ["demarrer", "accord", "choisir_rencontre", "demarrer_dictee"]) {
      expect(messageAccepte({ type }, CONSOLE, ID_EXT)).toBe("refuse");
    }
  });

  it("un autre site, une autre extension : refusés ; le panneau reste interne", () => {
    const ailleurs = { ...CONSOLE, origin: "https://exemple.test" };
    expect(messageAccepte({ type: "visio_sans_enregistrement" }, ailleurs, ID_EXT)).toBe("refuse");
    expect(messageAccepte({ type: "lire_etat" }, { id: "autre" }, ID_EXT)).toBe("refuse");
    expect(messageAccepte({ type: "demarrer" }, { id: ID_EXT }, ID_EXT)).toBe("interne");
  });
});

describe("la mémoire du rendez-vous à enregistrer", () => {
  const T = 1_000_000;
  const rencontres = [{ rencontreId: "r-1", calendlyEventId: "evt_1" }, { rencontreId: "r-2" }];

  it("mémorisée 30 minutes, puis oubliée", () => {
    const m = memoriserVisio("evt_1", T);
    expect(visioMemorisee(m, T + DUREE_MEMOIRE_MS - 1)).toBe("evt_1");
    expect(visioMemorisee(m, T + DUREE_MEMOIRE_MS)).toBeNull();
    expect(DUREE_MEMOIRE_MS).toBe(30 * 60 * 1000);
    expect(visioMemorisee(null, T)).toBeNull();
    expect(memoriserVisio("a b", T)).toBeNull();
  });

  it("pré-sélection par la rencontre ou par l'identifiant Calendly, au repos seulement", () => {
    const m = memoriserVisio("evt_1", T);
    expect(preselection({ phase: "repos", rencontres }, m, T)).toEqual({
      rencontreChoisie: "r-1",
      miseEnAvant: true,
    });
    expect(preselection({ phase: "repos", rencontres }, memoriserVisio("r-2", T), T)).toEqual({
      rencontreChoisie: "r-2",
      miseEnAvant: true,
    });
    // Capture en cours : on ne touche à rien.
    expect(preselection({ phase: "en_cours", rencontres }, m, T)).toBeNull();
    expect(preselection({ phase: "accord_en_attente", rencontres }, m, T)).toBeNull();
    // Rendez-vous absent de la liste, ou mémoire expirée : rien.
    expect(preselection({ phase: "repos", rencontres }, memoriserVisio("evt_9", T), T)).toBeNull();
    expect(preselection({ phase: "repos", rencontres }, m, T + DUREE_MEMOIRE_MS)).toBeNull();
  });

  it("la pré-sélection ne démarre rien : « demarrer » reste le seul clic du panneau", () => {
    const panneau = sansCommentaires(lire("panneau.js"));
    expect(panneau.match(/geste\("demarrer"\)/g)).toHaveLength(1);
    expect(panneau).toMatch(/\$\("demarrer"\)\.addEventListener\("click"/);
    const sw = sansCommentaires(lire("service-worker.js"));
    // La machine d'états ne démarre que sur le geste « demarrer ».
    expect(sw.match(/capture\.demarrer\(/g)).toHaveLength(1);
    expect(sw).toMatch(/case "demarrer": \{[\s\S]*?capture\.demarrer\(/);
    expect(sw).toMatch(/case "visio_sans_enregistrement":[\s\S]*?aEnregistrer = null/);
    expect(sw).toContain("chrome.sidePanel.open(");
    expect(sw).toContain("chrome.action.setBadgeText(");
  });
});
