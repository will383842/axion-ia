/**
 * 🔴 Trois tournures fautives dans les e-mails des stagiaires et de l'entreprise :
 *  - « J+48 h » (jargon interne) dans l'aperçu du lien d'émargement ;
 *  - « le suivi qualité que nous devons tenir » (obligation interne) dans la relance du
 *    questionnaire ;
 *  - « Il y a un mois, X nous confiait… » (faux : l'enquête part à la fin de la formation).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";
import { HEURES_VALIDITE_LIEN, QualiopiEmargementLienEmail } from "../qualiopi-emargement-lien";
import { QualiopiEnqueteEntrepriseEmail } from "../qualiopi-enquete-entreprise";
import { QualiopiQuestionnaireRelanceEmail } from "../qualiopi-questionnaire-relance";

async function texte(el: React.ReactElement): Promise<string> {
  const html = await render(el);
  return html
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ");
}

const EMARGEMENT = {
  stagiairePrenomNom: "Camille Martin",
  titreFormation: "IA pour les équipes",
  dateDebutFormation: "16 septembre 2026",
  lienEmargement: "https://axion-ia.com/fr/portail/emarger/abc",
  numeroSession: "S-001",
};
const RELANCE = {
  stagiairePrenomNom: "Camille Martin",
  titreFormation: "IA pour les équipes",
  libelleQuestionnaire: "questionnaire à froid",
  lienQuestionnaire: "https://axion-ia.com/fr/q/abc",
};
const ENQUETE = {
  contactNom: "Dominique Durand",
  raisonSociale: "Durand SAS",
  titreFormation: "IA pour les équipes",
  dateFinFormation: "mardi 16 septembre 2026",
  lienEnquete: "https://axion-ia.com/fr/enquete/abc",
  numeroSession: "S-001",
};

const MOTS_INTERDITS = [/qualiopi/i, /aucun gain garanti/i];

describe("textes des stagiaires et de l'entreprise", () => {
  it("émargement : plus de « J+48 h », durée tirée de la constante", async () => {
    const t = await texte(<QualiopiEmargementLienEmail locale="fr" payload={EMARGEMENT} />);
    expect(t).not.toMatch(/J\s?\+\s?48/);
    expect(t).toContain(`${HEURES_VALIDITE_LIEN} heures après la fin de la session`);
    // L'aperçu (pré-en-tête) est dans le HTML, caché : on le lit tel quel.
    const html = await render(<QualiopiEmargementLienEmail locale="fr" payload={EMARGEMENT} />);
    expect(html).not.toMatch(/J\s?\+\s?48/);
    expect(html).toContain(`Valable ${HEURES_VALIDITE_LIEN} h après la fin de la session.`);
    for (const re of MOTS_INTERDITS) expect(html).not.toMatch(re);
  });

  it("la durée du gabarit suit la fenêtre réelle du jeton", () => {
    // Lecture du SOURCE (et non import) : la garde d'isolation interdit à ce dossier
    // d'importer le domaine. La fenêtre est écrite `48 * 60 * 60 * 1000`.
    const src = readFileSync(
      join(process.cwd(), "src/server/qualiopi/emargement/token-service.ts"),
      "utf8",
    );
    const m = /FENETRE_APRES_FIN_MS\s*=\s*(\d+)\s*\*\s*60\s*\*\s*60\s*\*\s*1000/.exec(src);
    expect(m).not.toBeNull();
    expect(Number(m?.[1])).toBe(HEURES_VALIDITE_LIEN);
  });

  it("relance du questionnaire : plus d'obligation interne", async () => {
    const t = await texte(<QualiopiQuestionnaireRelanceEmail locale="fr" payload={RELANCE} />);
    expect(t).not.toMatch(/suivi qualité/i);
    expect(t).not.toMatch(/que nous devons tenir/i);
    expect(t).toContain("améliorer nos formations");
    for (const re of MOTS_INTERDITS) expect(t).not.toMatch(re);
  });

  it("enquête entreprise : plus de « Il y a un mois »", async () => {
    const t = await texte(<QualiopiEnqueteEntrepriseEmail locale="fr" payload={ENQUETE} />);
    expect(t).not.toMatch(/il y a un mois/i);
    expect(t).not.toMatch(/nous confiait/i);
    expect(t).toContain("Durand SAS nous a confié la formation IA pour les équipes");
    expect(t).toContain("achevée le mardi 16 septembre 2026");
    for (const re of MOTS_INTERDITS) expect(t).not.toMatch(re);
  });
});
