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
  planifierFaq,
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
    expect(retirerMontantCta(html)).toEqual({ texte: html, remplacements: 0 });
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
    expect(deux).toEqual({ texte: une.texte, remplacements: 0 });
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
