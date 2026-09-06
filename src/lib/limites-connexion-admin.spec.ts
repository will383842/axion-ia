import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  LIMITE_CONNEXION_COMPTE,
  LIMITE_CONNEXION_IP,
  cleConnexionCompte,
  cleConnexionIp,
} from "./limites-connexion-admin";

/**
 * LE SSOT DES PLAFONDS DE CONNEXION, ET LA RAISON POUR LAQUELLE IL EST TESTÉ.
 *
 * `rate-limit.spec.ts` accepte qu'un appel sensible ne répète pas `surPanne`
 * quand il passe l'une de ces constantes. Cette dispense n'est légitime QUE si
 * quelque chose vérifie les constantes elles-mêmes — sinon elle est une
 * échappatoire, et c'est ce fichier qui la referme.
 */
describe("plafonds de connexion à la console", () => {
  it("refusent de laisser passer pendant une panne du compteur", () => {
    // Laisser passer ici transformerait une panne Redis en ouverture de la
    // console à la force brute. C'est la dispense de `rate-limit.spec.ts` qui
    // repose sur cette assertion : sans elle, la dispense serait un trou.
    expect(LIMITE_CONNEXION_IP.surPanne).toBe("refuser");
    expect(LIMITE_CONNEXION_COMPTE.surPanne).toBe("refuser");
  });

  it("tiennent la fourchette ANSSI pour un formulaire d'authentification", () => {
    // 🔴 Ils valaient 100 (IP) et 50 (compte) — relevés « temporairement » le
    //    2026-05-10, jamais redescendus. La doctrine ANSSI est de 5 à 10 essais
    //    par quart d'heure. Le plafond par COMPTE est celui qui protège du
    //    bourrage d'identifiants : il est le seul borné haut strictement.
    expect(LIMITE_CONNEXION_COMPTE.limit).toBeLessThanOrEqual(10);
    expect(LIMITE_CONNEXION_COMPTE.limit).toBeGreaterThanOrEqual(5);
    expect(LIMITE_CONNEXION_IP.windowSec).toBe(900);
    expect(LIMITE_CONNEXION_COMPTE.windowSec).toBe(900);
  });

  it("laissent l'IP plus haute que le compte — la CI partage une seule clé", () => {
    // ⚠️ Sous `pnpm start` sans proxy, ni `x-real-ip` ni `x-forwarded-for`
    //    n'existent : `getClientIp()` rend "unknown" et les quatre workers
    //    Playwright comptent ensemble. Un plafond IP aligné sur le compte ferait
    //    rougir des suites qui n'ont rien cassé — c'est arrivé deux fois.
    expect(LIMITE_CONNEXION_IP.limit).toBeGreaterThan(LIMITE_CONNEXION_COMPTE.limit);
  });

  it("construisent les clés que les compteurs existants utilisaient déjà", () => {
    // Changer la forme de la clé remettrait à zéro les compteurs en vol et,
    // surtout, ferait perdre à `rate-limit.spec.ts` le préfixe `auth:login`
    // qu'elle balaie.
    expect(cleConnexionIp("1.2.3.4")).toBe("auth:login:ip:1.2.3.4");
    expect(cleConnexionCompte("a@b.fr")).toBe("auth:login:email:a@b.fr");
  });

  /**
   * 🔑 LA GARDE QUI EMPÊCHE LE RETOUR DES DEUX COPIES.
   *
   * Ces plafonds étaient écrits en dur dans `signInAction` ET dans
   * `authorize()`, avec le même commentaire recopié. Deux copies ne divergent
   * pas le jour où on les écrit, mais le jour où l'une est durcie — et la
   * divergence ne se voit sur aucun écran.
   */
  it("ne sont recopiés dans aucun des deux appelants", () => {
    const racine = process.cwd();
    for (const fichier of ["src/auth.ts", "src/features/admin-auth/actions.ts"]) {
      const source = readFileSync(path.join(racine, fichier), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^[ \t]*\/\/.*$/gm, "");
      expect(
        source,
        `${fichier} réécrit une fenêtre de limitation au lieu d'importer le SSOT`,
      ).not.toMatch(/windowSec:\s*900/);
    }
  });
});
