/**
 * Gardes du châssis e-mail — lot S1 « Mesurer et garder » (aucun changement visible).
 *
 * Cinq familles de tests :
 *   1. partition : chaque gabarit du registre appartient à UN groupe, et un seul ;
 *   2. cliquets : pour chaque groupe et chaque règle, l'ensemble des gabarits qui violent la
 *      règle est ÉGAL à la liste figée (deux sens : régression ET dette soldée font rougir) ;
 *   3. gardes sur tous les gabarits : G-salutation-isolee, G-preheader, marqueurs et ordre ;
 *   4. tests du test : de faux gabarits prouvent que les détecteurs rougissent bien ;
 *   5. (ailleurs) la garde « l'information d'abord » de `familles-email.spec.tsx`.
 *
 * La liste des gabarits n'est jamais recopiée ici : elle vient de `EMAIL_TEMPLATE_NAMES`.
 * Les règles sont celles de `emails-site/PLAN-STRUCTURE-ACCUSES.md` §2.2 et §2.4.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { PAYLOAD_EXEMPLE } from "@/server/email/apercu/payloads-exemple";
import { EMAIL_TEMPLATE_NAMES, renderEmailTemplate } from "../index";
import { GROUPES, PREHEADER_DEPUIS_TEXTE_LIBRE } from "./cliquets";
import {
  REGLES,
  corpsHtml,
  corpsParagraphes,
  ecartCliquet,
  fauteOrdre,
  fautePreEnTete,
  lignesSalutationIsolee,
  mesurerGabarit,
  messageCliquet,
  paragraphes,
  preEnTete,
  type Regle,
  type Rendre,
  type Rendu,
} from "./regles-chassis";

const CHARGE: Record<string, unknown> = { ...PAYLOAD_EXEMPLE };

const rendreGabarit =
  (nom: (typeof EMAIL_TEMPLATE_NAMES)[number]): Rendre =>
  (charge, locale) =>
    renderEmailTemplate(nom, locale, charge);

// ─────────────────────────────────────────────────────────────────────────────
// 1. Partition
// ─────────────────────────────────────────────────────────────────────────────

describe("partition des gabarits entre les groupes G1 à G9", () => {
  const tous = Object.entries(GROUPES).flatMap(([g, def]) => def.gabarits.map((n) => [g, n]));

  it("chaque gabarit du registre a un groupe (un gabarit nouveau sans groupe rougit)", () => {
    const classes = new Set(tous.map(([, n]) => n));
    const orphelins = EMAIL_TEMPLATE_NAMES.filter((n) => !classes.has(n));
    expect(
      orphelins,
      `Gabarit(s) sans groupe : ${orphelins.join(", ")}. Ajoutez-le au fichier ` +
        `cliquets/gN.ts du groupe qui lui correspond (plan §2.3), avec ses dettes mesurées.`,
    ).toEqual([]);
  });

  it("aucun groupe ne cite un gabarit inconnu du registre", () => {
    const connus = new Set<string>(EMAIL_TEMPLATE_NAMES);
    const inconnus = tous.filter(([, n]) => !connus.has(n as string)).map(([g, n]) => `${g}:${n}`);
    expect(inconnus).toEqual([]);
  });

  it("les groupes sont disjoints (aucun gabarit dans deux groupes, ni deux fois dans un)", () => {
    const vus = new Map<string, string>();
    const doublons: string[] = [];
    for (const [g, n] of tous) {
      const deja = vus.get(n as string);
      if (deja !== undefined) doublons.push(`${n} (${deja} et ${g})`);
      vus.set(n as string, g as string);
    }
    expect(doublons).toEqual([]);
  });

  it("l'union des groupes égale exactement le registre", () => {
    expect(new Set(tous.map(([, n]) => n))).toEqual(new Set(EMAIL_TEMPLATE_NAMES));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Cliquets à deux sens
// ─────────────────────────────────────────────────────────────────────────────

/** Mesure faite une seule fois pour toute la suite : chaque gabarit est rendu 4 fois (2 langues × 2 charges). */
const mesures = new Map<string, Set<Regle>>();
const rendus = new Map<string, { fr: Rendu; en: Rendu }>();

beforeAll(async () => {
  const exceptions = new Set(
    Object.values(GROUPES).flatMap((g) => g.exceptionsDurees.map((e) => e.gabarit)),
  );
  for (const nom of EMAIL_TEMPLATE_NAMES) {
    const rendre = rendreGabarit(nom);
    mesures.set(nom, await mesurerGabarit(rendre, CHARGE, { delaiTolere: exceptions.has(nom) }));
    rendus.set(nom, { fr: await rendre(CHARGE, "fr"), en: await rendre(CHARGE, "en") });
  }
}, 240_000);

describe("cliquets : l'état mesuré égale la liste figée, règle par règle", () => {
  for (const [groupe, def] of Object.entries(GROUPES)) {
    for (const regle of REGLES) {
      it(`${groupe} · ${regle}`, () => {
        const constat = def.gabarits.filter((n) => mesures.get(n)?.has(regle));
        const e = ecartCliquet(constat, def.dettes[regle]);
        expect(e.aCorriger.length + e.aRetirer.length, messageCliquet(groupe, regle, e)).toBe(0);
        // Une dette ne peut viser qu'un gabarit du groupe : une faute de frappe ne doit pas passer.
        const horsGroupe = def.dettes[regle].filter((n) => !def.gabarits.some((g) => g === n));
        expect(horsGroupe, `${groupe}.${regle} cite des gabarits hors du groupe`).toEqual([]);
      });
    }
    it(`${groupe} · une exception de durée cite sa constante et un gabarit du groupe`, () => {
      for (const ex of def.exceptionsDurees) {
        expect(def.gabarits.some((g) => g === ex.gabarit)).toBe(true);
        expect(ex.constante.trim().length).toBeGreaterThan(0);
      }
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Gardes sur tous les gabarits
// ─────────────────────────────────────────────────────────────────────────────

describe("G-salutation-isolee — aucune salutation seule sur sa ligne, dans aucun corps", () => {
  // Les gabarits non migrés passent par le cliquet `salutationHorsOuverture` : une salutation
  // isolée suppose une salutation dans le corps, donc une inscription à cette liste.
  const dettes = new Set(Object.values(GROUPES).flatMap((g) => g.dettes.salutationHorsOuverture));
  for (const nom of EMAIL_TEMPLATE_NAMES) {
    it(`${nom}`, () => {
      const r = rendus.get(nom);
      expect(r).toBeDefined();
      for (const locale of ["fr", "en"] as const) {
        const isolees = lignesSalutationIsolee(corpsParagraphes(r![locale].html));
        if (isolees.length === 0) continue;
        expect(
          dettes.has(nom),
          `${nom} (${locale}) ouvre sur « ${isolees[0]} » seule sur sa ligne sans figurer dans ` +
            `le cliquet salutationHorsOuverture : corrigez le gabarit.`,
        ).toBe(true);
      }
    });
  }
});

describe("G-preheader — le pré-en-tête ne commence pas par une salutation", () => {
  it("seuls les gabarits listés (texte saisi par une personne) y échouent, et ils y échouent encore", () => {
    const fautifs: string[] = [];
    for (const nom of EMAIL_TEMPLATE_NAMES) {
      const r = rendus.get(nom)!;
      if (fautePreEnTete(r.fr.html) !== null || fautePreEnTete(r.en.html) !== null)
        fautifs.push(nom);
    }
    const e = ecartCliquet(fautifs, PREHEADER_DEPUIS_TEXTE_LIBRE);
    expect(
      e.aCorriger.length + e.aRetirer.length,
      `G-preheader — à corriger : ${e.aCorriger.join(", ") || "rien"} ; ` +
        `à retirer de PREHEADER_DEPUIS_TEXTE_LIBRE : ${e.aRetirer.join(", ") || "rien"}.`,
    ).toBe(0);
  });

  it("tous les gabarits portent un pré-en-tête lisible", () => {
    const sans = EMAIL_TEMPLATE_NAMES.filter((n) => preEnTete(rendus.get(n)!.fr.html) === null);
    expect(sans).toEqual([]);
  });
});

describe("marqueurs du châssis (data-bloc) — présents, connus, dans l'ordre du plan §2.2-3", () => {
  for (const nom of EMAIL_TEMPLATE_NAMES) {
    it(`${nom}`, () => {
      const r = rendus.get(nom)!;
      for (const locale of ["fr", "en"] as const) {
        const { html } = r[locale];
        expect(
          corpsHtml(html),
          `${nom} (${locale}) : repères debut-corps / fin-corps absents`,
        ).not.toBeNull();
        expect(fauteOrdre(html), `${nom} (${locale})`).toBeNull();
      }
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Tests du test — de faux gabarits
// ─────────────────────────────────────────────────────────────────────────────

/** HTML minimal d'un faux gabarit : mêmes repères que le châssis réel. */
function faux(corps: string, options: { preheader?: string; destinataire?: boolean } = {}): Rendu {
  const html =
    `<html><body ${options.destinataire ? 'data-destinataire="client"' : ""}>` +
    `<div style="display:none" data-skip-in-text="true">${options.preheader ?? "Un pré-en-tête neutre."}</div>` +
    `<h1 data-bloc="titre">Titre</h1>` +
    `<span data-bloc="debut-corps" data-skip-in-text="true"></span>${corps}` +
    `<span data-bloc="fin-corps" data-skip-in-text="true"></span>` +
    `<div data-bloc="pied">pied</div></body></html>`;
  return { subject: "Objet", html, text: corps.replace(/<[^>]*>/g, " ") };
}

const rendreFaux =
  (corps: string, options?: Parameters<typeof faux>[1]): Rendre =>
  async () =>
    faux(corps, options);

describe("tests du test — les détecteurs rougissent sur de faux gabarits", () => {
  it("un « Bonjour, » isolé fait rougir G-salutation-isolee et salutationHorsOuverture", async () => {
    const f = faux("<p>Bonjour,</p><p>Votre dossier a bien été reçu et enregistré chez nous.</p>");
    expect(lignesSalutationIsolee(corpsParagraphes(f.html))).toEqual(["Bonjour,"]);
    const v = await mesurerGabarit(rendreFaux("<p>Bonjour,</p><p>Texte.</p>"), {});
    expect(v.has("salutationHorsOuverture")).toBe(true);
  });

  it("une salutation suivie de son information sur la même ligne n'est pas « isolée »", () => {
    const f = faux("<p>Bonjour Camille, nous avons bien reçu votre demande de formation.</p>");
    expect(lignesSalutationIsolee(corpsParagraphes(f.html))).toEqual([]);
  });

  it("un « Bonjour » séparé par <br> est isolé aussi (la coupe se fait sur <br>)", () => {
    const f = faux("<p>Bonjour Camille,<br/>Votre dossier est prêt et vous attend en ligne.</p>");
    expect(lignesSalutationIsolee(corpsParagraphes(f.html))).toEqual(["Bonjour Camille,"]);
  });

  it("« sous 48 heures » fait rougir le cliquet delaiEnDur, et « jours ouvrés » aussi", async () => {
    const v = await mesurerGabarit(rendreFaux("<p>Nous vous répondons sous 48 heures.</p>"), {});
    expect(v.has("delaiEnDur")).toBe(true);
    const w = await mesurerGabarit(rendreFaux("<p>Réponse en deux jours ouvrés.</p>"), {});
    expect(w.has("delaiEnDur")).toBe(true);
    const ok = await mesurerGabarit(rendreFaux("<p>Nous revenons vers vous.</p>"), {});
    expect(ok.has("delaiEnDur")).toBe(false);
  });

  it("une durée justifiée par une constante (exceptionsDurees) n'est pas comptée", async () => {
    const v = await mesurerGabarit(
      rendreFaux("<p>Ce lien est valable dans 24 heures.</p>"),
      {},
      { delaiTolere: true },
    );
    expect(v.has("delaiEnDur")).toBe(false);
  });

  it("détecte signature, « répondez » et vocabulaire dans le corps", async () => {
    const v = await mesurerGabarit(
      rendreFaux(
        "<p>Répondez simplement à cet e-mail. Bien cordialement. Votre email est noté.</p>",
      ),
      {},
    );
    expect(v.has("repondezDansLeCorps")).toBe(true);
    expect(v.has("signatureDansLeCorps")).toBe(true);
    expect(v.has("vocabulaire")).toBe(true);
  });

  it("une adresse e-mail ou une URL ne déclenche pas « vocabulaire »", async () => {
    const v = await mesurerGabarit(
      rendreFaux("<p>Écrivez à email@axion-ia.com ou https://x.fr/email.</p>"),
      {},
    );
    expect(v.has("vocabulaire")).toBe(false);
  });

  it("le nom complet après « Bonjour » fait rougir salutationNomComplet", async () => {
    const rendre: Rendre = async () => ({
      html: faux("<p>x</p>").html,
      text: "Bonjour Camille Dupont, voici",
    });
    const v = await mesurerGabarit(rendre, {});
    expect(v.has("salutationNomComplet")).toBe(true);
  });

  it("une valeur technique lisible dans le texte fait rougir, pas dans un href", async () => {
    const lisible: Rendre = async (charge) =>
      faux(`<p>Référence : ${String(charge.bookingId ?? "")}</p>`);
    const dansHref: Rendre = async (charge) =>
      faux(`<p>Suivez <a href="https://x.fr/${String(charge.bookingId ?? "")}">ce lien</a>.</p>`);
    expect((await mesurerGabarit(lisible, { bookingId: "reel" })).has("valeurTechnique")).toBe(
      true,
    );
    expect((await mesurerGabarit(dansHref, { bookingId: "reel" })).has("valeurTechnique")).toBe(
      false,
    );
  });

  it("nonMigre : absence de data-destinataire", async () => {
    expect((await mesurerGabarit(rendreFaux("<p>x</p>"), {})).has("nonMigre")).toBe(true);
    expect(
      (await mesurerGabarit(rendreFaux("<p>x</p>", { destinataire: true }), {})).has("nonMigre"),
    ).toBe(false);
  });

  it("G-preheader : un pré-en-tête qui commence par « Bonjour » est refusé", () => {
    expect(
      fautePreEnTete(faux("<p>x</p>", { preheader: "Bonjour Camille, votre dossier." }).html),
    ).not.toBeNull();
    expect(
      fautePreEnTete(faux("<p>x</p>", { preheader: "Votre dossier est prêt." }).html),
    ).toBeNull();
    expect(preEnTete(faux("<p>x</p>", { preheader: "Votre dossier est prêt." }).html)).toBe(
      "Votre dossier est prêt.",
    );
  });

  it("G-ordre : un bloc hors d'ordre ou inconnu est refusé", () => {
    expect(fauteOrdre(faux("<p>x</p>").html)).toBeNull();
    const inverse = faux("<p>x</p>").html.replace(
      '<div data-bloc="pied">pied</div>',
      '<div data-bloc="pied">pied</div><div data-bloc="signature">s</div>',
    );
    expect(fauteOrdre(inverse)).toMatch(/hors d'ordre/);
    expect(fauteOrdre('<div data-bloc="nouveau"></div>')).toMatch(/inconnu/);
  });

  it("l'entité apostrophe est décodée et le corps est découpé en paragraphes", () => {
    expect(paragraphes("<p>l&#x27;été</p><p>deux&nbsp;mots</p>")).toEqual(["l'été", "deux mots"]);
  });
});

describe("tests du test — le cliquet rougit dans les deux sens", () => {
  it("un gabarit non listé qui viole la règle : à corriger (régression)", () => {
    const e = ecartCliquet(["faux-gabarit"], []);
    expect(e.aCorriger).toEqual(["faux-gabarit"]);
    expect(messageCliquet("GX", "delaiEnDur", e)).toMatch(/sans être listé/);
  });

  it("un gabarit listé devenu conforme : à retirer de la liste", () => {
    const e = ecartCliquet([], ["faux-gabarit"]);
    expect(e.aRetirer).toEqual(["faux-gabarit"]);
    expect(messageCliquet("GX", "delaiEnDur", e)).toMatch(/retirez-le/);
  });

  it("l'égalité exacte ne produit aucun écart", () => {
    const e = ecartCliquet(["a", "b"], ["b", "a"]);
    expect(e.aCorriger).toEqual([]);
    expect(e.aRetirer).toEqual([]);
  });

  it("les huit règles sont toutes présentes dans chaque fichier de groupe", () => {
    for (const def of Object.values(GROUPES)) {
      expect(Object.keys(def.dettes).sort()).toEqual([...REGLES].sort());
    }
  });
});
