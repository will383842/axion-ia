// Gardes de format de la vCard imprimée sur la carte de visite.
//
// Ces tests ne vérifient pas « le fichier existe » : ils rejouent ce que fait
// un carnet d'adresses — déplier les lignes, relire les champs, décoder la
// photo. Une régression de pliage ou d'échappement produit une fiche vide ou
// tronquée SANS erreur visible côté téléphone ; c'est exactement le genre de
// panne qu'aucune relecture humaine n'attrape.

import { describe, it, expect } from "vitest";

import { BRAND, FOUNDER } from "@/lib/brand";

import { buildVCard, escapeValue, foldLine, WILLIAMS } from "./index";

/** Reconstitue le texte logique en supprimant le pliage (RFC 2426 §2.6). */
function unfold(vcard: string): string[] {
  return vcard
    .replace(/\r\n[ \t]/g, "")
    .split("\r\n")
    .filter(Boolean);
}

/** Récupère la valeur d'une propriété, params éventuels ignorés. */
function field(lines: string[], name: string): string | undefined {
  const line = lines.find(
    (l) => l === name || l.startsWith(`${name}:`) || l.startsWith(`${name};`),
  );
  return line?.slice(line.indexOf(":") + 1);
}

describe("vCard — enveloppe", () => {
  const vcard = buildVCard();

  it("s'ouvre et se ferme comme une vCard 3.0", () => {
    expect(vcard.startsWith("BEGIN:VCARD\r\nVERSION:3.0\r\n")).toBe(true);
    expect(vcard.endsWith("END:VCARD\r\n")).toBe(true);
  });

  it("n'utilise que des fins de ligne CRLF", () => {
    // Un \n orphelin fait rendre une fiche vide sur plusieurs carnets Android,
    // sans le moindre message d'erreur.
    expect(vcard.replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("ne dépasse jamais 75 octets par ligne", () => {
    const trop = vcard
      .split("\r\n")
      .filter((l) => Buffer.byteLength(l, "utf8") > 75)
      .map((l) => `${Buffer.byteLength(l, "utf8")} octets : ${l.slice(0, 40)}…`);
    expect(trop).toEqual([]);
  });

  it("poursuit chaque ligne pliée par une espace", () => {
    const lignes = vcard.split("\r\n").filter(Boolean);
    // Toute ligne qui ne commence pas par une espace doit ressembler à une
    // propriété `NOM:` ou `NOM;PARAM:`.
    const orphelines = lignes.filter((l) => !l.startsWith(" ") && !/^[A-Z][A-Z0-9-]*[;:]/.test(l));
    expect(orphelines).toEqual([]);
  });
});

describe("vCard — contenu", () => {
  const lines = unfold(buildVCard());

  it("porte le nom, la fonction et la société", () => {
    expect(field(lines, "FN")).toBe("Williams Jullin");
    expect(field(lines, "N")).toBe("Jullin;Williams;;;");
    expect(field(lines, "TITLE")).toBe("Fondateur & CEO");
    expect(field(lines, "ORG")).toBe("AXION IA SAS");
  });

  it("reste alignée sur les SSOT d'identité", () => {
    // Le 02/08/2026, la raison sociale existait en sept copies littérales
    // divergentes. Ces gardes comparent la sortie RÉELLE de la fiche aux SSOT,
    // pas les constantes entre elles.
    //
    // ⚠️ Ce qu'elles attrapent exactement : une DIVERGENCE — la SSOT change et
    // la fiche ne suit pas. Elles ne verraient PAS une recopie à l'identique
    // (remplacer `BRAND.legalName` par la même chaîne en dur les laisse
    // vertes) ; c'est l'invariant n° 2 de
    // `src/lib/seo/__tests__/identite-legale-registre.spec.ts` qui traque la
    // duplication, et il ne connaît que la propriété `legalName:`. Ne pas lire
    // ce test comme une interdiction de recopier.
    expect(field(lines, "ORG")).toBe(BRAND.legalName);
    expect(field(lines, "URL")).toBe(BRAND.url);
    // `N` veut nom et prénom séparés : la découpe est manuelle, donc vérifiée.
    expect(field(lines, "FN")).toBe(FOUNDER.fullName);
    // `TITLE` omet la société — que porte déjà `ORG` — mais doit rester le
    // préfixe exact de la fonction publiée ailleurs, sinon les deux divergent.
    expect(FOUNDER.jobTitleFr.startsWith(field(lines, "TITLE") ?? "")).toBe(true);
  });

  it("porte le téléphone et l'e-mail imprimés sur la carte", () => {
    // Ces deux valeurs figurent en clair sur la carte papier : si elles
    // divergent ici, la fiche enregistrée contredit la carte en main.
    expect(field(lines, "TEL")).toBe("+33743331201");
    expect(field(lines, "EMAIL")).toBe("williamsjullin@axion-ia.com");
  });

  it("donne l'adresse du siège en champs structurés", () => {
    expect(field(lines, "ADR")).toBe(
      ";ELITE BUREAUX - boîte 53;11 Avenue Paul Verlaine;Grenoble;;38100;France",
    );
  });

  it("donne une date de naissance complète, avec son millésime", () => {
    expect(field(lines, "BDAY")).toBe("1974-02-25");
    // 🔴 L'année est OBLIGATOIRE ici, et cette garde existe pour ça. La forme
    // sans millésime (`--0225`) a été servie en production le 2026-08-16 : le
    // carnet d'adresses n'affiche pas une date sans année, il lui substitue une
    // année sentinelle, et la fiche annonçait « 25 février 1604 ». Un
    // anniversaire faux est pire que pas d'anniversaire — il déclenche un rappel
    // à une date absurde, et il est cru.
    expect(field(lines, "BDAY")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(field(lines, "BDAY")).not.toMatch(/^--/);
  });

  it("échappe les virgules de la note", () => {
    const note = field(lines, "NOTE") ?? "";
    expect(note).toContain("\\,");
    // Aucune virgule nue : elle ferait basculer la suite du texte hors du champ.
    expect(note.replace(/\\,/g, "")).not.toContain(",");
  });

  it("ne revendique aucune certification Qualiopi", () => {
    // Le certificat n'est pas délivré (QUALIOPI_CERTIFICATION_OBTENUE=false).
    // Cette garde doit rougir si quelqu'un ajoute la mention dans la note.
    expect(buildVCard().toLowerCase()).not.toContain("qualiopi");
  });

  it("embarque un JPEG valide", () => {
    const photo = field(lines, "PHOTO") ?? "";
    const bytes = Buffer.from(photo, "base64");
    // Signature JPEG : FF D8 FF en tête, FF D9 en queue.
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xff, 0xd8, 0xff]);
    expect([bytes[bytes.length - 2], bytes[bytes.length - 1]]).toEqual([0xff, 0xd9]);
    // Assez grande pour une vignette, assez petite pour un téléchargement.
    expect(bytes.length).toBeGreaterThan(5_000);
    expect(bytes.length).toBeLessThan(60_000);
  });

  it("horodate la révision sans dépendre de l'heure du build", () => {
    // Un `new Date()` rendrait la sortie non reproductible d'un build à l'autre.
    expect(field(lines, "REV")).toBe(WILLIAMS.revision);
  });
});

describe("escapeValue", () => {
  it("échappe contre-obliques, virgules, points-virgules et sauts de ligne", () => {
    expect(escapeValue("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
  });
});

describe("foldLine", () => {
  it("laisse une ligne courte intacte", () => {
    expect(foldLine("FN:Williams Jullin")).toBe("FN:Williams Jullin");
  });

  it("ne coupe jamais au milieu d'un caractère multi-octets", () => {
    // 200 « é » : 2 octets chacun. Une découpe naïve sur les caractères
    // produirait des lignes de 150 octets ; une découpe naïve sur les octets
    // couperait un « é » en deux et ferait apparaître un caractère de
    // remplacement dans le carnet d'adresses.
    const plié = foldLine(`NOTE:${"é".repeat(200)}`);
    for (const ligne of plié.split("\r\n")) {
      expect(Buffer.byteLength(ligne, "utf8")).toBeLessThanOrEqual(75);
    }
    expect(plié.replace(/\r\n /g, "")).toBe(`NOTE:${"é".repeat(200)}`);
  });
});
