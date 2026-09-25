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

  // L6, relecture du 2026-09-25 — textes validés par Will, mot pour mot. « Dernier
  // contact » disparaît : seules les actions de la personne comptent, et la
  // politique les nomme (demande, clic, inscription). Mêmes durées que
  // `src/server/newsletter/retention.ts`.
  const CONSERVATION_FR =
    "Conservation : demande du guide, 3 ans après votre dernière demande ou votre dernier clic sur le bouton de téléchargement ; inscription à la lettre, 3 ans après votre inscription, votre dernière demande du guide ou votre dernier clic dans une lettre, sauf désinscription avant ce terme ; après une désinscription, votre adresse est gardée 3 ans, puis seule une empreinte en est conservée, sans limite de durée, pour qu'aucun envoi ne vous parvienne ; adresse en échec de distribution définitif, 3 ans, pour ne plus y écrire ; preuve de l'information ou de votre consentement, 5 ans après la fin de votre inscription ; inscription jamais confirmée (ancien parcours), 30 jours.";
  const CONSERVATION_EN =
    "Retention: guide request, 3 years after your last request or your last click on the download button; newsletter subscription, 3 years after you subscribed, last requested the guide or last clicked in a newsletter, unless you unsubscribe earlier; after an unsubscription, your address is kept for 3 years, then only a fingerprint of it is kept, with no time limit, so that nothing reaches you; address with a permanent delivery failure, 3 years, so that we no longer write to it; proof of information or of your consent, 5 years after your subscription ends; subscription never confirmed (former process), 30 days.";

  it("durées : le texte validé, mot pour mot (FR et EN)", () => {
    const fr = section("fr", /^Guide IA entreprise/);
    expect(fr).toContain(CONSERVATION_FR);
    expect(fr).not.toContain("dernier contact avec nous");
    expect(fr).not.toContain("3 ans en liste d'opposition");
    const en = section("en", /^Enterprise AI guide/);
    expect(en).toContain(CONSERVATION_EN);
    expect(en).not.toContain("last contact with us");
  });

  it("preuve : empreintes de l'adresse e-mail et de l'IP, rien en clair ; plus d'« empreinte non réversible »", () => {
    const fr = section("fr", /^Guide IA entreprise/);
    expect(fr).toContain(
      "Comme preuve, nous conservons la version du texte qui vous a été présenté (la mention d'information, ou le texte de la case), la date de votre demande, une empreinte de votre adresse e-mail et une empreinte de votre adresse IP ; ni l'une ni l'autre n'est gardée en clair.",
    );
    expect(fr).not.toContain("non réversible");
    const en = section("en", /^Enterprise AI guide/);
    expect(en).toContain(
      "As proof, we keep the version of the text you were shown (the information notice, or the text of the box), the date of your request, a fingerprint of your email address and a fingerprint of your IP address; neither is kept in clear.",
    );
    expect(en).not.toContain("non-reversible");
  });

  it("adresse personnelle : le retrait du consentement est annoncé", () => {
    expect(section("fr", /^Guide IA entreprise/)).toContain(
      "(consentement, art. 6.1.a), et vous pouvez retirer votre consentement à tout moment ;",
    );
    expect(section("en", /^Enterprise AI guide/)).toContain(
      "(consent, art. 6.1.a), and you can withdraw your consent at any time;",
    );
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
