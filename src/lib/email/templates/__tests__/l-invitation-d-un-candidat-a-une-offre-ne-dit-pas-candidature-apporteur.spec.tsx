// 2026-09-28 (Will) — une personne qui a postulé à une OFFRE D'EMPLOI salariée
// (commercial terrain, directeur commercial…) et à qui l'on propose AUSSI le
// réseau d'apporteurs n'a JAMAIS candidaté au réseau. Son invitation ne doit
// pas lui dire « ta candidature apporteur d'affaires est retenue » : c'est faux.
// Elle dit « une autre proposition », différente du poste, et d'où vient son
// adresse (art. 14). Ses rappels J+3 / J+7 aussi.

import { describe, expect, it } from "vitest";
import { renderEmailTemplate } from "../index";
import { marqueDemarche, offreDeLaFiche } from "@/lib/commercial-application/demarche-invitation";

const BASE = { contactName: "Camille Durand", calendlyUrl: "https://calendly.com/axion-ia/x" };
const OFFRE = "Business Developer B2B";

/** Le texte lu par la personne : balises retirées, entités courantes décodées. */
function texte(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;|&#xA0;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

describe("invitation — variante « offre »", () => {
  it("objet unique, qui ne parle pas de candidature apporteur", async () => {
    const r = await renderEmailTemplate("apporteur-invitation-appel", "fr", {
      ...BASE,
      offreEmploi: OFFRE,
    });
    expect(r.subject).toBe("Ta candidature Axion-IA : autre proposition");
    // Borne de 45 du référentiel (§3.4), que le référentiel ne mesure pas ici
    // (son payload d'exemple ne porte pas `offreEmploi`) — ce témoin la tient.
    expect(r.subject.length).toBeLessThanOrEqual(45);
  });

  it("🔴 PRIORITAIRE sur `candidature` : même marquée candidature, elle ne dit pas « retenue »", async () => {
    const r = await renderEmailTemplate("apporteur-invitation-appel", "fr", {
      ...BASE,
      candidature: true,
      variante: 2,
      offreEmploi: OFFRE,
    });
    expect(r.subject).toBe("Ta candidature Axion-IA : autre proposition");
    const t = texte(r.html);
    expect(t).not.toContain("Ta candidature apporteur d'affaires est retenue");
    expect(t).not.toMatch(/candidature apporteur/i);
    expect(t).not.toMatch(/est retenue/);
    expect(t).not.toMatch(/Merci pour ton intérêt/);
  });

  it("dit la vérité : l'offre, la différence avec le poste, la candidature qui suit son cours", async () => {
    const t = texte(
      (
        await renderEmailTemplate("apporteur-invitation-appel", "fr", {
          ...BASE,
          offreEmploi: OFFRE,
        })
      ).html,
    );
    expect(t).toContain("Bonjour Camille,");
    expect(t).toContain(`Merci pour ta candidature à notre offre « ${OFFRE} ».`);
    expect(t).toContain("réseau d'apporteurs d'affaires indépendants partout en France");
    expect(t).toContain("C'est différent du poste auquel tu as postulé");
    expect(t).toContain("rémunéré à la commission");
    expect(t).toContain("Ta candidature au poste, elle, suit son cours normalement.");
    expect(t).toContain("un échange de 15 minutes en visio");
    expect(t).toContain("Sans engagement : à l'issue, chacun décide librement de la suite.");
    expect(t).toContain("Réserver mon créneau");
  });

  it("🔴 après « poste pourvu » (proposition automatique) : ni « suit son cours », ni « profil commercial »", async () => {
    const t = texte(
      (
        await renderEmailTemplate("apporteur-invitation-appel", "fr", {
          ...BASE,
          ...marqueDemarche(
            {
              origine: "candidature-offre-emploi",
              offreTitre: "Data Scientist",
              propositionAuto: "poste-pourvu",
            },
            "x",
          ),
        })
      ).html,
    );
    expect(t).toContain("Merci pour ta candidature à notre offre « Data Scientist ».");
    expect(t).toContain("ce poste est aujourd'hui pourvu");
    expect(t).toContain("rémunéré à la commission");
    expect(t).not.toContain("suit son cours normalement");
    expect(t).not.toContain("profil commercial");
    expect(t).toContain("Réserver mon créneau");
  });

  it("proposition faite à la main (commerciaux) : le texte validé est inchangé", () => {
    expect(
      marqueDemarche({ origine: "candidature-offre-emploi", offreTitre: "BizDev" }, "x"),
    ).toEqual({ offreEmploi: "BizDev" });
  });

  it("porte la provenance de l'adresse et l'information de l'art. 14", async () => {
    const t = texte(
      (
        await renderEmailTemplate("apporteur-invitation-appel", "fr", {
          ...BASE,
          offreEmploi: OFFRE,
        })
      ).html,
    );
    expect(t).toContain(`Tu nous as donné ton adresse en postulant à notre offre « ${OFFRE} ».`);
    expect(t).toMatch(/Qui traite ton adresse/);
    expect(t).toMatch(/réclamation auprès de la CNIL/);
    expect(t).toMatch(/politique de confidentialité/);
  });

  it("porte le kit et la signature du fondateur, sans lien « dossier »", async () => {
    const r = await renderEmailTemplate("apporteur-invitation-appel", "fr", {
      ...BASE,
      offreEmploi: OFFRE,
      // Posé par l'envoi quand le dossier n'est pas arrivé : ignoré dans cette
      // variante, la personne n'a pas candidaté au réseau.
      dossierUrl: "https://axion-ia.com/fr/devenir-commercial-ia/candidature",
    });
    expect(r.html).toMatch(/document de présentation/);
    expect(r.html).toMatch(/catalogue complet/);
    expect(r.html).toContain("Williams Jullin");
    expect(r.html).not.toContain("/devenir-commercial-ia/candidature");
  });

  it("vocabulaire : aucun mot interdit pour le réseau, « poste » seulement pour l'offre salariée", async () => {
    const t = texte(
      (
        await renderEmailTemplate("apporteur-invitation-appel", "fr", {
          ...BASE,
          offreEmploi: OFFRE,
        })
      ).html,
    );
    for (const interdit of [
      /entretien/i,
      /objectif/i,
      /horaire/i,
      /quota/i,
      /il faut/i,
      /obligatoire/i,
      /agent commercial/i,
      /mandataire/i,
    ]) {
      expect(t, String(interdit)).not.toMatch(interdit);
    }
    // Les deux seules occurrences de « poste » désignent l'offre salariée.
    const postes = t.match(/\bposte\b/gi) ?? [];
    expect(postes).toHaveLength(2);
    expect(t).toContain("du poste auquel tu as postulé");
    expect(t).toContain("Ta candidature au poste");
  });

  it("sans titre d'offre : « l'une de nos offres d'emploi », toujours pas « candidature apporteur »", async () => {
    const r = await renderEmailTemplate("apporteur-invitation-appel", "fr", {
      ...BASE,
      offreEmploi: "",
    });
    const t = texte(r.html);
    expect(r.subject).toBe("Ta candidature Axion-IA : autre proposition");
    expect(t).toContain("Merci pour ta candidature à l'une de nos offres d'emploi.");
    expect(t).not.toContain("« »");
  });

  it("témoin : sans `offre`, la variante candidature est inchangée", async () => {
    const r = await renderEmailTemplate("apporteur-invitation-appel", "fr", {
      ...BASE,
      candidature: true,
      variante: 0,
    });
    expect(r.subject).toBe("Ta candidature apporteur d'affaires chez Axion-IA est retenue");
  });

  it("anglais : même structure", async () => {
    const r = await renderEmailTemplate("apporteur-invitation-appel", "en", {
      ...BASE,
      offreEmploi: OFFRE,
    });
    expect(r.subject).toBe("Your application at Axion-IA: another proposal");
    expect(texte(r.html)).toContain(OFFRE);
  });
});

describe("rappels J+3 / J+7 — variante « offre »", () => {
  it("J+3 : ne dit pas « ta candidature est retenue », rappelle l'offre", async () => {
    const r = await renderEmailTemplate("apporteur-invitation-relance", "fr", {
      ...BASE,
      etape: "j3",
      offreEmploi: OFFRE,
    });
    const t = texte(r.html);
    expect(r.subject).not.toMatch(/candidature apporteur/i);
    expect(t).not.toMatch(/est retenue|toujours retenue/);
    expect(t).toContain(`à ta candidature à notre offre « ${OFFRE} »`);
    expect(t).toContain("réseau d'apporteurs d'affaires indépendants");
  });

  it("J+7 : dernier message, la candidature à l'offre n'est pas concernée", async () => {
    const r = await renderEmailTemplate("apporteur-invitation-relance", "fr", {
      ...BASE,
      etape: "j7",
      offreEmploi: OFFRE,
    });
    const t = texte(r.html);
    expect(r.subject).toBe("Dernier rappel : l'échange sur le réseau");
    expect(r.subject.length).toBeLessThanOrEqual(45);
    expect(t).not.toMatch(/est retenue|toujours retenue/);
    expect(t).toContain(`Ta candidature à notre offre « ${OFFRE} », elle, n'est pas concernée`);
  });

  it("témoin : sans `offre`, le rappel d'une candidature reste celui d'origine", async () => {
    const r = await renderEmailTemplate("apporteur-invitation-relance", "fr", {
      ...BASE,
      etape: "j7",
    });
    expect(r.subject).toBe("Dernier rappel : ta candidature apporteur");
  });
});

describe("marqueDemarche — la règle partagée par l'envoi, l'aperçu et les rappels", () => {
  const offreDetails = {
    unifiedType: "recrutement",
    subType: "candidature-commerciale",
    origine: "candidature-offre-emploi",
    offreTitre: `  ${OFFRE} `,
  };

  it("fiche née d'une offre → `offre`, jamais `candidature`", () => {
    expect(marqueDemarche(offreDetails, "abc")).toEqual({ offreEmploi: OFFRE });
    expect(offreDeLaFiche(offreDetails)).toEqual({ offreEmploi: OFFRE });
  });

  it("saisie manuelle → rien ; autre fiche → candidature ; JSON inattendu → candidature, sans lever", () => {
    expect(marqueDemarche({ origine: "saisie-manuelle" }, "abc")).toEqual({});
    expect(marqueDemarche({ subType: "candidature-commerciale" }, "abc")).toMatchObject({
      candidature: true,
    });
    expect(marqueDemarche(null, "abc")).toMatchObject({ candidature: true });
    expect(offreDeLaFiche({ subType: "candidature-commerciale" })).toEqual({});
  });
});
