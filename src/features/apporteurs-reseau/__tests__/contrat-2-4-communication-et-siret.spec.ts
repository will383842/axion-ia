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
    expect(Number(CONTRAT_VERSION)).toBeGreaterThanOrEqual(2.4);
  });

  it("première page : SIREN puis l'établissement (gabarit), plus de « dont le siège est » pour l'Apporteur", () => {
    expect(T).toContain(
      "{{APPORTEUR_IMMATRICULE}} sous le numéro SIREN {{APPORTEUR_SIREN}}, {{APPORTEUR_ETABLISSEMENT}}{{APPORTEUR_REPRESENTANT}}, ci-après « **l'Apporteur** »",
    );
    expect(T).not.toContain("{{APPORTEUR_SIEGE}}");
  });

  it("article 22 bis (2.8) : licence de marque, texte exact validé par Will, cinq paragraphes", () => {
    const a = article("### Article 22 bis — Communication et image de marque", "### Article 23");
    for (const extrait of [
      "**22 bis.1 — Liberté de communication.** L'Apporteur fait connaître les prestations de la Société s'il le souhaite, par les moyens, sur les supports et au rythme de son choix. Il n'y est jamais tenu et ne soumet aucune communication à l'accord préalable de la Société. Seules s'appliquent les limites des articles 8.2, 8.3 et 22 bis.5.",
      "**22 bis.2 — Licence de marque.** Pour ces communications, la Société concède à l'Apporteur un droit d'usage personnel, non exclusif, gratuit et révocable de sa dénomination et de son logo, pour la durée du contrat.",
      "la charte ne régit que l'usage des signes, et non le contenu, le format ou la méthode de la communication.",
      "**22 bis.3 — Transparence.** Dans ses communications, l'Apporteur se présente comme apporteur d'affaires indépendant, jamais comme salarié ou représentant de la Société.",
      "**22 bis.4 — Retrait de la licence.** La Société peut, par un écrit qui en indique le motif, retirer le droit d'usage de l'article 22 bis.2",
      "au plus tard sous sept jours",
      "Ce retrait ne porte que sur l'usage des signes de la Société ; il n'est ni un avertissement ni une mesure disciplinaire.",
      "**22 bis.5 — Pratiques interdites.** Restent interdits en toutes circonstances l'achat de mots-clés ou de référencement reprenant le nom de la Société, les envois de messages en masse ou automatisés non sollicités, et toute communication relative au compte personnel de formation.",
    ])
      expect(a).toContain(extrait);
    // Plus de délai d'exécution imposé, plus d'obligation de communiquer.
    expect(a).not.toContain("quarante-huit heures");
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

  it("renvois : 22 et 22 bis.4 dans les manquements (11.2), 22 bis dans la garantie (8.5), 22 bis.4 dans la survie (21)", () => {
    expect(article("**11.2**", "**11.3**")).toContain("6.6, 7, 8, 9, 22 ou 22 bis.4,");
    expect(article("**8.5**", "### Article 9")).toContain("aux articles 6, 8, 9, 22 ou 22 bis");
    expect(article("### Article 21 — Survie", "### Article 22")).toContain(
      "20, 22, 22 bis.4 et 23",
    );
  });
});
