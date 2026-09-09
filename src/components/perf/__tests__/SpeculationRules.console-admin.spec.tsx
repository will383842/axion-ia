/**
 * La console admin ne reçoit AUCUNE règle de spéculation.
 *
 * 🔴 CE QUE CE FICHIER GARDE, ET POURQUOI IL N'EXISTAIT PAS.
 *
 * `SpeculationRules` documente depuis le 2026-05-22 qu'il saute la console —
 * les règles y « crashaient l'error boundary RSC stream » le 2026-05-18. Les
 * trois conditions écrites pour cela étaient toutes mortes (détail dans le
 * docstring du composant), et **aucun test n'existait** : le module n'avait
 * jamais eu de fichier de spec. Une garde sans témoin est une intention.
 *
 * 🔑 LES DEUX PREMIERS CAS NE SUFFISENT PAS, ET C'EST LE POINT DU FICHIER.
 * Un préfixe d'administration est d'autant meilleur qu'il ne s'annonce pas :
 * `ADMIN_URL_PREFIX` est rotatif, et rien n'oblige sa prochaine valeur à
 * contenir « admin ». Le troisième cas éprouve donc un préfixe qui n'en
 * contient pas, avec la coquille admin dans le DOM — c'est la seule couche qui
 * tienne le jour où le préfixe sera tourné.
 *
 * Le témoin POSITIF (« une page publique reçoit bien des règles ») n'est pas
 * décoratif : sans lui, une sonde qui n'injecterait jamais rien — parce que
 * `NODE_ENV` n'est pas ce qu'on croit, ou que `HTMLScriptElement.supports` n'est
 * pas simulé — rendrait ces trois assertions vertes en ne mesurant rien.
 */

import { render, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let cheminCourant = "/fr";

vi.mock("next/navigation", () => ({ usePathname: () => cheminCourant }));

import { SpeculationRules } from "../SpeculationRules";

const ID_INJECTE = "axion-speculation-rules";

function reglesInjectees(): HTMLElement | null {
  return document.getElementById(ID_INJECTE);
}

describe("SpeculationRules — périmètre d'injection", () => {
  beforeEach(() => {
    // Les règles ne sont posées qu'en production : sans ce doublage, chaque
    // assertion « rien n'est injecté » serait vraie pour la mauvaise raison.
    vi.stubEnv("NODE_ENV", "production");
    // jsdom n'implémente pas `HTMLScriptElement.supports`. Le composant s'en
    // sert comme détection de fonctionnalité et repartirait sans rien faire.
    Object.defineProperty(HTMLScriptElement, "supports", {
      configurable: true,
      writable: true,
      value: (type: string) => type === "speculationrules",
    });
  });

  afterEach(() => {
    cleanup();
    reglesInjectees()?.remove();
    document.body.innerHTML = "";
    vi.unstubAllEnvs();
  });

  it("TÉMOIN POSITIF — une page publique reçoit bien des règles", () => {
    cheminCourant = "/fr/tarifs";
    render(<SpeculationRules locale="fr" />);

    const script = reglesInjectees();
    expect(
      script,
      "aucune règle n'a été injectée sur une page publique : les trois assertions " +
        "suivantes seraient vertes sans rien mesurer",
    ).not.toBeNull();
    expect(script?.getAttribute("type")).toBe("speculationrules");
    // La règle attrape-tout est celle qui préchargerait les liens de la barre
    // latérale admin : c'est elle, précisément, qu'on veut voir ici et nulle
    // part sur la console.
    expect(script?.textContent).toContain('"href_matches":"/fr/*"');
  });

  it("aucune règle sur une page de la console (préfixe contenant « admin »)", () => {
    cheminCourant = "/fr/admin-dev-x7k2n9/qualiopi/alertes";
    render(<SpeculationRules locale="fr" />);

    expect(
      reglesInjectees(),
      "des règles de spéculation ont été posées sur la console admin : le navigateur " +
        "préchargerait les ~150 liens de la barre latérale, chacun une page force-dynamic. " +
        "C'est la configuration désactivée le 2026-05-18 pour crash du flux RSC.",
    ).toBeNull();
  });

  it("aucune règle sur la console même si le préfixe rotatif ne contient PAS « admin »", () => {
    // La coquille est posée par `[adminPrefix]/layout.tsx` — c'est déjà le
    // sélecteur dont ce layout se sert pour masquer l'en-tête public.
    const coquille = document.createElement("div");
    coquille.className = "admin-layout-v2";
    document.body.appendChild(coquille);
    cheminCourant = "/fr/x7k2n9-console/qualiopi/alertes";

    render(<SpeculationRules locale="fr" />);

    expect(
      reglesInjectees(),
      "la détection repose uniquement sur le nom du préfixe : le jour où il sera tourné " +
        "vers une valeur sans « admin », la console recevra de nouveau des règles.",
    ).toBeNull();
  });

  it("aucune règle sur l'écran de connexion admin (coquille `.admin-layout`)", () => {
    const coquille = document.createElement("div");
    coquille.className = "admin-layout";
    document.body.appendChild(coquille);
    cheminCourant = "/fr/x7k2n9-console/login";

    render(<SpeculationRules locale="fr" />);

    expect(reglesInjectees()).toBeNull();
  });

  it("aucune règle sur le portail stagiaire — l'URL porte un jeton", () => {
    cheminCourant = "/fr/portail/emarger/eyJhbGciOi.signature";
    render(<SpeculationRules locale="fr" />);

    expect(
      reglesInjectees(),
      "précharger une URL à jeton la fait entrer dans les journaux du CDN pour une page " +
        "que le visiteur n'ouvrira peut-être jamais",
    ).toBeNull();
  });
});
