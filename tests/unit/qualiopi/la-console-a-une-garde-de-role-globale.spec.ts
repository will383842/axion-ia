/**
 * 🛑 GARDE — la console entière est protégée à UN SEUL endroit.
 *
 * ## Le défaut que cette garde ferme
 *
 * Mesuré le 2026-08-27 : sur **305 pages `(admin)`, 216 ne portaient AUCUN test
 * de rôle**. Le callback `authorized()` d'Auth.js ne vérifie que `isLoggedIn` —
 * jamais le rôle — et aucun layout ne complétait. Un compte authentifié **sans
 * rôle reconnu** atteignait donc ces 216 écrans.
 *
 * Le risque était faible (tout `AdminUser` porte un rôle aujourd'hui) mais pas
 * nul, et surtout **il grandissait en silence** : chaque page ajoutée sans garde
 * élargissait la surface sans que rien ne rougisse.
 *
 * ## 🔑 Pourquoi une garde de LAYOUT et pas 216 gardes de page
 *
 * Le layout `[adminPrefix]` enveloppe les 305 pages. Une garde posée à un seul
 * endroit **ne peut pas être oubliée sur la page suivante**.
 *
 * C'est la leçon du 2026-08-27, payée cher : 64 pages portaient chacune leur
 * propre liste de rôles, dans **trois écritures différentes**, et la troisième
 * a failli être oubliée d'une campagne de correction qui serait passée au vert
 * en migrant 43 cas sur 69.
 *
 * ## ⚠️ CE QUE CETTE GARDE PROTÈGE EN PRIORITÉ : L'ACCÈS À LA CONNEXION
 *
 * La page `/login` vit **dans ce layout**. Une garde qui refuserait l'absence
 * de session verrouillerait tout le monde dehors — administrateurs compris, et
 * sans recours par l'interface. Le test le plus important de ce fichier est
 * donc celui qui vérifie que la garde ne se déclenche **que sur une session
 * existante**.
 *
 * ## Ce que cette garde ne couvre PAS
 *
 * Le PÉRIMÈTRE (qui voit quoi) : il vit dans `peutConsulter`, et c'est le sujet
 * des tests du SSOT. Ici on vérifie seulement que la protection existe, qu'elle
 * est au bon endroit, et qu'elle ne ferme pas la porte d'entrée.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { peutConsulter, ROLES_ADMIN } from "@/server/auth/habilitations";

const LAYOUT = "src/app/[locale]/(admin)/[adminPrefix]/layout.tsx";

function source(): string {
  return readFileSync(join(process.cwd(), LAYOUT), "utf8");
}

describe("🛑 la console a une garde de rôle, et elle est GLOBALE", () => {
  it("🔑 le layout existe et est bien LU", () => {
    // Une garde qui lit un fichier vide compare deux riens et reste verte.
    expect(source().length, `${LAYOUT} est vide ou introuvable`).toBeGreaterThan(2000);
  });

  it("le layout refuse un rôle non reconnu", () => {
    const s = source();
    // 🔑 On cherche l'USAGE, pas l'IMPORT. Premier jet : `toContain("AccesRefuse")`.
    // Le témoin négatif a montré la faille — remplacer `<AccesRefuse … />` par
    // un `<div>` laissait le test VERT, parce que la ligne d'import contient
    // encore le mot. Une garde débranchée serait passée.
    expect(
      s,
      "Le layout n'APPELLE plus `peutConsulter(` : les 305 pages de la console " +
        "redeviennent accessibles à un compte authentifié sans rôle reconnu.",
    ).toMatch(/!peutConsulter\(/);
    expect(
      s,
      "L'écran de refus n'est plus RENDU (`<AccesRefuse`) : la personne serait " +
        "renvoyée sans qu'on lui dise que c'est une question de droits. " +
        "⚠️ L'import seul ne suffit pas — c'est le rendu qui compte.",
    ).toMatch(/<AccesRefuse/);
  });

  it("🔴 elle ne se déclenche QUE sur une session existante — sinon plus personne ne se connecte", () => {
    // Le test le plus important du fichier. `/login` vit dans ce layout : une
    // garde qui refuserait l'absence de session fermerait la console à tout le
    // monde, sans recours par l'interface.
    const s = source();
    expect(
      s,
      "La condition de refus ne teste plus l'EXISTENCE de la session. Si elle " +
        "refuse aussi les visiteurs anonymes, la page /login — qui vit dans ce " +
        "layout — devient inaccessible et PLUS PERSONNE ne peut se connecter.",
    ).toMatch(/session\?\.user\s*&&\s*!peutConsulter/);
  });

  it("🔑 tous les rôles du produit passent — la garde ne ferme à personne", () => {
    // Contre-témoin du périmètre : si `peutConsulter` se resserrait un jour,
    // cette garde de layout mettrait un rôle légitime dehors sur TOUTE la
    // console d'un coup. C'est le revers d'une protection centralisée, et il
    // mérite son propre témoin.
    for (const r of ROLES_ADMIN) {
      expect(peutConsulter(r), `le rôle « ${r} » ne peut plus ouvrir la console`).toBe(true);
    }
    // Et l'inverse : un rôle inconnu est bien refusé, sinon la garde ne garde rien.
    expect(peutConsulter("role_invente"), "un rôle inconnu est accepté").toBe(false);
    expect(peutConsulter(null), "une session sans rôle est acceptée").toBe(false);
  });
});
