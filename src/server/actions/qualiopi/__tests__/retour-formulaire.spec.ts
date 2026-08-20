/**
 * 🔴 Le chemin de retour d'un formulaire est une entrée CLIENT.
 *
 * ## Le défaut
 *
 * `signature-revocation.ts` validait le paramètre `retour` par trois
 * conditions : chaîne, commence par `/`, longueur bornée. La deuxième ne suffit
 * pas — `//ailleurs.example` commence par `/` et est pourtant une **URL absolue
 * en protocole relatif** : le navigateur y va.
 *
 * Une révocation de signature pouvait donc se terminer par une sortie de la
 * console vers un domaine choisi par l'auteur du formulaire, avec le code de
 * retour en prime. C'est une redirection ouverte.
 *
 * ⚠️ La validation allait être RECOPIÉE à l'identique pour la révocation
 * d'émargement. Deux copies d'une garde de sécurité, c'est une copie de trop :
 * celle qu'on oublie de durcir est celle qui sert. Elle vit maintenant à un seul
 * endroit, et ce fichier la tient.
 */

import { describe, it, expect } from "vitest";
import { retourValide } from "../_retour-formulaire";

function fd(valeur: string | null): FormData {
  const f = new FormData();
  if (valeur !== null) f.set("retour", valeur);
  return f;
}

describe("`retourValide` — aucune sortie du site", () => {
  it("accepte un chemin interne", () => {
    expect(retourValide(fd("/fr/admin/qualiopi/mode-auditeur/emargement"))).toBe(
      "/fr/admin/qualiopi/mode-auditeur/emargement",
    );
  });

  it("🔴 refuse le protocole relatif `//` — le défaut d'origine", () => {
    // Il commençait par `/`, il passait. Le navigateur, lui, part sur le domaine.
    expect(retourValide(fd("//ailleurs.example/piege"))).toBe("/");
    expect(retourValide(fd("//ailleurs.example"))).toBe("/");
  });

  it("refuse une URL absolue, un chemin relatif, et l'absence de valeur", () => {
    expect(retourValide(fd("https://ailleurs.example"))).toBe("/");
    expect(retourValide(fd("javascript:alert(1)"))).toBe("/");
    expect(retourValide(fd("admin/sans-slash"))).toBe("/");
    expect(retourValide(fd(null))).toBe("/");
    expect(retourValide(fd(""))).toBe("/");
  });

  it("refuse au-delà de la borne de longueur", () => {
    expect(retourValide(fd(`/${"a".repeat(400)}`))).toBe("/");
  });

  it("le témoin : le repli ne recopie JAMAIS l'entrée", () => {
    // 🔑 Un repli qui rendrait la valeur reçue ne validerait rien — il
    // déplacerait le problème d'une ligne. Tous les refus rendent exactement
    // « / », jamais une variante de l'entrée.
    for (const piege of ["//x.example", "https://x.example", "javascript:x", "relatif"]) {
      expect(retourValide(fd(piege))).toBe("/");
    }
  });
});
