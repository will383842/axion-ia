/**
 * Champs vides — lot L4g (aucun gabarit n'est modifié : on MESURE et on FIGE l'existant).
 *
 * Chaque gabarit est rendu avec une charge vide `{}` puis avec `PAYLOAD_EXEMPLE`, en fr et en en.
 * Le sujet, le corps (balises et feuilles de style retirées) et le texte brut ne doivent contenir
 * ni `undefined`, ni `null`, ni `NaN`, ni `[object Object]`, ni « Bonjour , », ni une virgule seule
 * entre deux blancs. Un rendu qui lève une exception compte aussi (`rendu-leve`).
 *
 * Les défauts d'aujourd'hui sont figés par groupe (`champs-vides/gN.ts`, partition de
 * `cliquets/index.ts`), en LISTES À DEUX SENS : un défaut nouveau rougit ; un défaut corrigé mais
 * encore listé rougit aussi. Les fiches de migration S4 à S11 vident le fichier de leur groupe.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";
import { PAYLOAD_EXEMPLE } from "@/server/email/apercu/payloads-exemple";
import { EMAIL_TEMPLATE_NAMES, renderEmailTemplate } from "../index";
import { GROUPES } from "./cliquets";
import { CHAMPS_VIDES_G1 } from "./champs-vides/g1";
import { CHAMPS_VIDES_G2 } from "./champs-vides/g2";
import { CHAMPS_VIDES_G3 } from "./champs-vides/g3";
import { CHAMPS_VIDES_G4 } from "./champs-vides/g4";
import { CHAMPS_VIDES_G5 } from "./champs-vides/g5";
import { CHAMPS_VIDES_G6 } from "./champs-vides/g6";
import { CHAMPS_VIDES_G7 } from "./champs-vides/g7";
import { CHAMPS_VIDES_G8 } from "./champs-vides/g8";
import { CHAMPS_VIDES_G9 } from "./champs-vides/g9";
import { ecartCliquet, texteDe } from "./regles-chassis";

// Les statistiques d'avis interrogent la base à chaque rendu : on les neutralise (zéro avis, donc
// aucun bandeau d'avis), comme les specs voisines. La mesure ne dépend plus d'une base ni de son
// contenu.
vi.mock("../../review-stats", () => ({
  getPublishedReviewStats: async () => ({ count: 0, avg: 0 }),
}));

const LISTES: Readonly<Record<string, readonly string[]>> = {
  G1: CHAMPS_VIDES_G1,
  G2: CHAMPS_VIDES_G2,
  G3: CHAMPS_VIDES_G3,
  G4: CHAMPS_VIDES_G4,
  G5: CHAMPS_VIDES_G5,
  G6: CHAMPS_VIDES_G6,
  G7: CHAMPS_VIDES_G7,
  G8: CHAMPS_VIDES_G8,
  G9: CHAMPS_VIDES_G9,
};

// ─────────────────────────────────────────────────────────────────────────────
// Détecteur (pur : des chaînes en entrée)
// ─────────────────────────────────────────────────────────────────────────────

const MOTIFS: readonly (readonly [string, RegExp])[] = [
  ["undefined", /\bundefined\b/i],
  ["null", /\bnull\b/i],
  ["NaN", /\bNaN\b/],
  ["objet", /\[object Object\]/],
  ["salutation-virgule", /\b(?:Bonjour|Bonsoir|Hello|Hi|Dear)\s+[,!—–-]/],
  ["virgule-seule", /(?:^|\s),(?:\s|$)/],
  ["parentheses-vides", /\(\s*\)/],
  ["date-invalide", /Invalid Date/],
  // En français l'espace avant « : ; ! ? » est NORMALE : seuls la virgule et le point final sont visés.
  ["espace-avant-virgule", /[^\s,]\s+,/],
  ["espace-avant-point", /[^\s.]\s+\.(?:\s|$)/],
];

/** « Lien vide » : mesuré sur le HTML BRUT (le texte lisible n'a plus les attributs). */
const MOTIFS_HTML_BRUT: readonly (readonly [string, RegExp])[] = [
  [
    "lien-vide",
    /<a(?=[\s>])(?![^>]*\bhref\s*=)|\bhref\s*=\s*(?:""|''|"\s*")|\bhref\s*=\s*"[^"]*\b(?:undefined|null)\b/i,
  ],
];

export interface RenduMesure {
  readonly subject?: string;
  readonly html: string;
  readonly text?: string;
}

/** Les motifs de champ vide présents dans un rendu (sujet, corps lisible, texte brut). */
export function motifsDeChampVide(r: RenduMesure): Set<string> {
  const corps = texteDe(r.html.replace(/<style[\s\S]*?<\/style>/gi, ""));
  const trouves = new Set<string>();
  for (const champ of [r.subject ?? "", corps, r.text ?? ""]) {
    for (const [nom, re] of MOTIFS) if (re.test(champ)) trouves.add(nom);
  }
  for (const [nom, re] of MOTIFS_HTML_BRUT) if (re.test(r.html)) trouves.add(nom);
  return trouves;
}

type Charge = "vide" | "exemple";
type Rendre = (locale: "fr" | "en", charge: Record<string, unknown>) => Promise<RenduMesure>;

/**
 * Les entrées `gabarit|charge|motif` d'un gabarit, pour un rendu injecté. Pour un `rendu-leve`, le
 * texte de l'erreur est consigné dans `erreurs` (charges vides ou fictives : aucune donnée de personne).
 */
export async function mesurerChampsVides(
  nom: string,
  rendre: Rendre,
  erreurs?: Map<string, string>,
): Promise<Set<string>> {
  const entrees = new Set<string>();
  const charges: readonly (readonly [Charge, Record<string, unknown>])[] = [
    ["vide", {}],
    ["exemple", { ...PAYLOAD_EXEMPLE }],
  ];
  for (const [libelle, charge] of charges) {
    for (const locale of ["fr", "en"] as const) {
      try {
        const r = await rendre(locale, charge);
        for (const m of motifsDeChampVide(r)) entrees.add(`${nom}|${libelle}|${m}`);
      } catch (e) {
        const cle = `${nom}|${libelle}|rendu-leve`;
        entrees.add(cle);
        if (erreurs) {
          const ligne = `${locale} : ${String(e)}`;
          const deja = erreurs.get(cle);
          erreurs.set(cle, deja === undefined ? ligne : `${deja} | ${ligne}`);
        }
      }
    }
  }
  return entrees;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mesure réelle, une fois pour toute la suite
// ─────────────────────────────────────────────────────────────────────────────

const constat = new Map<string, Set<string>>();
const erreursLevees = new Map<string, string>();

beforeAll(async () => {
  for (const nom of EMAIL_TEMPLATE_NAMES) {
    constat.set(
      nom,
      await mesurerChampsVides(
        nom,
        (locale, charge) => renderEmailTemplate(nom, locale, charge),
        erreursLevees,
      ),
    );
  }
}, 240_000);

describe("champs vides : l'état mesuré égale la liste figée, groupe par groupe", () => {
  for (const [groupe, def] of Object.entries(GROUPES)) {
    it(`${groupe} : défauts mesurés = défauts listés (deux sens)`, () => {
      const mesures = def.gabarits.flatMap((n) => [...(constat.get(n) ?? [])]);
      const liste = LISTES[groupe] ?? [];
      const e = ecartCliquet(mesures, liste);
      const erreurs = [...erreursLevees].filter(([cle]) => mesures.includes(cle));
      const message = [
        e.aCorriger.length > 0
          ? `${groupe} : défaut(s) nouveau(x) — corrigez le gabarit, n'ajoutez jamais à la liste :\n  ${e.aCorriger.join("\n  ")}`
          : "",
        e.aRetirer.length > 0
          ? `${groupe} : défaut(s) corrigé(s) mais encore listé(s) — retirez-les de champs-vides/${groupe.toLowerCase()}.ts :\n  ${e.aRetirer.join("\n  ")}`
          : "",
        ...erreurs.map(([cle, texte]) => `${cle} → ${texte}`),
      ]
        .filter(Boolean)
        .join("\n");
      expect(e.aCorriger.length + e.aRetirer.length, message).toBe(0);
    });

    it(`${groupe} : la liste ne cite que des gabarits du groupe, sans doublon`, () => {
      const liste = LISTES[groupe] ?? [];
      expect(new Set(liste).size).toBe(liste.length);
      const hors = liste.filter((l) => !def.gabarits.some((g) => g === l.split("|")[0]));
      expect(hors).toEqual([]);
    });
  }

  it("chaque groupe de la partition a sa liste", () => {
    expect(Object.keys(LISTES).sort()).toEqual(Object.keys(GROUPES).sort());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests du test : de faux gabarits prouvent que le détecteur rougit
// ─────────────────────────────────────────────────────────────────────────────

describe("test du test : le détecteur voit les champs vides", () => {
  const faux = (html: string, extra: Partial<RenduMesure> = {}): RenduMesure => ({
    html,
    text: "",
    ...extra,
  });

  it("un gabarit propre ne remonte rien", () => {
    expect(motifsDeChampVide(faux("<p>Bonjour Camille, votre devis est prêt.</p>"))).toEqual(
      new Set(),
    );
  });

  it.each([
    ["undefined", "<p>Référence : undefined</p>"],
    ["null", "<p>Montant : null</p>"],
    ["NaN", "<p>Total : NaN €</p>"],
    ["objet", "<p>Lieu : [object Object]</p>"],
    ["salutation-virgule", "<p>Bonjour , votre devis</p>"],
    ["virgule-seule", "<p>la facture , d'un montant</p>"],
    ["salutation-virgule", "<p>Bonjour — vos stagiaires</p>"],
    ["salutation-virgule", "<p>Hello - your trainees</p>"],
    ["parentheses-vides", "<p>émargé pour ().</p>"],
    ["parentheses-vides", "<p>émargé pour ( ).</p>"],
    ["date-invalide", "<p>Le Invalid Date à 9 h</p>"],
    ["espace-avant-virgule", "<p>Madame Martin , directrice</p>"],
    ["espace-avant-point", "<p>Merci de votre confiance .</p>"],
    ["lien-vide", '<p><a style="x">Ouvrir</a></p>'],
    ["lien-vide", '<a href="">Ouvrir</a>'],
    ["lien-vide", '<a href="https://x.fr/?t=undefined">Ouvrir</a>'],
    ["lien-vide", '<a href="null">Ouvrir</a>'],
  ])("repère %s dans le corps", (motif, html) => {
    expect(motifsDeChampVide(faux(html)).has(motif)).toBe(true);
  });

  it.each([
    ["salutation-virgule", "<p>Bonjour Camille, bienvenue — merci.</p>"],
    ["parentheses-vides", "<p>Durée (7 heures) et (facultatif).</p>"],
    ["date-invalide", "<p>Le 12 novembre 2026 à 9 h</p>"],
    ["espace-avant-virgule", "<p>Merci : voici la suite ; êtes-vous prêt ? Oui !</p>"],
    ["espace-avant-point", "<p>Merci de votre confiance. Total : 12 € ... suite…</p>"],
    ["lien-vide", '<p><abbr>OF</abbr> <a href="https://axion-ia.com/fr" class="b">Ouvrir</a></p>'],
    ["lien-vide", '<a href="mailto:a@b.fr">Écrire</a> <a href="https://x.fr/nullable">x</a>'],
  ])("ne déclenche pas %s sur un contre-exemple sain", (motif, html) => {
    expect(motifsDeChampVide(faux(html)).has(motif)).toBe(false);
  });

  it("repère un défaut dans le sujet seul et dans le texte brut seul", () => {
    expect(motifsDeChampVide(faux("<p>ok</p>", { subject: "Devis undefined" }))).toContain(
      "undefined",
    );
    expect(motifsDeChampVide(faux("<p>ok</p>", { text: "lien ?t=undefined" }))).toContain(
      "undefined",
    );
  });

  it("ne confond pas une feuille de style, ni un mot qui contient le motif", () => {
    expect(
      motifsDeChampVide(faux("<style>a{content:'NaN'}</style><p>Un nullard indéfini</p>")),
    ).toEqual(new Set());
  });

  it("un faux gabarit défectueux produit des entrées, qu'une liste vide laisse rougir", async () => {
    const entrees = await mesurerChampsVides("faux-gabarit", async (_l, charge) => ({
      html: `<p>Bonjour ${String(charge["contactName"])},</p>`,
    }));
    expect([...entrees]).toEqual(["faux-gabarit|vide|undefined"]);
    const e = ecartCliquet(entrees, []);
    expect(e.aCorriger).toEqual(["faux-gabarit|vide|undefined"]);
  });

  it("un rendu qui lève est compté, et une dette soldée est signalée à retirer", async () => {
    const entrees = await mesurerChampsVides("faux-gabarit", async () => {
      throw new Error("champ absent");
    });
    expect(entrees).toEqual(
      new Set(["faux-gabarit|vide|rendu-leve", "faux-gabarit|exemple|rendu-leve"]),
    );
    const erreurs = new Map<string, string>();
    await mesurerChampsVides(
      "faux-gabarit",
      async () => {
        throw new Error("champ absent");
      },
      erreurs,
    );
    expect(erreurs.get("faux-gabarit|vide|rendu-leve")).toBe(
      "fr : Error: champ absent | en : Error: champ absent",
    );
    const sold = ecartCliquet([], ["faux-gabarit|vide|undefined"]);
    expect(sold.aRetirer).toEqual(["faux-gabarit|vide|undefined"]);
  });
});
