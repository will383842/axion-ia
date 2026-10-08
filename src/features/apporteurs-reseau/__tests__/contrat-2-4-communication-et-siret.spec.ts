import { describe, expect, it } from "vitest";

import { CONTRAT_V2_MARKDOWN, CONTRAT_VERSION } from "../contrat-v2";

// Contrat 2.4 (08/10/2026, décision de Will) : SIRET de l'établissement en première page, article
// 22 bis « Communication et image de marque » au TEXTE EXACT validé, article 22 assoupli, renvois
// en 8.5, 11.2 et 21. Aucune clause de perte de commission (option écartée par Will).
const T = CONTRAT_V2_MARKDOWN.replace(/\s+/g, " ");
const article = (titre: string, suivant: string) =>
  T.slice(T.indexOf(titre), T.indexOf(suivant, T.indexOf(titre) + titre.length));

describe("contrat 2.4", () => {
  it("version 2.4 (c'est elle que porte la signature et le PDF archivé)", () => {
    expect(CONTRAT_VERSION).toBe("2.4");
  });

  it("première page : SIREN puis l'établissement (gabarit), plus de « dont le siège est » pour l'Apporteur", () => {
    expect(T).toContain(
      "immatriculé sous le numéro SIREN {{APPORTEUR_SIREN}}, {{APPORTEUR_ETABLISSEMENT}}, ci-après « **l'Apporteur** »",
    );
    expect(T).not.toContain("{{APPORTEUR_SIEGE}}");
  });

  it("article 22 bis : le texte exact validé par Will, cinq paragraphes", () => {
    const a = article("### Article 22 bis — Communication et image de marque", "### Article 23");
    for (const extrait of [
      "**22 bis.1 — Communication autorisée.** L'Apporteur peut faire connaître les prestations de la Société par tout moyen de communication (vidéos, formats courts, publications sur les réseaux sociaux, visuels, publicités, supports imprimés), à condition de respecter la charte de marque remise par la Société (couleurs, typographies, logos, ton et règles de présentation) et les articles 8.2 et 8.3.",
      "**22 bis.2 — Usage de la marque.** Pour ces seules communications, la Société concède à l'Apporteur un droit d'usage personnel, non exclusif, gratuit et révocable de sa dénomination et de son logo, dans les formes prévues par la charte, pour la durée du contrat. Ce droit ne s'étend ni à la modification du logo, ni au dépôt d'une marque ou d'un nom de domaine, ni à la création d'un compte ou d'une page au nom de la Société (article 22).",
      "**22 bis.3 — Qualité et transparence.** Chaque communication est soignée et conforme à l'image de la Société. L'Apporteur s'y présente comme apporteur d'affaires indépendant, jamais comme salarié ou représentant de la Société. Il n'y annonce aucun prix, remise, délai, résultat ou financement (article 8.3), et ne fait aucune affirmation inexacte sur la Société ou ses prestations.",
      "**22 bis.4 — Contrôle de la Société.** La Société peut à tout moment demander la modification ou le retrait d'une communication qu'elle juge non conforme à sa charte ou à son image ; l'Apporteur s'exécute dans les quarante-huit heures, sans indemnité. Elle peut aussi suspendre ou retirer pour l'avenir, par simple écrit, le droit d'usage de l'article 22 bis.2 ; l'Apporteur cesse alors toute communication mentionnant la Société.",
      "**22 bis.5 — Pratiques interdites.** Restent interdits en toutes circonstances l'achat de mots-clés ou de référencement reprenant le nom de la Société, les envois de messages en masse ou automatisés non sollicités, et toute communication relative au compte personnel de formation.",
    ])
      expect(a).toContain(extrait);
    // Option écartée par Will : aucune perte de commission attachée à la communication.
    expect(a).not.toMatch(
      /perte|perd(?:ra)? (?:sa|ses|la) commission|commission[s]? (?:est|sont) perdue/i,
    );
  });

  it("article 22 : assoupli par 22 bis, mais modification, dépôt, compte et fin d'usage intacts", () => {
    const a = article("### Article 22 — Supports de présentation", "### Article 22 bis");
    expect(a).toContain("**Sauf dans les conditions de l'article 22 bis, aucun droit d'usage");
    expect(a).toContain("**en l'état, sans aucune modification**");
    expect(a).toContain("Il ne dépose ni marque, ni nom de domaine");
    expect(a).toContain("ne crée aucun compte sur un service en ligne portant ce nom");
    expect(a).toContain("À la fin du contrat, il cesse tout usage");
  });

  it("renvois : 22 et 22 bis dans les manquements (11.2), 22 bis dans la garantie (8.5), 22 bis.4 dans la survie (21)", () => {
    expect(article("**11.2**", "**11.3**")).toContain("6.6, 7, 8, 9, 22 ou 22 bis,");
    expect(article("**8.5**", "### Article 9")).toContain("aux articles 6, 8, 9, 22 ou 22 bis");
    expect(article("### Article 21 — Survie", "### Article 22")).toContain(
      "20, 22, 22 bis.4 et 23",
    );
  });
});
