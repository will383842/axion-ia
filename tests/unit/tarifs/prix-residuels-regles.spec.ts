// Règles du retrait des derniers anciens prix (2026-11) : textes FAQ identiques au seed, CTA
// d'article sans montant, rien d'autre touché, idempotent. Règles pures : aucune base.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ANCIENS_MONTANTS_RE,
  FAQ_CIBLES,
  contientCtaAvecMontant,
  contientMontant,
  ctaSuspects,
  planifierFaq,
  texteJson,
  retirerMontantCta,
  retirerMontantCtaJson,
} from "../../../scripts/tarifs/prix-residuels-regles";

const SEED = readFileSync(resolve(__dirname, "../../../prisma/seed.ts"), "utf8");

/** Lit la chaîne littérale d'une clé (`aFr`/`aEn`) du bloc d'une FAQ du seed. */
function texteSeed(slug: string, cle: "aFr" | "aEn"): string {
  const debut = SEED.indexOf(`slug: "${slug}"`);
  expect(debut).toBeGreaterThan(-1);
  const bloc = SEED.slice(debut, SEED.indexOf("},", debut));
  const iCle = bloc.indexOf(`${cle}:`);
  expect(iCle).toBeGreaterThan(-1);
  const ouvre = bloc.indexOf('"', iCle);
  const ferme = bloc.indexOf('"', ouvre + 1);
  return bloc.slice(ouvre + 1, ferme);
}

describe("FAQ : textes identiques à prisma/seed.ts", () => {
  it.each(FAQ_CIBLES.map((c) => [c.slug, c] as const))("%s", (slug, c) => {
    expect(c.answerFr).toBe(texteSeed(slug, "aFr"));
    expect(c.answerEn).toBe(texteSeed(slug, "aEn"));
  });

  it("n'écrit que si l'ancienne valeur contient un montant", () => {
    const cible = FAQ_CIBLES[0]!;
    const avec = planifierFaq(cible.slug, {
      answerFr: "Un audit coûte 1 990 € HT.",
      answerEn: "An audit costs 1,990 €.",
      metaDescription: "Dès 990 € HT",
    })!;
    expect(avec.ecritures).toEqual({ answerFr: cible.answerFr, answerEn: cible.answerEn });
    expect(avec.aRevoir).toEqual(["meta_description"]);
    const sans = planifierFaq(cible.slug, {
      answerFr: cible.answerFr,
      answerEn: cible.answerEn,
      metaDescription: null,
    })!;
    expect(sans.ecritures).toEqual({});
    expect(
      planifierFaq("autre-slug", { answerFr: "1 € ", answerEn: "", metaDescription: null }),
    ).toBeNull();
  });

  it("l'inventaire reconnaît les anciens montants", () => {
    for (const t of ["290 €", "1 990 €", "1\u202f990 €", "990 €", "50 000 €"])
      expect(ANCIENS_MONTANTS_RE.test(t)).toBe(true);
    expect(ANCIENS_MONTANTS_RE.test("1 490 € HT")).toBe(false);
  });
});

describe("CTA d'article : le montant part, le libellé reste", () => {
  it.each([
    ["Réserver une formation · 2\u202f450 € ", "Réserver une formation "],
    ["Réserver une formation · 2 450 € HT", "Réserver une formation"],
    ["Faire faire par Axion-IA · 1 900 €", "Faire faire par Axion-IA"],
    ["Réserver l'intervention Essentielle · 490 €", "Réserver une formation"],
    ["Réserver l’intervention Essentielle - 490 EUR HT", "Réserver une formation"],
    [
      "Réserver une formation&nbsp;&middot;&nbsp;2&#8239;450&nbsp;&euro; HT",
      "Réserver une formation",
    ],
    ["Faire faire par Axion-IA &ndash; 1&nbsp;900 euros", "Faire faire par Axion-IA"],
  ])("%j", (entree, attendu) => {
    const r = retirerMontantCta(entree);
    expect(r.texte).toBe(attendu);
    expect(r.remplacements).toBe(1);
    expect(contientMontant(r.texte)).toBe(false);
    expect(contientCtaAvecMontant(r.texte)).toBe(false);
  });

  it("ne touche ni un montant hors CTA, ni 12 450 €, ni un href", () => {
    const html =
      '<p>Budget de 12 450 € par an, soit 490 € HT par mois.</p><a href="/fr/appel?ref=Réserver une formation">Lien</a>';
    expect(retirerMontantCta(html)).toEqual({ texte: html, remplacements: 0, fragments: [] });
  });

  it("garde le HTML autour et le reste du texte", () => {
    const html =
      '<a class="cta" href="/fr/appel">Réserver une formation · 2\u202f450 €</a> Suite 490 €.';
    expect(retirerMontantCta(html).texte).toBe(
      '<a class="cta" href="/fr/appel">Réserver une formation</a> Suite 490 €.',
    );
  });

  it("est idempotent", () => {
    const une = retirerMontantCta(
      "Faire faire par Axion-IA · 1 900 € HT et Réserver une formation · 2 450 €",
    );
    expect(une.remplacements).toBe(2);
    const deux = retirerMontantCta(une.texte);
    expect(deux).toEqual({ texte: une.texte, remplacements: 0, fragments: [] });
  });

  it("parcourt un JSON récursivement et épargne les adresses", () => {
    const json = {
      type: "doc",
      content: [
        {
          type: "text",
          text: "Réserver une formation · 2\u202f450 €",
          href: "Faire faire par Axion-IA · 1 900 €",
        },
        [{ label: "Réserver l'intervention Essentielle · 490 €" }],
      ],
      n: 3,
    };
    const r = retirerMontantCtaJson(json);
    expect(r.remplacements).toBe(2);
    expect(r.valeur).toEqual({
      type: "doc",
      content: [
        {
          type: "text",
          text: "Réserver une formation",
          href: "Faire faire par Axion-IA · 1 900 €",
        },
        [{ label: "Réserver une formation" }],
      ],
      n: 3,
    });
    expect(retirerMontantCtaJson(r.valeur).remplacements).toBe(0);
  });
});

describe("garde-fous : seuls les anciens montants partent, le reste est signalé", () => {
  it("ne retire JAMAIS 1 490 € (prix public de la Journée IA) et le signale", () => {
    const t = "Réserver une formation · 1 490 € HT";
    expect(retirerMontantCta(t)).toEqual({ texte: t, remplacements: 0, fragments: [] });
    expect(ctaSuspects(t)).toHaveLength(1);
  });

  it.each([
    ["Réserver une formation — 2 450 €", "Réserver une formation"],
    ["Réserver une formation &mdash; 2 450 €", "Réserver une formation"],
    ["Réserver l&#039;intervention Essentielle · 490 €", "Réserver une formation"],
  ])("reconnaît %j", (entree, attendu) => {
    expect(retirerMontantCta(entree).texte).toBe(attendu);
  });

  it.each([
    "Réserver une formation à partir de 2 450 €",
    "<strong>Réserver une formation</strong> · 2 450 €",
    "Faire faire par Axion-IA · 3 200 €",
  ])("ne réécrit pas une forme inconnue, mais la signale : %j", (t) => {
    expect(retirerMontantCta(t).remplacements).toBe(0);
    expect(ctaSuspects(retirerMontantCta(t).texte)).toHaveLength(1);
  });

  it.each([
    "Réserver une formation : 2&nbsp;450&nbsp;€",
    "Réserver une formation — à partir de 2&#8239;450&nbsp;€",
    "RÉSERVER UNE FORMATION · 2 450 €",
    "R&eacute;server une formation, 2 450 €",
    "Réserver une formation : 2 450 €",
    "Réserver une formation : 2 450 €",
  ])("signale aussi une écriture inhabituelle : %j", (t) => {
    expect(ctaSuspects(retirerMontantCta(t).texte)).toHaveLength(1);
  });

  it("voit un montant dont les espaces sont des entités", () => {
    expect(contientMontant("Dès 1&nbsp;990&nbsp;€ HT")).toBe(true);
    expect(contientMontant("Sur devis.")).toBe(false);
  });

  it("FAQ : un montant écrit avec des entités est réécrit lui aussi", () => {
    const cible = FAQ_CIBLES[0]!;
    const p = planifierFaq(cible.slug, {
      answerFr: "Dès 1&nbsp;990&nbsp;€ HT.",
      answerEn: cible.answerEn,
      metaDescription: null,
    })!;
    expect(p.ecritures).toEqual({ answerFr: cible.answerFr });
  });

  it.each([
    "Réserver l&#x2019;intervention Essentielle · 2 450 €",
    "Réserver <b>une</b> formation · 2 450 €",
  ])("signale une apostrophe rare ou une balise dans le libellé : %j", (t) => {
    expect(ctaSuspects(retirerMontantCta(t).texte)).toHaveLength(1);
  });

  it("ne signale rien quand il n'y a pas de montant derrière le libellé", () => {
    expect(ctaSuspects("Réserver une formation, c'est simple.")).toEqual([]);
    expect(ctaSuspects(null)).toEqual([]);
  });

  it("rend le fragment avant → après et ce qui suit (« / jour »)", () => {
    const r = retirerMontantCta("Réserver une formation · 2 450 € / jour");
    expect(r.fragments).toEqual([
      {
        avant: "Réserver une formation · 2 450 €",
        apres: "Réserver une formation",
        suite: " / jour",
      },
    ]);
  });

  it("un bouton découpé en deux nœuds JSON n'est pas réécrit, mais signalé", () => {
    const json = { content: [{ text: "Réserver une formation" }, { text: " · 2 450 €" }] };
    const r = retirerMontantCtaJson(json);
    expect(r.remplacements).toBe(0);
    expect(ctaSuspects(texteJson(r.valeur), 160)).toHaveLength(1);
  });

  it("FAQ : « from €1,990 » est réécrit ; une réponse différente sans montant est signalée", () => {
    const cible = FAQ_CIBLES[0]!;
    const p = planifierFaq(cible.slug, {
      answerFr: "Texte modifié à la main, sans montant.",
      answerEn: "Audits start from €1,990.",
      metaDescription: null,
    })!;
    expect(p.ecritures).toEqual({ answerEn: cible.answerEn });
    expect(p.aRevoir).toEqual(["answer_fr"]);
  });
});
