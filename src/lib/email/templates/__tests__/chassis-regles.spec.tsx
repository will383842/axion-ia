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

import { Text } from "@react-email/components";
import { render } from "@react-email/render";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { EMAIL_SIGNATURE } from "../../legal-footer";
import {
  EmailLayout,
  avecDonneesRendu,
  REGIME_FAMILLE,
  type DestinataireEmail,
  type EmailLayoutProps,
  type FamilleEmail,
  type NatureEmail,
} from "../_layout";
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
  blocsPresents,
  paragraphes,
  texteDe,
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

// ═════════════════════════════════════════════════════════════════════════════
// LOT S2 — le châssis par destinataire et par nature, mesuré sur un GABARIT TÉMOIN
// ═════════════════════════════════════════════════════════════════════════════
//
// Aucun gabarit réel n'est migré par S2 : les gardes dures du plan §2.4 se prouvent donc sur un
// gabarit témoin, construit ici, pour CHAQUE destinataire et CHAQUE nature, dans les quatre
// familles et les deux langues. Quand un gabarit réel sera migré (S4 et suivants), les mêmes
// fonctions s'appliqueront à lui.

const DESTINATAIRES: readonly DestinataireEmail[] = [
  "client",
  "apporteur",
  "formateur",
  "stagiaire",
  "candidat",
  "interne",
];
const NATURES: readonly NatureEmail[] = [
  "accuse",
  "relation",
  "rappel",
  "securite",
  "piece",
  "recouvrement",
  "droits",
  "reclamation",
  "information-legale",
  "alerte-interne",
  "marketing",
];
const FAMILLES: readonly FamilleEmail[] = ["A", "B", "C", "D"];

const IDENTITE = { civilite: "monsieur", nomFamille: "Dupont", prenom: "Camille" } as const;
const INFORMATION = "nous avons bien reçu votre demande et nous revenons vers vous.";
const LIEN_OPPOSITION = "https://axion-ia.com/api/unsubscribe?token=op1.jeton-de-test";

interface Option {
  readonly destinataire: DestinataireEmail;
  readonly nature: NatureEmail;
  readonly famille: FamilleEmail;
  readonly locale: "fr" | "en";
  readonly surcharge?: Partial<EmailLayoutProps>;
}

async function rendreTemoin(o: Option): Promise<Rendu> {
  const element = (
    <EmailLayout
      famille={o.famille}
      preview="Un pré-en-tête neutre qui prolonge l'objet sans le répéter."
      title="Demande reçue"
      locale={o.locale}
      destinataire={o.destinataire}
      nature={o.nature}
      {...(o.destinataire === "interne"
        ? {}
        : { ouverture: { identite: IDENTITE, information: INFORMATION } })}
      {...o.surcharge}
    >
      <Text>Le corps du témoin.</Text>
    </EmailLayout>
  );
  return avecDonneesRendu({ oppositionHref: LIEN_OPPOSITION, lienEspace: null }, async () => ({
    html: await render(element, { pretty: false }),
    text: await render(element, { plainText: true }),
  }));
}

const COMBINAISONS: Option[] = DESTINATAIRES.flatMap((destinataire) =>
  NATURES.flatMap((nature) =>
    FAMILLES.flatMap((famille) =>
      (["fr", "en"] as const).map((locale) => ({ destinataire, nature, famille, locale })),
    ),
  ),
);

const temoins = new Map<string, Rendu>();
const cle = (o: Option): string => `${o.destinataire}|${o.nature}|${o.famille}|${o.locale}`;
beforeAll(async () => {
  for (const o of COMBINAISONS) temoins.set(cle(o), await rendreTemoin(o));
}, 120_000);

/** Bloc `data-bloc="signature"` : du repère à la fin de son paragraphe. */
function blocSignature(html: string): string | null {
  const m = /<p[^>]*data-bloc="signature"[^>]*>([\s\S]*?)<\/p>/.exec(html);
  return m ? (m[1] as string) : null;
}
/** Pied : tout ce qui suit le repère `data-bloc="pied"`. */
function pied(html: string): string {
  const i = html.indexOf('data-bloc="pied"');
  return i < 0 ? "" : html.slice(i);
}
const compter = (html: string, bloc: string): number =>
  (html.match(new RegExp(`data-bloc="${bloc}"`, "g")) ?? []).length;
const lienOpposition = (html: string): boolean => html.includes("/api/unsubscribe?token=op1.");

/** Plan §2.2-5 : ce que la signature doit porter pour (destinataire, famille). */
function signatureAttendue(d: DestinataireEmail, f: FamilleEmail) {
  if (d === "interne") return null;
  const pleine = f === "B" || f === "D";
  return {
    positionnement: d === "client" && pleine,
    linkedin: pleine && d !== "stagiaire" && d !== "candidat",
  };
}

/** Plan §2.2-7 et §2.2-8. */
const soupapeAttendue = (o: Option): boolean =>
  REGIME_FAMILLE[o.famille].soupapeReponse &&
  o.destinataire !== "interne" &&
  o.nature !== "securite";
const oppositionAttendue = (o: Option): boolean =>
  o.famille !== "A" &&
  o.destinataire !== "interne" &&
  !["droits", "reclamation", "recouvrement", "alerte-interne"].includes(o.nature);

describe("S2 — gardes dures sur le gabarit témoin (6 destinataires × 11 natures × 4 familles × 2 langues)", () => {
  it("G-ouverture : première phrase lue, salutation ≤ 40 caractères, information sur la même ligne", () => {
    for (const o of COMBINAISONS.filter((c) => c.destinataire !== "interne")) {
      const { html, text } = temoins.get(cle(o))!;
      const m = /<p[^>]*data-bloc="ouverture"[^>]*>([\s\S]*?)<\/p>/.exec(html);
      expect(m, `${cle(o)} : pas d'ouverture`).not.toBeNull();
      const ouverture = texteDe(m![1] as string);
      expect(ouverture, cle(o)).toMatch(/^(Bonjour|Hello)( [^,]{1,40})?, /);
      const info = ouverture.replace(/^(Bonjour|Hello)( [^,]{1,40})?, /, "");
      expect(info.length, cle(o)).toBeGreaterThanOrEqual(30);
      expect(info, cle(o)).toMatch(/^\p{Ll}/u);
      expect((ouverture.match(/\b(Bonjour|Hello)\b/g) ?? []).length, cle(o)).toBe(1);
      // Le grand titre a cédé la place au surtitre ; l'ouverture est la première phrase.
      expect(html, cle(o)).not.toContain('data-bloc="titre"');
      const blocs = blocsPresents(html);
      expect(blocs.indexOf("ouverture"), cle(o)).toBe(blocs.indexOf("surtitre") + 1);
      // Rendu texte : la salutation et le début de l'information tiennent sur UNE ligne.
      const ligne = text.split("\n").find((l) => /^(Bonjour|Hello)\b/.test(l.trim()));
      expect(ligne, `${cle(o)} : ligne d'ouverture introuvable dans le texte`).toBeDefined();
      expect(ligne!, cle(o)).toContain(info.slice(0, 30));
    }
  });

  it("interne : ni ouverture, ni politesse, ni signature, ni soupape, ni lien d'opposition ; grand titre gardé", () => {
    for (const o of COMBINAISONS.filter((c) => c.destinataire === "interne")) {
      const { html } = temoins.get(cle(o))!;
      for (const bloc of ["ouverture", "politesse", "signature", "soupape", "pas-vous"]) {
        expect(compter(html, bloc), `${cle(o)} : ${bloc}`).toBe(0);
      }
      expect(lienOpposition(html), cle(o)).toBe(false);
      expect(html, cle(o)).toContain('data-bloc="titre"');
    }
  });

  it("G-salutation-isolee, G-preheader et G-ordre sur chaque combinaison", () => {
    for (const o of COMBINAISONS) {
      const { html } = temoins.get(cle(o))!;
      expect(lignesSalutationIsolee(paragraphes(html)), cle(o)).toEqual([]);
      expect(fautePreEnTete(html), cle(o)).toBeNull();
      expect(fauteOrdre(html), cle(o)).toBeNull();
    }
  });

  it("G-ordre : le bouton est avant la politesse, la politesse avant la signature", async () => {
    const r = await rendreTemoin({
      destinataire: "client",
      nature: "relation",
      famille: "B",
      locale: "fr",
      surcharge: { cta: { label: "Ouvrir", href: "https://axion-ia.com/fr/x" } },
    });
    const blocs = blocsPresents(r.html);
    expect(blocs.indexOf("action")).toBeGreaterThan(blocs.indexOf("fin-corps"));
    expect(blocs.indexOf("politesse")).toBeGreaterThan(blocs.indexOf("action"));
    expect(blocs.indexOf("signature")).toBeGreaterThan(blocs.indexOf("politesse"));
  });

  it("estampille data-destinataire et data-nature sur le <body>", () => {
    for (const o of COMBINAISONS) {
      const { html } = temoins.get(cle(o))!;
      expect(html, cle(o)).toContain(`data-destinataire="${o.destinataire}"`);
      expect(html, cle(o)).toContain(`data-nature="${o.nature}"`);
      expect(html, cle(o)).toContain(`data-famille="${o.famille}"`);
    }
  });

  it("G-signature : le dessin suit (destinataire, famille) ; jamais de lien de rendez-vous", () => {
    for (const o of COMBINAISONS) {
      const { html } = temoins.get(cle(o))!;
      const attendue = signatureAttendue(o.destinataire, o.famille);
      const bloc = blocSignature(html);
      if (attendue === null) {
        expect(bloc, `${cle(o)} : interne sans signature`).toBeNull();
        continue;
      }
      expect(bloc, `${cle(o)} : signature absente`).not.toBeNull();
      const texte = texteDe(bloc!);
      expect(texte, cle(o)).toContain(EMAIL_SIGNATURE.fullName);
      expect(texte, cle(o)).toContain(
        o.locale === "fr" ? EMAIL_SIGNATURE.roleFr : EMAIL_SIGNATURE.roleEn,
      );
      expect(
        texte.includes(o.locale === "fr" ? "de bout en bout" : "end to end"),
        `${cle(o)} positionnement`,
      ).toBe(attendue.positionnement);
      expect(bloc!.includes("<a "), `${cle(o)} lien de signature`).toBe(attendue.linkedin);
      expect(bloc!, cle(o)).not.toContain("/appel");
      expect(texte, cle(o)).not.toMatch(
        /Prendre rendez-vous|Book a call|L'équipe Axion|Axion-IA team/,
      );
    }
  });

  it("politesse : vouvoiement « Bien cordialement, », apporteur « À bientôt, »", () => {
    for (const o of COMBINAISONS.filter((c) => c.destinataire !== "interne")) {
      const { html } = temoins.get(cle(o))!;
      const m = /<p[^>]*data-bloc="politesse"[^>]*>([\s\S]*?)<\/p>/.exec(html);
      expect(m, `${cle(o)} : politesse absente`).not.toBeNull();
      const attendu =
        o.destinataire === "apporteur"
          ? o.locale === "fr"
            ? "À bientôt,"
            : "Speak soon,"
          : o.locale === "fr"
            ? "Bien cordialement,"
            : "Kind regards,";
      expect(texteDe(m![1] as string), cle(o)).toBe(attendu);
    }
  });

  it("salutation : civilité + nom pour un client, prénom seul pour un apporteur (tutoyé)", async () => {
    const client = temoins.get("client|accuse|B|fr")!;
    expect(texteDe(/data-bloc="ouverture"[^>]*>([\s\S]*?)<\/p>/.exec(client.html)![1]!)).toMatch(
      /^Bonjour Monsieur Dupont, /,
    );
    const apporteur = temoins.get("apporteur|relation|B|fr")!;
    expect(texteDe(/data-bloc="ouverture"[^>]*>([\s\S]*?)<\/p>/.exec(apporteur.html)![1]!)).toMatch(
      /^Bonjour Camille, /,
    );
    const en = temoins.get("client|accuse|B|en")!;
    expect(texteDe(/data-bloc="ouverture"[^>]*>([\s\S]*?)<\/p>/.exec(en.html)![1]!)).toMatch(
      /^Hello Mr Dupont, /,
    );
    // Aucune identité : « Bonjour, », jamais un nom complet ni une civilité devinée.
    const vide = await rendreTemoin({
      destinataire: "client",
      nature: "accuse",
      famille: "B",
      locale: "fr",
      surcharge: { ouverture: { identite: {}, information: INFORMATION } },
    });
    expect(texteDe(/data-bloc="ouverture"[^>]*>([\s\S]*?)<\/p>/.exec(vide.html)![1]!)).toMatch(
      /^Bonjour, nous/,
    );
  });

  it("noms piégés (bit.ly/x, chiffres, @) : « Bonjour, » — aucun texte du visiteur recopié", async () => {
    for (const piege of ["Gagnez un iPhone bit.ly/x", "Jean2", "jean@exemple.fr", "www.promo.fr"]) {
      for (const destinataire of ["client", "apporteur"] as const) {
        const r = await rendreTemoin({
          destinataire,
          nature: "accuse",
          famille: "B",
          locale: "fr",
          surcharge: {
            ouverture: {
              identite: { prenom: piege, nomFamille: piege, civilite: "monsieur" },
              information: INFORMATION,
            },
          },
        });
        const ouverture = texteDe(/data-bloc="ouverture"[^>]*>([\s\S]*?)<\/p>/.exec(r.html)![1]!);
        expect(ouverture, `${destinataire} / ${piege}`).toMatch(/^Bonjour, nous/);
        expect(r.html, piege).not.toContain(piege);
        expect(r.text, piege).not.toContain(piege);
      }
    }
  });

  it("G-pied : la phrase du pied correspond à la nature ; « action sur votre compte » nulle part", () => {
    const PHRASES = {
      fr: {
        securite: "fait suite à une demande faite avec votre adresse",
        document: "Ce document vous est adressé dans le cadre de votre dossier avec Axion-IA",
        droits: "répond à votre demande concernant vos données personnelles",
      },
      en: {
        securite: "follows a request made with your address",
        document: "This document is sent to you as part of your file with Axion-IA",
        droits: "answers your request about your personal data",
      },
    } as const;
    for (const o of COMBINAISONS) {
      const { html, text } = temoins.get(cle(o))!;
      const p = texteDe(pied(html));
      const attendue =
        o.nature === "securite"
          ? "securite"
          : o.nature === "piece" || o.nature === "recouvrement"
            ? "document"
            : o.nature === "droits"
              ? "droits"
              : null;
      for (const k of ["securite", "document", "droits"] as const) {
        expect(p.includes(PHRASES[o.locale][k]), `${cle(o)} : pied « ${k} »`).toBe(attendue === k);
      }
      if (attendue === null)
        expect(p, cle(o)).toContain(o.locale === "fr" ? "Contact :" : "Contact:");
      expect(html + text, cle(o)).not.toMatch(/action sur votre compte|action on your account/);
      expect(html + text, cle(o)).not.toMatch(/Prendre rendez-vous|Book a call/);
    }
  });

  it("G-soupape : exactement une soupape si le régime, le destinataire et la nature le permettent", () => {
    for (const o of COMBINAISONS) {
      expect(compter(temoins.get(cle(o))!.html, "soupape"), cle(o)).toBe(
        soupapeAttendue(o) ? 1 : 0,
      );
    }
  });

  it("G-opposition : le lien selon le §2.2-8 (hors famille A, hors droits, réclamation, recouvrement, alerte, interne)", () => {
    for (const o of COMBINAISONS) {
      expect(lienOpposition(temoins.get(cle(o))!.html), cle(o)).toBe(oppositionAttendue(o));
    }
  });

  it("mention « pas vous » : rendue par le châssis pour la nature accuse, et seulement elle", async () => {
    for (const o of COMBINAISONS) {
      const attendu = o.nature === "accuse" && o.destinataire !== "interne";
      expect(compter(temoins.get(cle(o))!.html, "pas-vous"), cle(o)).toBe(attendu ? 1 : 0);
    }
    const texte = texteDe(
      /data-bloc="pas-vous"[^>]*>([\s\S]*?)<\/p>/.exec(
        temoins.get("client|accuse|B|fr")!.html,
      )![1]!,
    );
    expect(texte).toBe(
      "Si vous n'êtes pas à l'origine de ce message, ignorez-le ou répondez-nous : nous effaçons vos données.",
    );
    const sans = await rendreTemoin({
      destinataire: "client",
      nature: "accuse",
      famille: "B",
      locale: "fr",
      surcharge: { mentionPasVous: false },
    });
    expect(compter(sans.html, "pas-vous")).toBe(0);
  });

  it("G-mots interdits : ni certification, ni « Aucun gain garanti », ni « vous-même », ni Grenoble hors pied", () => {
    for (const o of COMBINAISONS) {
      const { html } = temoins.get(cle(o))!;
      const hors = html.slice(0, html.indexOf('data-bloc="pied"'));
      const texte = texteDe(hors);
      expect(texte, cle(o)).not.toMatch(/Qualiopi|OPCO|prise en charge|financeur|Grenoble/i);
      expect(texte, cle(o)).not.toMatch(/Aucun gain garanti|vous-même/i);
    }
  });

  it("une ouverture mal formée crie hors production (minuscule, 30 caractères, point final)", async () => {
    const erreur = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await rendreTemoin({
        destinataire: "client",
        nature: "accuse",
        famille: "B",
        locale: "fr",
        surcharge: { ouverture: { identite: {}, information: "Trop court" } },
      });
      expect(erreur).toHaveBeenCalledWith(expect.stringMatching(/ouverture mal formée/));
      erreur.mockClear();
      await rendreTemoin({
        destinataire: "client",
        nature: "accuse",
        famille: "B",
        locale: "fr",
      });
      expect(erreur).not.toHaveBeenCalled();
    } finally {
      erreur.mockRestore();
    }
  });

  it("une ouverture donnée à « interne » est ignorée (et signalée hors production)", async () => {
    const erreur = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const r = await rendreTemoin({
        destinataire: "interne",
        nature: "alerte-interne",
        famille: "C",
        locale: "fr",
        surcharge: { ouverture: { identite: IDENTITE, information: INFORMATION } },
      });
      expect(compter(r.html, "ouverture")).toBe(0);
      expect(r.text).not.toContain("Bonjour");
      expect(erreur).toHaveBeenCalled();
    } finally {
      erreur.mockRestore();
    }
  });

  it("deux rendus simultanés ne s'échangent ni salutation ni lien d'opposition", async () => {
    const un = (prenom: string, href: string) =>
      avecDonneesRendu({ oppositionHref: href, lienEspace: null }, async () => {
        const element = (
          <EmailLayout
            famille="B"
            preview="Un pré-en-tête neutre qui prolonge l'objet sans le répéter."
            title="Demande reçue"
            locale="fr"
            destinataire="client"
            nature="accuse"
            ouverture={{ identite: { prenom }, information: INFORMATION }}
          >
            <Text>Corps.</Text>
          </EmailLayout>
        );
        const html = await render(element, { pretty: false });
        await Promise.resolve();
        return html;
      });
    const [a, b] = await Promise.all([
      un("Alice", "https://axion-ia.com/api/unsubscribe?token=op1.aaa"),
      un("Bruno", "https://axion-ia.com/api/unsubscribe?token=op1.bbb"),
    ]);
    expect(a).toContain("Bonjour Alice,");
    expect(a).toContain("op1.aaa");
    expect(a).not.toContain("Bruno");
    expect(a).not.toContain("op1.bbb");
    expect(b).toContain("Bonjour Bruno,");
    expect(b).toContain("op1.bbb");
  });
});

describe("S2 — non-régression : un gabarit qui ne passe pas `destinataire` rend comme avant", () => {
  // Les trois premiers gabarits de cette liste qui ne sont pas encore migrés : le test se
  // déplace tout seul vers d'autres gabarits quand les fiches S4 et suivantes les migrent.
  const CANDIDATS = [
    "contact-confirmed",
    "audit-confirmed",
    "payment-receipt",
    "qualiopi-suivi-j30",
    "roi-report",
    "devis-envoi",
    "gdpr-export-link",
  ] as const;

  it("aucun marqueur du nouveau châssis sur un gabarit non migré (3 gabarits au moins)", () => {
    const nonMigres = CANDIDATS.filter(
      (n) => !rendus.get(n)!.fr.html.includes("data-destinataire="),
    );
    expect(nonMigres.length).toBeGreaterThanOrEqual(3);
    for (const nom of nonMigres) {
      for (const locale of ["fr", "en"] as const) {
        const { html } = rendus.get(nom)![locale];
        expect(html, `${nom} (${locale})`).not.toMatch(/data-nature=|data-destinataire=/);
        for (const bloc of ["ouverture", "politesse", "pas-vous"]) {
          expect(compter(html, bloc), `${nom} (${locale}) : ${bloc}`).toBe(0);
        }
        // Le grand titre et les repères de corps sont ceux d'avant.
        expect(compter(html, "titre"), `${nom} (${locale})`).toBe(1);
        expect(compter(html, "debut-corps"), `${nom} (${locale})`).toBe(1);
      }
    }
  });

  it("légacy : la signature héritée est dessinée comme avant, moins le lien de rendez-vous", async () => {
    const { html } = await avecDonneesRendu(
      { oppositionHref: null, lienEspace: null },
      async () => ({
        html: await render(
          <EmailLayout
            famille="B"
            preview="Un pré-en-tête neutre qui prolonge l'objet sans le répéter."
            title="Titre"
            locale="fr"
            signature="fondateur"
            apresCta={<Text>après-bouton hérité</Text>}
          >
            <Text>corps</Text>
          </EmailLayout>,
          { pretty: false },
        ),
      }),
    );
    const bloc = blocSignature(html)!;
    const texte = texteDe(bloc);
    expect(texte).toContain(EMAIL_SIGNATURE.fullName);
    expect(texte).toContain("de bout en bout");
    expect(texte).toContain("Formation · Coaching 1-to-1");
    expect(bloc).not.toContain("/appel");
    expect(texte).not.toContain("Prendre rendez-vous");
    expect(bloc.match(/<a /g)).toHaveLength(1); // LinkedIn seul
    expect(html).toContain("après-bouton hérité"); // `apresCta` reste honorée hors châssis migré
    expect(blocsPresents(html)).toEqual([
      "titre",
      "debut-corps",
      "fin-corps",
      "soupape",
      "signature",
      "pied",
    ]);
  });

  it("légacy famille A : la phrase « action sur votre compte » est retirée, l'issue est gardée", async () => {
    const { html } = await avecDonneesRendu(
      { oppositionHref: null, lienEspace: null },
      async () => ({
        html: await render(
          <EmailLayout
            famille="A"
            preview="Un pré-en-tête neutre qui prolonge l'objet."
            title="Titre"
            locale="fr"
          >
            <Text>corps</Text>
          </EmailLayout>,
          { pretty: false },
        ),
      }),
    );
    const p = texteDe(pied(html));
    expect(p).not.toContain("action sur votre compte");
    expect(p).toContain("Vous n'êtes pas à l'origine de cette demande ? Écrivez-nous :");
  });

  it("tous les gabarits : aucun lien de rendez-vous en signature, aucune phrase « action sur votre compte »", () => {
    for (const nom of EMAIL_TEMPLATE_NAMES) {
      for (const locale of ["fr", "en"] as const) {
        const { html, text } = rendus.get(nom)![locale];
        expect(html + text, `${nom} (${locale})`).not.toMatch(
          /action sur votre compte|action on your account|utm_content=signature/,
        );
        const bloc = blocSignature(html);
        if (bloc !== null) {
          expect(texteDe(bloc), `${nom} (${locale})`).not.toMatch(
            /Prendre rendez-vous|Book a call/,
          );
          expect(bloc, `${nom} (${locale})`).not.toContain("/appel");
        }
      }
    }
  });
});
