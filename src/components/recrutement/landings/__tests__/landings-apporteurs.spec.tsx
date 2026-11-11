/**
 * Landings apporteurs d'affaires (refonte du 09/11/2026) : ce que les six pages promettent au
 * visiteur et aux moteurs, vérifié sur le HTML rendu et sur les données structurées.
 *
 * Les sections sont GÉNÉRÉES depuis les maquettes validées par Williams ; ce test garde ce qui ne
 * doit jamais bouger : une seule offre (la Journée IA), une seule commission indicative, les
 * montants lus dans `pricing.ts`, aucun vocabulaire interdit, tous les boutons vers un endroit
 * qui existe.
 */
import { renderToStaticMarkup } from "react-dom/server";
import type { ImgHTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: ImgHTMLAttributes<HTMLImageElement>) => (
    <img src={String(src)} alt={alt} />
  ),
}));
vi.mock("@/lib/tracking", () => ({ trackFunnel: vi.fn() }));

import { FOUNDER_PERSON_ID } from "@/lib/brand";
import { COMMISSION_FORMATION_PAR_JOURNEE_EUR, JOURNEE_IA_TIER } from "@/content/pricing";
import { ListeFaq, faqPrincipale } from "../faq";
import { faqApporteurs } from "../jsonld";
import { chiffresApporteurs } from "../chiffres";
import { SectionsDossier } from "../SectionsDossier";
import { SectionsPrincipale } from "../SectionsPrincipale";
import { SectionsPub } from "../SectionsPub";

const reel = chiffresApporteurs();
// Les deux états de l'interrupteur R7 : montant publié, montant masqué.
const avec = { ...reel, commissionPublique: true };
const sans = { ...reel, commissionPublique: false };
const p = avec;
const INTERDITS =
  /qualiopi|opco|reste à charge|grenoble|freelance|sans plafond|aucun gain garanti|parrain|recrut|\bposte\b|agent commercial|salarié d'Axion/i;

/** Le texte lu par une personne : balises retirées, espaces normalisés. */
function texte(html: string): string {
  return html
    .replace(/<svg[\s\S]*?<\/svg>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;| | /g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/\s+/g, " ");
}

const rendu = (c: typeof avec) => ({
  principale: renderToStaticMarkup(
    <SectionsPrincipale p={c} faq={<ListeFaq items={faqPrincipale(c)} />} />,
  ),
  pub: renderToStaticMarkup(<SectionsPub p={c} formulaire={<form data-test="lead" />} />),
  annonce: renderToStaticMarkup(<SectionsPub p={c} annonce canal="Vu sur Le Bon Coin" />),
  dossier: renderToStaticMarkup(
    <SectionsDossier p={c} formulaire={<form data-test="dossier" />} />,
  ),
});
const { principale, pub, annonce, dossier } = rendu(avec);
const masque = rendu(sans);
describe("les montants viennent de pricing.ts", () => {
  it("la commission et le prix public sont ceux du barème", () => {
    expect(p.commission.replace(/\s| /g, "")).toBe(`${COMMISSION_FORMATION_PAR_JOURNEE_EUR}€`);
    expect(p.prix.replace(/\s| /g, "")).toBe(`${JOURNEE_IA_TIER.priceFlat}€`);
  });

  it("aucune page n'a laissé un jeton non remplacé", () => {
    for (const html of [principale, pub, annonce, dossier]) {
      expect(html).not.toMatch(/\{p\.|undefined|\[object/);
    }
  });
});

describe("une seule offre, une seule commission", () => {
  it("la page principale dit la Journée IA, son prix et la commission « à titre indicatif »", () => {
    const t = texte(principale);
    expect(t).toContain("Présentez-leur la Journée IA");
    expect(t).toContain(texte(p.prix));
    expect(t).toContain(texte(p.commission));
    expect(t.toLowerCase()).toContain("à titre indicatif");
    expect(t).toContain(
      "si les gains identifiés ne dépassent pas 3 fois le prix de la journée, nous remboursons",
    );
  });

  it("aucun vocabulaire interdit, sur aucune des six surfaces", () => {
    for (const html of [principale, pub, annonce, dossier])
      expect(texte(html)).not.toMatch(INTERDITS);
  });

  it("jamais de « vendue » ni de « sans plafond » : la commission se dit payée", () => {
    for (const html of [principale, pub, annonce, dossier]) {
      expect(texte(html)).not.toMatch(/Journée IA vendue|sans plafond/i);
    }
  });
});

describe("tous les boutons mènent au bon endroit", () => {
  // Les adresses des liens, sans dépendre de la balise (next/link peut être doublé dans les tests) ;
  // les href de préchargement d'image et des icônes ne sont pas des liens.
  const liens = (html: string) =>
    [...html.matchAll(/\bhref="([^"]+)"/g)]
      .map((m) => m[1]!)
      .filter(
        (h) =>
          h.startsWith("/fr") ||
          h.startsWith("/apporteur") ||
          h.startsWith("#c") ||
          h === "#dossier",
      );

  it("la page principale envoie chaque bouton vers le dossier de 3 minutes", () => {
    const boutons = liens(principale).filter((h) => h.includes("candidature"));
    expect(boutons.length).toBeGreaterThanOrEqual(3);
    for (const href of boutons)
      expect(href).toMatch(/^\/fr\/devenir-commercial-ia\/candidature\?depuis=/);
  });

  it("la variante pub garde le formulaire court, la variante annonce envoie au dossier", () => {
    expect(pub).toContain('data-test="lead"');
    expect(pub).toContain('id="contact"');
    expect(annonce).not.toContain('data-test="lead"');
    expect(annonce).not.toContain('id="contact"');
    expect(annonce).toContain("Vu sur Le Bon Coin");
    expect(
      annonce,
      annonce.slice(annonce.indexOf("Vu sur"), annonce.indexOf("Vu sur") + 1200),
    ).toContain("candidature?depuis=annonce-haut");
    expect(annonce).toContain("candidature?depuis=annonce");
  });

  it("le dossier pose le formulaire existant à la place de l'écran de la maquette", () => {
    expect(dossier).toContain('data-test="dossier"');
    expect(dossier).toContain('id="dossier"');
  });

  it("aucun lien ne pointe vers une page supprimée ou une adresse tronquée", () => {
    const connus = new Set([
      "/fr/devenir-commercial-ia",
      "/fr/journee-ia",
      "/fr/equipe/williams",
      "/fr/politique-confidentialite",
      "/apporteur/dossier/retrouver",
      "#contact",
      "#dossier",
    ]);
    for (const html of [principale, pub, annonce, dossier]) {
      for (const href of liens(html)) {
        const sansRequete = href.split("?")[0]!;
        expect(
          connus.has(sansRequete) || sansRequete === "/fr/devenir-commercial-ia/candidature",
          href,
        ).toBe(true);
      }
    }
  });
});

describe("données structurées", () => {
  it("la FAQ est signée par Williams, sans JobPosting ni rémunération balisée", () => {
    const json = JSON.stringify(faqApporteurs(faqPrincipale(p)));
    expect(json).toContain(FOUNDER_PERSON_ID);
    expect(json).not.toMatch(/JobPosting|baseSalary|incentiveCompensation|MonetaryAmount/);
    expect(json).not.toContain("equipe/manon");
  });

  it("la liste visible et le JSON-LD portent les mêmes huit questions", () => {
    const items = faqPrincipale(p);
    expect(items).toHaveLength(8);
    for (const f of items) expect(texte(principale)).toContain(f.question.replace(/\s+/g, " "));
  });
});

describe("règle R7 : le montant de la commission ne sort que si l'interrupteur le publie", () => {
  it("masqué : aucun montant de commission, seul le prix de la Journée IA reste", () => {
    for (const html of Object.values(masque)) {
      const t = texte(html);
      const montants = [...t.matchAll(/d[d ]*(?:[.,]d+)?s*(?:€|euros?)/g)].map((m) => m[0].trim());
      for (const m of montants)
        expect(m.replace(/s/g, ""), m).toBe(texte(reel.prix).replace(/s/g, ""));
      expect(t).not.toMatch(/%/);
    }
    expect(texte(masque.principale)).toContain("Une commission sur chaque Journée IA payée");
  });

  it("masqué : la FAQ et le JSON-LD disent la même chose, sans chiffre", () => {
    const items = faqPrincipale(sans);
    const gagner = items.find((f) => /gagner/.test(f.question));
    expect(gagner?.reponse).toContain("Une commission sur chaque Journée IA payée");
    expect(JSON.stringify(faqApporteurs(items))).not.toContain(texte(reel.commission));
  });

  it("publié : le montant est dit « à titre indicatif »", () => {
    expect(texte(principale)).toContain(texte(reel.commission));
    expect(faqPrincipale(avec).find((f) => /gagner/.test(f.question))?.reponse).toMatch(
      /À titre indicatif/,
    );
  });
});
