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

import { readFileSync } from "node:fs";
import { join } from "node:path";

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

  // 2026-10-07 (Will : « coupe tous les effacements ») — plus aucune durée de
  // suppression : la lettre et le guide ne sont plus purgés par le worker
  // (`retention-purge-worker.ts` n'appelle plus `purgerDesinscrits` ni
  // `purgerLettreEtGuide`). Les durées de 3 ans, 5 ans et 30 jours qui étaient
  // écrites ici, mot pour mot, sont retirées avec la purge.
  const CONSERVATION_FR =
    "Conservation : votre demande du guide, votre inscription à la lettre et la preuve de l'information ou de votre consentement sont conservées pour garder la trace de nos échanges ; elles ne sont pas supprimées automatiquement. Après une désinscription, votre adresse reste conservée pour qu'aucun envoi ne vous parvienne. Vous pouvez à tout moment en demander l'effacement.";
  const CONSERVATION_EN =
    "Retention: your guide request, your newsletter subscription and the proof of information or of your consent are kept to preserve a record of our exchanges; they are not deleted automatically. After an unsubscription, your address remains kept so that nothing reaches you. You may ask for them to be erased at any time.";

  it("conservation : aucune suppression automatique annoncée (FR et EN)", () => {
    const fr = section("fr", /^Guide IA entreprise/);
    expect(fr).toContain(CONSERVATION_FR);
    expect(fr).not.toMatch(/\b\d+ (?:ans|jours)\b/);
    const en = section("en", /^Enterprise AI guide/);
    expect(en).toContain(CONSERVATION_EN);
    expect(en).not.toMatch(/\b\d+ (?:years|days)\b/);
  });

  it("les deux moitiés sont couplées : le worker n'appelle plus les purges de la lettre", () => {
    const worker = readFileSync(
      join(process.cwd(), "src/server/queue/workers/retention-purge-worker.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ \t]*\/\/.*$/gm, "");
    expect(worker).not.toMatch(/purgerDesinscrits\(|purgerLettreEtGuide\(/);
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
