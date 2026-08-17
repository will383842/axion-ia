/**
 * 🔴 NDA et SIRET — les deux identifiants qui s'IMPRIMENT sur des pièces
 * opposables.
 *
 * Défaut constaté le 2026-08-17, en recevant le récépissé de déclaration
 * d'activité : les deux clés étaient de simples `z.string().trim()`. Le champ
 * acceptait un nom, un numéro de téléphone, une moitié de numéro.
 *
 * Ce n'est pas un défaut d'affichage. Ces valeurs partent dans les conventions,
 * les contrats, les factures, les attestations et le BPF. Et le SIRET est
 * BLOQUANT au sens de `documents/conformite.ts` : le renseigner **lève le
 * filigrane SPÉCIMEN**. Une coquille produit donc une facture d'apparence
 * valable portant un numéro d'immatriculation qui n'est pas le nôtre — mention
 * obligatoire au sens de l'article R.123-238 du code de commerce.
 */

import { describe, expect, it } from "vitest";
import { QUALIOPI_CONFIG_REGISTRY, cleLuhnSiretValide } from "./registry";

const nda = QUALIOPI_CONFIG_REGISTRY.nda_numero.schema;
const siret = QUALIOPI_CONFIG_REGISTRY.siret.schema;

/** Les VRAIS numéros d'Axion IA — récépissé DREETS et Kbis. */
const NDA_REEL = "84381100438";
const SIRET_REEL = "10801863100011";

describe("🔴 les vrais numéros d'Axion IA passent", () => {
  // ⚠️ Le test le plus important du fichier. Une validation qui refuse un
  // numéro VALABLE est plus grave que pas de validation du tout : elle bloque
  // la saisie sans issue par l'interface, un jour où Will doit justement
  // enregistrer son NDA fraîchement obtenu.
  it("le NDA du récépissé du 17/08/2026", () => {
    expect(nda.parse(NDA_REEL)).toBe(NDA_REEL);
  });

  it("le SIRET, clé de Luhn comprise", () => {
    expect(siret.parse(SIRET_REEL)).toBe(SIRET_REEL);
  });
});

describe("🔴 ce que le champ acceptait avant, et qui partait à l'impression", () => {
  it.each([
    ["un nom", "Williams Jullin"],
    ["un numéro de téléphone", "0755512345"],
    ["une moitié de numéro", "8438110"],
    ["un numéro trop long", "843811004380"],
    ["des lettres au milieu", "8438110O438"],
  ])("NDA — %s est refusé", (_cas, valeur) => {
    expect(() => nda.parse(valeur)).toThrow();
  });

  it.each([
    ["un SIREN seul (9 chiffres)", "108018631"],
    ["un SIRET tronqué", "1080186310001"],
    ["une inversion de deux chiffres", "10801863100101"],
  ])("SIRET — %s est refusé", (_cas, valeur) => {
    expect(() => siret.parse(valeur)).toThrow();
  });
});

describe("les espaces internes sont NORMALISÉS, pas rejetés", () => {
  // Un numéro recopié depuis un PDF administratif arrive presque toujours
  // groupé. Refuser cette forme ferait échouer la saisie la plus naturelle, et
  // la validation serait vécue comme un obstacle plutôt qu'un filet.
  it("SIRET recopié groupé", () => {
    expect(siret.parse("108 018 631 00011")).toBe(SIRET_REEL);
  });

  it("NDA recopié groupé", () => {
    expect(nda.parse("84 38 110 0438")).toBe(NDA_REEL);
  });

  it("la valeur STOCKÉE est toujours compacte", () => {
    // Sinon deux écritures du même numéro donneraient deux valeurs distinctes,
    // et une comparaison ultérieure les croirait différentes.
    expect(siret.parse(" 10801863100011 ")).toBe(SIRET_REEL);
  });
});

describe("le vide reste valide", () => {
  // Ces clés sont facultatives tant que l'organisme n'a pas ses numéros, et
  // refuser le vide empêcherait d'EFFACER une valeur erronée — précisément le
  // geste dont on a besoin le jour où on découvre une coquille.
  it.each([
    ["NDA", nda],
    ["SIRET", siret],
  ])("%s", (_n, schema) => {
    expect(schema.parse("")).toBe("");
    expect(schema.parse("   ")).toBe("");
  });
});

describe("🔴 le message dit CE QU'ON ATTEND", () => {
  // Un refus muet fait ressaisir à l'identique, échouer encore, et croire
  // l'écran cassé.
  it("longueur : il annonce le nombre de chiffres", () => {
    const r = siret.safeParse("108018631");
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toContain("14 chiffres");
  });

  it("clé : il distingue la coquille de la longueur", () => {
    const r = siret.safeParse("10801863100101");
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toContain("clé de contrôle");
  });

  it("le libellé nomme le champ concerné", () => {
    const r = nda.safeParse("123");
    if (!r.success) expect(r.error.issues[0]?.message).toContain("NDA");
  });
});

describe("cleLuhnSiretValide", () => {
  it("accepte le SIRET réel", () => {
    expect(cleLuhnSiretValide(SIRET_REEL)).toBe(true);
  });

  it("rejette une inversion de deux chiffres voisins", () => {
    // La coquille la plus fréquente à la recopie, et la raison d'être de la clé.
    expect(cleLuhnSiretValide("10801863100101")).toBe(false);
  });

  it("🔴 La Poste : sa règle est la somme divisible par 5, pas Luhn", () => {
    // Traité non par prudence rituelle mais parce qu'un refus sur un numéro
    // VALABLE bloque une saisie légitime sans issue par l'interface.
    const laPoste = "35600000009075"; // somme = 35
    expect([...laPoste].reduce((s, c) => s + Number(c), 0) % 5).toBe(0);
    expect(cleLuhnSiretValide(laPoste)).toBe(true);
    // …et il ÉCHOUERAIT à Luhn : c'est bien l'exception qui le sauve.
    expect(laPoste).not.toBe(SIRET_REEL);
  });

  it("et un SIRET La Poste fautif est quand même rejeté", () => {
    // L'exception ne doit pas devenir un passe-droit : sans ce test, une
    // dérogation trop large laisserait passer n'importe quoi commençant par
    // 356000000.
    expect(cleLuhnSiretValide("35600000009076")).toBe(false); // somme = 36
  });
});

describe("🔴 NDA ≠ Qualiopi", () => {
  it("le NDA n'a PAS de clé de contrôle — on n'en invente pas une", () => {
    // Le NDA réel échoue à Luhn. Poser un contrôle de clé dessus « par
    // symétrie » avec le SIRET aurait refusé le numéro que la DREETS vient
    // d'attribuer. Vérifié avant d'écrire le schéma, pas après.
    let somme = 0;
    for (let i = 0; i < NDA_REEL.length; i++) {
      let d = Number(NDA_REEL[NDA_REEL.length - 1 - i]);
      if (i % 2 === 1) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      somme += d;
    }
    expect(somme % 10).not.toBe(0);
    // …et pourtant il est valide.
    expect(nda.parse(NDA_REEL)).toBe(NDA_REEL);
  });
});
