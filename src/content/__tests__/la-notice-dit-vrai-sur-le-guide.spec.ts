// @vitest-environment node

/**
 * Verrou — la politique de confidentialité dit ce que fait le formulaire du
 * guide (lot L2, amendement de Will du 24/09).
 *
 * Le commentaire de `legal.ts` citait ce fichier comme garde des durées… et il
 * n'existait pas. Il garde désormais les deux bases de la lettre (intérêt
 * légitime pour une adresse professionnelle, consentement pour une adresse
 * personnelle), la réinscription qui n'est jamais automatique, et les durées.
 * Garde de forme, pas de rédaction.
 */

import { describe, expect, it } from "vitest";

import { LEGAL_PAGES } from "../legal";

function section(locale: "fr" | "en", titre: RegExp): string {
  const page = LEGAL_PAGES.find((p) => p.slug === "politique-confidentialite");
  const corps = page?.[locale].sections.find((s) => titre.test(s.title))?.body;
  expect(corps, `section ${titre} introuvable (${locale})`).toBeTruthy();
  return corps ?? "";
}

describe("la politique dit vrai sur le guide et la lettre", () => {
  it("FR : deux bases pour la lettre, selon la nature de l'adresse", () => {
    const t = section("fr", /^Guide IA entreprise/);
    expect(t).toContain(
      "Adresse professionnelle : vous la recevez aussi, sur la base de notre intérêt légitime",
    );
    expect(t).toContain(
      "Adresse personnelle (messagerie grand public) : vous ne la recevez que si vous avez coché la case prévue à cet effet (consentement, art. 6.1.a)",
    );
    // L'ancien parcours (case pour tous + confirmation) ne doit plus être promis.
    expect(t).not.toContain("puis confirmé votre inscription");
  });

  it("EN : même contenu", () => {
    const t = section("en", /^Enterprise AI guide/);
    expect(t).toContain(
      "Business address: you receive it too, on the basis of our legitimate interest",
    );
    expect(t).toContain(
      "Personal address (consumer webmail): you only receive it if you ticked the dedicated box (consent, art. 6.1.a)",
    );
    expect(t).not.toContain("then confirmed your subscription");
  });

  it("une demande du guide ne réinscrit JAMAIS un désinscrit, et la politique le dit", () => {
    expect(section("fr", /^Guide IA entreprise/)).toContain(
      "une nouvelle demande du guide ne vous réinscrit pas",
    );
    expect(section("en", /^Enterprise AI guide/)).toContain(
      "a new guide request does not resubscribe you",
    );
  });

  it("durées : 3 ans après le dernier contact, 3 ans en liste d'opposition", () => {
    const fr = section("fr", /^Guide IA entreprise/);
    expect(fr).toContain("inscription à la lettre, 3 ans après votre dernier contact avec nous");
    expect(fr).toContain("3 ans en liste d'opposition");
    expect(fr).toContain("demande du guide, 3 ans après votre dernière demande");
  });

  it("la base légale générale cite les deux régimes de la lettre", () => {
    const fr = section("fr", /^Base légale$/);
    expect(fr).toContain("lettre d'information adressée aux adresses professionnelles");
    expect(fr).toContain("lettre d'information adressée aux adresses personnelles");
    const en = section("en", /^Legal basis$/);
    expect(en).toContain("newsletter sent to business addresses");
    expect(en).toContain("newsletter sent to personal addresses");
  });

  it("CRM (lot L4-S) : l'intérêt légitime vise les personnes qui ont demandé le guide, et l'inscription y est reportée", () => {
    const fr = section("fr", /^Guide IA entreprise/);
    expect(fr).toContain(
      "à suivre les échanges avec les personnes qui ont demandé le guide ; vous pouvez vous y opposer à tout moment.",
    );
    expect(fr).toContain(
      "y compris dans notre outil de suivi de la relation client. Votre inscription à la lettre y est aussi reportée, lorsque vous ouvrez le guide ou confirmez votre inscription par le bouton prévu.",
    );
    expect(fr).not.toContain("suivre les échanges avec les professionnels qui s'intéressent");
    const en = section("en", /^Enterprise AI guide/);
    expect(en).toContain(
      "in following up with people who requested the guide; you can object at any time.",
    );
    expect(en).toContain(
      "Your subscription to the letter is also recorded there when you open the guide or confirm your subscription with the button provided.",
    );
    expect(en).not.toContain("following up with professionals interested in our services");
  });

  it("⛔ aucune lettre par ZeptoMail : la politique ne lui prête que l'e-mail du guide", () => {
    expect(section("fr", /^Guide IA entreprise/)).toContain(
      "ZeptoMail, qui achemine l'e-mail du guide ;",
    );
  });
});
