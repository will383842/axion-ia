/**
 * Le lecteur de liens du banc (`tests/e2e/fixtures/formateurs/v2n-lecture.ts`), éprouvé
 * lui-même : un contrôle de « lien mort » qui accepterait tout ne prouverait rien.
 */
import { describe, expect, it } from "vitest";

import {
  liensDe,
  problemesDuTexte,
  routeExiste,
} from "../../../e2e/fixtures/formateurs/v2n-lecture";

describe("V2-N · le lecteur de liens et de textes du banc", () => {
  it("reconnaît les pages réelles du parcours formateur", () => {
    for (const u of [
      "https://axion-ia.com/",
      "https://axion-ia.com/formateur/dossier/0f0e/abc",
      "/formateur/dossier/retrouver",
      "/fr/espace-formateur",
      "/fr/espace-formateur/connexion/jeton",
      "/fr/espace-formateur/remuneration",
      "/fr/politique-confidentialite",
    ]) {
      expect(routeExiste(u), u).toBe(true);
    }
  });

  it("refuse les adresses qui ne mènent à rien (l'attrape-tout et la console ne comptent pas)", () => {
    for (const u of ["/nimporte", "/fr/nimporte/quoi", "/fr/qualiopi/formateurs", "/de/a-propos"]) {
      expect(routeExiste(u), u).toBe(false);
    }
  });

  it("extrait les liens d'un e-mail, sans mailto", () => {
    expect(
      liensDe('<a href="https://axion-ia.com/a?b=1&amp;c=2">x</a><a href="mailto:a@b.c">y</a>'),
    ).toEqual(["https://axion-ia.com/a?b=1&c=2"]);
  });

  it("signale l'anglais, la valeur brute et le crochet non rempli, pas le français courant", () => {
    expect(problemesDuTexte("Votre dossier est signé. Merci !")).toEqual([]);
    expect(problemesDuTexte("Click here")).toHaveLength(1);
    expect(problemesDuTexte("Statut : a_verifier")).toHaveLength(1);
    expect(problemesDuTexte("Bonjour [prénom]")).toHaveLength(1);
  });
});
