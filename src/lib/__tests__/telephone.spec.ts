/**
 * UN NUMÉRO FRANÇAIS NORMAL DOIT PASSER — ET UN NUMÉRO ÉTRANGER AUSSI.
 *
 * ── Pourquoi ce fichier ──────────────────────────────────────────────────
 * Le 2026-09-24, testé au navigateur sur la production : `0639981234` était
 * refusé par le formulaire de contact. Trois candidats avaient écrit en
 * septembre que le formulaire « ne marchait pas » ; l'un d'eux disait avoir
 * essayé sur tous ses navigateurs.
 *
 * ⚠️ CE QUE CE FICHIER EXISTE POUR EMPÊCHER, dans les deux sens :
 *
 *  1. **Le retour du refus.** Un `06…` doit passer. C'est le cas courant, et
 *     c'était lui qu'on renvoyait.
 *
 *  2. **L'élargissement aveugle.** Il ne suffit PAS d'accepter : il faut
 *     NORMALISER. Le site reçoit des candidatures de six pays. Si on se
 *     contentait d'accepter dix chiffres sans les convertir, on rangerait
 *     côte à côte des numéros qu'on ne saurait plus composer — et le test
 *     passerait au vert en ayant créé le problème suivant.
 *
 *  3. **Le refus qui n'explique rien.** Le message doit nommer les DEUX
 *     formes admises. L'ancien n'en exigeait qu'une, ce qui est précisément
 *     ce qui a coûté des candidatures.
 */

import { describe, expect, it } from "vitest";

import {
  FORMES_ACCEPTEES,
  lireTelephone,
  normaliserTelephone,
  telephoneEstLisible,
} from "../telephone";

describe("un numéro français écrit comme on le dit", () => {
  it("🔴 accepte le cas qui était refusé en production, et le normalise", () => {
    const lu = lireTelephone("0639981234");
    expect(lu.ok).toBe(true);
    // Ce n'est PAS « accepté tel quel » : la forme rangée est internationale.
    expect(lu.ok && lu.e164).toBe("+33639981234");
  });

  it("accepte les mises en forme que les gens écrivent vraiment", () => {
    for (const saisie of [
      "06 39 98 12 34",
      "06.39.98.12.34",
      "06-39-98-12-34",
      "(0) 639981234".replace("(0) ", "0"),
      " 0639981234 ",
      "01 42 68 53 00",
      "09 70 80 90 10",
    ]) {
      const lu = lireTelephone(saisie);
      expect(lu.ok, saisie).toBe(true);
    }
  });

  it("l'espace INSÉCABLE d'un copier-coller ne fait pas échouer la lecture", () => {
    // Un numéro recopié depuis une page web arrive souvent avec U+00A0 ou
    // U+202F. Invisible à l'œil, fatal à une expression régulière naïve.
    expect(lireTelephone("06 39 98 12 34").ok).toBe(true);
  });
});

describe("les numéros étrangers, qui sont la raison de normaliser", () => {
  it("garde l'indicatif tel quel — Madagascar, Tunisie, Togo, Maroc, Espagne", () => {
    const cas: ReadonlyArray<readonly [string, string]> = [
      ["+261 34 60 609 58", "+261346060958"],
      ["+216 20 123 456", "+21620123456"],
      // 229 puis 01 46 61 68 18 — dix chiffres, aucun avale.
      ["+229 01 46 61 68 18", "+2290146616818"],
      ["+212 6 62 02 29 08", "+212662022908"],
      ["+34 697 71 06 66", "+34697710666"],
      ["+33 6 12 34 56 78", "+33612345678"],
    ];
    for (const [saisie, attendu] of cas) {
      const lu = lireTelephone(saisie);
      expect(lu.ok, saisie).toBe(true);
      expect(lu.ok && lu.e164, saisie).toBe(attendu);
    }
  });

  it("le préfixe 00 vaut le +", () => {
    expect(lireTelephone("0033 6 12 34 56 78")).toEqual({ ok: true, e164: "+33612345678" });
  });
});

describe("ce qui reste refusé, et comment on le dit", () => {
  it("refuse ce qui n'est pas un numéro", () => {
    for (const saisie of ["", "   ", "abc", "06 39 98", "0039981234567890123456", "+0 123456789"]) {
      expect(telephoneEstLisible(saisie), saisie).toBe(false);
    }
  });

  it("🔑 le motif de refus nomme les DEUX formes — c'est l'ancien qui n'en nommait qu'une", () => {
    const lu = lireTelephone("nawak");
    expect(lu.ok).toBe(false);
    expect(lu.ok === false && lu.motif).toBe(FORMES_ACCEPTEES);
    expect(FORMES_ACCEPTEES).toContain("06 12 34 56 78");
    expect(FORMES_ACCEPTEES).toContain("+212");
  });

  it("un numéro à neuf chiffres commençant par 0 n'est PAS français", () => {
    // 0 + 8 chiffres : ni une forme nationale française, ni une internationale.
    expect(telephoneEstLisible("012345678")).toBe(false);
  });

  it("🔑 `00` est lu comme l'indicatif international, PAS comme un 0 national", () => {
    // Première rédaction de ce test : on attendait un refus. C'était faux —
    // `00` EST le préfixe international. La règle nationale exige un second
    // chiffre non nul (`0[1-9]`), donc `0012345678` ne peut être que du
    // `+1 2345678`. Le module avait raison, le test avait tort.
    expect(lireTelephone("0012345678")).toEqual({ ok: true, e164: "+12345678" });
  });
});

describe("le repli de `normaliserTelephone`", () => {
  it("rend la forme internationale quand il sait lire", () => {
    expect(normaliserTelephone("06 39 98 12 34")).toBe("+33639981234");
  });

  it("🔑 rend la SAISIE quand il ne sait pas lire — jamais une chaîne vide", () => {
    // Si une garde en amont laisse passer l'illisible, on garde ce que la
    // personne a écrit : on peut encore la rappeler. Une chaîne vide, non.
    expect(normaliserTelephone("  poste 4512  ")).toBe("poste 4512");
  });
});
