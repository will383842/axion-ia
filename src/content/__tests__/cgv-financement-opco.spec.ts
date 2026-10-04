/**
 * Garde-fou — article « Financement par un opérateur de compétences (OPCO) »
 * des CGV (lot OPCO O13, 2026-10-04).
 *
 * Les CGV ne disaient rien du financement par un OPCO : zéro occurrence de
 * « subrogation ». Or les conventions de formation (bipartite et tripartite)
 * portent depuis le 16/08 une clause de défaillance du financeur ; les CGV,
 * annexées à ces conventions, doivent dire la même chose dans les mêmes mots
 * — deux rédactions du même engagement s'interprètent l'une contre l'autre
 * (art. 1190 C. civ.).
 *
 * Trois familles :
 *   1. PRÉSENCE de l'article et des cinq règles, en FR et en EN.
 *   2. COHÉRENCE avec la clause de défaillance des conventions (vocabulaire).
 *   3. TENABILITÉ : aucun délai promis par Axion-IA, aucun médiateur.
 */
import { describe, it, expect } from "vitest";
import { getLegal } from "@/content/legal";

const CGV = getLegal("conditions-generales");
const TITRE_FR = "Financement par un opérateur de compétences (OPCO)";
const TITRE_EN = "Funding by a skills operator (OPCO)";

function article(locale: "fr" | "en", titre: string): string {
  const found = CGV[locale].sections.find((s) => s.title === titre);
  if (!found) {
    throw new Error(
      `Article « ${titre} » introuvable dans les CGV (${locale}). Titres présents :\n` +
        CGV[locale].sections.map((s) => `  - ${s.title}`).join("\n"),
    );
  }
  return found.body;
}

describe("CGV — article Financement par un OPCO (FR)", () => {
  it("1. la demande de prise en charge incombe au Client, avant le début, pièces transmises", () => {
    const b = article("fr", TITRE_FR);
    expect(b).toMatch(/il appartient au Client de déposer sa demande de prise en charge/);
    expect(b).toMatch(/avant le début de la formation/);
    expect(b).toMatch(/dans les délais et selon les modalités fixés par cet OPCO/);
    expect(b).toMatch(/convention de formation, programme, devis/);
  });

  it("2. subrogation : OPCO facturé pour sa part, Client pour le solde ; sinon tout au Client", () => {
    const b = article("fr", TITRE_FR);
    expect(b).toMatch(/subrogation de paiement/);
    expect(b).toMatch(/facture l'OPCO pour la part prise en charge et le Client pour le solde/);
    expect(b).toMatch(/fait son affaire du remboursement/);
    // Relecture A07 : aucune date ni réforme datée — la modalité suit l'accord.
    expect(b).not.toMatch(/1er octobre 2026/);
    expect(b).toMatch(
      /relevant des règles propres à chaque OPCO, notamment fiscales, et pouvant évoluer/,
    );
    expect(b).toMatch(/la modalité applicable est celle que retient l'accord de prise en charge/);
  });

  it("3. refus, prise en charge partielle ou absence de réponse : le Client reste redevable, sauf annulation", () => {
    const b = article("fr", TITRE_FR);
    expect(b).toMatch(/refus, de prise en charge partielle ou d'absence de réponse/);
    expect(b).toMatch(/demeurent dues par le Client/);
    expect(b).toMatch(
      /sauf annulation de sa part, les sommes dues étant alors celles prévues par la clause « Annulation, report et remboursement »/,
    );
  });

  it("4. heures d'absence : non prises en charge, facturées au Client, abandon réservé", () => {
    const b = article("fr", TITRE_FR);
    expect(b).toMatch(
      /heures effectivement suivies par chaque stagiaire, attestées par l'émargement/,
    );
    expect(b).toMatch(/restent dues par le Client ; elles lui sont facturées distinctement/);
    expect(b).toMatch(/ne peuvent être présentées à l'OPCO/);
    expect(b).toMatch(/l'arrêt définitif de la participation du stagiaire à l'action/);
    expect(b).toMatch(/« Dédit et abandon en cours d'exécution »/);
  });

  it("5. part acceptée mais non réglée par l'OPCO : redevient exigible auprès du Client", () => {
    const b = article("fr", TITRE_FR);
    expect(b).toMatch(/dossier incomplet du fait du Client/);
    expect(b).toMatch(/refus de paiement après contrôle/);
    // Même formule que la convention tripartite (§ 5).
    expect(b).toMatch(/redeviennent exigibles auprès du Client, qui demeure le débiteur du prix/);
    // Relecture A07 : la dernière phrase cède devant la clause d'abandon…
    expect(b).toMatch(
      /Enfin, sous réserve de la clause « Dédit et abandon en cours d'exécution », en cas de réduction/,
    );
    // … et ne fait pas supporter au Client les manquements d'Axion-IA.
    expect(b).toMatch(
      /sauf lorsque la réduction, la caducité ou le non-paiement résulte d'un manquement d'Axion-IA à ses propres obligations/,
    );
    expect(b).toMatch(/défaut des justificatifs de réalisation qui lui incombent/);
  });

  it("le prix reste exigible, sous réserve de la subrogation de paiement", () => {
    const b = article("fr", TITRE_FR);
    expect(b).toMatch(
      /elle ne modifie ni le prix convenu, ni son exigibilité, sous réserve de la subrogation de paiement prévue ci-après/,
    );
  });

  it("les clauses renvoyées existent bien dans les CGV", () => {
    const titres = CGV.fr.sections.map((s) => s.title);
    expect(titres).toContain("Annulation, report et remboursement");
    expect(titres).toContain("Dédit et abandon en cours d'exécution");
  });
});

describe("CGV — article Financement par un OPCO (EN)", () => {
  it("porte les cinq règles", () => {
    const b = article("en", TITRE_EN);
    expect(b).toMatch(/before the training starts/);
    expect(b).toMatch(/direct payment/);
    expect(b).not.toMatch(/1 October 2026/);
    expect(b).toMatch(/refusal, partial funding or lack of response/);
    expect(b).toMatch(/incomplete file attributable to the Client/);
  });

  it("porte les corrections de la relecture A07", () => {
    const b = article("en", TITRE_EN);
    // Heures effectivement suivies ; abandon = arrêt définitif.
    expect(b).toMatch(
      /hours actually attended by each trainee, as evidenced by the attendance sheet/,
    );
    expect(b).toMatch(/may not be submitted to the OPCO/);
    expect(b).toMatch(/permanent cessation of the trainee's participation in the action/);
    // Manquement d'Axion-IA.
    expect(b).toMatch(/results from a failure by Axion-IA to perform its own obligations/);
    // Exigibilité sous réserve de la subrogation.
    expect(b).toMatch(
      /changes neither the agreed price nor when it falls due, subject to the payment subrogation provided for below/,
    );
    // Aucun renvoi à une clause d'abandon qui n'existe pas en anglais.
    expect(b).not.toMatch(/withdrawal and abandonment|Forfeit and abandonment/i);
  });

  it("les clauses renvoyées existent bien dans la version anglaise", () => {
    const titres = CGV.en.sections.map((s) => s.title);
    expect(titres).toContain("Cancellation, rescheduling and refund");
  });
});

describe("CGV — article OPCO : rien qu'Axion-IA ne puisse tenir", () => {
  // « heures » seul ne peut pas être interdit : l'article DOIT parler des
  // heures réalisées et des heures d'absence. Ce qui est interdit, c'est un
  // délai CHIFFRÉ (« sous 48 h », « 2 jours ouvrés », « dans les 15 jours »).
  const DELAIS = [
    /sous \d+/i,
    /\d+\s*(h|heures?)\b/i,
    /jours? ouvr[ée]s/i,
    /\d+\s*jours?/i,
    /within \d+/i,
    /\d+\s*(hours?|days?|business days?)\b/i,
    /chaque semaine|every week|weekly|hebdomadaire/i,
  ];

  for (const [locale, titre] of [
    ["fr", TITRE_FR],
    ["en", TITRE_EN],
  ] as const) {
    it(`${locale} : aucun délai chiffré promis`, () => {
      const b = article(locale, titre);
      for (const re of DELAIS) expect(b, `motif interdit ${re}`).not.toMatch(re);
    });

    it(`${locale} : aucun médiateur`, () => {
      expect(article(locale, titre)).not.toMatch(/m[ée]diat(eur|or|ion)/i);
    });

    it(`${locale} : ne touche pas aux promesses de reste à charge`, () => {
      const b = article(locale, titre);
      expect(b).not.toMatch(/reste à charge/i);
      expect(b).not.toMatch(/100\s*%/);
    });
  }
});
