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

import { beforeAll, describe, expect, it } from "vitest";
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
  ["salutation-virgule", /\b(?:Bonjour|Bonsoir|Hello|Hi|Dear)\s+[,!]/],
  ["virgule-seule", /(?:^|\s),(?:\s|$)/],
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
  return trouves;
}

type Charge = "vide" | "exemple";
type Rendre = (locale: "fr" | "en", charge: Record<string, unknown>) => Promise<RenduMesure>;

/** Les entrées `gabarit|charge|motif` d'un gabarit, pour un rendu injecté. */
export async function mesurerChampsVides(nom: string, rendre: Rendre): Promise<Set<string>> {
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
      } catch {
        entrees.add(`${nom}|${libelle}|rendu-leve`);
      }
    }
  }
  return entrees;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mesure réelle, une fois pour toute la suite
// ─────────────────────────────────────────────────────────────────────────────

const constat = new Map<string, Set<string>>();

beforeAll(async () => {
  for (const nom of EMAIL_TEMPLATE_NAMES) {
    constat.set(
      nom,
      await mesurerChampsVides(nom, (locale, charge) => renderEmailTemplate(nom, locale, charge)),
    );
  }
}, 240_000);

describe("champs vides : l'état mesuré égale la liste figée, groupe par groupe", () => {
  for (const [groupe, def] of Object.entries(GROUPES)) {
    it(`${groupe} : défauts mesurés = défauts listés (deux sens)`, () => {
      const mesures = def.gabarits.flatMap((n) => [...(constat.get(n) ?? [])]);
      const liste = LISTES[groupe] ?? [];
      const e = ecartCliquet(mesures, liste);
      const message = [
        e.aCorriger.length > 0
          ? `${groupe} : défaut(s) nouveau(x) — corrigez le gabarit, n'ajoutez jamais à la liste :\n  ${e.aCorriger.join("\n  ")}`
          : "",
        e.aRetirer.length > 0
          ? `${groupe} : défaut(s) corrigé(s) mais encore listé(s) — retirez-les de champs-vides/${groupe.toLowerCase()}.ts :\n  ${e.aRetirer.join("\n  ")}`
          : "",
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
  ])("repère %s dans le corps", (motif, html) => {
    expect(motifsDeChampVide(faux(html)).has(motif)).toBe(true);
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
    const sold = ecartCliquet([], ["faux-gabarit|vide|undefined"]);
    expect(sold.aRetirer).toEqual(["faux-gabarit|vide|undefined"]);
  });
});
