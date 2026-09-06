/**
 * 🔴 Le montant se SAISIT en euros et se STOCKE en centimes.
 *
 * La colonne est `montantHtCents`. L'écran ne peut pas demander des centimes à
 * un humain — personne ne tape « 190000 » pour 1 900 €. La conversion est donc
 * faite une fois, dans `SessionMontantForm`, et c'est le seul endroit où une
 * erreur d'unité ou d'arrondi se glisserait. Elle irait ensuite sur la
 * CONVENTION et sur la FACTURE.
 *
 * Ce que ces témoins gardent :
 *
 * 1. **l'arrondi** — la conversion n'emprunte AUCUN flottant. `19.99 * 100`
 *    vaut `1998.9999999999998` en IEEE 754 ; `Math.round` le rattrape ici, mais
 *    l'implémentation par concaténation de chaînes ne dépend d'aucun arrondi.
 *    Le témoin vérifie donc le RÉSULTAT sur les valeurs qui piègent le flottant,
 *    pas la technique employée ;
 * 2. **le refus** — ce qui n'est pas un montant doit rendre `null`, jamais un
 *    nombre approximatif. `parseFloat` accepte « 12e3 », « .5 » et « 100abc » :
 *    trois façons d'écrire en base un prix que personne n'a saisi ;
 * 3. **l'aller-retour** — `centimes → euros → centimes` doit être l'identité.
 *    Sans lui, le champ pourrait s'ouvrir sur une valeur que sa propre lecture
 *    ne rend pas, et un simple « enregistrer » sans rien toucher changerait le
 *    prix.
 */

import { describe, it, expect } from "vitest";

import { centimesVersEuros, eurosVersCentimes } from "@/components/admin/qualiopi/montant-euros";

describe("🔴 montant : saisi en euros, stocké en centimes", () => {
  it("convertit les montants ordinaires", () => {
    expect(eurosVersCentimes("100")).toBe(10000);
    expect(eurosVersCentimes("1900")).toBe(190000);
    expect(eurosVersCentimes("0")).toBe(0);
    expect(eurosVersCentimes("1200,50")).toBe(120050);
    expect(eurosVersCentimes("1200.50")).toBe(120050);
  });

  it("une seule décimale vaut des dizaines de centimes, pas des unités", () => {
    // « 1200,5 » = 1 200,50 € = 120050 centimes. Lire « 5 » comme 5 centimes
    // ferait 120005 : 45 centimes d'écart sur une pièce comptable, et l'erreur
    // ne se voit qu'au rapprochement bancaire.
    expect(eurosVersCentimes("1200,5")).toBe(120050);
    expect(eurosVersCentimes("0,5")).toBe(50);
  });

  it("ne dépend d'aucun arrondi flottant", () => {
    // 19.99 * 100 = 1998.9999999999998 · 1.15 * 100 = 114.99999999999999
    expect(eurosVersCentimes("19,99")).toBe(1999);
    expect(eurosVersCentimes("1,15")).toBe(115);
    expect(eurosVersCentimes("8,29")).toBe(829);
  });

  it("tolère les espaces de milliers, insécables compris", () => {
    // Le montant s'affiche « 1 900,00 € » juste au-dessus du champ : un
    // copier-coller ramène l'espace fine insécable de `Intl`.
    expect(eurosVersCentimes("1 900")).toBe(190000);
    expect(eurosVersCentimes("1 900,50")).toBe(190050);
    expect(eurosVersCentimes("1 900")).toBe(190000);
  });

  it("REFUSE ce qui n'est pas un montant, au lieu d'en inventer un", () => {
    for (const saisie of ["", "  ", "abc", "12e3", ".5", "100abc", "-100", "1,234", "1.2.3"]) {
      expect(eurosVersCentimes(saisie)).toBeNull();
    }
  });

  it("l'aller-retour centimes → euros → centimes est l'identité", () => {
    for (const cents of [0, 1, 50, 10000, 120050, 190000, 999999]) {
      expect(eurosVersCentimes(centimesVersEuros(cents))).toBe(cents);
    }
  });

  it("centimesVersEuros écrit la virgule française et deux décimales", () => {
    expect(centimesVersEuros(190000)).toBe("1900,00");
    expect(centimesVersEuros(120050)).toBe("1200,50");
    expect(centimesVersEuros(5)).toBe("0,05");
  });
});
